# Gih Architecture

This document outlines the internal architecture, design principles, and subsystems of Gih.

---

## 1. Process Model & IPC Bridge

Gih operates on a two-tier desktop architecture:

```
┌────────────────────────────────────────────────────────┐
│                   Renderer Process                     │
│      React 19 + TypeScript + Tailwind CSS (Vite)        │
│  - CommitGraph (DAG Canvas & Bezier Curve Renderer)    │
│  - StagingArea (Precision Hunk Stager & Conflict HUD)  │
│  - Sidebar (Draggable Nav & Branch Controls)           │
│  - Top-Center Command Feedback Island                  │
└───────────────────────────┬────────────────────────────┘
                            │
               window.gih contextBridge IPC
                            │
┌───────────────────────────▼────────────────────────────┐
│                     Main Process                       │
│                   Electron Runtime                     │
│  - GitService (Native Exec & Stdin Streaming)          │
│  - FSWatcher (.git File System Event Monitor)          │
│  - Native Dialogs (Folder picker, Window chrome)       │
└────────────────────────────────────────────────────────┘
```

- **Renderer Process**: Pure client application loaded inside Electron's BrowserWindow with `contextIsolation: true` and `nodeIntegration: false`. Communicates strictly through typed interfaces exposed via `window.gih`.
- **Preload Script (`src/main/preload.ts`)**: Defines type-safe IPC invocations (`ipcRenderer.invoke`) across all Git actions and provides push notifications via `git:changed`.
- **Main Process (`src/main/index.ts`)**: Handles OS window lifecycle, file picker dialogs, and delegates operations to the `GitService`.

---

## 2. Git Engine (`src/main/gitService.ts`)

Gih avoids wrapping Git inside high-level abstraction layers that strip CLI functionality. Instead, it interacts directly with the system's native `git.exe` binary.

### Key Capabilities

1. **Direct Child-Process Invocation**:
   Uses `execFile('git', args)` with standard buffers (32MB max buffer limit, hidden Windows console windows, UTF-8 environment variables).
2. **Stdin Patch Streaming (`applyPatch`)**:
   Enables hunk-level and partial-line staging by spawning Git processes with writable stdin streams (`git apply --cached --whitespace=nowarn --recount -`).
3. **Execution Mutex Guard**:
   Maintains an internal `activeExecutions` reference counter so background file-system watchers know when Gih itself is modifying repository state.
4. **Command Telemetry & Audit Log**:
   Every command is recorded with timestamp, duration, arguments, exit code, and stdout/stderr output into an in-memory ring buffer (up to 500 entries) inspectable in the terminal panel.

---

## 3. Real-Time Repository Watcher

To ensure the UI is in sync with external terminal actions without manual refreshes:

- **Directory Monitoring**: Watches the `.git/` folder recursively via `fs.watch`.
- **Noise Suppression**: Ignores lock files (`.git/*.lock`), commit edit messages (`COMMIT_EDITMSG`), and intermediate fetch logs to prevent watcher thrashing.
- **Debounce & Execution Interlocking**: Coalesces bursts of file changes with a 350ms trailing debounce. If Gih is currently running an internal command, watcher events are dropped to prevent re-entrant loops.

---

## 4. Directed Acyclic Graph (DAG) Layout & Virtual Windowing

The commit visualizer renders branches, merges, and commit topology using an analytical topological sorting algorithm paired with virtual row windowing:

1. **Topological Row Assignment**: Commits are sorted chronologically by commit date and parent traversal.
2. **Lane Reservation**: Branch heads claim dedicated horizontal lanes. As branches merge back into parent streams, lanes are reclaimed to prevent horizontal sprawl.
3. **Cubic Bezier Splines**: Branching arcs and merges are drawn on an SVG canvas layer behind the commit list, calculating control points between parent and child coordinates.
4. **Virtual Row Windowing (`OVERSCAN_ROWS = 12`)**: Only commits and bezier edges currently visible within the user's viewport plus an overscan buffer are rendered to the DOM, preserving constant 60 FPS scrolling and low memory usage even across repositories with 50,000+ commits.
5. **Interactive Highlighting**: Search queries (`Ctrl+F`) compute an index of matching hashes, dimming non-matching rows and rendering cyan focus rings on matching nodes.
6. **Drag-and-Drop Operations**: Dragging branch badges onto commit rows dynamically renders targeting rings and prompts a drop popover offering Merge, Rebase, or Cherry-Pick.

---

## 5. Conflict Resolution & Staging System

- **Porcelain v2 Status Parser**: Parses Git status porcelain v2 format, differentiating between modified (`1`), renamed (`2`), untracked (`?`), and conflicted unmerged entries (`u`).
- **Conflict Resolution Engine**: When merge conflicts occur, Gih surfaces an unmerged file tray with one-click actions:
  - `Keep Ours`: `git checkout --ours -- <file> && git add <file>`
  - `Keep Theirs`: `git checkout --theirs -- <file> && git add <file>`
  - `Mark Resolved`: `git add <file>`
- **Granular Reset**: Supports `--soft`, `--mixed`, and `--hard` reset modes from the visual commit graph context menu.

---

## 6. Diff Engine & Intra-Line Word Tokenization (`diffUtils.ts`)

- **Word & Punctuation Tokenizer**: Tokenizes lines using regular expressions into alphanumeric tokens, punctuation, and whitespace chunks.
- **Longest Common Subsequence (LCS)**: Computes word-level diffs between deleted and added lines with a $40,000$ matrix size guard against minified assets.
- **Dual Display Modes**:
  - `Unified`: Single-column diff showing additions and deletions inline with green/red word token highlights.
  - `Split (Side-by-Side)`: Contiguous delete lines are paired with contiguous addition lines in a 2-column layout. Unpaired lines span empty space on the opposite side.

---

## 7. Multi-Commit Selection & Range Diff Engine

- **Selection Modifiers**:
  - `Click`: Single-commit selection.
  - `Ctrl + Click` / `Cmd + Click`: Multi-commit toggle.
  - `Shift + Click`: Continuous commit range selection between anchor and target commits.
- **Aggregated Diff Inspection**: Queries `git diff --name-status base~1 head` and `git diff --stat base~1 head`, surfacing all files changed across the range with intra-line word diffs on demand.

---

## 8. Remote Hosting Deep-Links & Safe Force-Push

- **Remote URL Parsing**: Automatically parses SSH and HTTPS remote URLs for GitHub, GitLab, and Bitbucket.
- **Deep-Links**: Exposes one-click links to view repositories, specific commits (`/commit/{hash}`), and create pull requests (`/compare/{branch}`).
- **Safe Force-Push**: Provides `--force-with-lease` to update upstream branches safely without risking overwriting teammates' pushes.

---

## 9. Dependency Resolution & Standalone Packaging

- **Git Dependency Resolution**: On launch, Gih queries `git --version` to verify presence on the system `$PATH`. When missing, Gih presents an OS-adaptive setup view offering official download links or platform-native installers (Windows `winget`, macOS `xcode-select`, Linux package managers) with in-app status re-checking.
- **Cross-Platform Binary Packaging**: Managed via `electron-builder`:
  - **Windows**: Outputs both a portable standalone executable (`Gih-Portable-${version}.exe`) requiring zero installation, and an NSIS one-click installer (`Gih-Setup-${version}.exe`).
  - **macOS**: Builds Apple Silicon and Intel DMG images and ZIP bundles.
  - **Linux**: Produces universal AppImage executables and Debian (`.deb`) packages.
