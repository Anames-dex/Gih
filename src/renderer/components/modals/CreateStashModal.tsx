import React, { useState, useRef } from 'react'
import { Archive, X, Check, Shield } from 'lucide-react'
import { useFocusTrap } from '@/renderer/hooks/useFocusTrap'

interface CreateStashModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (message: string, includeUntracked: boolean, keepIndex: boolean) => Promise<void>
}

export const CreateStashModal: React.FC<CreateStashModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [message, setMessage] = useState('')
  const [includeUntracked, setIncludeUntracked] = useState(true)
  const [keepIndex, setKeepIndex] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)

  useFocusTrap(modalRef, isOpen, onClose)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await onConfirm(message.trim(), includeUntracked, keepIndex)
      setMessage('')
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

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
        className="w-full max-w-md bg-surface border border-surface-border rounded-2xl shadow-2xl overflow-hidden flex flex-col outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between shrink-0 bg-[#0f172a]/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">Create Git Stash</h2>
              <p className="text-xs text-slate-400">Save uncommitted changes to project stash stack</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-surface-hover rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Stash Description (Optional)
            </label>
            <input
              type="text"
              autoFocus
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. WIP: refactoring navigation before pull..."
              className="w-full bg-[#0c0e14] border border-surface-border rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-400"
            />
          </div>

          <div className="space-y-2.5 pt-1">
            <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeUntracked}
                onChange={(e) => setIncludeUntracked(e.target.checked)}
                className="rounded bg-surface-border border-surface-border text-purple-500 focus:ring-0"
              />
              <div>
                <span className="font-medium text-slate-200">Include untracked files</span>
                <span className="font-mono text-[10px] text-slate-500 ml-1.5">(-u / --include-untracked)</span>
              </div>
            </label>

            <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={keepIndex}
                onChange={(e) => setKeepIndex(e.target.checked)}
                className="rounded bg-surface-border border-surface-border text-purple-500 focus:ring-0"
              />
              <div>
                <span className="font-medium text-slate-200">Keep staged changes in index</span>
                <span className="font-mono text-[10px] text-slate-500 ml-1.5">(--keep-index)</span>
              </div>
            </label>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-surface-border">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white flex items-center gap-1.5 transition-all shadow-md shadow-purple-950/40 disabled:opacity-50"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Saving...' : 'Save Stash'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
