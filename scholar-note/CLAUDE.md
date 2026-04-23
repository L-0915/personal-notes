# ScholarNote — CLAUDE.md

> 个人学术文献管理和笔记桌面软件（中文界面）
> Electron 41 + React 19 + TypeScript + SQLite + Vite

---

## 用户需求（来自用户本人）

这是用户明确要求的功能，**必须全部实现**：

1. **中文界面** — 整个软件所有 UI 文字必须是中文（按钮、菜单、提示、状态栏等）
2. **可编辑的 Markdown 笔记** — 左侧编辑器（CodeMirror），右侧实时预览（GitHub 风格渲染）
3. **自动检测修改的 Markdown 文件** — 监控 vault 目录，发现新文件或修改自动更新
4. **导入论文** — 粘贴 URL/DOI，自动从学术 API（arXiv、CrossRef、Semantic Scholar）获取元数据（标题、作者、引用数）、下载 PDF、生成笔记
5. **导入本地 Markdown 笔记** — 选择本地的 .md 文件导入到 vault 中
6. **笔记中链接本地文件** — 在 Markdown 中写 `[文件](D:\path\to\file.pdf)`，点击用系统默认程序打开任意本地文件
7. **Mermaid 图表** — 在 Markdown 中嵌入 Mermaid 代码块，渲染论文关系图
8. **标签系统** — 给笔记打标签，按标签筛选
9. **星级评分** — 1-5 星
10. **全文搜索** — 搜索笔记标题、摘要、笔记内容
11. **深色/浅色主题** — 一键切换
12. **键盘快捷键** — Ctrl+N 新建等
13. **打包成桌面软件** — Windows（NSIS 安装包）、macOS（DMG）、Linux（AppImage）
14. **LaTeX 数学公式** — 用 KaTeX 渲染
15. **自动检测 URL/DOI** — 在笔记中粘贴 arXiv 链接、DOI 等，自动检测并提示获取元数据

---

## 当前实现状态（2026-04-18）

### 已实现（全部功能完整）

| 功能 | 状态 | 说明 |
|------|------|------|
| Electron 窗口启动 | ✅ 已实现 | vite-plugin-electron, 开发模式可运行 |
| CodeMirror 编辑器 | ✅ 已实现 | 左侧编辑器，支持 Markdown 语法高亮 |
| Markdown 实时预览 | ✅ 已实现 | markdown-it 渲染 + mermaid 图表 + kaTeX |
| 分栏布局 | ✅ 已实现 | 可拖拽调整左右分栏宽度 |
| 本地文件链接 | ✅ 已实现 | 预览中点击任意本地文件链接，用系统默认程序打开（不限于 PDF，不限于 vault 内） |
| 论文元数据抓取 | ✅ 已实现 | arXiv/CrossRef/Semantic Scholar 三个源 |
| 自动检测 URL/DOI | ✅ 已实现 | 编辑器中粘贴论文链接自动提示，一键获取元数据 |
| SQLite 数据库 | ✅ 已实现 | papers/authors/tags 表 + FTS5 全文索引 |
| 安全模型 | ✅ 已实现 | 上下文隔离、XSS 防护 |
| 打包配置 | ✅ 已实现 | electron-builder NSIS 安装包，输出到 D:\notes\ScholarNote-Release\ |
| 深色/浅色主题 | ✅ 已实现 | CSS 变量切换 |
| 标签筛选 | ✅ 已实现 | 按标签过滤文件列表 |
| 星级评分 | ✅ 已实现 | 1-5 星组件 |
| YAML frontmatter | ✅ 已实现 | gray-matter 解析/序列化 |
| URL/DOI 导入论文 | ✅ 已实现 | ImportDialog 粘贴 URL/DOI |
| 中文界面 | ✅ 已实现 | 所有 UI 文字均为中文 |
| 笔记自动保存 | ✅ 已实现 | 编辑器 onChange 1秒防抖自动写入磁盘 |
| 导入本地 Markdown | ✅ 已实现 | ImportDialog "本地导入" 标签页 |
| 搜索连接后端 | ✅ 已实现 | SearchBar 300ms 防抖 → dbSearchPapers |
| 新建空白笔记 | ✅ 已实现 | 侧边栏 + 按钮创建 |
| 文件监视启动 | ✅ 已实现 | App.tsx 启动 watcher，监听 file:changed/added |
| 笔记删除 | ✅ 已实现 | 鼠标悬停显示删除按钮 + 确认对话框 |
| 设置页面 | ✅ 已实现 | 通用/编辑器/快捷键/帮助/关于 五个标签页，Ctrl+, 打开 |
| 默认存储路径 | ✅ 已实现 | D:\ScholarNote，D 盘不可用时回退到用户文档目录 |
| 笔记模板 | ✅ 已实现 | 默认论文笔记模板（摘要/主要贡献/方法/个人笔记/相关论文） |
| 键盘快捷键 | ✅ 已实现 | Ctrl+N 导入、Ctrl+, 设置 |

