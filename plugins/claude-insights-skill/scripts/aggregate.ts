/**
 * aggregate.ts
 *
 * Takes SessionMeta[] + optional SessionFacets[], aggregates into AggregatedData.
 * Includes multi-clauding detection. Pure computation, no LLM needed.
 *
 * Usage:
 *   node dist/scripts/aggregate.js --metas path/to/session-metas.json [--facets path/to/facets.json] [--output path]
 */

import { readFile, writeFile, mkdir } from 'fs/promises'
import { dirname } from 'path'
import type { SessionMeta, SessionFacets, AggregatedData } from './types.js'

// ============================================================================
// Args
// ============================================================================

function parseArgs(): { metasPath: string; facetsPath: string | null; output: string | null } {
  const args = process.argv.slice(2)
  let metasPath = ''
  let facetsPath: string | null = null
  let output: string | null = null

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--metas' && args[i + 1]) { metasPath = args[i + 1]!; i++ }
    else if (args[i] === '--facets' && args[i + 1]) { facetsPath = args[i + 1]!; i++ }
    else if (args[i] === '--output' && args[i + 1]) { output = args[i + 1]!; i++ }
  }

  if (!metasPath) {
    console.error('Usage: aggregate.js --metas <path> [--facets <path>] [--output <path>]')
    process.exit(1)
  }
  return { metasPath, facetsPath, output }
}

// ============================================================================
// Multi-Clauding Detection
// ============================================================================

export function detectMultiClauding(
  sessions: Array<{ session_id: string; user_message_timestamps: string[] }>,
): { overlap_events: number; sessions_involved: number; user_messages_during: number } {
  const OVERLAP_WINDOW_MS = 30 * 60000
  const allMessages: Array<{ ts: number; sessionId: string }> = []

  for (const session of sessions) {
    for (const timestamp of session.user_message_timestamps) {
      try {
        allMessages.push({ ts: new Date(timestamp).getTime(), sessionId: session.session_id })
      } catch { /* skip */ }
    }
  }

  allMessages.sort((a, b) => a.ts - b.ts)

  const pairSet = new Set<string>()
  const msgsDuring = new Set<string>()
  let windowStart = 0
  const sessionLastIndex = new Map<string, number>()

  for (let i = 0; i < allMessages.length; i++) {
    const msg = allMessages[i]!

    while (windowStart < i && msg.ts - allMessages[windowStart]!.ts > OVERLAP_WINDOW_MS) {
      const expiring = allMessages[windowStart]!
      if (sessionLastIndex.get(expiring.sessionId) === windowStart) {
        sessionLastIndex.delete(expiring.sessionId)
      }
      windowStart++
    }

    const prevIndex = sessionLastIndex.get(msg.sessionId)
    if (prevIndex !== undefined) {
      for (let j = prevIndex + 1; j < i; j++) {
        const between = allMessages[j]!
        if (between.sessionId !== msg.sessionId) {
          const pair = [msg.sessionId, between.sessionId].sort().join(':')
          pairSet.add(pair)
          msgsDuring.add(`${allMessages[prevIndex]!.ts}:${msg.sessionId}`)
          msgsDuring.add(`${between.ts}:${between.sessionId}`)
          msgsDuring.add(`${msg.ts}:${msg.sessionId}`)
          break
        }
      }
    }

    sessionLastIndex.set(msg.sessionId, i)
  }

  const sessionsWithOverlaps = new Set<string>()
  for (const pair of pairSet) {
    const parts = pair.split(':')
    if (parts[0]) sessionsWithOverlaps.add(parts[0])
    if (parts[1]) sessionsWithOverlaps.add(parts[1])
  }

  return {
    overlap_events: pairSet.size,
    sessions_involved: sessionsWithOverlaps.size,
    user_messages_during: msgsDuring.size,
  }
}

// ============================================================================
// Aggregation
// ============================================================================

function safeEntries<V>(obj: Record<string, V> | undefined | null): [string, V][] {
  return obj ? Object.entries(obj) : []
}

function safeKeys(obj: Record<string, unknown> | undefined | null): string[] {
  return obj ? Object.keys(obj) : []
}

