/**
 * scan-sessions.ts
 *
 * Scans ~/.claude/projects/ for session .jsonl files, parses each one,
 * and outputs SessionMeta[] as JSON. Pure I/O + computation, no LLM needed.
 *
 * Usage:
 *   node dist/scripts/scan-sessions.js [options]
 *
 * Options:
 *   --max N          Maximum sessions to process (default: 200)
 *   --output path    Write output to file instead of stdout
 *   --cache-dir dir  Directory for SessionMeta cache (default: output/cache/session-meta)
 *   --project name   Filter by project (fuzzy match on directory name, e.g. "Pedal-Web-Service")
 *   --days N         Only include sessions from the last N days
 */

import { readdir, readFile, stat, mkdir, writeFile } from 'fs/promises'
import { join, extname, basename, dirname } from 'path'
import { homedir } from 'os'
import { diffLines } from 'diff'
import type { SessionMeta, LogMessage, ContentBlock } from './types.js'
import { EXTENSION_TO_LANGUAGE } from './types.js'

// ============================================================================
// Config
// ============================================================================

const CLAUDE_CONFIG_DIR = process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude')
const PROJECTS_DIR = join(CLAUDE_CONFIG_DIR, 'projects')

type ScanArgs = {
  max: number
  output: string | null
  cacheDir: string
  project: string | null
  days: number | null
}

function parseArgs(): ScanArgs {
  const args = process.argv.slice(2)
  let max = 200
  let output: string | null = null
  let cacheDir = join(process.cwd(), 'output', 'cache', 'session-meta')
  let project: string | null = null
  let days: number | null = null

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--max' && args[i + 1]) {
      max = parseInt(args[i + 1]!, 10)
      i++
    } else if (args[i] === '--output' && args[i + 1]) {
      output = args[i + 1]!
      i++
    } else if (args[i] === '--cache-dir' && args[i + 1]) {
      cacheDir = args[i + 1]!
      i++
    } else if (args[i] === '--project' && args[i + 1]) {
      project = args[i + 1]!
      i++
    } else if (args[i] === '--days' && args[i + 1]) {
      days = parseInt(args[i + 1]!, 10)
      i++
    }
  }
  return { max, output, cacheDir, project, days }
}

// ============================================================================
// Session File Discovery
// ============================================================================

type SessionFileInfo = {
  sessionId: string
  path: string
  mtime: number
  size: number
  projectDir: string
}

async function discoverSessionFiles(projectFilter: string | null, daysFilter: number | null): Promise<SessionFileInfo[]> {
  const results: SessionFileInfo[] = []
  const cutoffMs = daysFilter ? Date.now() - daysFilter * 24 * 60 * 60 * 1000 : 0

  let projectDirs: string[]
  try {
    const entries = await readdir(PROJECTS_DIR, { withFileTypes: true })
    projectDirs = entries
      .filter(e => e.isDirectory())
      .filter(e => {
        if (!projectFilter) return true
        // Fuzzy match: directory name contains the filter string (case-insensitive)
        const dirName = e.name.toLowerCase()
        const filter = projectFilter.toLowerCase()
        return dirName.includes(filter)
      })
      .map(e => join(PROJECTS_DIR, e.name))
  } catch {
    console.error(`Cannot read projects directory: ${PROJECTS_DIR}`)
    return []
  }

  if (projectFilter && projectDirs.length === 0) {
    console.error(`No project directories match "${projectFilter}"`)
    console.error(`Available projects:`)
    try {
      const entries = await readdir(PROJECTS_DIR, { withFileTypes: true })
      for (const e of entries.filter(e => e.isDirectory())) {
        console.error(`  ${e.name}`)
      }
    } catch { /* ignore */ }
    return []
  }

  if (projectFilter) {
    console.error(`Matched project directories: ${projectDirs.map(d => basename(d)).join(', ')}`)
  }

  for (const projectDir of projectDirs) {
    try {
      const files = await readdir(projectDir)
      for (const file of files) {
        if (!file.endsWith('.jsonl')) continue
        const filePath = join(projectDir, file)
        const sessionId = basename(file, '.jsonl')
        try {
          const fileStat = await stat(filePath)
          // Time filter: skip sessions older than cutoff
          if (daysFilter && fileStat.mtimeMs < cutoffMs) continue
          results.push({
            sessionId,
            path: filePath,
            mtime: fileStat.mtimeMs,
            size: fileStat.size,
            projectDir: basename(projectDir),
          })
        } catch {
          // Skip unreadable files
        }
      }
    } catch {
      // Skip unreadable directories
    }
  }

  // Sort by mtime descending (most recent first)
  results.sort((a, b) => b.mtime - a.mtime)
  return results
}

