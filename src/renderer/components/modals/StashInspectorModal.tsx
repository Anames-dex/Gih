import React, { useState, useEffect, useRef } from 'react'
import type { GitStash } from '@/shared/types'
import { useFocusTrap, useBackdropClose } from '@/renderer/hooks/useFocusTrap'
import { showConfirm, showPrompt } from '@/renderer/utils/dialog'
import {
  Archive,
  X,
  Play,
  Trash2,
  GitBranch,
  Copy,
  Check,
  FileDiff,
  Clock
} from 'lucide-react'

interface StashInspectorModalProps {
  stash: GitStash | null
  onClose: () => void
  onApply: (index: number) => Promise<void>
  onPop: (index: number) => Promise<void>
  onDrop: (index: number) => Promise<void>
  onBranch: (branchName: string, index: number) => Promise<void>
  onGetStashDiff: (index: number) => Promise<string>
}

export const StashInspectorModal: React.FC<StashInspectorModalProps> = ({
  stash,
  onClose,
  onApply,
  onPop,
  onDrop,
  onBranch,
  onGetStashDiff,
}) => {
  const [diffText, setDiffText] = useState<string>('')
  const [isLoadingDiff, setIsLoadingDiff] = useState(true)
  const [copied, setCopied] = useState(false)
  const [isActionPending, setIsActionPending] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)

  useFocusTrap(modalRef, !!stash, onClose)
  const backdropProps = useBackdropClose(onClose)

  useEffect(() => {
    if (!stash) return
    let isMounted = true
    setIsLoadingDiff(true)
    onGetStashDiff(stash.index)
      .then((res) => {
        if (isMounted) setDiffText(res || 'No changes recorded in stash.')
      })
      .catch((err) => {
        if (isMounted) setDiffText(`Failed to load stash diff: ${err.message}`)
      })
      .finally(() => {
        if (isMounted) setIsLoadingDiff(false)
      })

    return () => {
      isMounted = false
    }
  }, [stash, onGetStashDiff])

  if (!stash) return null

  const handleCopyDiff = () => {
    navigator.clipboard.writeText(diffText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
      {...backdropProps}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="w-full max-w-4xl bg-surface border border-surface-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-surface-border flex items-center justify-between shrink-0 bg-[#0f172a]/60">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
              <Archive className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800/50">
                  {stash.name || `stash@{${stash.index}}`}
                </span>
                <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                  <Clock className="w-3 h-3 text-slate-500" />
                  {stash.date}
                </span>
              </div>
              <h2 className="text-sm font-semibold text-white truncate mt-1">
                {stash.message || 'WIP on branch'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopyDiff}
              disabled={isLoadingDiff || !diffText}
              className="px-2.5 py-1.5 rounded-lg border border-surface-border hover:bg-surface-hover text-xs text-slate-300 flex items-center gap-1.5 transition-colors disabled:opacity-40"
              title="Copy stash diff to clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Diff'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-surface-hover rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Diff preview body */}
        <div className="flex-1 overflow-auto p-4 bg-[#090b10] font-mono text-xs text-slate-300 leading-relaxed">
          {isLoadingDiff ? (
            <div className="p-8 text-center text-slate-500">Loading stash diff...</div>
          ) : (
            <div className="space-y-0.5">
              {diffText.split('\n').map((line, idx) => {
                const isAdd = line.startsWith('+') && !line.startsWith('+++')
                const isDel = line.startsWith('-') && !line.startsWith('---')
                const isHunk = line.startsWith('@@')
                const isHeader = line.startsWith('diff --git') || line.startsWith('index ')

                return (
                  <div
                    key={idx}
                    className={`px-2 py-0.5 rounded-xs whitespace-pre-wrap break-all ${
                      isAdd
                        ? 'bg-emerald-500/10 text-emerald-300'
                        : isDel
                        ? 'bg-rose-500/10 text-rose-300'
                        : isHunk
                        ? 'bg-indigo-950/40 text-indigo-300 font-bold'
                        : isHeader
                        ? 'text-sky-400 font-bold pt-2'
                        : 'text-slate-400'
                    }`}
                  >
                    {line}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-3.5 border-t border-surface-border bg-[#0f172a]/60 flex items-center justify-between shrink-0 text-xs">
          <div className="text-slate-400">
            Hash: <span className="font-mono text-slate-300">{stash.hash.slice(0, 10)}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isActionPending}
              onClick={async () => {
                const bName = await showPrompt({
                  title: 'Branch from Stash',
                  message: 'Create and checkout a new branch from this stash:',
                  placeholder: 'e.g. feat/stashed-work',
                  confirmLabel: 'Create & Checkout',
                })
                if (!bName) return
                setIsActionPending(true)
                try {
                  await onBranch(bName, stash.index)
                  onClose()
                } finally {
                  setIsActionPending(false)
                }
              }}
              className="px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-medium flex items-center gap-1.5 transition-colors"
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>Branch...</span>
            </button>

            <button
              type="button"
              disabled={isActionPending}
              onClick={async () => {
                setIsActionPending(true)
                try {
                  await onApply(stash.index)
                  onClose()
                } finally {
                  setIsActionPending(false)
                }
              }}
              className="px-3 py-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 font-medium flex items-center gap-1.5 transition-colors"
              title="Apply stash changes into working directory, keeping stash in list"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Apply Stash</span>
            </button>

            <button
              type="button"
              disabled={isActionPending}
              onClick={async () => {
                setIsActionPending(true)
                try {
                  await onPop(stash.index)
                  onClose()
                } finally {
                  setIsActionPending(false)
                }
              }}
              className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold flex items-center gap-1.5 transition-colors shadow-md shadow-purple-950/40"
              title="Apply stash changes and remove from stash list"
            >
              <span>Pop Stash</span>
            </button>

            <button
              type="button"
              disabled={isActionPending}
              onClick={async () => {
                const ok = await showConfirm({
                  title: 'Drop Stash',
                  message: `Permanently drop ${stash.name || `stash@{${stash.index}}`}? This cannot be undone.`,
                  confirmLabel: 'Drop Stash',
                  danger: true,
                })
                if (!ok) return
                setIsActionPending(true)
                try {
                  await onDrop(stash.index)
                  onClose()
                } finally {
                  setIsActionPending(false)
                }
              }}
              className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/50 border border-rose-800/40 rounded-lg transition-colors ml-1"
              title="Drop stash"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
