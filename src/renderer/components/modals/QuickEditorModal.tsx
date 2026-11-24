import React, { useState, useEffect, useRef } from 'react'
import {
  X,
  Save,
  ExternalLink,
  Code2,
  FileCode,
  AlertTriangle,
  CheckCircle2,
  FileText
} from 'lucide-react'

interface QuickEditorModalProps {
  filePath: string
  onClose: () => void
  onSaved?: () => void
}

const EDITORS = [
  { id: 'vscode', label: 'VS Code' },
  { id: 'cursor', label: 'Cursor' },
  { id: 'windsurf', label: 'Windsurf' },
  { id: 'sublime', label: 'Sublime' },
  { id: 'system', label: 'System Default' },
] as const

export const QuickEditorModal: React.FC<QuickEditorModalProps> = ({
  filePath,
  onClose,
  onSaved,
}) => {
  const gih = (window as any).gih
  const [content, setContent] = useState('')
  const [originalContent, setOriginalContent] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isBinary, setIsBinary] = useState(false)
  const [fileSize, setFileSize] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [editorChoice, setEditorChoice] = useState<string>(() => {
    return localStorage.getItem('gih_preferred_editor') || 'vscode'
  })

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lineNumbersRef = useRef<HTMLDivElement>(null)

  const isDirty = content !== originalContent

  useEffect(() => {
    let isMounted = true
    setIsLoading(true)
    setError(null)

    if (!gih?.readFileContent) {
      setError('File reading API not available')
      setIsLoading(false)
      return
    }

    gih.readFileContent(filePath).then((res) => {
      if (!isMounted) return
      setIsLoading(false)
      if (res.error) {
        setError(res.error)
      } else {
        setIsBinary(res.isBinary)
        setFileSize(res.size)
        setContent(res.content)
        setOriginalContent(res.content)
      }
    })

    return () => {
      isMounted = false
    }
  }, [filePath])

  const handleSave = async () => {
    if (!gih?.saveFileContent || isSaving || !isDirty) return
    setIsSaving(true)
    setError(null)
    try {
      const res = await gih.saveFileContent(filePath, content)
      if (res.success) {
        setOriginalContent(content)
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 2000)
        onSaved?.()
      } else {
        setError(res.error || 'Failed to save file')
      }
    } catch (e: any) {
      setError(e.message || 'Save error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleOpenExternal = async () => {
    if (!gih?.openInEditor) return
    try {
      const res = await gih.openInEditor(filePath, editorChoice)
      if (!res.success && res.error) {
        setError(res.error)
      }
    } catch (e: any) {
      setError(e.message)
    }
  }

  const handleEditorChoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    setEditorChoice(val)
    localStorage.setItem('gih_preferred_editor', val)
  }

  // Keyboard shortcuts (Ctrl+S / Cmd+S, Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        handleSave()
      } else if (e.key === 'Escape') {
        if (isDirty) {
          if (window.confirm('You have unsaved changes. Discard and close editor?')) {
            onClose()
          }
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [content, originalContent, isDirty])

  // Handle Tab key inside textarea
  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const textarea = e.currentTarget
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const newContent = content.substring(0, start) + '  ' + content.substring(end)
      setContent(newContent)
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2
      }, 0)
    }
  }

  // Sync line numbers scrolling with textarea
  const handleScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }

  const lineCount = content.split('\n').length
  const fileName = filePath.split(/[\\/]/).pop() || filePath
  const ext = fileName.includes('.') ? fileName.split('.').pop()?.toUpperCase() : 'TEXT'

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0f131c] border border-surface-border rounded-xl shadow-2xl flex flex-col w-full max-w-5xl h-[85vh] overflow-hidden text-slate-200">
        {/* Editor Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-surface border-b border-surface-border select-none">
          <div className="flex items-center gap-2.5 truncate">
            <FileCode className="w-4 h-4 text-sky-400 shrink-0" />
            <div className="flex items-center gap-2 truncate">
              <span className="font-semibold text-white truncate">{fileName}</span>
              <span className="text-[11px] font-mono text-slate-500 truncate max-w-[260px]">{filePath}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface-subtle text-slate-400 border border-surface-border shrink-0">
                {ext}
              </span>
              {isDirty && (
                <span className="flex items-center gap-1 text-[10px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.2 rounded shrink-0">
                  ● Unsaved
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* External Editor Selector */}
            <div className="flex items-center gap-1.5 bg-surface-subtle border border-surface-border rounded px-2 py-1 text-xs">
              <span className="text-slate-500 text-[11px]">Editor:</span>
              <select
                value={editorChoice}
                onChange={handleEditorChoiceChange}
                className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer text-xs"
              >
                {EDITORS.map((ed) => (
                  <option key={ed.id} value={ed.id} className="bg-surface text-slate-200">
                    {ed.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleOpenExternal}
                className="hover:text-sky-300 ml-1 transition-colors"
                title={`Open in ${EDITORS.find((ed) => ed.id === editorChoice)?.label || 'Editor'}`}
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Save Button */}
            <button
              type="button"
              onClick={handleSave}
              disabled={!isDirty || isSaving || isBinary}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
                saveSuccess
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'bg-brand hover:bg-brand-hover text-slate-950'
              }`}
              title="Save changes to disk (Ctrl+S)"
            >
              {saveSuccess ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Saving...' : 'Save (Ctrl+S)'}</span>
                </>
              )}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={() => {
                if (isDirty) {
                  if (window.confirm('You have unsaved changes. Discard and close editor?')) {
                    onClose()
                  }
                } else {
                  onClose()
                }
              }}
              className="p-1 hover:bg-surface-hover rounded text-slate-400 hover:text-white transition-colors"
              title="Close editor (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Editor Body */}
        <div className="flex-1 flex overflow-hidden relative bg-[#090b10]">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
              Loading file content...
            </div>
          ) : error ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-2 text-xs">
              <AlertTriangle className="w-8 h-8 text-rose-400" />
              <p className="text-slate-300 font-medium">{error}</p>
              <button
                type="button"
                onClick={handleOpenExternal}
                className="mt-2 px-3 py-1.5 rounded bg-surface border border-surface-border text-sky-400 hover:text-sky-300 flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in external editor</span>
              </button>
            </div>
          ) : isBinary ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3 text-xs">
              <FileText className="w-10 h-10 text-slate-500" />
              <p className="text-slate-400">
                Binary or non-text file ({((fileSize || 0) / 1024).toFixed(1)} KB).
              </p>
              <button
                type="button"
                onClick={handleOpenExternal}
                className="px-3 py-1.5 rounded bg-surface border border-surface-border text-sky-400 hover:text-sky-300 flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open with system viewer / external editor</span>
              </button>
            </div>
          ) : (
            <>
              {/* Line Numbers Gutter */}
              <div
                ref={lineNumbersRef}
                className="w-12 py-3 bg-[#0a0d14] border-r border-surface-border/40 select-none overflow-hidden text-right pr-2 text-slate-600 font-mono text-xs leading-5"
              >
                {Array.from({ length: lineCount }).map((_, idx) => (
                  <div key={idx + 1}>{idx + 1}</div>
                ))}
              </div>

              {/* Code Textarea */}
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onScroll={handleScroll}
                onKeyDown={handleTextareaKeyDown}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
                className="flex-1 p-3 bg-transparent text-slate-200 font-mono text-xs leading-5 resize-none focus:outline-none overflow-auto whitespace-pre tab-2"
              />
            </>
          )}
        </div>

        {/* Editor Footer Status Bar */}
        <div className="px-4 py-1.5 bg-[#0a0d14] border-t border-surface-border flex items-center justify-between text-[11px] font-mono text-slate-500 select-none">
          <div className="flex items-center gap-3">
            <span>{lineCount} lines</span>
            <span>{((fileSize || content.length) / 1024).toFixed(1)} KB</span>
            <span>UTF-8</span>
          </div>
          <div className="flex items-center gap-2">
            <span>Tab = 2 spaces</span>
            <span>•</span>
            <span>Ctrl+S = Save</span>
          </div>
        </div>
      </div>
    </div>
  )
}
