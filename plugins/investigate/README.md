# investigate — Cross-Repo Investigation Plugin

# investigate — 跨 Repo 調查 Plugin

---

## What It Does | 功能說明

`/investigate:investigate [topic]` spawns parallel investigation agents across your repos,
each searching for code, configs, PRs, and recent changes. Results are consolidated into
a structured report with cross-repo correlations and recommended actions.

`/investigate:investigate [topic]` 平行派出調查 agent 到你的各個 repo，搜尋程式碼、
設定檔、PR 和近期變更。結果合併為結構化報告，包含跨 repo 關聯分析和建議行動。

**Workflow**: Explore → Decide → Execute

---

## Quick Start | 快速開始

### Step 1: Install plugin | 安裝 plugin

**Local test | 本地測試：**
```bash
claude --plugin-dir ./investigate-plugin
```

**Install permanently | 永久安裝：**
```bash
claude plugin install ./investigate-plugin
```

After install, run `/reload-plugins` to activate.
安裝後執行 `/reload-plugins` 啟動。

### Step 2: First-run configuration | 首次設定

On first use, the plugin automatically creates a configuration file and prompts you to edit it.
首次使用時，plugin 會自動建立設定檔並提示你編輯。

**One file needs your data | 一個檔案需要你的資料：**

**`working-directories.md`** — your repo paths | 你的 repo 路徑

Located at `~/.claude/plugins/data/investigate/context/ (default path)`.
位於 `~/.claude/plugins/data/investigate/context/ (default path)`。

**Builder Prompt | 建構 Prompt** — paste this into Claude to auto-populate:

```
Read my git repos in ~/Projects/ and help me populate
~/.claude/plugins/data/investigate/context/working-directories.md.
For each repo, detect: the GitHub remote (org/repo), main branch name,
and primary language/framework.
```

### Step 3: Verify system requirements | 確認系統需求

| Requirement | Check Command | Why | 說明 |
| ----------- | ------------- | --- | ---- |
| **Claude Code** | `claude --version` | Plugin host | Plugin 平台 |
| **GitHub CLI** | `gh --version` | Agent uses `gh pr list` | Agent 用 `gh` 查 PR |
| **GitHub auth** | `gh auth status` | Must be authenticated | 需要已登入 |
| **git** | `git --version` | Agent uses `git log/blame` | Agent 用 git 分析歷史 |
| **Local clones** | `ls ~/Projects/` | Searches use local files | 搜尋使用本地檔案 |

### Step 4: Run it | 執行

```bash
claude

# In Claude Code (note the namespace prefix):
/investigate:investigate are there any SQL injection risks
/investigate:investigate how does auth work across all services
/investigate:investigate which repos still use deprecated API v1
```

---

## Package Contents | 打包內容

```
investigate-plugin/
├── .claude-plugin/
│   └── plugin.json                             ← Plugin manifest
├── skills/
│   ├── investigate/
│   │   └── SKILL.md                            ← /investigate command
│   └── investigation-report/
│       └── SKILL.md                            ← Report format templates (agent preload)
├── agents/
│   └── cross-repo-investigator.md              ← Per-repo investigation agent
├── templates/
│   └── working-directories.md                  ← Config template (copied on first run)
├── hooks/
│   └── hooks.json                              ← SessionStart: auto-init config files
├── scripts/
│   └── init-context.sh                         ← First-run initializer script
└── README.md                                   ← You are here
```

## File Dependency Map | 檔案依賴圖

```
/investigate:investigate (skills/investigate/SKILL.md)
  ├── reads: ${CLAUDE_PLUGIN_DATA}/context/working-directories.md
  ├── spawns: cross-repo-investigator (agents/)
  │   ├── tools: Bash, Read, Glob, Grep
  │   ├── preloads: investigation-report (skills/investigation-report/)
  │   └── uses: gh CLI, git CLI
  ├── hooks: SessionStart → scripts/init-context.sh
  │   └── copies: templates/ → ${CLAUDE_PLUGIN_DATA}/context/
  └── output: investigations/YYYY-MM-DD-[topic].md
```

---

## Output Directory | 輸出目錄

Reports save to `investigations/` in your project root.
報告存到專案根目錄的 `investigations/`。

```bash
mkdir -p investigations/
```

---

## Usage Examples | 使用範例

