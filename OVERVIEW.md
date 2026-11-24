# Gih — Product Overview

## 1. What is Gih?

**Gih** is a source-available, visual Git workstation and interactive shell designed for developers who demand the full expressive depth of the Git command-line interface, combined with the spatial clarity and speed of a modern visual client.

Most graphical Git clients create an artificial abstraction layer over Git. In doing so, they obscure what Git is actually doing, introduce non-standard terms, or strip away advanced features such as interactive rebasing, selective hunk application, reflog restoration, and granular resets.

Gih takes the opposite approach: **every visual interaction in Gih corresponds to an authentic Git CLI operation**, complete with transparent command logging, millisecond timing feedback, and instant bidirectional state synchronization.

---

## 2. Feature Comparison Matrix

| Capability | Git CLI | Traditional Git GUIs | Gih Workstation |
|---|:---:|:---:|:---:|
| **Full CLI Parity** | 100% | ~40–60% | **100%** |
| **Interactive Commit DAG** | Graph ASCII (`--graph`) | Static Tree | **Fluid Bezier Graph with Multi-Lane Routing** |
| **Hunk & Line Staging** | `git add -p` (Console) | Varies | **One-Click Hunk Stage, Unstage & Discard** |
| **Interactive Rebase** | Terminal Text Editor | Paid Feature | **Visual Reorder, Squash, Edit & Drop Cards** |
| **Merge Conflict Resolver** | Manual Edit | Limited | **3-Way Conflict Studio (`--ours`, `--theirs`)** |
| **Reflog Recovery** | `git reflog` | Not Available | **Visual Reflog Timeline with One-Click Reset** |
| **Granular Reset Control** | Complex Flags | Binary Reset | **Soft, Mixed & Hard Interactive Modes** |
| **Command Visibility** | Native | Hidden / Obscured | **Real-Time Telemetry & Command Island** |
| **Licensing** | GPLv2 | Proprietary / Subscription | **Free for Individuals (Commercial on request)** |

---

## 3. Core Capabilities Walkthrough

### 3.1. Interactive DAG Graph & Virtual Windowing
- Renders branch lanes, merge arcs, and commit topology using an analytical topological sorting engine.
- Virtual windowing renders only in-viewport rows and bezier splines, maintaining fluid 60 FPS scrolling on 50,000+ commit repositories.
- Direct Drag-and-Drop Git actions: drag branch badges onto target commit rows to merge, rebase, or cherry-pick.
- Instant search filter (`Ctrl+F`) highlighting matching commits across message, author, short-hash, and branch/tag badges.
- **Branch view toggle**: Switch cleanly between all repository branches (`git log --all`) and current active branch (`git log HEAD`).
- Right-click context menus for cherry-picking, **safe commit reversion (`git revert`)**, interactive rebasing, branch resets, and remote provider deep links.

### 3.2. Intra-Line Word Diffs, Staging Studio & Conventional Commits
- Character- and word-level diffing powered by longest common subsequence (LCS) tokenization.
- Segmented toggle to switch instantly between **Unified** (single column) and **Split** (side-by-side) views.
- Individual hunk actions: `Stage Hunk`, `Unstage Hunk`, and `Discard Hunk` via native `git apply`.
- **Conventional Commit helper pills**: One-click prefix formatting (`feat:`, `fix:`, `docs:`, `refactor:`, `perf:`, `test:`, `chore:`) with smart prefix replacement and cursor autofocus.
- **Discard All Changes**: Instant working-tree reset restoring tracked modifications (`git checkout -- .`) and removing untracked artifacts (`git clean -df`).
- **Quick `.gitignore` Action**: Contextual one-click pattern generator on unstaged files to ignore exact paths, file extensions (`*.ext`), or parent directories.
- Quick-toggle commit `Amend (HEAD)` checkbox that auto-populates the last commit message for rapid corrections.

### 3.3. Multi-Commit Selection & Range Diff Engine
- Multi-commit selection via `Ctrl+Click` / `Cmd+Click` and continuous range selection via `Shift+Click`.
- Aggregated diff view showing files changed across the entire selection range with intra-line word diffs.
- Quick-action buttons to copy commit hashes and inspect statistics.

### 3.4. Safe Force-Push & Remote Provider Deep-Links
- Dropdown push split-button supporting standard `git push` alongside `--force-with-lease` to safely guard against overwriting teammate commits.
- Automatic detection of GitHub, GitLab, and Bitbucket origin remotes with one-click links to view repositories, commits, and open pull requests.

### 3.5. 3-Way Merge Conflict Studio
- Identifies unmerged files (`status: conflicted`) automatically during merges or rebases.
- Provides immediate resolution actions:
  - `Keep Ours`: Checks out current branch version and stages into index.
  - `Keep Theirs`: Checks out incoming branch version and stages into index.
  - `Mark Resolved`: Stages the file once manual adjustments are complete.

### 3.6. Granular Reset Engine
- Replace ambiguous reset dialogs with explicit mode selection:
  - `--soft`: Moves branch pointer; keeps all changes staged in index.
  - `--mixed`: Default; moves branch pointer and keeps working directory intact as unstaged changes.
  - `--hard`: Discards working tree modifications with safety prompts.

### 3.7. Branch Management, Sync Badges & Git Worktree Studio
- Inline branch renaming (`git branch -m`) directly from the sidebar.
- Real-time `↑ ahead` and `↓ behind` commit badges on local and tracking branches.
- **Stale Branch Prune**: One-click action in the branch header executing `git fetch --prune` and deleting merged local tracking branches whose upstream is gone.
- **Git Worktree Studio**: Sidebar interface for `git worktree add`, listing, and safe deletion, enabling instant parallel checkouts in dedicated folders.
- Built-in **Clone Repository** modal with URL parsing, destination browsing, and automatic project opening.
- Stash manager with stash inspect, pop, apply, drop, and branch-from-stash support.