export function aggregateData(
  sessions: SessionMeta[],
  facets: Map<string, SessionFacets>,
): AggregatedData {
  const result: AggregatedData = {
    total_sessions: sessions.length,
    sessions_with_facets: facets.size,
    date_range: { start: '', end: '' },
    total_messages: 0,
    total_duration_hours: 0,
    total_input_tokens: 0,
    total_output_tokens: 0,
    tool_counts: {},
    languages: {},
    git_commits: 0,
    git_pushes: 0,
    projects: {},
    goal_categories: {},
    outcomes: {},
    satisfaction: {},
    helpfulness: {},
    session_types: {},
    friction: {},
    success: {},
    session_summaries: [],
    total_interruptions: 0,
    total_tool_errors: 0,
    tool_error_categories: {},
    user_response_times: [],
    median_response_time: 0,
    avg_response_time: 0,
    sessions_using_task_agent: 0,
    sessions_using_mcp: 0,
    sessions_using_web_search: 0,
    sessions_using_web_fetch: 0,
    total_lines_added: 0,
    total_lines_removed: 0,
    total_files_modified: 0,
    days_active: 0,
    messages_per_day: 0,
    message_hours: [],
    multi_clauding: { overlap_events: 0, sessions_involved: 0, user_messages_during: 0 },
  }

  const dates: string[] = []
  const allResponseTimes: number[] = []
  const allMessageHours: number[] = []

  for (const session of sessions) {
    dates.push(session.start_time)
    result.total_messages += session.user_message_count
    result.total_duration_hours += session.duration_minutes / 60
    result.total_input_tokens += session.input_tokens
    result.total_output_tokens += session.output_tokens
    result.git_commits += session.git_commits
    result.git_pushes += session.git_pushes
    result.total_interruptions += session.user_interruptions
    result.total_tool_errors += session.tool_errors

    for (const [cat, count] of Object.entries(session.tool_error_categories)) {
      result.tool_error_categories[cat] = (result.tool_error_categories[cat] || 0) + count
    }
    allResponseTimes.push(...session.user_response_times)

    if (session.uses_task_agent) result.sessions_using_task_agent++
    if (session.uses_mcp) result.sessions_using_mcp++
    if (session.uses_web_search) result.sessions_using_web_search++
    if (session.uses_web_fetch) result.sessions_using_web_fetch++

    result.total_lines_added += session.lines_added
    result.total_lines_removed += session.lines_removed
    result.total_files_modified += session.files_modified
    allMessageHours.push(...session.message_hours)

    for (const [tool, count] of Object.entries(session.tool_counts)) {
      result.tool_counts[tool] = (result.tool_counts[tool] || 0) + count
    }
    for (const [lang, count] of Object.entries(session.languages)) {
      result.languages[lang] = (result.languages[lang] || 0) + count
    }
    if (session.project_path) {
      result.projects[session.project_path] = (result.projects[session.project_path] || 0) + 1
    }

    const sf = facets.get(session.session_id)
    if (sf) {
      for (const [cat, count] of safeEntries(sf.goal_categories)) {
        if (count > 0) result.goal_categories[cat] = (result.goal_categories[cat] || 0) + count
      }
      result.outcomes[sf.outcome] = (result.outcomes[sf.outcome] || 0) + 1
      for (const [level, count] of safeEntries(sf.user_satisfaction_counts)) {
        if (count > 0) result.satisfaction[level] = (result.satisfaction[level] || 0) + count
      }
      result.helpfulness[sf.claude_helpfulness] = (result.helpfulness[sf.claude_helpfulness] || 0) + 1
      result.session_types[sf.session_type] = (result.session_types[sf.session_type] || 0) + 1
      for (const [type, count] of safeEntries(sf.friction_counts)) {
        if (count > 0) result.friction[type] = (result.friction[type] || 0) + count
      }
      if (sf.primary_success !== 'none') {
        result.success[sf.primary_success] = (result.success[sf.primary_success] || 0) + 1
      }
    }

    if (result.session_summaries.length < 50) {
      result.session_summaries.push({
        id: session.session_id.slice(0, 8),
        date: session.start_time.split('T')[0] || '',
        summary: session.summary || session.first_prompt.slice(0, 100),
        goal: sf?.underlying_goal,
      })
    }
  }

  // Date range
  dates.sort()
  result.date_range.start = dates[0]?.split('T')[0] || ''
  result.date_range.end = dates[dates.length - 1]?.split('T')[0] || ''

  // Response time stats
  result.user_response_times = allResponseTimes
  if (allResponseTimes.length > 0) {
    const sorted = [...allResponseTimes].sort((a, b) => a - b)
    result.median_response_time = sorted[Math.floor(sorted.length / 2)] || 0
    result.avg_response_time = allResponseTimes.reduce((a, b) => a + b, 0) / allResponseTimes.length
  }

  // Days active
  const uniqueDays = new Set(dates.map(d => d.split('T')[0]))
  result.days_active = uniqueDays.size
  result.messages_per_day = result.days_active > 0
    ? Math.round((result.total_messages / result.days_active) * 10) / 10
    : 0

  result.message_hours = allMessageHours
  result.multi_clauding = detectMultiClauding(sessions)

  // Filter out warmup-only sessions from facets
  const substantiveFacets = new Map<string, SessionFacets>()
  for (const [id, f] of facets) {
    const cats = safeKeys(f.goal_categories).filter(k => (f.goal_categories[k] ?? 0) > 0)
    const isMinimal = cats.length === 1 && cats[0] === 'warmup_minimal'
    if (!isMinimal) substantiveFacets.set(id, f)
  }
  result.sessions_with_facets = substantiveFacets.size

  return result
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const { metasPath, facetsPath, output } = parseArgs()

  const metasRaw = JSON.parse(await readFile(metasPath, 'utf-8'))
  const sessions: SessionMeta[] = metasRaw.sessions || metasRaw

  let facets = new Map<string, SessionFacets>()
  if (facetsPath) {
    try {
      const facetsArr: SessionFacets[] = JSON.parse(await readFile(facetsPath, 'utf-8'))
      for (const f of facetsArr) {
        facets.set(f.session_id, f)
      }
    } catch (err) {
      console.error(`Warning: could not load facets from ${facetsPath}:`, err)
    }
  }

  const aggregated = aggregateData(sessions, facets)
  aggregated.total_sessions_scanned = metasRaw.total_scanned || sessions.length

  const jsonOutput = JSON.stringify(aggregated, null, 2)

  if (output) {
    await mkdir(dirname(output), { recursive: true })
    await writeFile(output, jsonOutput, 'utf-8')
    console.error(`Aggregated data written to ${output}`)
  } else {
    process.stdout.write(jsonOutput)
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