```
/investigate:investigate RLS policy configuration across all services
/investigate:investigate are there any hardcoded API keys or credentials
/investigate:investigate how does error handling work across backend services
/investigate:investigate which repos still use lodash — focus on frontend
/investigate:investigate memory leaks — also check ~/Projects/legacy-api/
```

---

## Plugin Configuration | 設定方式

### Config files (PLUGIN_DATA) | 設定檔

| File | Path | Purpose | 用途 |
| ---- | ---- | ------- | ---- |
| `working-directories.md` | `~/.claude/plugins/data/investigate/context/ (default path)` | Repo paths | Repo 路徑 |

**To reconfigure | 重新設定：**
```bash
rm -rf ~/.claude/plugins/data/investigate/context/
# Next /investigate run will re-initialize from templates
```

These files **survive plugin updates** — your configuration is preserved.
這些檔案**不受 plugin 更新影響** — 你的設定會保留。

---

## Plugin Management | 管理

```bash
# Update | 更新
claude plugin update investigate

# Disable | 停用
claude plugin disable investigate

# Uninstall (removes PLUGIN_DATA too) | 移除（也刪除 PLUGIN_DATA）
claude plugin uninstall investigate

# Uninstall but keep config | 移除但保留設定
claude plugin uninstall investigate --keep-data
```

---

## Optional Enhancements | 可選強化

| Feature | Purpose | 用途 | Effort |
| ------- | ------- | ---- | ------ |
| `email-drafting` skill | Draft escalation emails from findings | 從發現草擬 email | Medium |
| Operations logging | Track investigation history | 追蹤調查歷史 | Low |
| `/status` command | Quick PR overview across repos | 快速 PR 總覽 | Low |

---

## Customization | 自訂設定

### Change agent model | 更改 Agent 模型

Edit `agents/cross-repo-investigator.md` frontmatter:
```yaml
model: sonnet    # Default | 預設
model: opus      # Deeper analysis | 更深入分析
model: haiku     # Quick scans | 快速掃描
```

### Restrict agent tools | 限制 Agent 工具

Edit `agents/cross-repo-investigator.md`:
```yaml
allowed-tools:
  - Read        # Read-only mode | 僅唯讀模式
  - Glob
  - Grep
```

---

## Troubleshooting | 疑難排解

| Issue | Solution | 解決方案 |
| ----- | -------- | -------- |
| "No repos found" | Edit `working-directories.md` in PLUGIN_DATA | 編輯 PLUGIN_DATA 中的設定檔 |
| "gh: not found" | `brew install gh && gh auth login` | 安裝 GitHub CLI |
| Config not initialized | Delete PLUGIN_DATA/context/ and retry | 刪除 context 目錄重試 |
| Agent returns empty | Verify repo cloned at specified path | 確認 repo 已 clone |
| Plugin not loading | `claude plugin validate ./investigate-plugin` | 驗證 plugin 結構 |

---

## Distribution Guide | 發布指南

This section covers all methods to distribute the `investigate` plugin to others.
本節涵蓋所有將 `investigate` plugin 發布給他人的方法。

> **Important namespace note | 重要命名空間說明:**
> After installation, skills are invoked with the plugin namespace prefix:
> `/investigate:investigate [topic]` — NOT `/investigate [topic]`.
>
> 安裝後，skill 需要使用 plugin 命名空間前綴來呼叫：
> `/investigate:investigate [topic]` — 不是 `/investigate [topic]`。

> **After any install method | 任何安裝方式之後:**
> Run `/reload-plugins` inside Claude Code to activate.
> 在 Claude Code 中執行 `/reload-plugins` 來啟動。

> **Test before sharing | 分享前測試:**
> ```bash
> claude --plugin-dir ./investigate-plugin
> ```

---

### Method 1: GitHub (Recommended) | 方法一：GitHub（推薦）

The recommended way to distribute. Push to GitHub and others install directly.
推薦的發布方式。推送到 GitHub 後，其他人直接安裝。

**Step 1: Push to GitHub | 推送到 GitHub**

```bash
cd investigate-plugin
git remote add origin git@github.com:<your-username>/investigate-plugin.git
git push -u origin main
```

**Step 2: Others install | 其他人安裝**

```bash
claude plugin install github:<your-username>/investigate-plugin
```

Replace `<your-username>` with your GitHub username (e.g., `github:emilwu/investigate-plugin`).
將 `<your-username>` 替換為你的 GitHub 使用者名稱（例如 `github:emilwu/investigate-plugin`）。

