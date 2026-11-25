<div align="center">

<img src="public/logo.png" alt="Gih Logo" width="120" />

# Gih

### A high-craft visual Git workstation and interactive graph shell.

[![License](https://img.shields.io/badge/license-PolyForm%20Noncommercial%201.0.0-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)]()
[![TypeScript](https://img.shields.io/badge/built%20with-TypeScript%20%7C%20React%2019-blue.svg)]()

[**Overview**](OVERVIEW.md) • [**Architecture**](ARCHITECTURE.md) • [**Contributing**](CONTRIBUTING.md) • [**Accessibility**](ACCESSIBILITY.md) • [**Code of Conduct**](CODE_OF_CONDUCT.md) • [**Security**](SECURITY.md) • [**License**](LICENSE) • [**Commercial**](COMMERCIAL.md)

</div>

---

## What is Gih?

**Gih** is a source-available, visual-first Git workstation designed for developers who want the speed and clarity of a graphical commit graph without losing the full, unconstrained depth of the Git command-line interface.

Unlike tools that simplify Git by hiding its internals, Gih keeps you connected to raw Git operations. Every click, drag, and toggle shows the exact Git CLI command executed with millisecond telemetry feedback.

---

## Features at a Glance

- **Interactive Topological DAG & Virtual Windowing**: Multi-lane commit graph with cubic bezier routing, active branch badges, and virtual row windowing sustaining 60 FPS on 50,000+ commit repositories.
- **Drag-and-Drop Git Actions**: Drag branch badges directly onto target commits in the graph to trigger context menus for Merge, Rebase, or Cherry-Pick.
- **Multi-Commit Selection & Range Diff**: `Shift+Click` commit ranges or `Ctrl+Click` multi-commit sets to inspect aggregate files changed and statistics across commit boundaries.
- **Intra-Line Token Diffs & Split/Unified View**: Character- and word-level diffing powered by longest common subsequence (LCS) tokenization, with a segmented control to switch between Unified and Side-by-Side Split views.
- **Commit Graph Search (`Ctrl+F`)**: Instant search across commit messages, authors, short hashes, and branch/tag labels with focused highlighting.
- **Precision Hunk Staging**: Unified and split diff viewer with single-click `[ Stage Hunk ]`, `[ Unstage Hunk ]`, and `[ Discard Hunk ]` powered by `git apply`.
- **Commit Amend Toggle**: Quick-amend mode in the staging panel that auto-populates previous commit messages for fast fixes.
- **Granular Reset Studio**: Interactive `--soft`, `--mixed`, and `--hard` reset options with clear safety explanations.
- **Safe Force-Push (`--force-with-lease`)**: Dropdown push control offering standard push alongside `--force-with-lease` to prevent overwriting teammates' upstream work.
- **Remote Provider Deep-Links**: Auto-detects GitHub, GitLab, and Bitbucket origin remotes with one-click links to view repositories, commits, and create pull requests in your default browser.
- **3-Way Merge Conflict Studio**: Automatic detection of conflicted files with one-click `Keep Ours`, `Keep Theirs`, and `Mark Resolved` actions.
- **Visual Rebase & Reflog**: Interactive rebase modal (`pick`, `reword`, `edit`, `squash`, `fixup`, `drop`) and reflog restoration.
- **Remote Repository Clone**: Built-in clone dialog with destination browsing and automatic workspace transition.
- **Safe Commit Reversion (`git revert`)**: Safely invert commits directly from the graph right-click context menu via `git revert --no-edit <hash>`, producing clean reverse commits while preserving linear history and catching conflicts.
- **Git Worktree Studio**: Sidebar management for Git worktrees (`git worktree add`, `list`, and `remove`), allowing developers to checkout and work across multiple branches concurrently in parallel directories.
- **Interactive Git Blame & Commit Jump**: Gutter-based line-by-line blame inspector showing author, relative date, commit subject, and hash-coded hues; click any commit to navigate directly to it in the graph.
- **In-App Quick File Viewer / Editor & External Launch**: In-app code editor modal with line numbers, 2-space tab indent, and instant `Ctrl+S` saving back to disk, plus one-click launching in configured editors (VS Code, Cursor, Windsurf, Sublime, or system default).
- **Patch Management Studio**: Export individual commits as `.patch` files or copy format-patch content to clipboard, with a dedicated Apply Patch studio supporting `--cached` and `--reverse` options.
- **Branch Ahead/Behind Sync Badges & Stale Branch Pruning**: Real-time `↑ ahead` and `↓ behind` tracking badges on branches, with a one-click action to prune remote references (`git fetch --prune`) and remove merged local branches whose upstream is gone.
- **Staging & Commit File Filter**: Instant fuzzy file search bar in both the Staging area and Commit/Range Inspector to rapidly isolate modified files in large changesets.
- **Commit Message 50/72 Rule Counter**: Real-time character pill adhering to standard Git commit guidelines (green `<= 50`, amber `50-72`, rose `> 72`) with blank second-line warnings.
- **Keyboard Graph Navigation & Vim Keys**: Walk the commit DAG fluidly using `↑` / `↓` or `j` / `k` with auto-scrolling viewport, `Shift` for range selection, and `Esc` to clear.
- **Discard All Changes**: One-click action in the Staging Area to restore tracked files (`git checkout -- .`) and clean untracked artifacts (`git clean -df`) with a safety confirmation prompt.
- **Conventional Commit Helper Pills**: Quick-tap prefix buttons (`feat:`, `fix:`, `docs:`, `refactor:`, `perf:`, `test:`, `chore:`) that automatically format or update commit messages and focus the input.
- **Branch View Filter Toggle**: Toggle between `All Branches` (`git log --all`) and `Current Branch` (`git log HEAD`) directly from the graph search bar for distraction-free feature branch development.
- **Quick `.gitignore` Context Action**: One-click pattern generator on unstaged files to ignore specific files, file extensions (`*.ext`), or parent directories without editing text files manually.
- **Recent Repositories & Quick Switcher**: Persistent workspace history with instant dropdown switching, recent project jump lists, and 1-click workspace removal.
- **CLI & Windows Explorer Integration**: Launch directly from your shell (`gih .` or `gih path/to/repo`) or right-click any folder in Windows Explorer with "Open with Gih".
- **First-Commit Author Identity Setup**: Automatically detects missing `user.name` / `user.email` configurations, guides users through global/local identity setup, and auto-resumes their pending commit.
- **Stash Inspection & Custom Stash Studio**: Modal diff viewer for `stash@{n}` entries and custom stash options (`--include-untracked` / `-u`, `--keep-index`).
- **Cryptographic Commit Signatures (GPG & SSH)**: Automatic signature verification badges (`Verified`, `Unverified`, `Invalid`) in the DAG graph and inspector, with a `Sign (-S)` commit composer toggle.
- **Visual Git Bisect Assistant & Binary Search HUD**: Step-by-step binary search assistant with interactive HUD controls (`Mark Good`, `Mark Bad`, `Skip`, `Abort`) to quickly isolate regression commits.
- **File History Filter (`git log -- <path>`)**: Instant path scoping in the DAG graph to review the complete evolution of an individual file.
- **Annotated Tagging Studio & Remote Push**: Create release tags with multi-line release notes and push tags to remote origin (`git push origin <tag>` / `--tags`).
- **Git Submodules Studio**: Sidebar submodule management with sync status indicators, recursive sync (`git submodule update --init --recursive`), and one-click child repo navigation.
- **100% Zero-Mouse Keyboard Accessibility**: Complete hotkey and focus-switching coverage (`Ctrl+1..4`, `F6`, `?`, `Space`, `Enter`, `d`, `e`, `b`, `c`, `s`, `u`) for seamless mouse-free development.
- **Tactile Command Island**: Top-center HUD notifications showing command timing and results within natural foveal focus.
- **Draggable & Resizable Panes**: Customizable sidebar sections and smooth split panes for staging and terminal views.

---

## Quickstart

### Prerequisites

- [Node.js](https://nodejs.org/) v20 or higher
- [Git](https://git-scm.com/) installed and available in `$PATH`

### Installation & Development

```bash
# Clone the repository
git clone https://github.com/Anames-dex/Gih.git
cd Gih

# Install dependencies
npm install

# Start in development mode (Vite HMR + Electron)
npm run dev

# Compile TypeScript and build production bundle
npm run build
```

### Packaging & Standalone Executables

Gih can be packaged into standalone executables and distribution installers with a single command:

```bash
# Package Windows portable executable (.exe) and installer
npm run package:win

# Package macOS DMG and ZIP archives
npm run package:mac

# Package Linux standalone AppImage and DEB package
npm run package:linux
```

All built binaries are output to the `release/` directory:
- **Windows (x64 & ARM64)**:
  - `Gih-Setup-1.0.0-x64.exe` / `Gih-Setup-1.0.0-arm64.exe` (NSIS customizable setup installers with desktop & Start menu shortcuts)
  - `Gih-Portable-1.0.0-x64.exe` / `Gih-Portable-1.0.0-arm64.exe` (Zero-install portable binaries)
- **macOS (Apple Silicon arm64 & Intel x64)**:
  - `Gih-1.0.0-arm64.dmg` / `Gih-1.0.0-arm64.zip` (Native Apple Silicon M-series)
  - `Gih-1.0.0-x64.dmg` / `Gih-1.0.0-x64.zip` (Intel Mac)
- **Linux (x64 & ARM64)**:
  - `Gih-1.0.0-x64.AppImage` / `Gih-1.0.0-arm64.AppImage` (Universal standalone binary across all Linux distributions)
  - `Gih-1.0.0-x64.deb` / `Gih-1.0.0-arm64.deb` (Debian, Ubuntu, Linux Mint)

> **Git Detection**: Gih automatically verifies whether Git is installed and available on your system PATH on startup. If Git is not detected, Gih offers a guided one-click installation flow tailored to your operating system (official installer, winget, Apple developer tools, or Linux package managers) with instant in-app status re-checking.

---

## Documentation

- [**OVERVIEW.md**](OVERVIEW.md): Comprehensive feature breakdown and comparative matrix.
- [**ARCHITECTURE.md**](ARCHITECTURE.md): Deep dive into the process model, Git execution engine, watcher deduplication, and DAG layout algorithms.
- [**CONTRIBUTING.md**](CONTRIBUTING.md): Developer guide, code style standards, and conventional commit workflow.
- [**ACCESSIBILITY.md**](ACCESSIBILITY.md): Zero-mouse keyboard navigation guide, focus management, and WCAG standards.
- [**CODE_OF_CONDUCT.md**](CODE_OF_CONDUCT.md): Community standards, respectful collaboration, and maintainer responsibilities.
- [**COMMERCIAL.md**](COMMERCIAL.md): Commercial licensing, 14-day team trial, and seat pricing (>10 users).
- [**SECURITY.md**](SECURITY.md): Responsible disclosure policy and contact procedures.

---

## Keyboard Shortcuts & Zero-Mouse Navigation

Gih is engineered for complete keyboard accessibility—every panel, tree, diff hunk, and action is controllable without touching the mouse:

| Shortcut | Context | Action |
|---|---|---|
| `Ctrl + 1` / `Cmd + 1` | Global | Focus Sidebar (Branches, Stashes, Worktrees) |
| `Ctrl + 2` / `Cmd + 2` | Global | Focus Commit Graph (Interactive DAG) |
| `Ctrl + 3` / `Cmd + 3` | Global | Focus Staging Area & Inspector |
| `Ctrl + 4` / `Cmd + 4` | Global | Focus Terminal panel & CLI input |
| `F6` / `Shift + F6` | Global | Cycle focus forward / backward across open panels |
| `Ctrl + K` / `Cmd + K` | Global | Open Command Palette & Quick Switcher |
| `Ctrl + J` | Global | Toggle Integrated Git Terminal |
| `?` or `F1` | Global | Open Interactive Keyboard Shortcuts Cheatsheet |
| `Tab` / `Shift + Tab` | Global | Tab through interactive elements with high-contrast focus rings |
| `↑` / `↓` or `j` / `k` | Graph | Traverse commits (child / parent) |
| `Shift + ↑/↓` | Graph | Range select commits to inspect diff range |
| `Enter` or `m` | Graph | Open Commit Context Menu (Checkout, Rebase, Patch, etc.) |
| `Ctrl + F` | Graph | Filter commits by message, author, or SHA |
| `↑` / `↓` or `j` / `k` | Staging | Navigate file lists (conflicts, staged, unstaged) |
| `Space` | Staging | Toggle stage / unstage focused file |
| `Enter` | Staging | Inspect file diff in diff viewer |
| `e` | Staging | Open in-app Quick File Editor |
| `b` | Staging | Open interactive Git Blame inspector |
| `d` | Staging | Discard working changes for unstaged file |
| `c` | Staging | Focus commit message composer |
| `]` / `[` (or `n` / `p`) | Diff Viewer | Jump to next / previous diff hunk |
| `s` / `u` / `d` | Diff Viewer | Stage / Unstage / Discard currently focused hunk |
| `↑` / `↓` or `j` / `k` | Sidebar | Traverse branch, tag, stash, and worktree tree |
| `Enter` | Sidebar | Checkout branch / Switch worktree / Pop stash |
| `Delete` | Sidebar | Delete selected branch (with safety confirmation) |
| `Ctrl + Enter` | Composer | Submit commit with message |
| `Ctrl + S` | Editor | Save changes in Quick File Editor |
| `Esc` | Universal | Close modal / close diff view / blur input back to file list |

---

## License & Commercial Inquiries

Gih is **source-available** software distributed under the [**PolyForm Noncommercial License 1.0.0**](LICENSE):

- **Free Use**: Free of charge for individuals, students, non-profits, open-source contributors, and teams of **10 or fewer users**.
- **Commercial Teams (> 10 Users)**: Includes a **14-day free trial**, followed by **$5 USD/user/month** (or **$50 USD/user/year**). See [**COMMERCIAL.md**](COMMERCIAL.md) for details.

To start a team trial or purchase a commercial license, contact:
**natelligence.ai@gmail.com**
