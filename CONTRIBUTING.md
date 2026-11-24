# Contributing to Gih

Thank you for your interest in contributing to **Gih**! We welcome bug reports, workflow enhancements, accessibility improvements, and code contributions from everyone.

---

## 1. Quick Workflow

1. **Fork and clone the repository**:
   ```bash
   git clone https://github.com/Anames-dex/Gih.git
   cd Gih
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run the local development workstation**:
   ```bash
   npm run dev
   ```
   This spins up the Vite development server with Hot Module Replacement (HMR) and launches the Electron application shell.

4. **Verify types and bundle builds before committing**:
   ```bash
   npm run build
   ```

---

## 2. Commit Message Guidelines

We follow atomic conventional commits to keep the repository history clean and easy to inspect:

- `feat(scope)`: A new user-facing capability, component, or UX workflow.
- `fix(scope)`: A bug fix or error correction.
- `perf(scope)`: A performance optimization or memory footprint reduction.
- `refactor(scope)`: Internal structural improvements without altering external behavior.
- `docs(scope)`: Updates or additions to documentation.
- `chore(scope)`: Build scripts, configuration files, or release asset changes.

---

## 3. Pull Request Process

- Ensure every PR targets the `main` branch.
- Include a concise summary of the changes and testing steps in your PR description.
- For non-trivial features or UI changes, attach a brief screenshot or animated recording demonstrating the behavior.
- Ensure all tests, TypeScript compile checks (`npx tsc --noEmit`), and Vite production builds succeed.

For deep architectural context, see [**ARCHITECTURE.md**](ARCHITECTURE.md) and [**CONTRIBUTIONS.md**](CONTRIBUTIONS.md).
