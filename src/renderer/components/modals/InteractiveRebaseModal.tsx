import React, { useState, useRef } from 'react'
import type { GitCommit } from '@/shared/types'
import { GitCommit as CommitIcon, ArrowUp, ArrowDown, X, Play, RefreshCw } from 'lucide-react'
import { useFocusTrap } from '@/renderer/hooks/useFocusTrap'

export type RebaseAction = 'pick' | 'reword' | 'edit' | 'squash' | 'fixup' | 'drop'

export interface RebaseStep {
  commit: GitCommit
  action: RebaseAction
  rewordMessage?: string
}

interface InteractiveRebaseModalProps {
  isOpen: boolean
  onClose: () => void
  commits: GitCommit[]
  onExecuteRebase: (steps: RebaseStep[]) => void
}

export const InteractiveRebaseModal: React.FC<InteractiveRebaseModalProps> = ({
  isOpen,
  onClose,
  commits,
  onExecuteRebase,
}) => {
  const [steps, setSteps] = useState<RebaseStep[]>(() =>
    commits.slice(0, 10).map((c) => ({ commit: c, action: 'pick' }))
  )
  const modalRef = useRef<HTMLDivElement>(null)

  useFocusTrap(modalRef, isOpen, onClose)

  if (!isOpen) return null

  const handleActionChange = (idx: number, action: RebaseAction) => {
    setSteps((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], action }
      return next
    })
  }

  const moveStep = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= steps.length) return
    setSteps((prev) => {
      const next = [...prev]
      const [item] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, item)
      return next
    })
  }

  const getActionColor = (action: RebaseAction) => {
    switch (action) {
      case 'pick': return 'text-sky-400 border-sky-400/40 bg-sky-950/30'
      case 'squash': return 'text-purple-400 border-purple-400/40 bg-purple-950/30'
      case 'fixup': return 'text-amber-400 border-amber-400/40 bg-amber-950/30'
      case 'reword': return 'text-emerald-400 border-emerald-400/40 bg-emerald-950/30'
      case 'drop': return 'text-rose-400 border-rose-400/40 bg-rose-950/30'
      default: return 'text-slate-400 border-slate-700 bg-surface'
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="w-[720px] max-h-[85vh] bg-surface border border-surface-border rounded-xl shadow-2xl flex flex-col overflow-hidden outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-brand" />
            <div>
              <h2 className="text-sm font-bold text-white">Visual Interactive Rebase</h2>
              <p className="text-xs text-slate-400">
                Reorder, squash, pick, or drop commits visually.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-surface-hover rounded text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Steps List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {steps.map((step, idx) => (
            <div
              key={step.commit.hash}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                step.action === 'drop'
                  ? 'opacity-40 bg-rose-950/10 border-rose-900/30 line-through'
                  : 'bg-surface-subtle border-surface-border'
              }`}
            >
              {/* Reorder Buttons */}
              <div className="flex flex-col gap-0.5">
                <button
                  disabled={idx === 0}
                  onClick={() => moveStep(idx, idx - 1)}
                  className="p-1 hover:bg-surface-hover rounded text-slate-400 hover:text-white disabled:opacity-20"
                >
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button
                  disabled={idx === steps.length - 1}
                  onClick={() => moveStep(idx, idx + 1)}
                  className="p-1 hover:bg-surface-hover rounded text-slate-400 hover:text-white disabled:opacity-20"
                >
                  <ArrowDown className="w-3 h-3" />
                </button>
              </div>

              {/* Action Selector */}
              <select
                value={step.action}
                onChange={(e) => handleActionChange(idx, e.target.value as RebaseAction)}
                className={`text-xs font-mono font-bold px-2 py-1 rounded border focus:outline-none ${getActionColor(
                  step.action
                )}`}
              >
                <option value="pick">pick</option>
                <option value="reword">reword</option>
                <option value="edit">edit</option>
                <option value="squash">squash</option>
                <option value="fixup">fixup</option>
                <option value="drop">drop</option>
              </select>

              {/* Commit Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <CommitIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="text-xs font-semibold text-slate-200 truncate">
                    {step.commit.summary}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-[11px] font-mono text-slate-500">
                  <span>{step.commit.shortHash}</span>
                  <span>{step.commit.author.name}</span>
                  <span>{step.commit.author.date}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-surface-border bg-surface-subtle/50 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-mono">
            {steps.filter((s) => s.action !== 'drop').length} commits will be rebased
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded text-xs text-slate-400 hover:text-white hover:bg-surface-hover"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onExecuteRebase(steps)
                onClose()
              }}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-brand hover:bg-brand-hover text-slate-950 font-bold rounded text-xs transition-colors shadow-sm"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start Rebase</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
