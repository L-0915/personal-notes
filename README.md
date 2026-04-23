# ScholarNote

**个人学术文献管理与笔记软件** — 一款"小而美"的桌面应用，专为研究者设计。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-41-47848F?logo=electron)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript)](https://www.typescriptlang.org/)

---

## 为什么做 ScholarNote？

作为研究者，我试过几乎所有主流的文献管理和笔记工具——Obsidian、Notion、Zotero、MarginNote、ReadCube Papers……但始终找不到一款真正贴合学术写作流程的产品：

- **Obsidian** 是优秀的通用笔记工具，但缺少学术元数据抓取、论文导入等功能，需要安装大量插件
- **Zotero / Mendeley** 擅长文献管理，但笔记功能极其薄弱，无法写出结构化的阅读笔记
- **MarginNote** 的 PDF 标注很强，但不支持 Markdown，数据格式封闭
- **ReadCube Papers** 功能全面但按年收费（$60-130/年），且完全依赖云端
- **Notion** 美观但非本地优先，学术功能需要大量手动配置

于是我做了 ScholarNote：**把论文导入、元数据管理、结构化笔记、知识图谱整合到一个轻量级的本地应用中**。

---

## 与市面产品的对比

| 功能 | ScholarNote | Obsidian | Zotero | MarginNote | ReadCube Papers | Notion |
|:-----|:-----------:|:--------:|:------:|:----------:|:---------------:|:------:|
| 论文元数据自动抓取 | ✅ 内置 | ❌ 需插件 | ✅ | ❌ | ✅ | ❌ |
| Markdown 笔记编辑 | ✅ | ✅ | ❌ 弱 | ❌ | ❌ 弱 | ⚠️ 部分 |
| 结构化论文笔记模板 | ✅ 内置 | ⚠️ 需手动 | ❌ | ❌ | ❌ | ⚠️ 需模板 |
| Mermaid 图表（论文关系图）| ✅ 内置 | ✅ | ❌ | ❌ | ❌ | ❌ |
| LaTeX 数学公式 | ✅ KaTeX | ✅ | ❌ | ❌ | ❌ | ✅ |
| 双向笔记链接 `[[title]]` | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| 本地文件链接（打开 PDF）| ✅ 任意路径 | ⚠️ 有限 | ✅ | ✅ | ✅ | ❌ |
| URL/DOI 自动检测导入 | ✅ | ❌ | ⚠️ 有限 | ❌ | ❌ | ❌ |
| 全文搜索 | ✅ SQLite FTS5 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 标签系统 + 星级评分 | ✅ | ✅ 标签 | ⚠️ | ❌ | ✅ | ✅ |
| 本地优先 | ✅ | ✅ | ✅ | ✅ | ❌ 云端 | ❌ 云端 |
| 中文界面 | ✅ 原生 | ⚠️ 插件 | ⚠️ 插件 | ✅ | ❌ | ⚠️ 部分 |
| 免费开源 | ✅ MIT | ✅ 核心 | ✅ | ❌ 付费 | ❌ 订阅 | ⚠️ 有限 |
| 笔记导出（PDF/Word/HTML）| ✅ 内置 | ⚠️ 需插件 | ❌ | ⚠️ 有限 | ❌ | ⚠️ 有限 |
| 图片粘贴 | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ |

---

## 核心创新功能

### 1. 智能论文导入

粘贴一个 arXiv 链接、DOI 或 Semantic Scholar URL，ScholarNote 自动完成：

- 从 **arXiv / CrossRef / Semantic Scholar** 三大学术 API 抓取标题、作者、摘要、引用数、期刊信息
- 自动下载 PDF 到本地
- 使用内置模板生成结构化笔记（摘要 → 主要贡献 → 方法 → 个人笔记 → 相关论文）
- 自动写入 SQLite 全文索引

甚至，**在笔记中粘贴论文链接**，ScholarNote 会自动检测并静默创建新笔记——无需离开当前编辑。

### 2. 论文关系可视化

在笔记中嵌入 Mermaid 代码块，用思维导图可视化论文之间的引用和关联关系：

```markdown
```mermaid
graph LR
  A["Attention Is All You Need"]
  B["BERT"]
  C["GPT-3"]
  A --> B
  A --> C
``` ```

### 3. 双模式编辑体验

- **预览模式**：纯净的阅读体验，GitHub 风格渲染，支持数学公式、Mermaid 图表、脚注、任务列表
- **编辑模式**：CodeMirror 6 代码编辑器，语法高亮、自动补全括号、格式化工具栏
- 使用 `Ctrl+E` 一键切换，滚动位置自动同步

### 4. 本地优先 + 数据自主

- 所有笔记以 **Markdown 文件**存储在本地磁盘，不依赖任何云服务
- SQLite 仅为搜索索引，Markdown 文件才是唯一数据源
- 支持 `[[笔记标题]]` 语法实现笔记间跳转
- 支持链接到任意本地文件（不限于 PDF，不限仓库内）
- 内置备份与回收站功能

### 5. 一键多格式导出

将笔记导出为：

- **PDF** — A4 排版，保留完整样式和中文支持
- **Word (.docx)** — 可在 Microsoft Word 中继续编辑
- **HTML** — 带内嵌 CSS 的独立网页文件
- **Markdown (.md)** — 纯文本格式，通用性最强

### 6. 中文原生支持

从界面到搜索到文件名，全面支持中文：

- 全中文 UI（按钮、菜单、提示、状态栏）
- Unicode-aware 文件名 slug 生成
- 中文友好的全文搜索（FTS5 前缀匹配）
- 中文字数统计和阅读时间估算

---

## 功能概览

| 类别 | 功能 |
|:-----|:-----|
| **编辑器** | CodeMirror 6 · 语法高亮 · 格式化工具栏 · 图片粘贴 · 大纲导航 |
| **预览** | markdown-it 渲染 · KaTeX 数学公式 · Mermaid 图表 · 脚注 · 任务列表 · Emoji |
| **论文导入** | arXiv · CrossRef · Semantic Scholar · URL/DOI 自动检测 · PDF 下载 |
| **笔记管理** | 文件夹树 · 标签筛选 · 星级评分 · 置顶 · 排序（标题/日期/评分）· 搜索 |
| **知识网络** | `[[wiki-links]]` · Mermaid 论文关系图 · 本地文件链接 |
| **导出** | PDF · Word (.docx) · HTML · Markdown |
| **数据安全** | 本地 Markdown 文件 · 自动保存（1s 防抖）· 备份 · 回收站 |
| **主题** | 浅色/深色一键切换 · CSS 变量主题系统 |
| **界面** | 全中文 · 可拖拽侧边栏 · 键盘快捷键 · 拖拽导入 |
| **打包** | Windows NSIS 安装包 · macOS DMG · Linux AppImage |

---

## 快速开始

### 环境要求

- Node.js 18+
- npm 9+

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/RainbowHacker/personal-notes.git
cd personal-notes/scholar-note

# 安装依赖
npm install

# 重建原生模块（SQLite）
npx electron-rebuild -f -w better-sqlite3

# 开发模式运行
npm run electron:dev

# 打包桌面应用
npm run electron:build
```

### 常用命令

| 命令 | 说明 |
|:-----|:-----|
| `npm run electron:dev` | 开发模式（Electron + Vite 热更新） |
| `npm run electron:build` | 构建并打包桌面安装程序 |
| `npm run dev` | 仅前端开发服务器 |
| `npm run test` | 运行测试 |
| `npm run test:watch` | 监听模式运行测试 |

---

## 技术架构

```
┌─────────────────────────────────────────────┐
│  Electron Main Process (Node.js)            │
│  ├─ IPC Handlers ─── file / paper / db      │
│  ├─ SQLite (better-sqlite3 + FTS5)          │
│  ├─ File Watcher (chokidar)                 │
│  ├─ Paper Fetcher (arXiv / CrossRef / S2)   │
│  └─ Export Engine (PDF / DOCX / HTML)       │
│         ↕ contextBridge (preload.ts)        │
└─────────────────────────────────────────────┘
         ↕ IPC
┌─────────────────────────────────────────────┐
│  Electron Renderer (Chromium)               │
│  ├─ React 19 + TypeScript                   │
│  ├─ Zustand 状态管理                         │
│  ├─ CodeMirror 6 编辑器                     │
│  ├─ markdown-it 实时预览                     │
│  └─ window.electronAPI (类型安全)            │
└─────────────────────────────────────────────┘
```

**技术栈：** Electron 41 · React 19 · TypeScript 6 · Vite 8 · Zustand 5 · CodeMirror 6 · markdown-it · KaTeX · Mermaid · SQLite (FTS5) · docx

---

## 项目结构

```
scholar-note/
├── electron/                    # Electron 主进程
│   ├── main.ts                 # 应用入口、窗口创建、生命周期
│   ├── preload.ts              # contextBridge 安全 API
│   ├── ipc/                    # IPC 处理模块
│   │   ├── fileIPC.ts          # 文件操作、导入、回收站
│   │   ├── paperIPC.ts         # 论文导入、PDF 处理
│   │   ├── exportIPC.ts        # 导出功能（PDF/Word/HTML/MD）
│   │   ├── dbIPC.ts            # 数据库 CRUD
│   │   └── watchIPC.ts         # 文件监视
│   └── services/               # 核心业务逻辑
│       ├── database.ts         # SQLite 初始化、FTS5、触发器
│       ├── noteParser.ts       # Markdown 解析与序列化
│       ├── paperFetcher.ts     # arXiv / CrossRef / Semantic Scholar
│       ├── pdfManager.ts       # PDF 下载与存储
│       ├── searchEngine.ts     # 全文搜索
│       └── exportService.ts    # 多格式导出引擎
├── src/                         # 前端（React）
│   ├── components/
│   │   ├── common/             # 通用组件（设置、导出、星级）
│   │   ├── editor/             # 编辑器（CodeMirror、预览、工具栏、大纲）
│   │   ├── import/             # 导入对话框
│   │   ├── layout/             # 布局（AppLayout、StatusBar）
│   │   └── sidebar/            # 侧边栏（文件树、标签、搜索）
│   ├── stores/                 # Zustand 状态管理
│   ├── styles/                 # 纯 CSS 主题系统
│   └── types/                  # TypeScript 类型定义
├── package.json
├── vite.config.ts
└── electron-builder.json
```

---

## 数据哲学

> **Markdown 文件是唯一数据源。SQLite 只是搜索索引。**

- 所有笔记以 `.md` 文件存储在本地 vault 目录（默认 `D:\ScholarNote`）
- YAML frontmatter 存储元数据（标题、作者、DOI、标签等）
- SQLite FTS5 仅用于加速搜索，可随时从文件重建
- 即使不用 ScholarNote，你仍然可以用任何文本编辑器打开和编辑笔记

---

## 键盘快捷键

| 快捷键 | 功能 |
|:-------|:-----|
| `Ctrl+N` | 打开导入对话框 |
| `Ctrl+E` | 预览/编辑模式切换 |
| `Ctrl+F` | 聚焦搜索栏 |
| `Ctrl+S` | 立即保存当前笔记 |
| `Ctrl+,` | 打开设置 |

---

## 仓库目录说明

这是一个多用途仓库，包含多个子项目：

| 目录 | 说明 |
|:-----|:-----|
| `scholar-note/` | ScholarNote 桌面应用（本项目） |
| `ScholarNote-Release/` | 构建输出（安装包） |

---

## License

[MIT](LICENSE)

---

**用 ScholarNote，把更多时间留给思考，而不是折腾工具。**