### 3.8. Interactive Git Blame & Commit Jump
- Full file blame inspection powered by `git blame --line-porcelain`.
- Color-coded commit gutters with deterministic hues, author signatures, dates, and commit subjects.
- Single-click commit focus: clicking any blame line jumps directly to that commit in the DAG graph.
- Search filter for instantly finding code snippets, authors, or commit messages across blame output.

### 3.9. Quick In-App Code Editor & Patch Studio
- In-app file viewer and editor modal with line numbers, tab spacing, and instant `Ctrl+S` disk saving.
- Configurable external editor launcher (`code`, `cursor`, `windsurf`, `subl`, or system default).
- Format-patch export directly from commit context menus (`git format-patch -1`).
- Unified Apply Patch modal supporting raw clipboard paste and `--cached` / `--reverse` flags.

### 3.10. 100% Zero-Mouse Keyboard Accessibility & Focus System
- **Pane Focus Switching**: Instant switching across app zones via `Ctrl+1` (Sidebar), `Ctrl+2` (Commit Graph), `Ctrl+3` (Staging Area & Inspector), `Ctrl+4` (Terminal input), or cycling with `F6` / `Shift+F6`.
- **Keyboard Graph Traversal**: Walk through commit DAG with `↑`/`↓` or Vim keys `j`/`k`, extend range diff selection with `Shift+↑/↓`, and trigger the commit actions menu with `Enter` or `m`.
- **Staging Keyboard Workstation**: Navigate through conflicted, staged, and unstaged files with `↑`/`↓` or `j`/`k`, toggle staging with `Space`, inspect diffs with `Enter`, edit with `e`, blame with `b`, discard with `d`, and jump to commit composer with `c`.
- **Hunk Navigation & Operations**: Step through diff hunks with `[` / `]` or `p` / `n`, and apply hunk patches with `s` (stage), `u` (unstage), or `d` (discard).
- **Sidebar Tree Traversal**: Navigate local branches, remote branches, tags, stashes, and worktrees with `↑`/`↓`, checkout with `Enter` or `Space`, and delete with `Delete`.
- **Interactive Keyboard Cheatsheet**: Press `?` or `F1` anywhere to view the full categorized shortcuts cheatsheet modal.
- **Accessible Focus Rings**: High-contrast, WCAG-compliant `:focus-visible` styling and accessible tab indexing across all interactive elements.

### 3.11. Stash Inspection & Custom Stash Studio
- **Stash Inspector Modal**: Direct inspection of individual stashes (`stash@{n}`) showing author, timestamp, parent commit, full patch diff with syntax highlighting, and immediate Pop, Apply, or Drop buttons.
- **Custom Stash Options**: Flexible stash creation studio supporting custom descriptions, untracked file inclusion (`--include-untracked` / `-u`), and staged index preservation (`--keep-index`).

### 3.12. Cryptographic Commit Signatures (GPG & SSH)
- **Signature Verification Badges**: Automatic evaluation of commit cryptographic signatures via `%G?`, `%GS`, `%GK`, and `%GF`, displaying `Verified` (emerald shield), `Unverified` (amber shield), or `Invalid` (rose shield) badges directly in the graph and commit inspector.
- **Commit Signing Toggle**: Single-click `Sign (-S)` checkbox in the commit message composer to automatically sign new or amended commits with configured GPG or SSH signing keys.
- **Key Details Inspector**: Displays signer name, key ID, and primary fingerprint directly in the commit inspector metadata card.

### 3.13. Visual Git Bisect Assistant & Binary Search HUD
- **One-Click Bisect Initiation**: Right-click any commit to start a Git bisect session, or select two commits to begin bisecting between a known good commit and bad commit.
- **Interactive HUD Banner**: In-progress bisect HUD with immediate action controls for `Mark Good`, `Mark Bad`, `Skip`, and `Reset / Abort`.
- **Telemetry & Step Guidance**: Displays revisions remaining, estimated steps left in the binary search, and highlights culprit commits upon completion.

### 3.14. File-Specific History Filter & Graph Isolation
- **Scoped Commit History (`git log -- <path>`)**: Filter the entire commit DAG to display only commits modifying a specific file.
- **Dismissible Header Filter Pill**: Displays active file focus in the graph header with instant single-click or `Esc` clearing.
- **Staging & Diff Shortcuts**: One-click `History` action on any modified or inspected file to isolate its history in the DAG graph.

### 3.15. Annotated Tagging Studio & Remote Tag Push
- **Annotated Tag Studio**: Modal to create lightweight or annotated tags with version names, release notes, changelog summaries, and commit targeting.
- **Remote Tag Push Actions**: Direct push controls on individual tags (`git push origin <tag>`) and header action to push all tags (`git push origin --tags`).

### 3.16. Git Submodules Studio & Recursive Sync
- **Sidebar Submodule Section**: Displays nested child submodules with current commit SHA, submodule status badges (`clean`, `modified`, `uninitialized`, `conflict`), and describe strings.
- **Recursive Submodule Sync**: Single-click action to execute `git submodule update --init --recursive`.
- **Direct Workspace Switching**: Double-click or click play on any submodule to instantly switch the Gih workspace into that child repository.

---

## 4. Contact & Inquiries

For enterprise licensing, questions, or commercial partnerships, contact:
**natelligence.ai@gmail.com**
