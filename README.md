# Gih

An open-source, visual-first Git workstation and interactive shell built for developers who want the speed of a GUI with the full depth of the Git command line.

---

## Highlights

- **Visual Commit DAG**: Interactive branch lanes, merge arcs, and commit topology with real-time updates.
- **Full Git CLI Parity**: Interactive rebase (`git rebase -i`), reflog recovery, worktrees, submodules, bisect, and hunk/line-level patch staging.
- **Bidirectional Shell**: Visual actions print the exact Git command being executed; commands run in the integrated terminal reflect on the graph instantly.
- **3-Way Merge Studio**: Side-by-side conflict resolution with semantic difference highlighting.
- **Reflog & Visual Undo**: Rewind accidental hard resets or dropped stashes with reflog snapshots.

---

## Architecture

- **Runtime**: Electron on Windows (x64)
- **Frontend**: React 19, TypeScript, Tailwind CSS
- **Icons**: Lucide React
- **Git Engine**: Direct child-process pipeline streaming stdout/stderr with filesystem watchers on `.git/`

---

## Development

```bash
# Install dependencies
npm install

# Start in development mode (Vite + Electron)
npm run dev

# Package for Windows
npm run build
```

---

## License

MIT © 2026 Anames-dex