### 已移除（用户明确不需要）

| 功能 | 原因 |
|------|------|
| 阅读状态（待读/在读/已读） | 用户：这是个人笔记软件，不需要阅读状态管理 |
| 引用生成（BibTeX/GB/T 7714） | 用户：不需要引用功能 |
| 导入本地 PDF | 用户：不需要导入 PDF，只需链接到本地文件 |

---

## 待完善功能建议

参考 MarginNote、ReadCube Papers、Obsidian、Logseq 等文献笔记软件，以下功能可以显著提升体验，按优先级排列：

### 高优先级（日常使用最需要）

1. **笔记排序** — 支持按标题、修改日期、创建日期、评分排序（当前无法排序）
2. **回收站** — 删除笔记先移到回收站，支持恢复，防止误删（当前删除是永久的）
3. **笔记间双向链接** — `[[笔记标题]]` 语法实现笔记间跳转，预览中点击可直接打开对应笔记。类似 Obsidian 的核心功能，方便建立论文间的知识网络
4. **图片粘贴** — 在编辑器中 Ctrl+V 粘贴剪贴板图片，自动保存到 vault/images/ 并插入 Markdown 图片链接
5. **Markdown 格式工具栏** — 编辑器上方添加加粗、斜体、标题、列表、链接、代码块等快捷按钮，降低 Markdown 使用门槛

### 中优先级（提升效率）

6. **笔记置顶** — 重要的笔记可以置顶显示在列表最前面
7. **最近编辑** — 侧边栏顶部显示最近编辑的笔记，快速访问
8. **批量标签操作** — 多选笔记后批量添加/删除标签
9. **拖拽导入** — 直接拖拽 .md 文件到窗口即可导入
10. **笔记导出** — 支持导出为 PDF 或 HTML，方便分享
11. **字数统计** — 状态栏显示当前笔记字数和预计阅读时间

### 低优先级（锦上添花）

12. **自定义笔记模板** — 支持创建和管理多个笔记模板（如：论文笔记、会议笔记、读书笔记）
13. **自动备份** — 定期备份 vault 目录到指定位置，防止数据丢失
14. **笔记版本历史** — 记录笔记的修改历史，可以回退到之前的版本
15. **快捷键自定义** — 用户可以自定义各功能的快捷键
16. **迷你地图** — 编辑器右侧显示文档缩略图，快速定位长笔记
17. **大纲导航** — 根据标题生成目录树，点击跳转到对应章节

---

## Project Overview

ScholarNote is a "小而美" (small but beautiful) desktop app for managing academic papers and notes. The user actively uses this tool for their own research workflow.

**Core Workflow:**
1. Paste a paper URL/DOI → auto-fetch metadata from arXiv/CrossRef/Semantic Scholar → download PDF → generate Markdown note
2. Edit notes in a split-pane Markdown editor (CodeMirror) with live preview (GitHub-like rendering)
3. Organize notes with tags and star ratings
4. Link to local files (PDFs, documents) in Markdown — click to open with system default app
5. Auto-detect URL/DOI pasted in notes → one-click metadata enrichment
6. Full-text search across all note metadata via SQLite FTS5
7. Visualize paper relationships with Mermaid diagrams embedded in notes

**Data Philosophy:** Markdown files on disk are the source of truth. SQLite is merely an index/cache for search performance. Notes live under the vault directory.

---

## Quick Start

```bash
# Install dependencies
npm install

# IMPORTANT: Rebuild native modules for Electron's Node.js version
npx electron-rebuild -f -w better-sqlite3

# Development (starts Vite + Electron with hot reload)
npm run electron:dev

# Run just the frontend (Vite dev server, no Electron)
npm run dev

# Production build
npm run electron:build

# Tests
npm run test
```

