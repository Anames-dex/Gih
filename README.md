<div align="center">

<img src="public/logo.png" alt="Gih Logo" width="120" />

# Gih

### A high-craft visual Git workstation and interactive graph shell.

[![License](https://img.shields.io/badge/license-Community%20%26%20Commercial-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Cross--Platform-lightgrey.svg)]()
[![TypeScript](https://img.shields.io/badge/built%20with-TypeScript%20%7C%20React%2019-blue.svg)]()

[**Overview**](OVERVIEW.md) • [**Architecture**](ARCHITECTURE.md) • [**Contributing**](CONTRIBUTIONS.md) • [**Security**](SECURITY.md) • [**License**](LICENSE)

</div>

---

## What is Gih?

**Gih** is an open-source, visual-first Git workstation designed for developers who want the speed and clarity of a graphical commit graph without losing the full, unconstrained depth of the Git command-line interface.

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
- **Branch View Filter Toggle**: Toggle between `All Branches` (`git log --all`) and `Current Branch` (`git log HEAD`) directly from the graph search bar for distraction-free feature branch development.
- **Quick `.gitignore` Context Action**: One-click pattern generator on unstaged files to ignore specific files, file extensions (`*.ext`), or parent directories without editing text files manually.
- **Recent Repositories & Quick Switcher**: Persistent workspace history with instant dropdown switching, recent project jump lists, and 1-click workspace removal.
- **CLI & Windows Explorer Integration**: Launch directly from your shell (`gih .` or `gih path/to/repo`) or right-click any folder in Windows Explorer with "Open with Gih".
- **First-Commit Author Identity Setup**: Automatically detects missing `user.name` / `user.email` configurations, guides users through global/local identity setup, and auto-resumes their pending commit.
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
- **Windows**: `Gih-Portable-0.1.0.exe` (double-click to run immediately without installation) or `Gih-Setup-0.1.0.exe` (NSIS installer).
- **macOS**: `Gih-0.1.0-arm64.dmg` and `Gih-0.1.0-x64.dmg`.
- **Linux**: `Gih-0.1.0.AppImage` (universal portable Linux executable).

> **Git Detection**: Gih automatically verifies whether Git is installed and available on your system PATH on startup. If Git is not detected, Gih offers a guided one-click installation flow tailored to your operating system (official installer, winget, Apple developer tools, or Linux package managers) with instant in-app status re-checking.

---

## Documentation

- [**OVERVIEW.md**](OVERVIEW.md): Comprehensive feature breakdown and comparative matrix.
- [**ARCHITECTURE.md**](ARCHITECTURE.md): Deep dive into the process model, Git execution engine, watcher deduplication, and DAG layout algorithms.
- [**CONTRIBUTIONS.md**](CONTRIBUTIONS.md): Developer guide, code style standards, and conventional commit workflow.
- [**SECURITY.md**](SECURITY.md): Responsible disclosure policy and contact procedures.

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl + K` / `Cmd + K` | Open Command Palette |
| `Ctrl + F` / `Cmd + F` | Search Commit Graph |
| `Ctrl + Enter` | Submit Commit in Staging Panel |
| `Esc` | Clear active search or close dialog |

---

## License & Commercial Inquiries

Gih is distributed under the **Gih Community & Commercial License**:

- **Individual Use**: Free of charge for personal, non-commercial, and open-source contribution purposes.
- **Commercial & Enterprise Use**: Use by or on behalf of commercial companies requires an authorized commercial license.

For commercial licensing and enterprise inquiries, contact:
**natelligence.ai@gmail.com**