// ============================================================================
// JSONL Parsing
// ============================================================================

function parseSessionJsonl(content: string): LogMessage[] {
  const messages: LogMessage[] = []
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      const parsed = JSON.parse(trimmed)
      if (parsed && parsed.type && parsed.message) {
        messages.push(parsed as LogMessage)
      }
    } catch {
      // Skip malformed lines
    }
  }
  return messages
}

// ============================================================================
// Stats Extraction
// ============================================================================

function getLanguageFromPath(filePath: string): string | null {
  const ext = extname(filePath).toLowerCase()
  return EXTENSION_TO_LANGUAGE[ext] || null
}

function countChar(str: string, ch: string): number {
  let count = 0
  for (const c of str) {
    if (c === ch) count++
  }
  return count
}

function isHumanMessage(content: unknown): boolean {
  if (typeof content === 'string' && content.trim()) return true
  if (Array.isArray(content)) {
    for (const block of content) {
      if (block.type === 'text' && 'text' in block) return true
    }
  }
  return false
}

function extractSessionMeta(
  sessionId: string,
  messages: LogMessage[],
  projectPath: string,
): SessionMeta | null {
  if (messages.length === 0) return null

  // Determine timestamps
  const firstTimestamp = messages[0]?.timestamp
  const lastTimestamp = messages[messages.length - 1]?.timestamp

  if (!firstTimestamp || !lastTimestamp) return null

  const startTime = new Date(firstTimestamp)
  const endTime = new Date(lastTimestamp)
  if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) return null

  const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 1000 / 60)

  // Accumulators
  const toolCounts: Record<string, number> = {}
  const languages: Record<string, number> = {}
  let gitCommits = 0
  let gitPushes = 0
  let inputTokens = 0
  let outputTokens = 0
  let userInterruptions = 0
  const userResponseTimes: number[] = []
  let toolErrors = 0
  const toolErrorCategories: Record<string, number> = {}
  let usesTaskAgent = false
  let usesMcp = false
  let usesWebSearch = false
  let usesWebFetch = false
  let linesAdded = 0
  let linesRemoved = 0
  const filesModified = new Set<string>()
  const messageHours: number[] = []
  const userMessageTimestamps: string[] = []
  let lastAssistantTimestamp: string | null = null
  let userMessageCount = 0
  let assistantMessageCount = 0
  let firstPrompt = ''

  for (const msg of messages) {
    const msgTimestamp = msg.timestamp

    // --- Assistant messages ---
    if (msg.type === 'assistant' && msg.message) {
      assistantMessageCount++
      if (msgTimestamp) lastAssistantTimestamp = msgTimestamp

      const usage = msg.message.usage
      if (usage) {
        inputTokens += usage.input_tokens || 0
        outputTokens += usage.output_tokens || 0
      }

      const content = msg.message.content
      if (Array.isArray(content)) {
        for (const block of content as ContentBlock[]) {
          if (block.type === 'tool_use' && 'name' in block) {
            const toolName = block.name
            toolCounts[toolName] = (toolCounts[toolName] || 0) + 1

            if (toolName === 'Agent' || toolName === 'Task') usesTaskAgent = true
            if (toolName.startsWith('mcp__')) usesMcp = true
            if (toolName === 'WebSearch') usesWebSearch = true
            if (toolName === 'WebFetch') usesWebFetch = true

            const input = 'input' in block ? block.input : undefined
            if (input) {
              const filePath = (input.file_path as string) || ''
              if (filePath) {
                const lang = getLanguageFromPath(filePath)
                if (lang) languages[lang] = (languages[lang] || 0) + 1
                if (toolName === 'Edit' || toolName === 'Write') {
                  filesModified.add(filePath)
                }
              }

              if (toolName === 'Edit') {
                const oldString = (input.old_string as string) || ''
                const newString = (input.new_string as string) || ''
                for (const change of diffLines(oldString, newString)) {
                  if (change.added) linesAdded += change.count || 0
                  if (change.removed) linesRemoved += change.count || 0
                }
              }

              if (toolName === 'Write') {
                const writeContent = (input.content as string) || ''
                if (writeContent) linesAdded += countChar(writeContent, '\n') + 1
              }

              const command = (input.command as string) || ''
              if (command.includes('git commit')) gitCommits++
              if (command.includes('git push')) gitPushes++
            }
          }
        }
      }
    }

    // --- User messages ---
    if (msg.type === 'user' && msg.message) {
      const content = msg.message.content
      const isHuman = isHumanMessage(content)

      if (isHuman) {
        userMessageCount++
        if (!firstPrompt) {
          if (typeof content === 'string') {
            firstPrompt = content.slice(0, 200)
          } else if (Array.isArray(content)) {
            for (const block of content) {
              if (block.type === 'text' && 'text' in block) {
                firstPrompt = (block.text as string).slice(0, 200)
                break
              }
            }
          }
        }

        if (msgTimestamp) {
          try {
            const msgDate = new Date(msgTimestamp)
            messageHours.push(msgDate.getHours())
            userMessageTimestamps.push(msgTimestamp)
          } catch { /* skip */ }
        }

        if (lastAssistantTimestamp && msgTimestamp) {
          const assistantTime = new Date(lastAssistantTimestamp).getTime()
          const userTime = new Date(msgTimestamp).getTime()
          const responseTimeSec = (userTime - assistantTime) / 1000
          if (responseTimeSec > 2 && responseTimeSec < 3600) {
            userResponseTimes.push(responseTimeSec)
          }
        }
      }

      // Tool errors
      if (Array.isArray(content)) {
        for (const block of content as ContentBlock[]) {
          if (block.type === 'tool_result' && block.is_error) {
            toolErrors++
            let category = 'Other'
            const resultContent = block.content
            if (typeof resultContent === 'string') {
              const lower = resultContent.toLowerCase()
              if (lower.includes('exit code')) category = 'Command Failed'
              else if (lower.includes('rejected') || lower.includes("doesn't want")) category = 'User Rejected'
              else if (lower.includes('string to replace not found') || lower.includes('no changes')) category = 'Edit Failed'
              else if (lower.includes('modified since read')) category = 'File Changed'
              else if (lower.includes('exceeds maximum') || lower.includes('too large')) category = 'File Too Large'
              else if (lower.includes('file not found') || lower.includes('does not exist')) category = 'File Not Found'
            }
            toolErrorCategories[category] = (toolErrorCategories[category] || 0) + 1
          }
        }
      }

      // Interruptions
      const contentStr = typeof content === 'string' ? content : ''
      if (contentStr.includes('[Request interrupted by user')) {
        userInterruptions++
      } else if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'text' && 'text' in block && (block.text as string).includes('[Request interrupted by user')) {
            userInterruptions++
            break
          }
        }
      }
    }
  }

  // Filter out meta-sessions (insights' own API calls logged as sessions)
  if (firstPrompt.includes('RESPOND WITH ONLY A VALID JSON OBJECT') || firstPrompt.includes('record_facets')) {
    return null
  }

  return {
    session_id: sessionId,
    project_path: projectPath,
    start_time: startTime.toISOString(),
    duration_minutes: durationMinutes,
    user_message_count: userMessageCount,
    assistant_message_count: assistantMessageCount,
    tool_counts: toolCounts,
    languages,
    git_commits: gitCommits,
    git_pushes: gitPushes,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    first_prompt: firstPrompt,
    user_interruptions: userInterruptions,
    user_response_times: userResponseTimes,
    tool_errors: toolErrors,
    tool_error_categories: toolErrorCategories,
    uses_task_agent: usesTaskAgent,
    uses_mcp: usesMcp,
    uses_web_search: usesWebSearch,
    uses_web_fetch: usesWebFetch,
    lines_added: linesAdded,
    lines_removed: linesRemoved,
    files_modified: filesModified.size,
    message_hours: messageHours,
    user_message_timestamps: userMessageTimestamps,
  }
}