**CRITICAL for VS Code / Claude Code users:** VS Code sets `ELECTRON_RUN_AS_NODE=1` which breaks Electron's main process. The `vite.config.ts` deletes this env var at the top of the file. If Electron fails to start with `require('electron')` returning a string instead of the module object, check this env var.

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Shell | Electron | 41.2.1 |
| Frontend | React | 19.x |
| Language | TypeScript | 6.0.2 |
| Build | Vite | 8.x |
| State | Zustand | 5.x |
| Editor | CodeMirror 6 | latest |
| Rendering | markdown-it | latest |
| Diagrams | mermaid.js | latest |
| Database | better-sqlite3 + FTS5 | latest |
| File Watching | chokidar | 5.x |
| Frontmatter | gray-matter | latest |
| LaTeX | kaTeX | latest |
| Testing | Vitest + Testing Library | latest |
| Packaging | electron-builder | latest |

---

## Directory Structure

```
scholar-note/
├── electron/                    # Electron main process (Node.js)
│   ├── main.ts                 # App entry: window creation, lifecycle, IPC registration
│   ├── preload.ts              # contextBridge — exposes electronAPI to renderer
│   ├── ipc/                    # IPC handler modules (one per domain)
│   │   ├── fileIPC.ts          # file:read, file:write, file:list, file:delete, file:showInExplorer, dialog:selectVault
│   │   ├── paperIPC.ts         # paper:import, pdf:open
│   │   ├── watchIPC.ts         # watcher:start, watcher:stop
│   │   └── dbIPC.ts            # 8 database CRUD operations
│   ├── services/               # Core business logic
│   │   ├── database.ts         # SQLite init (WAL mode), FTS5, CRUD, triggers
│   │   ├── fileWatcher.ts      # chokidar wrapper for vault directory
│   │   ├── noteParser.ts       # parseNote/serializeNote with gray-matter
│   │   ├── paperFetcher.ts     # arXiv, CrossRef, Semantic Scholar fetchers
│   │   ├── pdfManager.ts       # PDF download with streaming
│   │   └── searchEngine.ts     # FTS5 search with snippet highlighting
│   └── utils/
│       └── slugify.ts          # Unicode-aware slug generation
├── src/                         # Frontend (React, runs in Electron renderer)
│   ├── components/
│   │   ├── common/             # StarRating, ThemeToggle, SettingsDialog
│   │   ├── editor/             # MarkdownEditor (CodeMirror), MarkdownPreview, SplitPane
│   │   ├── import/             # ImportDialog (URL/DOI paste + local Markdown import)
│   │   ├── layout/             # AppLayout, StatusBar
│   │   └── sidebar/            # Sidebar, FileTree, TagList, SearchBar
│   ├── stores/                 # Zustand state management
│   │   ├── noteStore.ts        # papers[], currentPaper, currentContent
│   │   ├── tagStore.ts         # tags[], selectedTags[]
│   │   └── uiStore.ts          # theme, sidebarWidth, dialogs
│   ├── styles/                 # CSS (no CSS-in-JS, no Tailwind)
│   │   ├── variables.css       # CSS custom properties for light/dark themes
│   │   ├── global.css          # Reset, layout, dialog, button styles
│   │   ├── editor.css          # Split pane, editor, preview styles
│   │   └── sidebar.css         # Sidebar, file tree, tags, search
│   ├── types/
│   │   └── index.ts            # Paper, Author, Tag, NoteFrontmatter, etc.
│   ├── preload.d.ts            # TypeScript declarations for window.electronAPI
│   ├── App.tsx                 # Root component: theme, keyboard shortcuts, data loading
│   └── main.tsx                # React DOM entry
├── scripts/
│   └── build-electron.cjs      # Standalone Electron build script (alternative to plugin)
├── docs/
│   └── superpowers/            # Design specs and implementation plans
├── dist/                        # Vite build output (frontend)
├── dist-electron/               # Compiled Electron main/preload
├── package.json                 # No "type" field (removed to avoid ESM/CJS conflicts)
├── vite.config.ts               # Vite + vite-plugin-electron configuration
├── tsconfig.json                # Frontend TypeScript config
├── tsconfig.node.json           # Electron type-checking config (noEmit)
├── tsconfig.electron.json       # Electron compilation config (CJS output)
├── vitest.config.ts             # Test configuration
└── electron-builder.json        # Packaging config (win/mac/linux)
```

