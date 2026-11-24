import React, { useState, useEffect, useRef } from 'react'
import { AlertTriangle, HelpCircle, X } from 'lucide-react'
import { useFocusTrap } from '@/renderer/hooks/useFocusTrap'

export interface DialogRequest {
  mode: 'confirm' | 'prompt'
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  defaultValue?: string
  placeholder?: string
  resolve: (value: boolean | string | null) => void
}

interface ActionDialogModalProps {
  request: DialogRequest | null
  onClose: () => void
}

export const ActionDialogModal: React.FC<ActionDialogModalProps> = ({ request, onClose }) => {
  const [inputValue, setInputValue] = useState('')
  const modalRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (request) {
      setInputValue(request.defaultValue ?? '')
      if (request.mode === 'prompt') {
        setTimeout(() => inputRef.current?.focus(), 0)
      }
    }
  }, [request])

  const handleCancel = () => {
    if (!request) return
    request.resolve(request.mode === 'confirm' ? false : null)
    onClose()
  }

  useFocusTrap(modalRef, !!request, handleCancel)

  if (!request) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (request.mode === 'confirm') {
      request.resolve(true)
      onClose()
    } else {
      const trimmed = inputValue.trim()
      if (!trimmed) return
      request.resolve(trimmed)
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in select-none"
      onClick={handleCancel}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="w-full max-w-md bg-surface border border-surface-border rounded-2xl shadow-2xl overflow-hidden text-slate-200 outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3.5 border-b border-surface-border flex items-center justify-between bg-[#0f172a]/60">
          <div className="flex items-center gap-2.5">
            {request.danger ? (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <HelpCircle className="w-4 h-4 text-sky-400 shrink-0" />
            )}
            <h2 className="text-sm font-semibold text-white">{request.title}</h2>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            className="p-1 text-slate-400 hover:text-white hover:bg-surface-hover rounded-lg transition-colors"
            title="Cancel (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
            {request.message}
          </p>

          {request.mode === 'prompt' && (
            <input
              ref={inputRef}
              type="text"
              autoFocus
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={request.placeholder || 'Enter value...'}
              className="w-full bg-[#0c0e14] border border-surface-border rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-brand font-mono"
            />
          )}

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="px-3.5 py-1.5 rounded-lg border border-surface-border text-xs text-slate-300 hover:text-white hover:bg-surface-hover transition-colors"
            >
              {request.cancelLabel || 'Cancel'}
            </button>
            <button
              type="submit"
              autoFocus={request.mode === 'confirm'}
              disabled={request.mode === 'prompt' && !inputValue.trim()}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                request.danger
                  ? 'bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-950/40'
                  : 'bg-sky-600 hover:bg-sky-500 shadow-lg shadow-sky-950/40'
              }`}
            >
              {request.confirmLabel || (request.mode === 'confirm' ? 'Confirm' : 'Submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
