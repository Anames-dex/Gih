import React, { useState } from 'react'
import type { GitCommit } from '@/shared/types'
import { AlertTriangle, RotateCcw, X, ShieldAlert, CheckCircle2 } from 'lucide-react'

export type ResetMode = 'soft' | 'mixed' | 'hard'

interface ResetBranchModalProps {
  isOpen: boolean
  commit: GitCommit | null
  currentBranch: string | null
  onClose: () => void
  onConfirmReset: (commit: GitCommit, mode: ResetMode) => void
}

export const ResetBranchModal: React.FC<ResetBranchModalProps> = ({
  isOpen,
  commit,
  currentBranch,
  onClose,
  onConfirmReset,
}) => {
  const [selectedMode, setSelectedMode] = useState<ResetMode>('mixed')

  if (!isOpen || !commit) return null

  const handleExecute = () => {
    onConfirmReset(commit, selectedMode)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in select-none">
      <div className="bg-surface border border-surface-border rounded-xl shadow-2xl max-w-lg w-full overflow-hidden text-slate-200">
        {/* Header */}
        <div className="p-4 border-b border-surface-border flex items-center justify-between bg-surface-subtle/50">
          <div className="flex items-center gap-2.5">
            <RotateCcw className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-white">
              Reset Branch <span className="font-mono text-sky-400">"{currentBranch || 'HEAD'}"</span>
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-surface-hover rounded text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Commit Target Summary */}
        <div className="p-4 border-b border-surface-border/60 bg-[#0c0e14]">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
            Target Commit
          </div>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{commit.summary}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {commit.author.name} • {commit.author.date}
              </p>
            </div>
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-surface-subtle text-sky-300 shrink-0 border border-surface-border/50">
              {commit.shortHash}
            </span>
          </div>
        </div>

        {/* Reset Mode Selector */}
        <div className="p-4 space-y-2.5">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
            Select Reset Mode
          </div>

          {/* Soft */}
          <div
            onClick={() => setSelectedMode('soft')}
            className={`p-3 rounded-lg border cursor-pointer transition-all ${
              selectedMode === 'soft'
                ? 'bg-emerald-950/20 border-emerald-500/60 ring-1 ring-emerald-500/40'
                : 'bg-surface-subtle/40 border-surface-border/60 hover:border-surface-border'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400 font-mono">--soft</span>
              <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800/40">
                Safe • Keeps changes staged
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Moves HEAD to this commit. All changes between this commit and previous HEAD stay staged in the index ready to commit.
            </p>
          </div>

          {/* Mixed */}
          <div
            onClick={() => setSelectedMode('mixed')}
            className={`p-3 rounded-lg border cursor-pointer transition-all ${
              selectedMode === 'mixed'
                ? 'bg-sky-950/20 border-sky-500/60 ring-1 ring-sky-500/40'
                : 'bg-surface-subtle/40 border-surface-border/60 hover:border-surface-border'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-sky-400 font-mono">--mixed (Git Default)</span>
              <span className="text-[10px] font-semibold text-sky-400 bg-sky-950/50 px-2 py-0.5 rounded border border-sky-800/40">
                Keeps working copy unstaged
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Moves HEAD and resets the index. Your files on disk are completely preserved in the working directory as unstaged changes.
            </p>
          </div>

          {/* Hard */}
          <div
            onClick={() => setSelectedMode('hard')}
            className={`p-3 rounded-lg border cursor-pointer transition-all ${
              selectedMode === 'hard'
                ? 'bg-rose-950/20 border-rose-500/60 ring-1 ring-rose-500/40'
                : 'bg-surface-subtle/40 border-surface-border/60 hover:border-surface-border'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-400 font-mono">--hard</span>
              <span className="text-[10px] font-semibold text-rose-400 bg-rose-950/50 px-2 py-0.5 rounded border border-rose-800/40 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Destructive • Discards all changes
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Forcefully discards all working tree modifications and resets index. Any uncommitted code will be permanently lost.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-surface-border bg-surface-subtle/50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-surface-border text-xs text-slate-300 hover:text-white hover:bg-surface-hover active:scale-95 transition-all"
          >
            Cancel
          </button>

          <button
            onClick={handleExecute}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white shadow-lg active:scale-95 transition-all ${
              selectedMode === 'hard'
                ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-950/50'
                : selectedMode === 'soft'
                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/50'
                : 'bg-sky-600 hover:bg-sky-500 shadow-sky-950/50'
            }`}
          >
            {selectedMode === 'hard' ? (
              <ShieldAlert className="w-3.5 h-3.5" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            <span>Execute Reset ({`git reset --${selectedMode}`})</span>
          </button>
        </div>
      </div>
    </div>
  )
}