// ============================================================================
// Cache
// ============================================================================

async function loadCachedMeta(cacheDir: string, sessionId: string): Promise<SessionMeta | null> {
  try {
    const content = await readFile(join(cacheDir, `${sessionId}.json`), 'utf-8')
    return JSON.parse(content) as SessionMeta
  } catch {
    return null
  }
}

async function saveCachedMeta(cacheDir: string, meta: SessionMeta): Promise<void> {
  try {
    await mkdir(cacheDir, { recursive: true })
    await writeFile(
      join(cacheDir, `${meta.session_id}.json`),
      JSON.stringify(meta, null, 2),
      'utf-8',
    )
  } catch {
    // Ignore cache write errors
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const { max, output, cacheDir, project, days } = parseArgs()

  // Log filter info
  const filters: string[] = []
  if (project) filters.push(`project="${project}"`)
  if (days) filters.push(`last ${days} days`)
  const filterDesc = filters.length > 0 ? ` (${filters.join(', ')})` : ''

  console.error(`Scanning sessions in ${PROJECTS_DIR}${filterDesc}...`)
  const sessionFiles = await discoverSessionFiles(project, days)
  console.error(`Found ${sessionFiles.length} session files, processing up to ${max}...`)

  const metas: SessionMeta[] = []
  const toProcess = sessionFiles.slice(0, max)

  for (const sessionFile of toProcess) {
    // Try cache first
    const cached = await loadCachedMeta(cacheDir, sessionFile.sessionId)
    if (cached) {
      // Even for cached metas, apply time filter on start_time
      if (days) {
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        if (new Date(cached.start_time) < cutoff) continue
      }
      metas.push(cached)
      continue
    }

    // Parse session
    try {
      const content = await readFile(sessionFile.path, 'utf-8')
      const messages = parseSessionJsonl(content)
      const meta = extractSessionMeta(
        sessionFile.sessionId,
        messages,
        sessionFile.projectDir,
      )
      if (meta && meta.user_message_count >= 2 && meta.duration_minutes >= 1) {
        metas.push(meta)
        await saveCachedMeta(cacheDir, meta)
      }
    } catch {
      // Skip unreadable sessions
    }
  }

  // Deduplicate: keep the branch with most user messages per session_id
  const bestBySession = new Map<string, SessionMeta>()
  for (const meta of metas) {
    const existing = bestBySession.get(meta.session_id)
    if (
      !existing ||
      meta.user_message_count > existing.user_message_count ||
      (meta.user_message_count === existing.user_message_count &&
        meta.duration_minutes > existing.duration_minutes)
    ) {
      bestBySession.set(meta.session_id, meta)
    }
  }

  const deduplicated = [...bestBySession.values()]
    .sort((a, b) => b.start_time.localeCompare(a.start_time))

  console.error(`Processed ${deduplicated.length} substantive sessions (${sessionFiles.length} total scanned)`)

  const result = {
    total_scanned: sessionFiles.length,
    filter: {
      project: project || null,
      days: days || null,
      generated_at: new Date().toISOString().split('T')[0],
    },
    sessions: deduplicated,
  }

  const jsonOutput = JSON.stringify(result, null, 2)

  if (output) {
    await mkdir(dirname(output), { recursive: true })
    await writeFile(output, jsonOutput, 'utf-8')
    console.error(`Output written to ${output}`)
  } else {
    process.stdout.write(jsonOutput)
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
