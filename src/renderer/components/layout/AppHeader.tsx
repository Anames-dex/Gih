import React from 'react'
import {
  FolderGit2,
  ArrowDown,
  ArrowUp,
  RefreshCw,
  GitBranch,
  Archive,
  Terminal,
  Search,
  FolderOpen
} from 'lucide-react'

interface AppHeaderProps {
  repoName: string
  currentBranch: string | null
  onFetch: () => void
  onPull: () => void
  onPush: () => void
  onNewBranch: () => void
  onStash: () => void
  onOpenRepo: () => void
  onToggleTerminal: () => void
  onOpenCommandPalette: () => void
  isFetching?: boolean
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  repoName,
  currentBranch,
  onFetch,
  onPull,
  onPush,
  onNewBranch,
  onStash,
  onOpenRepo,
  onToggleTerminal,
  onOpenCommandPalette,
  isFetching = false,
}) => {
  return (
    <header className="h-12 bg-surface border-b border-surface-border flex items-center justify-between px-3 select-none shrink-0" style={{ WebkitAppRegion: 'drag' } as any}>
      {/* Left: App Brand & Repository Switcher */}
      <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <div className="flex items-center gap-2 pr-2 border-r border-surface-border">
          <div className="w-6 h-6 rounded bg-gradient-to-tr from-sky-500 to-indigo-500 flex items-center justify-center font-bold text-xs text-white shadow-sm shadow-sky-500/20">
            G
          </div>
          <span className="font-semibold text-sm tracking-tight text-white">Gih</span>
        </div>

        <button
          onClick={onOpenRepo}
          className="flex items-center gap-2 px-2.5 py-1 rounded bg-surface-subtle hover:bg-surface-hover border border-surface-border text-xs text-slate-300 font-medium transition-colors"
          title="Open another repository"
        >
          <FolderGit2 className="w-3.5 h-3.5 text-sky-400" />
          <span className="max-w-[140px] truncate">{repoName || 'Select Repo'}</span>
          <FolderOpen className="w-3 h-3 text-slate-500 ml-1" />
        </button>

        {currentBranch && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-mono">
            <GitBranch className="w-3 h-3" />
            <span className="max-w-[120px] truncate">{currentBranch}</span>
          </div>
        )}
      </div>

      {/* Center: Quick Action Toolbar */}
      <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <button
          onClick={onFetch}
          disabled={isFetching}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-slate-300 hover:text-white hover:bg-surface-hover transition-colors disabled:opacity-50"
          title="Fetch from all remotes"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${isFetching ? 'animate-spin' : ''}`} />
          <span>Fetch</span>
        </button>

        <button
          onClick={onPull}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-slate-300 hover:text-white hover:bg-surface-hover transition-colors"
          title="Pull from upstream"
        >
          <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
          <span>Pull</span>
        </button>

        <button
          onClick={onPush}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-slate-300 hover:text-white hover:bg-surface-hover transition-colors"
          title="Push to upstream"
        >
          <ArrowUp className="w-3.5 h-3.5 text-indigo-400" />
          <span>Push</span>
        </button>

        <div className="w-px h-4 bg-surface-border mx-1" />

        <button
          onClick={onNewBranch}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-slate-300 hover:text-white hover:bg-surface-hover transition-colors"
          title="Create new branch"
        >
          <GitBranch className="w-3.5 h-3.5 text-amber-400" />
          <span>Branch</span>
        </button>

        <button
          onClick={onStash}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-slate-300 hover:text-white hover:bg-surface-hover transition-colors"
          title="Stash uncommitted changes"
        >
          <Archive className="w-3.5 h-3.5 text-purple-400" />
          <span>Stash</span>
        </button>
      </div>

      {/* Right: Command Palette & Terminal Toggle (leaving room for Windows window control buttons) */}
      <div className="flex items-center gap-2 pr-32" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <button
          onClick={onOpenCommandPalette}
          className="flex items-center gap-2 px-2.5 py-1 rounded bg-surface-subtle hover:bg-surface-hover border border-surface-border text-xs text-slate-400 transition-colors"
          title="Open Command Palette (Ctrl+K)"
        >
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <span className="hidden sm:inline">Commands</span>
          <kbd className="px-1 py-0.2 rounded bg-surface-border text-[10px] text-slate-400 font-mono">
            Ctrl+K
          </kbd>
        </button>

        <button
          onClick={onToggleTerminal}
          className="p-1.5 rounded hover:bg-surface-hover text-slate-400 hover:text-white transition-colors"
          title="Toggle Terminal & Visual Shell"
        >
          <Terminal className="w-4 h-4 text-slate-400" />
        </button>
      </div>
    </header>
  )
}