**Step 3 (Optional): Register as a marketplace plugin | 註冊為 marketplace plugin**

Create `.claude-plugin/marketplace.json` in the repo:
在 repo 中建立 `.claude-plugin/marketplace.json`：

```json
{
  "plugins": [
    {
      "name": "investigate",
      "description": "Cross-repo investigation workflow — spawn parallel investigators per repo, consolidate findings.",
      "repo": "github:<your-username>/investigate-plugin",
      "version": "1.0.0"
    }
  ]
}
```

This allows discovery via marketplace commands.
這可以讓 plugin 透過 marketplace 指令被發現。

---

### Method 2: Local Directory | 方法二：本地目錄

Share the plugin as a zip, tarball, or git clone. Best for quick sharing or offline use.
將 plugin 以 zip、tarball 或 git clone 方式分享。適合快速分享或離線使用。

**Option A: Share as zip/tar | 以 zip/tar 分享**

```bash
# Create archive | 建立壓縮檔
tar -czf investigate-plugin.tar.gz --exclude='.git' investigate-plugin/
# or | 或
zip -r investigate-plugin.zip investigate-plugin/ -x '*.git*'
```

**Option B: Git clone | Git clone**

```bash
git clone git@github.com:<your-username>/investigate-plugin.git
```

**Install from local directory | 從本地目錄安裝**

```bash
# Permanent install | 永久安裝
claude plugin install ./investigate-plugin

# Or test without installing | 或不安裝直接測試
claude --plugin-dir ./investigate-plugin
```

---

### Method 3: Team Distribution | 方法三：團隊發布

Add the plugin to your team's project settings so teammates are auto-prompted to install.
將 plugin 加入團隊的專案設定，讓隊友自動收到安裝提示。

**Add to project `.claude/settings.json`:**
加入專案的 `.claude/settings.json`：

```json
{
  "extraKnownMarketplaces": [
    "github:<your-username>/investigate-plugin"
  ]
}
```

When teammates open the project and trust the settings, they will be prompted to install the plugin.
當隊友開啟專案並信任設定後，會自動收到安裝 plugin 的提示。

**Alternatively, teammates can install directly | 或者隊友可以直接安裝：**

```bash
claude plugin install github:<your-username>/investigate-plugin
```

---

### Method 4: Create a Marketplace | 方法四：建立 Marketplace

Host a marketplace that lists this plugin alongside others. Useful if you maintain multiple plugins.
建立一個 marketplace 來列出此 plugin 和其他 plugin。適合維護多個 plugin 的情境。

**Step 1: Create a marketplace repo | 建立 marketplace repo**

Create a new repo (e.g., `my-claude-plugins`) with a `marketplace.json` at the root:
建立一個新 repo（例如 `my-claude-plugins`），在根目錄放 `marketplace.json`：

```json
{
  "name": "My Plugin Marketplace",
  "description": "Curated Claude Code plugins",
  "plugins": [
    {
      "name": "investigate",
      "description": "Cross-repo investigation workflow",
      "repo": "github:<your-username>/investigate-plugin",
      "version": "1.0.0"
    }
  ]
}
```

**Step 2: Others add your marketplace | 其他人加入你的 marketplace**

```bash
claude marketplace add github:<your-username>/my-claude-plugins
```

**Step 3: Browse and install from marketplace | 瀏覽並從 marketplace 安裝**

```bash
claude marketplace list
claude plugin install investigate
```

---

### Distribution Quick Reference | 發布快速參考

| Method | Install Command | Best For | 適用場景 |
| ------ | --------------- | -------- | -------- |
| GitHub | `claude plugin install github:user/investigate-plugin` | Public sharing | 公開分享 |
| Local | `claude plugin install ./investigate-plugin` | Quick test / offline | 快速測試 / 離線 |
| Team | Add to `.claude/settings.json` | Team-wide adoption | 團隊內部推廣 |
| Marketplace | `claude marketplace add github:user/my-plugins` | Multi-plugin catalog | 多 plugin 目錄 |

**Common commands after install | 安裝後常用指令：**

```bash
# Reload plugins | 重新載入 plugins
/reload-plugins

# Verify installation | 驗證安裝
/investigate:investigate test query

# Update plugin | 更新 plugin
claude plugin update investigate

# Uninstall | 移除
claude plugin uninstall investigate
```
