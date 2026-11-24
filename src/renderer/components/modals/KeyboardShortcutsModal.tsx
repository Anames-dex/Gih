import React, { useState, useRef } from 'react'
import { useFocusTrap } from '@/renderer/hooks/useFocusTrap'
import {
  Keyboard,
  X,
  Search,
  Terminal,
  GitBranch,
  FileText,
  CornerDownLeft,
  Layers,
  FileCode,
  FileDiff,
  CheckCircle2,
  Sparkles
} from 'lucide-react'

interface KeyboardShortcutsModalProps {
  isOpen: boolean
  onClose: () => void
}

interface ShortcutGroup {
  category: string
  icon: React.FC<{ className?: string }>
  shortcuts: { keys: string[]; description: string; context?: string }[]
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    category: 'Global & Pane Focus Navigation',
    icon: Layers,
    shortcuts: [
      { keys: ['Ctrl', '1'], description: 'Focus Sidebar (Branches, Remotes, Stashes, Worktrees)' },
      { keys: ['Ctrl', '2'], description: 'Focus Commit Graph (Interactive DAG)' },
      { keys: ['Ctrl', '3'], description: 'Focus Staging Area & Inspector' },
      { keys: ['Ctrl', '4'], description: 'Focus Terminal & CLI input' },
      { keys: ['F6'], description: 'Cycle forward across all open panes' },
      { keys: ['Shift', 'F6'], description: 'Cycle backward across all open panes' },
      { keys: ['Ctrl', 'K'], description: 'Open Command Palette & branch switcher' },
      { keys: ['Ctrl', '`'], description: 'Toggle integrated terminal panel' },
      { keys: ['?'], description: 'Open Keyboard Shortcuts & Cheatsheet' },
      { keys: ['F1'], description: 'Open Keyboard Shortcuts & Cheatsheet' },
      { keys: ['Tab'], description: 'Focus next interactive element / button' },
      { keys: ['Shift', 'Tab'], description: 'Focus previous interactive element' },
    ],
  },
  {
    category: 'Commit Graph & DAG Traversal',
    icon: GitBranch,
    shortcuts: [
      { keys: ['↓', 'or', 'j'], description: 'Select next commit (child)' },
      { keys: ['↑', 'or', 'k'], description: 'Select previous commit (parent)' },
      { keys: ['Shift', '↓/↑'], description: 'Multi-select range to inspect commit diff range' },
      { keys: ['Enter', 'or', 'm'], description: 'Open Commit Action Menu (Checkout, Rebase, Patch, etc.)' },
      { keys: ['Ctrl', 'F'], description: 'Filter commits by message, author, or SHA' },
      { keys: ['Esc'], description: 'Clear search filter or clear commit selection' },
    ],
  },
  {
    category: 'Staging Area & Working Files',
    icon: FileText,
    shortcuts: [
      { keys: ['↓', 'or', 'j'], description: 'Navigate down file list' },
      { keys: ['↑', 'or', 'k'], description: 'Navigate up file list' },
      { keys: ['Space'], description: 'Toggle stage / unstage selected file' },
      { keys: ['Enter'], description: 'Open file diff inspection viewer' },
      { keys: ['e'], description: 'Open Quick View / In-App file editor' },
      { keys: ['b'], description: 'Open interactive Git Blame inspector' },
      { keys: ['d'], description: 'Discard changes for selected unstaged file' },
      { keys: ['c'], description: 'Focus commit message composer immediately' },
      { keys: ['Esc'], description: 'Close diff viewer / blur input back to file list' },
    ],
  },
  {
    category: 'Diff Viewer & Hunk Staging',
    icon: FileDiff,
    shortcuts: [
      { keys: [']', 'or', 'n'], description: 'Jump to next hunk in diff' },
      { keys: ['[', 'or', 'p'], description: 'Jump to previous hunk in diff' },
      { keys: ['s'], description: 'Stage currently focused hunk only' },
      { keys: ['u'], description: 'Unstage currently focused hunk' },
      { keys: ['d'], description: 'Discard currently focused hunk from working directory' },
      { keys: ['Esc'], description: 'Close diff viewer and return to list' },
    ],
  },
  {
    category: 'Sidebar Branch Tree & Worktrees',
    icon: Layers,
    shortcuts: [
      { keys: ['↓', 'or', 'j'], description: 'Navigate down branches, stashes, and worktrees' },
      { keys: ['↑', 'or', 'k'], description: 'Navigate up branches, stashes, and worktrees' },
      { keys: ['Enter'], description: 'Checkout branch / switch worktree / pop stash' },
      { keys: ['Delete'], description: 'Delete selected branch (safety checks active)' },
      { keys: ['Space'], description: 'Checkout selected branch' },
    ],
  },
  {
    category: 'Commit Composer & In-App Editor',
    icon: FileCode,
    shortcuts: [
      { keys: ['Ctrl', 'Enter'], description: 'Execute commit with message' },
      { keys: ['Esc'], description: 'Unfocus commit input / return focus to files' },
      { keys: ['Ctrl', 'S'], description: 'Save file changes in Quick Editor' },
      { keys: ['Tab'], description: 'Insert 2 indentation spaces in Quick Editor' },
    ],
  },
]

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const modalRef = useRef<HTMLDivElement>(null)

  useFocusTrap(modalRef, isOpen, onClose)

  if (!isOpen) return null

  const filteredGroups = SHORTCUT_GROUPS.map((group) => {
    if (activeCategory !== 'all' && group.category !== activeCategory) {
      return null
    }
    const filteredShortcuts = group.shortcuts.filter((s) => {
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase().trim()
      return (
        s.description.toLowerCase().includes(q) ||
        s.keys.some((k) => k.toLowerCase().includes(q))
      )
    })
    if (filteredShortcuts.length === 0) return null
    return { ...group, shortcuts: filteredShortcuts }
  }).filter(Boolean) as ShortcutGroup[]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="w-full max-w-3xl bg-surface border border-surface-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-surface-border flex items-center justify-between shrink-0 bg-[#0f172a]/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shadow-inner">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Keyboard Navigation Cheatsheet</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Zero-Mouse Ready
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Every feature in Gih can be navigated, inspected, staged, and controlled via keyboard
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-surface-hover rounded-lg transition-colors"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter bar */}
        <div className="px-6 py-3 border-b border-surface-border/60 bg-[#0c0e14] flex items-center gap-3 shrink-0">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search shortcuts (e.g. stage, commit, focus, pane)..."
              className="w-full bg-surface border border-surface-border rounded-lg pl-9 pr-4 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-brand"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto text-[11px]">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                activeCategory === 'all'
                  ? 'bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All
            </button>
            {SHORTCUT_GROUPS.map((g) => (
              <button
                key={g.category}
                onClick={() => setActiveCategory(g.category)}
                className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap ${
                  activeCategory === g.category
                    ? 'bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {g.category.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Shortcuts List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {filteredGroups.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No shortcuts matched '{searchQuery}'.
            </div>
          ) : (
            filteredGroups.map((group) => (
              <div key={group.category} className="space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                  <group.icon className="w-4 h-4 text-sky-400" />
                  <span>{group.category}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {group.shortcuts.map((s, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-surface-subtle/70 border border-surface-border/50 hover:border-surface-border hover:bg-surface-hover/50 transition-colors"
                    >
                      <span className="text-xs text-slate-300 font-medium mr-2">
                        {s.description}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {s.keys.map((k, kIdx) =>
                          k === 'or' ? (
                            <span key={kIdx} className="text-[10px] text-slate-500 px-0.5">
                              or
                            </span>
                          ) : (
                            <kbd
                              key={kIdx}
                              className="px-2 py-0.5 rounded-md bg-[#090b10] border border-surface-border/80 text-[11px] font-mono text-sky-300 shadow-sm font-semibold"
                            >
                              {k}
                            </kbd>
                          )
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-surface-border bg-[#0f172a]/40 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Accessible with screen readers, full keyboard focus rings, and high contrast</span>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-surface border border-surface-border hover:bg-surface-hover text-white text-xs font-semibold transition-colors"
          >
            Close (Esc)
          </button>
        </div>
      </div>
    </div>
  )
}
