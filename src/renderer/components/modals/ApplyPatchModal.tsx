import React, { useState, useEffect, useRef } from 'react'
import { useFocusTrap } from '@/renderer/hooks/useFocusTrap'
import {
  X,
  FileDiff,
  Clipboard,
  Check,
  AlertTriangle,
  Play
} from 'lucide-react'

interface ApplyPatchModalProps {
  isOpen: boolean
  onClose: () => void
  onPatchApplied?: () => void
}

export const ApplyPatchModal: React.FC<ApplyPatchModalProps> = ({
  isOpen,
  onClose,
  onPatchApplied,
}) => {
  const gih = (window as any).gih
  const [patchText, setPatchText] = useState('')
  const [isCached, setIsCached] = useState(false)
  const [isReverse, setIsReverse] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  useFocusTrap(modalRef, isOpen, onClose)

  useEffect(() => {
    if (isOpen) {
      setError(null)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        setPatchText(text)
        setError(null)
      }
    } catch (e: any) {
      setError('Failed to read from clipboard')
    }
  }

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!patchText.trim() || !gih?.applyPatch || isApplying) return

    setIsApplying(true)
    setError(null)
    try {
      const res = await gih.applyPatch(patchText.trim(), {
        cached: isCached,
        reverse: isReverse,
      })

      if (res.exitCode !== 0) {
        setError(res.stderr || 'Failed to apply patch. Working tree or patch may have conflicting changes.')
      } else {
        setPatchText('')
        onClose()
        onPatchApplied?.()
      }
    } catch (err: any) {
      setError(err?.message || 'Error applying patch')
    } finally {
      setIsApplying(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="bg-[#0f131c] border border-surface-border rounded-xl shadow-2xl flex flex-col w-full max-w-2xl overflow-hidden text-slate-200 animate-fade-in outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-surface border-b border-surface-border select-none">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-brand/10 border border-brand/20 text-brand">
              <FileDiff className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-white">Apply Git Patch</h3>
              <p className="text-[11px] text-slate-400">
                Apply a unified diff or format-patch file to the working directory
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-surface-hover rounded text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleApply} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300">Patch Content (Unified Diff)</label>
              <button
                type="button"
                onClick={handlePasteClipboard}
                className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 transition-colors"
              >
                <Clipboard className="w-3 h-3" />
                <span>Paste from Clipboard</span>
              </button>
            </div>
            <textarea
              value={patchText}
              onChange={(e) => setPatchText(e.target.value)}
              placeholder="Paste raw diff or .patch contents here (diff --git a/... b/...)..."
              rows={9}
              className="w-full bg-[#090b10] border border-surface-border rounded-lg p-3 font-mono text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-brand resize-none tab-2"
              required
            />
          </div>

          {/* Options */}
          <div className="flex items-center gap-6 text-xs text-slate-300">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isCached}
                onChange={(e) => setIsCached(e.target.checked)}
                className="rounded bg-surface-border border-surface-border text-brand focus:ring-0"
              />
              <span>Stage directly to index (<code className="text-amber-400 font-mono text-[10px]">--cached</code>)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isReverse}
                onChange={(e) => setIsReverse(e.target.checked)}
                className="rounded bg-surface-border border-surface-border text-brand focus:ring-0"
              />
              <span>Reverse patch application (<code className="text-amber-400 font-mono text-[10px]">--reverse</code>)</span>
            </label>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="font-mono whitespace-pre-wrap break-all">{error}</div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-surface-border/50">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-surface-border text-xs text-slate-300 hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!patchText.trim() || isApplying}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-brand hover:bg-brand-hover text-slate-950 font-semibold text-xs transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isApplying ? 'Applying Patch...' : 'Apply Patch'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
