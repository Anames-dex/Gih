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
  FolderOpen,
  Loader2,
  Download
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
  onCloneRepo?: () => void
  onToggleTerminal: () => void
  onOpenCommandPalette: () => void
  isFetching?: boolean
  isPulling?: boolean
  isPushing?: boolean
  isStashing?: boolean
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
  onCloneRepo,
  onToggleTerminal,
  onOpenCommandPalette,
  isFetching = false,
  isPulling = false,
  isPushing = false,
  isStashing = false,
}) => {
  return (
    <header className="h-12 bg-surface border-b border-surface-border flex items-center justify-between px-3 select-none shrink-0" style={{ WebkitAppRegion: 'drag' } as any}>
      {/* Left: App Brand & Repository Switcher */}
      <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <div className="flex items-center pr-3 border-r border-surface-border">
          <img
            src="/logo.png"
            alt="Gih"
            className="h-9 w-auto object-contain drop-shadow select-none cursor-pointer active:scale-95 transition-transform"
            title="Gih"
          />
        </div>

        <button
          onClick={onOpenRepo}
          className="flex items-center gap-2 px-2.5 py-1 rounded bg-surface-subtle hover:bg-surface-hover active:scale-95 border border-surface-border text-xs text-slate-300 font-medium transition-all shadow-sm"
          title="Open another repository"
        >
          <FolderGit2 className="w-3.5 h-3.5 text-sky-400" />
          <span className="max-w-[140px] truncate">{repoName || 'Select Repo'}</span>
          <FolderOpen className="w-3 h-3 text-slate-500 ml-1" />
        </button>

        {onCloneRepo && (
          <button
            onClick={onCloneRepo}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-subtle hover:bg-surface-hover active:scale-95 border border-surface-border text-xs text-slate-300 font-medium transition-all shadow-sm"
            title="Clone a remote repository from URL"
          >
            <Download className="w-3.5 h-3.5 text-indigo-400" />
            <span>Clone</span>
          </button>
        )}

        {currentBranch && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-mono">
            <GitBranch className="w-3 h-3" />
            <span className="max-w-[120px] truncate">{currentBranch}</span>
          </div>
        )}
      </div>

      {/* Center: Quick Action Toolbar */}
      <div className="flex items-center gap-1.5" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <button
          onClick={onFetch}
          disabled={isFetching}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-slate-300 hover:text-white hover:bg-surface-hover active:scale-95 transition-all disabled:opacity-50 border border-transparent hover:border-surface-border/50"
          title="Fetch from all remotes"
        >
          {isFetching ? (
            <Loader2 className="w-3.5 h-3.5 text-sky-400 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
          )}
          <span>{isFetching ? 'Fetching...' : 'Fetch'}</span>
        </button>

        <button
          onClick={onPull}
          disabled={isPulling}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-slate-300 hover:text-white hover:bg-surface-hover active:scale-95 transition-all disabled:opacity-50 border border-transparent hover:border-surface-border/50"
          title="Pull from upstream"
        >
          {isPulling ? (
            <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
          ) : (
            <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
          )}
          <span>{isPulling ? 'Pulling...' : 'Pull'}</span>
        </button>

        <button
          onClick={onPush}
          disabled={isPushing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-slate-300 hover:text-white hover:bg-surface-hover active:scale-95 transition-all disabled:opacity-50 border border-transparent hover:border-surface-border/50"
          title="Push to upstream"
        >
          {isPushing ? (
            <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
          ) : (
            <ArrowUp className="w-3.5 h-3.5 text-indigo-400" />
          )}
          <span>{isPushing ? 'Pushing...' : 'Push'}</span>
        </button>

        <div className="w-px h-4 bg-surface-border mx-1" />

        <button
          onClick={onNewBranch}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-slate-300 hover:text-white hover:bg-surface-hover active:scale-95 transition-all border border-transparent hover:border-surface-border/50"
          title="Create new branch"
        >
          <GitBranch className="w-3.5 h-3.5 text-amber-400" />
          <span>Branch</span>
        </button>

        <button
          onClick={onStash}
          disabled={isStashing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-slate-300 hover:text-white hover:bg-surface-hover active:scale-95 transition-all disabled:opacity-50 border border-transparent hover:border-surface-border/50"
          title="Stash uncommitted changes"
        >
          {isStashing ? (
            <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin" />
          ) : (
            <Archive className="w-3.5 h-3.5 text-purple-400" />
          )}
          <span>{isStashing ? 'Stashing...' : 'Stash'}</span>
        </button>
      </div>

      {/* Right: Command Palette & Terminal Toggle (leaving room for Windows window control buttons) */}
      <div className="flex items-center gap-2 pr-32" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <button
          onClick={onOpenCommandPalette}
          className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-surface-subtle hover:bg-surface-hover active:scale-95 border border-surface-border text-xs text-slate-400 transition-all shadow-sm"
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
          className="p-1.5 rounded-md hover:bg-surface-hover active:scale-95 text-slate-400 hover:text-white transition-all border border-transparent hover:border-surface-border/50"
          title="Toggle Terminal & Visual Shell"
        >
          <Terminal className="w-4 h-4 text-slate-400" />
        </button>
      </div>
    </header>
  )
}