---

## Architecture

### Two-Process Model

```
┌─────────────────────────────────────────┐
│  Electron Main Process (Node.js)        │
│  electron/main.ts                       │
│  ├─ IPC Handlers (ipc/)                 │
│  ├─ Database Service (SQLite)           │
│  ├─ File Watcher (chokidar)             │
│  ├─ Paper Fetcher (HTTP APIs)           │
│  └─ PDF Manager                         │
│         ↕ contextBridge (preload.ts)    │
└─────────────────────────────────────────┘
         ↕ IPC (ipcMain ↔ ipcRenderer)
┌─────────────────────────────────────────┐
│  Electron Renderer (Chromium)           │
│  src/ — React 19 + TypeScript           │
│  ├─ Zustand Stores                      │
│  ├─ CodeMirror 6 Editor                 │
│  ├─ markdown-it Preview                 │
│  └─ window.electronAPI (typed)          │
└─────────────────────────────────────────┘
```

### IPC Communication

The preload script (`electron/preload.ts`) uses `contextBridge.exposeInMainWorld` to expose a typed `electronAPI` object. The renderer communicates exclusively through this API — never direct Node.js access.

**Key IPC Channels:**
| Channel | Direction | Purpose |
|---------|-----------|---------|
| `file:read` | renderer→main | Read file contents |
| `file:write` | renderer→main | Write file contents |
| `file:list` | renderer→main | List vault files |
| `file:delete` | renderer→main | Delete note file |
| `file:showInExplorer` | renderer→main | Reveal file in system file manager |
| `file:openLocal` | renderer→main | Open any local file with system default app |
| `dialog:selectVault` | renderer→main | Open folder picker |
| `paper:import` | renderer→main | Import paper from URL/DOI |
| `paper:enrichNote` | renderer→main | Fetch metadata for URL/DOI and update existing note |
| `watcher:start/stop` | renderer→main | Control file watching |
| `file:changed/added` | main→renderer | File change notifications |
| `db:getAllPapers` etc. | renderer→main | Database CRUD (8 channels) |
| `get-vault-path` | renderer→main | Get current vault path |
| `set-vault-path` | renderer→main | Change vault directory |
| `settings:read/write` | renderer→main | Read/write app settings |

### Database Schema (SQLite)

Tables: `papers`, `authors`, `tags`, `paper_authors`, `paper_tags`, `papers_fts` (FTS5 virtual table)

Triggers automatically keep `papers_fts` in sync with `papers` table on INSERT/UPDATE/DELETE.

### Vault Directory Structure

```
D:\ScholarNote/               # Default vault path (fallback: ~/Documents/ScholarNote)
├── notes/                   # Markdown note files (source of truth)
│   └── paper-slug.md        # One file per paper
├── papers/                  # Downloaded PDFs
├── pdfs/                    # Additional PDF storage
├── templates/               # Note templates
├── images/                  # Embedded images
└── scholarnote.db           # SQLite index (not source of truth)
```

### Note File Format

Each note is a Markdown file with YAML frontmatter:

```markdown
---
title: "Paper Title"
authors:
  - "Author One"
  - "Author Two"
year: 2024
journal: "Nature"
doi: "10.1038/..."
url: "https://arxiv.org/abs/..."
pdf_path: "papers/paper-slug.pdf"
tags:
  - machine-learning
  - transformers
reading_status: reading
rating: 4
citations: 42
abstract: "Paper abstract text..."
added_date: "2024-01-15"
---

# Paper Title

Your notes here...
```

---

## Build System

### vite-plugin-electron

The project uses `vite-plugin-electron` which handles:
- Compiling `electron/main.ts` → `dist-electron/main.js` (Rollup bundle, CJS format)
- Compiling `electron/preload.ts` → `dist-electron/preload.js` (Rollup bundle, CJS format)
- External modules: `electron`, `better-sqlite3`, `chokidar` (not bundled, loaded at runtime)
- Auto-starting Electron process after build
- Hot reload: main process restarts on electron/ changes; renderer reloads via HMR

