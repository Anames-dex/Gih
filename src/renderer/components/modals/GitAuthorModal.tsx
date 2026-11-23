import React, { useState, useEffect } from 'react'
import { User, Mail, Globe, FolderGit2, X, AlertCircle, Check } from 'lucide-react'

interface GitAuthorModalProps {
  isOpen: boolean
  onClose: () => void
  currentName?: string
  currentEmail?: string
  onSave: (name: string, email: string, isGlobal: boolean) => Promise<{ success: boolean; error?: string }>
  onSuccess?: () => void
}

export const GitAuthorModal: React.FC<GitAuthorModalProps> = ({
  isOpen,
  onClose,
  currentName = '',
  currentEmail = '',
  onSave,
  onSuccess,
}) => {
  const [name, setName] = useState(currentName)
  const [email, setEmail] = useState(currentEmail)
  const [isGlobal, setIsGlobal] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setName(currentName)
      setEmail(currentEmail)
      setError(null)
    }
  }, [isOpen, currentName, currentEmail])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = name.trim()
    const trimmedEmail = email.trim()

    if (!trimmedName) {
      setError('Author name is required.')
      return
    }
    if (!trimmedEmail) {
      setError('Author email address is required.')
      return
    }
    if (!trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
      setError('Please enter a valid email address.')
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      const res = await onSave(trimmedName, trimmedEmail, isGlobal)
      if (res.success) {
        onSuccess?.()
        onClose()
      } else {
        setError(res.error || 'Failed to save Git author configuration.')
      }
    } catch (err: any) {
      setError(err?.message || 'An error occurred while saving Git config.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in select-none">
      <div className="bg-[#0f172a] border border-surface-border rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Set Git Author Identity</h2>
              <p className="text-[11px] text-slate-400">Recorded on your commits</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-xs text-slate-300 leading-relaxed">
            Git requires your name and email to attribute your commits. These can be configured globally for all repositories or locally for this repository only.
          </p>

          {error && (
            <div className="px-3.5 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Author Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Jane Doe"
                  autoFocus
                  required
                  className="w-full pl-9 pr-3 py-2 bg-surface border border-surface-border rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
                />
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Author Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. jane@example.com"
                  required
                  className="w-full pl-9 pr-3 py-2 bg-surface border border-surface-border rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
                />
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              </div>
            </div>

            {/* Scope Selection */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                Configuration Scope
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsGlobal(true)}
                  className={`p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                    isGlobal
                      ? 'bg-sky-500/10 border-sky-500/40 text-sky-300'
                      : 'bg-surface/60 border-surface-border text-slate-400 hover:bg-surface'
                  }`}
                >
                  <Globe className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold">Global (Recommended)</div>
                    <div className="text-[10px] text-slate-400">git config --global</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setIsGlobal(false)}
                  className={`p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                    !isGlobal
                      ? 'bg-sky-500/10 border-sky-500/40 text-sky-300'
                      : 'bg-surface/60 border-surface-border text-slate-400 hover:bg-surface'
                  }`}
                >
                  <FolderGit2 className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold">This Repo Only</div>
                    <div className="text-[10px] text-slate-400">git config --local</div>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-surface-border flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-2 rounded-lg border border-surface-border hover:bg-surface text-slate-400 hover:text-white text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 active:scale-95 text-slate-950 text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Saving...</span>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Identity</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
