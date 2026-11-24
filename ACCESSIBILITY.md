# Gih Accessibility & Zero-Mouse Navigation Specification

Accessibility is a core engineering foundation in **Gih**. The application is designed to be fully operable without requiring a mouse, trackpad, or pointing device, providing a fluid keyboard-first developer experience while maintaining high contrast, clear visual cues, and WCAG 2.1 AA compliant interfaces.

---

## 1. Zero-Mouse Architecture & Focus Management

Gih splits the workstation into four distinct navigable zones, each with dedicated global focus hotkeys:

| Target Zone | Windows & Linux | macOS | Description |
|---|---|---|---|
| **Sidebar** | `Ctrl + 1` | `Cmd + 1` | Focuses local/remote branches, tags, submodules, stashes, and worktrees. |
| **Commit Graph** | `Ctrl + 2` | `Cmd + 2` | Focuses the topological DAG canvas and commit history list. |
| **Staging Area** | `Ctrl + 3` | `Cmd + 3` | Focuses changed files, diff viewers, and the commit message composer. |
| **Integrated Terminal** | `Ctrl + 4` | `Cmd + 4` | Focuses the embedded Git CLI shell and reflog dock. |
| **Panel Cycle Forward** | `F6` | `F6` | Cycles keyboard focus sequentially through open panels. |
| **Panel Cycle Backward** | `Shift + F6` | `Shift + F6` | Cycles keyboard focus backward across open panels. |
| **Command Palette** | `Ctrl + K` | `Cmd + K` | Global quick launcher and branch switcher. |
| **Shortcuts Guide** | `?` or `F1` | `?` or `F1` | Opens the interactive categorized keyboard reference modal. |

---

## 2. In-Pane Keyboard Operation

### 2.1. Commit Graph Navigation
- **`↑` / `↓` or `j` / `k`**: Traverse commits chronologically (child to parent). Viewport auto-scrolls to keep the focused commit in view.
- **`Shift + ↑` / `Shift + ↓`**: Select a continuous commit range to inspect aggregate file changes and statistics.
- **`Enter` or `m`**: Open the keyboard-navigable context menu for the focused commit (checkout, branch creation, tag creation, cherry-pick, patch export, revert, rebase, and bisect actions).
- **`Ctrl + F` (`Cmd + F`)**: Open the graph filter bar to search by message, author name, short hash, or branch reference.
- **`Esc`**: Clear commit range selections, exit search filters, or close menus.

### 2.2. Staging Area & File Inspection
- **`↑` / `↓` or `j` / `k`**: Navigate vertically across conflicted, staged, and unstaged file lists.
- **`Space`**: Toggle stage or unstage state for the selected file without mouse interaction.
- **`Enter`**: Open the file's unified or split diff viewer in the main panel.
- **`e`**: Open the focused file in the in-app Quick File Editor.
- **`b`**: Launch the interactive line-by-line Git Blame inspector.
- **`d`**: Discard working tree changes for the selected unstaged file (with confirmation).
- **`c`**: Jump keyboard focus directly into the commit message composer textarea.

### 2.3. Precision Hunk Staging in Diff Viewer
- **`]` or `n`**: Jump focus to the next diff hunk.
- **`[` or `p`**: Jump focus to the previous diff hunk.
- **`s`**: Stage the currently active diff hunk (`git apply --cached`).
- **`u`**: Unstage the currently active diff hunk (`git apply --cached --reverse`).
- **`d`**: Discard the currently active diff hunk (`git apply --reverse`).

### 2.4. Sidebar Tree Traversal
- **`↑` / `↓` or `j` / `k`**: Move focus across branch nodes, tags, stashes, submodules, and worktrees.
- **`Enter`**: Checkout selected branch, switch to worktree, or pop stash.
- **`Delete` or `Backspace`**: Trigger delete branch action for non-active branches with a confirmation dialog.

### 2.5. Commit Message Composer
- **`Ctrl + Enter` (`Cmd + Enter`)**: Commit staged changes with the typed message.
- **Tab Navigation**: Tab through conventional commit helper pills (`feat:`, `fix:`, etc.), sign-off (`-s`), GPG/SSH sign (`-S`), and amend checkboxes.

---

## 3. High-Contrast Focus Indicators

All interactive buttons, list items, tree nodes, inputs, and diff hunks utilize explicit, high-contrast `:focus-visible` styling:
- **Focus Rings**: Dual-layer outline with `2px` ring width in vibrant sky (`#38bdf8`) or amber (`#f59e0b`) accents.
- **Offset Separation**: `ring-offset-2 ring-offset-[#0c0e14]` ensures clear visibility against dark obsidian backgrounds.
- **No Mouse Clutter**: Standard mouse clicks do not display focus rings; they appear exclusively when navigating via keyboard (`Tab`, arrows, or shortcut triggers).

---

## 4. Visual Contrast & Readability (WCAG 2.1 AA)

- **Contrast Ratios**: Body text (`#f1f5f9`), metadata labels (`#94a3b8`), and semantic badges (emerald `#10b981`, rose `#f43f5e`, sky `#38bdf8`) maintain a minimum contrast ratio of 4.5:1 against the dark surface colors (`#0f172a`, `#1e293b`).
- **Font Legibility**: High-legibility monospaced typography (`ui-monospace`, `SF Mono`, `Consolas`) is applied to hashes, diff lines, blame dates, and Git commands for unambiguous character recognition.

---

## 5. Screen Reader & Semantic DOM Structure

- Interactive elements use semantic HTML (`<button>`, `<input>`, `<textarea>`, `<aside>`, `<main>`) with explicit `aria-label`, `title`, and descriptive text.
- Virtualized lists maintain DOM tab indexing and focus restoration when navigating between panels or closing modals.
- Toast notifications announce operation success or failure with descriptive command text.

---

## 6. Feedback & Accessibility Issues

We are committed to continuous accessibility improvements. If you encounter any friction, missing screen reader announcements, or keyboard trap issues, please reach out to us:

- **Email**: `natelligence.ai@gmail.com`
- **GitHub Issues**: Open an issue labeled `accessibility` on the repository tracker.