### Key Build Notes

1. **`package.json` has NO `"type"` field.** Previously had `"type": "module"` which caused ESM/CJS conflicts with Electron. Removed during development.

2. **`ELECTRON_RUN_AS_NODE` must be deleted.** VS Code (and Claude Code) set this env var to `1`. It causes Electron to run in Node.js mode instead of main process mode. The fix is at the top of `vite.config.ts`:
   ```typescript
   delete process.env.ELECTRON_RUN_AS_NODE;
   ```
   Without this, `require('electron')` returns the npm package path (string) instead of the built-in Electron module.

3. **Native modules must be rebuilt for Electron.** `better-sqlite3` has a C++ addon compiled for Node.js. Electron uses a different Node.js version (different NODE_MODULE_VERSION). Run `npx electron-rebuild` after `npm install`.

4. **JSDoc comments must not contain `*/`.** TypeScript's parser will treat `*/` inside a block comment as the end of the comment. For example, `notes/**/*.md` in a JSDoc comment contains `*/` which prematurely closes the comment. Use descriptive text instead of glob patterns in comments.

5. **`markdown-it-emoji` uses named exports.** Import as `import { full as emoji } from 'markdown-it-emoji'`, NOT `import emoji from 'markdown-it-emoji'`.

6. **`bracketMatching` is from `@codemirror/language`.** NOT from `@codemirror/autocomplete`. It's commonly confused because `closeBrackets` is in autocomplete.

---

## State Management (Zustand)

Three stores, all in `src/stores/`:

### noteStore.ts
```typescript
// State
papers: Paper[]           // All papers from database
currentPaper: Paper | null // Currently selected paper
currentContent: string     // Markdown content of current note
isLoading: boolean

// Actions
setPapers(papers)          // Load all papers
setCurrentPaper(paper)     // Select a paper
setCurrentContent(content) // Update editor content
updatePaperRating(id, r)   // Update star rating
```

### tagStore.ts
```typescript
// State
tags: Tag[]               // All tags
selectedTags: string[]     // Currently selected for filtering

// Actions
setTags(tags)
toggleTag(name)
clearTags()
```

### uiStore.ts
```typescript
// State
theme: 'light' | 'dark'
sidebarWidth: number
showImportDialog: boolean
showSettings: boolean

// Actions
toggleTheme()
setShowImportDialog(show)
setShowSettings(show)
```

---

## Security Model

- **Context Isolation:** Enabled. Renderer cannot access Node.js APIs directly.
- **nodeIntegration:** Disabled. No `require()` in renderer.
- **Path Validation:** Vault file operations (read/write/delete) validate paths stay within vault boundaries (`isPathInVault()`).
- **Local File Opening:** `file:openLocal` accepts any local path but verifies the file exists before opening with system default app.
- **markdown-it:** Configured with `html: false` to prevent XSS.
- **mermaid:** `securityLevel: 'strict'` to prevent code injection.
- **Academic APIs:** Use HTTPS only (arXiv, CrossRef, Semantic Scholar).

---

## Academic API Integration

Three metadata sources, tried in order based on URL/DOI detection:

| Source | URL Pattern | API |
|--------|------------|-----|
| arXiv | `arxiv.org/abs/...` | `https://export.arxiv.org/api/query?idList=...` |
| CrossRef | DOI `10.xxx/...` | `https://api.crossref.org/works/{doi}` |
| Semantic Scholar | Fallback | `https://api.semanticscholar.org/graph/v1/paper/...` |

Paper import flow: `detectSourceType()` → `fetchPaperMeta()` → download PDF → create note from template → save to database.

---

## Styling

Pure CSS with custom properties for theming. No Tailwind, no CSS-in-JS, no CSS modules.

- `variables.css` — Light/dark theme variables via `[data-theme]` attribute
- `global.css` — Reset, layout, dialog, button styles, scrollbar
- `editor.css` — Split pane, CodeMirror overrides, preview (GitHub-like), mermaid
- `sidebar.css` — Sidebar, file tree, tags, search

