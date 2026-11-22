import React, { useState, useEffect } from 'react'
import { Download, FolderOpen, X, Loader2, AlertCircle } from 'lucide-react'

interface CloneRepositoryModalProps {
  isOpen: boolean
  onClose: () => void
  onCloneSuccess: (targetPath: string) => void
  onBrowseFolder: () => Promise<string | null>
  onExecuteClone: (url: string, targetPath: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>
}

export const CloneRepositoryModal: React.FC<CloneRepositoryModalProps> = ({
  isOpen,
  onClose,
  onCloneSuccess,
  onBrowseFolder,
  onExecuteClone,
}) => {
  const [repoUrl, setRepoUrl] = useState('')
  const [parentDir, setParentDir] = useState('')
  const [targetFolderName, setTargetFolderName] = useState('')
  const [isCloning, setIsCloning] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Derive suggested folder name when URL changes
  useEffect(() => {
    if (repoUrl.trim()) {
      try {
        const cleaned = repoUrl.trim().replace(/\/+$/, '')
        const segments = cleaned.split(/[/:]/)
        const last = segments[segments.length - 1]
        const folder = last.replace(/\.git$/, '')
        if (folder) {
          setTargetFolderName(folder)
        }
      } catch {
        // ignore
      }
    }
  }, [repoUrl])

  if (!isOpen) return null

  const handleBrowse = async () => {
    const selected = await onBrowseFolder()
    if (selected) {
      setParentDir(selected)
    }
  }

  const handleClone = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!repoUrl.trim() || !parentDir.trim() || !targetFolderName.trim() || isCloning) return

    setIsCloning(true)
    setErrorMessage(null)

    const sep = parentDir.includes('/') ? '/' : '\\'
    const fullTargetPath = `${parentDir.replace(/[\\/]+$/, '')}${sep}${targetFolderName.trim()}`

    try {
      const res = await onExecuteClone(repoUrl.trim(), fullTargetPath)
      if (res.exitCode !== 0) {
        setErrorMessage(res.stderr || res.stdout || 'Clone failed with non-zero exit code')
      } else {
        onCloneSuccess(fullTargetPath)
        onClose()
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error occurred while cloning repository')
    } finally {
      setIsCloning(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in select-none">
      <div className="bg-surface border border-surface-border rounded-xl shadow-2xl max-w-lg w-full overflow-hidden text-slate-200">
        {/* Header */}
        <div className="p-4 border-b border-surface-border flex items-center justify-between bg-surface-subtle/50">
          <div className="flex items-center gap-2.5">
            <Download className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-semibold text-white">Clone Remote Repository</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isCloning}
            className="p-1 hover:bg-surface-hover rounded text-slate-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleClone} className="p-5 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-lg flex items-start gap-2.5 text-xs text-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="break-all whitespace-pre-wrap">{errorMessage}</div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Repository URL (HTTPS or SSH)
            </label>
            <input
              type="text"
              autoFocus
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="e.g. https://github.com/torvalds/linux.git"
              className="w-full bg-[#0c0e14] border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-brand font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Destination Directory
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={parentDir}
                onChange={(e) => setParentDir(e.target.value)}
                placeholder="Select parent folder on your disk..."
                className="flex-1 bg-[#0c0e14] border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-brand font-mono"
              />
              <button
                type="button"
                onClick={handleBrowse}
                className="px-3 py-2 bg-surface-subtle hover:bg-surface-hover border border-surface-border rounded-lg text-xs font-medium text-slate-300 hover:text-white flex items-center gap-1.5 shrink-0 active:scale-95 transition-all shadow-sm"
              >
                <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
                <span>Browse...</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Directory Name
            </label>
            <input
              type="text"
              value={targetFolderName}
              onChange={(e) => setTargetFolderName(e.target.value)}
              placeholder="folder-name"
              className="w-full bg-[#0c0e14] border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-brand font-mono"
            />
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-surface-border flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              disabled={isCloning}
              className="px-3.5 py-1.5 rounded-lg border border-surface-border text-xs text-slate-300 hover:text-white hover:bg-surface-hover active:scale-95 transition-all disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isCloning || !repoUrl.trim() || !parentDir.trim() || !targetFolderName.trim()}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-950/50 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isCloning ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Cloning repository...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Clone Repository</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
