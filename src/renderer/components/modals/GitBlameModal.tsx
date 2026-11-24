import React, { useState, useEffect, useMemo } from 'react'
import type { GitBlameLine } from '@/shared/types'
import {
  X,
  History,
  ExternalLink,
  Search,
  User,
  GitCommit as CommitIcon,
  AlertTriangle
} from 'lucide-react'

interface GitBlameModalProps {
  filePath: string
  onClose: () => void
  onSelectCommitHash?: (hash: string) => void
  onOpenInEditor?: (path: string) => void
}

// Generate consistent, readable color from commit hash
function getHashColor(hash: string): string {
  let num = 0
  for (let i = 0; i < hash.length; i++) {
    num = (num << 5) - num + hash.charCodeAt(i)
    num |= 0
  }
  const hues = [
    'text-sky-400 bg-sky-500/10 border-sky-500/30',
    'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    'text-amber-400 bg-amber-500/10 border-amber-500/30',
    'text-purple-400 bg-purple-500/10 border-purple-500/30',
    'text-rose-400 bg-rose-500/10 border-rose-500/30',
    'text-indigo-400 bg-indigo-500/10 border-indigo-500/30',
    'text-teal-400 bg-teal-500/10 border-teal-500/30',
    'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
  ]
  const idx = Math.abs(num) % hues.length
  return hues[idx]
}

export const GitBlameModal: React.FC<GitBlameModalProps> = ({
  filePath,
  onClose,
  onSelectCommitHash,
  onOpenInEditor,
}) => {
  const gih = (window as any).gih
  const [lines, setLines] = useState<GitBlameLine[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [hoveredHash, setHoveredHash] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    setIsLoading(true)
    setError(null)

    if (!gih?.getFileBlame) {
      setError('Git blame API not available')
      setIsLoading(false)
      return
    }

    gih.getFileBlame(filePath).then((res: GitBlameLine[]) => {
      if (!isMounted) return
      setIsLoading(false)
      if (res && res.length > 0) {
        setLines(res)
      } else {
        setError('No blame information found (file may be untracked or empty)')
      }
    }).catch((err: any) => {
      if (!isMounted) return
      setIsLoading(false)
      setError(err?.message || 'Failed to execute git blame')
    })

    return () => {
      isMounted = false
    }
  }, [filePath])

  // Keyboard shortcut Esc to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const fileName = filePath.split(/[\\/]/).pop() || filePath

  const uniqueAuthors = useMemo(() => {
    const authors = new Set(lines.map((l) => l.author))
    return authors.size
  }, [lines])

  const uniqueCommits = useMemo(() => {
    const commits = new Set(lines.map((l) => l.hash))
    return commits.size
  }, [lines])

  const filteredLines = useMemo(() => {
    if (!searchQuery.trim()) return lines
    const q = searchQuery.toLowerCase().trim()
    return lines.filter(
      (l) =>
        l.content.toLowerCase().includes(q) ||
        l.author.toLowerCase().includes(q) ||
        l.summary.toLowerCase().includes(q) ||
        l.shortHash.toLowerCase().includes(q)
    )
  }, [lines, searchQuery])

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0f131c] border border-surface-border rounded-xl shadow-2xl flex flex-col w-full max-w-6xl h-[88vh] overflow-hidden text-slate-200">
        {/* Blame Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-surface border-b border-surface-border select-none">
          <div className="flex items-center gap-3 truncate">
            <div className="p-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <History className="w-4 h-4" />
            </div>
            <div className="truncate">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white">{fileName}</span>
                <span className="text-[11px] font-mono text-slate-400 truncate max-w-[280px]">
                  {filePath}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                <span>{lines.length} lines</span>
                <span>•</span>
                <span>{uniqueAuthors} authors</span>
                <span>•</span>
                <span>{uniqueCommits} commits</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Search filter */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter code, author, commit..."
                className="bg-[#090b10] border border-surface-border rounded-lg pl-8 pr-7 py-1 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-brand/70 font-mono w-56"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {onOpenInEditor && (
              <button
                type="button"
                onClick={() => onOpenInEditor(filePath)}
                className="px-2.5 py-1 rounded bg-surface-subtle hover:bg-surface-hover border border-surface-border text-xs text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors"
                title="Open file in external editor"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Editor</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1 hover:bg-surface-hover rounded text-slate-400 hover:text-white transition-colors ml-1"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Blame Table Body */}
        <div className="flex-1 overflow-auto bg-[#090b10] font-mono text-xs">
          {isLoading ? (
            <div className="h-full flex items-center justify-center text-slate-500 text-xs">
              Calculating git blame history...
            </div>
          ) : error ? (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-2">
              <AlertTriangle className="w-8 h-8 text-rose-400" />
              <p className="text-slate-300 text-xs">{error}</p>
            </div>
          ) : (
            <div className="min-w-full divide-y divide-surface-border/30">
              {filteredLines.map((line, idx) => {
                const isHovered = hoveredHash === line.hash
                const hashColor = getHashColor(line.hash)
                const prevLine = idx > 0 ? filteredLines[idx - 1] : null
                const isSameCommitAsPrev = prevLine?.hash === line.hash

                return (
                  <div
                    key={`${line.lineNumber}-${line.hash}`}
                    className={`flex items-stretch hover:bg-surface-hover/70 transition-colors ${
                      isHovered ? 'bg-sky-950/20' : ''
                    }`}
                  >
                    {/* Commit Gutter */}
                    <div
                      onMouseEnter={() => setHoveredHash(line.hash)}
                      onMouseLeave={() => setHoveredHash(null)}
                      onClick={() => onSelectCommitHash?.(line.hash)}
                      className={`w-80 shrink-0 px-2.5 py-0.5 flex items-center justify-between border-r border-surface-border/40 select-none cursor-pointer group ${
                        isSameCommitAsPrev ? 'opacity-40 hover:opacity-100' : ''
                      }`}
                      title={`${line.author} (${line.dateStr}): ${line.summary}\nClick to inspect commit in graph`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span
                          className={`text-[10px] font-bold px-1 py-0.2 rounded border shrink-0 ${hashColor}`}
                        >
                          {line.shortHash}
                        </span>
                        <span className="truncate text-slate-300 group-hover:text-white">
                          {line.author}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 shrink-0 ml-2">
                        {line.dateStr}
                      </span>
                    </div>

                    {/* Line Number */}
                    <div className="w-12 shrink-0 py-0.5 pr-2 text-right text-slate-600 select-none border-r border-surface-border/30">
                      {line.lineNumber}
                    </div>

                    {/* Code Content */}
                    <div className="flex-1 px-3 py-0.5 text-slate-200 whitespace-pre overflow-x-auto selection:bg-brand/30">
                      {line.content || ' '}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-1.5 bg-[#0a0d14] border-t border-surface-border flex items-center justify-between text-[11px] font-mono text-slate-500 select-none">
          <div className="flex items-center gap-2">
            <span>Tip: Click any commit in the gutter to inspect it in the DAG graph</span>
          </div>
          <div className="flex items-center gap-2">
            <span>Esc = Close</span>
          </div>
        </div>
      </div>
    </div>
  )
}
