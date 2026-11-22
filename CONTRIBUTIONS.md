# Contributing to Gih

Thank you for your interest in contributing to Gih! We welcome bug reports, feature suggestions, documentation enhancements, and code contributions.

---

## 1. Prerequisites

Before setting up Gih locally, ensure you have the following installed:

- **Node.js**: `v20.x` or higher (tested with `v24.x`)
- **Git**: Installed and available in your system `$PATH` (`git --version`)
- **Package Manager**: `npm` (included with Node.js)

---

## 2. Getting Started

1. **Fork & Clone**:
   ```bash
   git clone https://github.com/Anames-dex/Gih.git
   cd Gih
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Run in Development Mode**:
   ```bash
   npm run dev
   ```
   This launches the Vite development server with Hot Module Replacement (HMR) alongside Electron.

---

## 3. Project Structure

```
src/
├── main/                 # Electron main process & OS integration
│   ├── gitService.ts     # Native Git CLI orchestrator & stream engine
│   ├── index.ts          # Window management & IPC handlers
│   └── preload.ts        # Typed IPC context bridge (window.gih)
├── renderer/             # React 19 UI
│   ├── components/
│   │   ├── graph/        # DAG layout engine and SVG canvas
│   │   ├── layout/       # Header, draggable Sidebar, Panes
│   │   ├── modals/       # Clone, Rebase, Reset, Palette modals
│   │   ├── staging/      # Staging area, hunk diffs, conflict studio
│   │   └── terminal/     # Bottom dock, command logs, reflog
│   ├── App.tsx           # Primary application orchestration
│   └── main.tsx          # React mount entry
└── shared/
    └── types.ts          # Shared TypeScript interfaces across IPC boundary
```

---

## 4. Development Guidelines

### Code Quality
- **TypeScript**: Strict type annotations without implicit `any`.
- **Styling**: Tailwind CSS classes following the dark obsidian palette. Avoid hardcoded inline styles unless computing dynamic pixel dimensions (e.g. pane widths).
- **Git Safety**: When adding Git operations, always ensure commands run with appropriate argument arrays rather than string interpolation to avoid shell injection.

### Modular Commit Standards
We follow conventional commit formatting. Commits must be focused and atomic:

- `feat(scope)`: A new user-facing feature or UI capability
- `fix(scope)`: A bug fix
- `perf(scope)`: A performance optimization
- `refactor(scope)`: Code change that neither fixes a bug nor adds a feature
- `docs(scope)`: Documentation additions or updates

Always verify the build passes before committing:
```bash
npm run build
```

---

## 5. Submitting Pull Requests

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Make your changes with modular commits.
3. Test thoroughly against local repositories.
4. Open a Pull Request on GitHub against the `main` branch with a clear description of the problem solved and testing steps.
