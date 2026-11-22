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

## 4. Directed Acyclic Graph (DAG) Layout (`dagLayout.ts`)

The commit visualizer renders branches, merges, and commit topology using an analytical topological sorting algorithm:

1. **Topological Row Assignment**: Commits are sorted chronologically by commit date and parent traversal.
2. **Lane Reservation**: Branch heads claim dedicated horizontal lanes. As branches merge back into parent streams, lanes are reclaimed to prevent horizontal sprawl.
3. **Cubic Bezier Splines**: Branching arcs and merges are drawn on an SVG canvas layer behind the commit list, calculating control points between parent and child coordinates.
4. **Interactive Highlighting**: Search queries (`Ctrl+F`) compute an index of matching hashes, dimming non-matching rows and rendering cyan focus rings on matching nodes.

---

## 5. Conflict Resolution & Staging System

- **Porcelain v2 Status Parser**: Parses Git status porcelain v2 format, differentiating between modified (`1`), renamed (`2`), untracked (`?`), and conflicted unmerged entries (`u`).
- **Conflict Resolution Engine**: When merge conflicts occur, Gih surfaces an unmerged file tray with one-click actions:
  - `Keep Ours`: `git checkout --ours -- <file> && git add <file>`
  - `Keep Theirs`: `git checkout --theirs -- <file> && git add <file>`
  - `Mark Resolved`: `git add <file>`
- **Granular Reset**: Supports `--soft`, `--mixed`, and `--hard` reset modes from the visual commit graph context menu.
