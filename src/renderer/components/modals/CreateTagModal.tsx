import React, { useState, useEffect, useRef } from 'react'
import { Tag as TagIcon, X, Check, UploadCloud } from 'lucide-react'
import type { GitCommit } from '@/shared/types'
import { useFocusTrap } from '@/renderer/hooks/useFocusTrap'

interface CreateTagModalProps {
  isOpen: boolean
  onClose: () => void
  targetCommit?: GitCommit | null
  onConfirm: (name: string, message: string, targetHash?: string, pushImmediately?: boolean) => Promise<void>
}

export const CreateTagModal: React.FC<CreateTagModalProps> = ({
  isOpen,
  onClose,
  targetCommit,
  onConfirm,
}) => {
  const [tagName, setTagName] = useState('')
  const [tagMessage, setTagMessage] = useState('')
  const [targetHash, setTargetHash] = useState('')
  const [isAnnotated, setIsAnnotated] = useState(true)
  const [pushImmediately, setPushImmediately] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)

  useFocusTrap(modalRef, isOpen, onClose)

  useEffect(() => {
    if (isOpen) {
      setTagName('')
      setTagMessage('')
      setTargetHash(targetCommit ? targetCommit.hash : '')
      setIsAnnotated(true)
      setPushImmediately(false)
    }
  }, [isOpen, targetCommit])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tagName.trim()) return
    setIsSubmitting(true)
    try {
      await onConfirm(
        tagName.trim(),
        isAnnotated ? tagMessage.trim() : '',
        targetHash.trim() || undefined,
        pushImmediately
      )
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
        {/* Header */}
        <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between shrink-0 bg-[#0f172a]/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <TagIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">Create Git Tag</h2>
              <p className="text-xs text-slate-400">Mark release version or milestone commit</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-surface-hover rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Tag Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              autoFocus
              required
              value={tagName}
              onChange={(e) => setTagName(e.target.value)}
              placeholder="e.g. v1.0.0, release-2026.11"
              className="w-full px-3 py-2 bg-background border border-surface-border rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/50 transition-all font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Target Commit (Optional)
            </label>
            <input
              type="text"
              value={targetHash}
              onChange={(e) => setTargetHash(e.target.value)}
              placeholder="Defaults to HEAD commit"
              className="w-full px-3 py-2 bg-background border border-surface-border rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/50 transition-all font-mono"
            />
            {targetCommit && (
              <p className="mt-1 text-[11px] text-slate-500 truncate">
                Selected: <span className="font-mono text-slate-300">{targetCommit.shortHash}</span> — {targetCommit.summary}
              </p>
            )}
          </div>

          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isAnnotated}
                onChange={(e) => setIsAnnotated(e.target.checked)}
                className="rounded bg-surface-border border-surface-border text-emerald-500 focus:ring-0"
              />
              <span>Annotated Tag (includes release message & author metadata)</span>
            </label>
          </div>

          {isAnnotated && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Release Notes / Annotation Message
              </label>
              <textarea
                rows={3}
                value={tagMessage}
                onChange={(e) => setTagMessage(e.target.value)}
                placeholder="Version description, key changes, or release summary..."
                className="w-full px-3 py-2 bg-background border border-surface-border rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/50 transition-all resize-none font-mono"
              />
            </div>
          )}

          <div className="pt-1">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={pushImmediately}
                onChange={(e) => setPushImmediately(e.target.checked)}
                className="rounded bg-surface-border border-surface-border text-sky-500 focus:ring-0"
              />
              <span className="flex items-center gap-1.5">
                <UploadCloud className="w-3.5 h-3.5 text-sky-400" />
                Push tag to remote origin immediately after creation
              </span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-surface-border/60">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 bg-surface-subtle hover:bg-surface-hover border border-surface-border text-slate-300 font-medium rounded-lg text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !tagName.trim()}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-sm"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Creating Tag...' : 'Create Tag'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