Theme toggle sets `data-theme` attribute on `<html>` element.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+N` / `Cmd+N` | 打开导入对话框 |
| `Ctrl+,` / `Cmd+,` | 打开设置 |

---

## Testing

- **Framework:** Vitest with jsdom environment
- **Component tests:** @testing-library/react + @testing-library/jest-dom
- **Config:** `vitest.config.ts` at project root
- **Location:** Test files should go in `tests/**/*.test.ts(x)`
- **Coverage target:** 80%+ (see project rules)

Currently no tests exist. Tests should be added for:
- Database service (CRUD operations)
- Note parser (parse/serialize)
- Paper fetcher (API integration with mocks)
- React components (rendering, interactions)
- IPC handlers (with mocked electron)

---

## Known Gotchas & Troubleshooting

### Electron won't start, `require('electron')` returns a string
**Cause:** `ELECTRON_RUN_AS_NODE=1` is set in the environment (common in VS Code terminals).
**Fix:** `delete process.env.ELECTRON_RUN_AS_NODE` is at the top of `vite.config.ts`. If running manually, `unset ELECTRON_RUN_AS_NODE` first.

### `better-sqlite3` NODE_MODULE_VERSION mismatch
**Cause:** Native addon compiled for system Node.js, not Electron's Node.js.
**Fix:** `npx electron-rebuild -f -w better-sqlite3`

### Build errors with `*/` in comments
**Cause:** TypeScript parser treats `*/` in block comments as end-of-comment.
**Fix:** Don't put glob patterns like `**/*.md` in JSDoc/block comments.

### `markdown-it-emoji` import fails
**Cause:** Package doesn't have a default export compatible with ESM.
**Fix:** `import { full as emoji } from 'markdown-it-emoji'`

### `bracketMatching` not found
**Cause:** Exported from `@codemirror/language`, not `@codemirror/autocomplete`.
**Fix:** `import { bracketMatching } from '@codemirror/language'`

---

## Configuration Files

| File | Purpose |
|------|---------|
| `vite.config.ts` | Vite + vite-plugin-electron config, env var cleanup |
| `tsconfig.json` | Frontend TypeScript (ES2020, React JSX, strict) |
| `tsconfig.node.json` | Electron type-checking (noEmit, for IDE support) |
| `tsconfig.electron.json` | Electron compilation (CJS output, used by build script) |
| `vitest.config.ts` | Test configuration (jsdom, aliases) |
| `electron-builder.json` | Packaging (NSIS/DMG/AppImage, appId, metadata) |

---

## Commands Reference

```bash
# Development
npm run dev              # Vite dev server only (no Electron)
npm run electron:dev     # Full Electron + Vite dev (recommended)

# Building
npm run build            # Vite build (frontend only)
npm run electron:build   # Full build + electron-builder packaging

# Testing
npm run test             # Run tests once
npm run test:watch       # Run tests in watch mode

# Native module rebuild (after npm install)
npx electron-rebuild -f -w better-sqlite3

# Type checking
npx tsc -p tsconfig.json --noEmit          # Frontend types
npx tsc -p tsconfig.node.json --noEmit     # Electron types (checks all electron/ code)
npx tsc -p tsconfig.electron.json          # Electron compilation (emits to dist-electron/)
```

---

## Important Types (`src/types/index.ts`)

```typescript
interface Paper {
  id: number; title: string; slug: string; filePath: string;
  pdfPath: string | null; doi: string | null; url: string | null;
  year: number | null; journal: string | null; abstract: string | null;
  citations: number; readingStatus: ReadingStatus; rating: number;
  addedDate: string; updatedDate: string; bibtex: string | null;
  authors: Author[]; tags: Tag[];
}

type ReadingStatus = 'to-read' | 'reading' | 'read';

interface NoteFrontmatter {
  title: string; authors?: string[]; year?: number; journal?: string;
  doi?: string; url?: string; pdf_path?: string; tags?: string[];
  reading_status?: ReadingStatus; rating?: number; citations?: number;
  abstract?: string; added_date?: string;
}
```

---

## Commit Convention

Follow conventional commits:
```
feat: add paper import from DOI
fix: resolve path traversal in file operations
refactor: extract search logic into service
docs: update CLAUDE.md
test: add database service tests
chore: upgrade electron to 41.x
```

---

## Design Documents

Detailed design spec and implementation plan are at:
- `docs/superpowers/specs/2026-04-16-scholar-note-design.md`
- `docs/superpowers/plans/2026-04-16-scholar-note-implementation.md`
