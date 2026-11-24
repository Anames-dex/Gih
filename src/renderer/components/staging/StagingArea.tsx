import React, { useState, useEffect, useRef } from 'react'
import type { GitFileStatus, FileDiff, DiffHunk, GitCommit, CommitRangeDiff } from '@/shared/types'
import {
  FileText,
  Plus,
  Minus,
  Check,
  RotateCcw,
  GitCommit as CommitIcon,
  X,
  FileDiff as DiffIcon,
  AlertTriangle,
  Copy,
  GitCompare,
  Layers,
  ChevronRight,
  EyeOff,
  Search,
  FileCode,
  ExternalLink
} from 'lucide-react'
import { buildSplitRows, buildUnifiedRows, buildHunkPatch } from './diffUtils'

interface StagingAreaProps {
  width?: number
  files: GitFileStatus[]
  selectedCommits: GitCommit[]
  onClearSelectedCommits: () => void
  onStageFile: (path: string) => void
  onUnstageFile: (path: string) => void
  onStageAll: () => void
  onUnstageAll: () => void
  onDiscardChanges: (path: string) => void
  onDiscardAll?: () => void
  onIgnorePattern?: (pattern: string) => void
  onOpenInEditor?: (path: string) => void
  onQuickEditFile?: (path: string) => void
  onCommit: (message: string, signOff?: boolean, amend?: boolean) => void
  onGetDiff: (path: string, staged: boolean) => Promise<FileDiff>
  onGetCommitFiles?: (hash: string) => Promise<{ files: GitFileStatus[]; statSummary: string }>
  onGetRangeDiff?: (baseHash: string, headHash: string) => Promise<CommitRangeDiff>
  onGetCommitFileDiff?: (baseHash: string, headHash: string, filePath: string) => Promise<FileDiff>
  onApplyHunkPatch?: (patch: string, options: { cached?: boolean; reverse?: boolean }) => Promise<void>
  onResolveConflict?: (filePath: string, resolution: 'ours' | 'theirs' | 'mark-resolved') => void
  headCommit?: GitCommit | null
}

const CONVENTIONAL_TYPES = [
  { type: 'feat', label: 'feat:', desc: 'A new feature', color: 'hover:bg-emerald-500/20 hover:text-emerald-300 hover:border-emerald-500/40 text-emerald-400' },
  { type: 'fix', label: 'fix:', desc: 'A bug fix', color: 'hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/40 text-rose-400' },
  { type: 'docs', label: 'docs:', desc: 'Documentation only changes', color: 'hover:bg-blue-500/20 hover:text-blue-300 hover:border-blue-500/40 text-blue-400' },
  { type: 'refactor', label: 'refactor:', desc: 'Code change that neither fixes a bug nor adds a feature', color: 'hover:bg-purple-500/20 hover:text-purple-300 hover:border-purple-500/40 text-purple-400' },
  { type: 'perf', label: 'perf:', desc: 'A code change that improves performance', color: 'hover:bg-amber-500/20 hover:text-amber-300 hover:border-amber-500/40 text-amber-400' },
  { type: 'test', label: 'test:', desc: 'Adding or correcting tests', color: 'hover:bg-yellow-500/20 hover:text-yellow-300 hover:border-yellow-500/40 text-yellow-400' },
  { type: 'chore', label: 'chore:', desc: 'Build process or auxiliary tools and libraries', color: 'hover:bg-slate-500/20 hover:text-slate-200 hover:border-slate-500/40 text-slate-400' },
] as const

export const StagingArea: React.FC<StagingAreaProps> = ({
  width = 380,
  files,
  selectedCommits,
  onClearSelectedCommits,
  onStageFile,
  onUnstageFile,
  onStageAll,
  onUnstageAll,
  onDiscardChanges,
  onDiscardAll,
  onIgnorePattern,
  onOpenInEditor,
  onQuickEditFile,
  onCommit,
  onGetDiff,
  onGetCommitFiles,
  onGetRangeDiff,
  onGetCommitFileDiff,
  onApplyHunkPatch,
  onResolveConflict,
  headCommit,
}) => {
  const [activeFile, setActiveFile] = useState<GitFileStatus | null>(null)
  const [activeDiff, setActiveDiff] = useState<FileDiff | null>(null)
  const [ignoreMenuFile, setIgnoreMenuFile] = useState<GitFileStatus | null>(null)
  const [commitMessage, setCommitMessage] = useState('')
  const [signOff, setSignOff] = useState(false)
  const [isAmend, setIsAmend] = useState(false)
  const [diffViewMode, setDiffViewMode] = useState<'unified' | 'split'>('unified')
  const [isDiffLoading, setIsDiffLoading] = useState(false)
  const [isApplyingHunk, setIsApplyingHunk] = useState(false)
  const commitTextareaRef = useRef<HTMLTextAreaElement>(null)

  const handleApplyConventionalPrefix = (type: string) => {
    const prefixRegex = /^([a-zA-Z]+)(\([^\)]+\))?(!)?:\s*/
    let newMessage = ''
    if (prefixRegex.test(commitMessage)) {
      newMessage = commitMessage.replace(prefixRegex, (_, _oldType, scope, breaking) => {
        return `${type}${scope || ''}${breaking || ''}: `
      })
    } else {
      newMessage = `${type}: ${commitMessage}`
    }
    setCommitMessage(newMessage)
    setTimeout(() => {
      if (commitTextareaRef.current) {
        commitTextareaRef.current.focus()
        const colonIndex = newMessage.indexOf(': ')
        const pos = colonIndex !== -1 ? colonIndex + 2 : newMessage.length
        commitTextareaRef.current.setSelectionRange(pos, pos)
      }
    }, 0)
  }

  // Commit / Range inspection state
  const [inspectorFiles, setInspectorFiles] = useState<GitFileStatus[]>([])
  const [inspectorStatSummary, setInspectorStatSummary] = useState('')
  const [isInspectorLoading, setIsInspectorLoading] = useState(false)
  const [activeInspectorFile, setActiveInspectorFile] = useState<GitFileStatus | null>(null)
  const [activeInspectorDiff, setActiveInspectorDiff] = useState<FileDiff | null>(null)
  const [isInspectorDiffLoading, setIsInspectorDiffLoading] = useState(false)
  const [hasCopiedHashes, setHasCopiedHashes] = useState(false)
  const [fileFilter, setFileFilter] = useState('')

  const isMultiSelection = selectedCommits.length > 1
  const isSingleSelection = selectedCommits.length === 1
  const headCommitSelected = selectedCommits[0] || null
  const baseCommitSelected = selectedCommits[selectedCommits.length - 1] || null

  const conflictedFiles = files.filter((f) => f.status === 'conflicted')
  const stagedFiles = files.filter((f) => f.staged)
  const unstagedFiles = files.filter((f) => !f.staged && f.status !== 'conflicted')

  const filterMatch = (filePath: string) => {
    if (!fileFilter.trim()) return true
    return filePath.toLowerCase().includes(fileFilter.trim().toLowerCase())
  }

  const filteredConflictedFiles = conflictedFiles.filter((f) => filterMatch(f.path))
  const filteredStagedFiles = stagedFiles.filter((f) => filterMatch(f.path))
  const filteredUnstagedFiles = unstagedFiles.filter((f) => filterMatch(f.path))
  const filteredInspectorFiles = inspectorFiles.filter((f) => filterMatch(f.path))

  const firstLine = commitMessage.split('\n')[0] || ''
  const firstLineLen = firstLine.length
  const hasMultipleLines = commitMessage.includes('\n')
  const secondLine = hasMultipleLines ? commitMessage.split('\n')[1] || '' : ''
  const secondLineEmpty = !hasMultipleLines || secondLine.trim() === ''

  // Load files for selected commit or commit range
  useEffect(() => {
    if (selectedCommits.length === 0) {
      setInspectorFiles([])
      setInspectorStatSummary('')
      setActiveInspectorFile(null)
      setActiveInspectorDiff(null)
      return
    }

    let isMounted = true
    setIsInspectorLoading(true)
    setActiveInspectorFile(null)
    setActiveInspectorDiff(null)

    if (isSingleSelection && onGetCommitFiles) {
      onGetCommitFiles(selectedCommits[0].hash)
        .then((res) => {
          if (!isMounted) return
          setInspectorFiles(res.files)
          setInspectorStatSummary(res.statSummary)
        })
        .catch((err) => {
          console.error('Failed to load commit files:', err)
        })
        .finally(() => {
          if (isMounted) setIsInspectorLoading(false)
        })
    } else if (isMultiSelection && onGetRangeDiff && baseCommitSelected && headCommitSelected) {
      onGetRangeDiff(baseCommitSelected.hash, headCommitSelected.hash)
        .then((res) => {
          if (!isMounted) return
          setInspectorFiles(res.files)
          setInspectorStatSummary(res.statSummary)
        })
        .catch((err) => {
          console.error('Failed to load range diff:', err)
        })
        .finally(() => {
          if (isMounted) setIsInspectorLoading(false)
        })
    } else {
      setIsInspectorLoading(false)
    }

    return () => {
      isMounted = false
    }
  }, [selectedCommits, onGetCommitFiles, onGetRangeDiff])

  // Load diff for inspected file
  useEffect(() => {
    if (!activeInspectorFile || !onGetCommitFileDiff || selectedCommits.length === 0) {
      setActiveInspectorDiff(null)
      return
    }

    let isMounted = true
    setIsInspectorDiffLoading(true)
    const baseHash = baseCommitSelected ? baseCommitSelected.hash : headCommitSelected!.hash
    const headHash = headCommitSelected!.hash

    onGetCommitFileDiff(baseHash, headHash, activeInspectorFile.path)
      .then((diff) => {
        if (!isMounted) return
        setActiveInspectorDiff(diff)
      })
      .catch((err) => {
        console.error('Failed to load file diff:', err)
      })
      .finally(() => {
        if (isMounted) setIsInspectorDiffLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [activeInspectorFile, selectedCommits, onGetCommitFileDiff])

  const handleCopyHashes = () => {
    if (selectedCommits.length === 0) return
    const text = selectedCommits.map((c) => c.hash).join('\n')
    navigator.clipboard.writeText(text)
    setHasCopiedHashes(true)
    setTimeout(() => setHasCopiedHashes(false), 2000)
  }

  const handleStageHunk = async (hunk: DiffHunk) => {
    if (!activeFile || !onApplyHunkPatch) return
    setIsApplyingHunk(true)
    try {
      const patch = buildHunkPatch(activeFile.path, hunk)
      await onApplyHunkPatch(patch, { cached: true })
      const updated = await onGetDiff(activeFile.path, activeFile.staged)
      setActiveDiff(updated)
    } finally {
      setIsApplyingHunk(false)
    }
  }

  const handleUnstageHunk = async (hunk: DiffHunk) => {
    if (!activeFile || !onApplyHunkPatch) return
    setIsApplyingHunk(true)
    try {
      const patch = buildHunkPatch(activeFile.path, hunk)
      await onApplyHunkPatch(patch, { cached: true, reverse: true })
      const updated = await onGetDiff(activeFile.path, activeFile.staged)
      setActiveDiff(updated)
    } finally {
      setIsApplyingHunk(false)
    }
  }

  const handleDiscardHunk = async (hunk: DiffHunk) => {
    if (!activeFile || !onApplyHunkPatch) return
    if (!window.confirm('Discard this hunk changes from working directory?')) return
    setIsApplyingHunk(true)
    try {
      const patch = buildHunkPatch(activeFile.path, hunk)
      await onApplyHunkPatch(patch, { reverse: true })
      const updated = await onGetDiff(activeFile.path, activeFile.staged)
      setActiveDiff(updated)
    } finally {
      setIsApplyingHunk(false)
    }
  }

  useEffect(() => {
    if (activeFile) {
      setIsDiffLoading(true)
      onGetDiff(activeFile.path, activeFile.staged)
        .then((diff) => {
          setActiveDiff(diff)
        })
        .finally(() => {
          setIsDiffLoading(false)
        })
    } else {
      setActiveDiff(null)
    }
  }, [activeFile])

  const handleCommitSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!commitMessage.trim() || (!isAmend && stagedFiles.length === 0)) return
    onCommit(commitMessage.trim(), signOff, isAmend)
    setCommitMessage('')
    setIsAmend(false)
  }

  const renderFileFilterInput = (totalCount: number) => {
    if (totalCount === 0 && !fileFilter) return null
    return (
      <div className="relative mb-2 select-none">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={fileFilter}
          onChange={(e) => setFileFilter(e.target.value)}
          placeholder={`Filter files (${totalCount})...`}
          className="w-full bg-[#0c0e14] border border-surface-border rounded-lg pl-8 pr-7 py-1 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-brand/70 font-mono"
        />
        {fileFilter && (
          <button
            type="button"
            onClick={() => setFileFilter('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            title="Clear filter"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    )
  }

  const renderFileDiffViewer = (
    filePath: string,
    diff: FileDiff | null,
    isLoading: boolean,
    onClose: () => void,
    isInspect: boolean = false
  ) => {
    return (
      <div className="border-b border-surface-border bg-surface-subtle/50 p-2.5">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-surface-border/50 text-xs">
          <div className="flex items-center gap-1.5 truncate">
            <DiffIcon className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="font-mono text-white truncate max-w-[180px]" title={filePath}>
              {filePath}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onQuickEditFile && (
              <button
                type="button"
                onClick={() => onQuickEditFile(filePath)}
                className="px-2 py-0.5 rounded bg-surface hover:bg-surface-hover border border-surface-border text-sky-400 text-[10px] flex items-center gap-1 font-mono transition-colors"
                title="Quick View & Edit file inside Gih"
              >
                <FileCode className="w-3 h-3" />
                <span>Edit in Gih</span>
              </button>
            )}
            {onOpenInEditor && (
              <button
                type="button"
                onClick={() => onOpenInEditor(filePath)}
                className="px-2 py-0.5 rounded bg-surface hover:bg-surface-hover border border-surface-border text-slate-300 hover:text-white text-[10px] flex items-center gap-1 font-mono transition-colors"
                title="Open file in configured external editor"
              >
                <ExternalLink className="w-3 h-3" />
                <span>External</span>
              </button>
            )}
            <div className="flex items-center bg-[#090b10] border border-surface-border/60 rounded p-0.5 text-[10px]">
              <button
                type="button"
                onClick={() => setDiffViewMode('unified')}
                className={`px-2 py-0.5 rounded transition-all ${
                  diffViewMode === 'unified'
                    ? 'bg-sky-500/20 text-sky-300 font-semibold shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Unified single-column diff with intra-line word highlight"
              >
                Unified
              </button>
              <button
                type="button"
                onClick={() => setDiffViewMode('split')}
                className={`px-2 py-0.5 rounded transition-all ${
                  diffViewMode === 'split'
                    ? 'bg-sky-500/20 text-sky-300 font-semibold shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Side-by-side split diff with paired word changes"
              >
                Split
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1 hover:bg-surface-hover rounded text-slate-400 hover:text-white transition-colors"
              title="Close diff view"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto text-xs font-mono bg-[#090b10] p-2 rounded border border-surface-border/40 space-y-2.5">
          {isLoading && <p className="text-slate-500 py-2">Loading diff...</p>}
          {diff && diff.hunks.length === 0 && !isLoading && (
            <p className="text-slate-500 py-2">No text differences found.</p>
          )}
          {diff?.hunks.map((hunk, hIdx) => {
            const unifiedRows = buildUnifiedRows(hunk.lines)
            const splitRows = buildSplitRows(hunk.lines)

            return (
              <div key={hIdx} className="rounded border border-surface-border/50 overflow-hidden bg-[#0c0e14]">
                <div className="flex items-center justify-between text-[11px] text-indigo-300 bg-indigo-950/40 px-2 py-1 border-b border-surface-border/40 font-mono">
                  <span className="truncate max-w-[200px]" title={hunk.header}>
                    {hunk.header}
                  </span>
                  {!isInspect && activeFile && (
                    <div className="flex items-center gap-1.5 font-sans shrink-0">
                      {!activeFile.staged ? (
                        <>
                          <button
                            type="button"
                            disabled={isApplyingHunk}
                            onClick={() => handleStageHunk(hunk)}
                            className="px-1.5 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 hover:text-emerald-200 text-[10px] font-medium flex items-center gap-1 transition-all active:scale-95 disabled:opacity-50"
                            title="Stage this hunk only"
                          >
                            <Plus className="w-2.5 h-2.5" />
                            <span>Stage Hunk</span>
                          </button>
                          <button
                            type="button"
                            disabled={isApplyingHunk}
                            onClick={() => handleDiscardHunk(hunk)}
                            className="px-1.5 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 hover:text-rose-200 text-[10px] font-medium flex items-center gap-1 transition-all active:scale-95 disabled:opacity-50"
                            title="Discard this hunk from working directory"
                          >
                            <RotateCcw className="w-2.5 h-2.5" />
                            <span>Discard Hunk</span>
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          disabled={isApplyingHunk}
                          onClick={() => handleUnstageHunk(hunk)}
                          className="px-1.5 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 hover:text-amber-200 text-[10px] font-medium flex items-center gap-1 transition-all active:scale-95 disabled:opacity-50"
                          title="Unstage this hunk"
                        >
                          <Minus className="w-2.5 h-2.5" />
                          <span>Unstage Hunk</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {diffViewMode === 'unified' ? (
                  <div className="overflow-x-auto p-1 text-[11px] leading-relaxed">
                    {unifiedRows.map((item, lIdx) => (
                      <div
                        key={lIdx}
                        className={`px-1.5 py-0.5 rounded-xs flex items-start ${
                          item.line.type === 'add'
                            ? 'bg-emerald-950/30 text-emerald-300'
                            : item.line.type === 'delete'
                            ? 'bg-rose-950/30 text-rose-300'
                            : 'text-slate-400'
                        }`}
                      >
                        <span className="inline-block w-4 text-slate-600 select-none shrink-0 font-bold">
                          {item.line.type === 'add' ? '+' : item.line.type === 'delete' ? '-' : ' '}
                        </span>
                        <span className="whitespace-pre flex-1">
                          {item.tokens ? (
                            item.tokens.map((tok, tIdx) => (
                              <span
                                key={tIdx}
                                className={
                                  tok.isChanged
                                    ? item.line.type === 'add'
                                      ? 'bg-emerald-500/35 text-emerald-100 font-semibold rounded-xs px-0.5'
                                      : 'bg-rose-500/35 text-rose-100 font-semibold line-through rounded-xs px-0.5'
                                    : ''
                                }
                              >
                                {tok.text}
                              </span>
                            ))
                          ) : (
                            item.line.content
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="overflow-x-auto p-1 text-[11px] leading-relaxed divide-y divide-surface-border/20">
                    {splitRows.map((row, rIdx) => (
                      <div key={rIdx} className="grid grid-cols-2 gap-1">
                        <div
                          className={`px-1.5 py-0.5 rounded-xs truncate flex items-start ${
                            row.left
                              ? row.left.line.type === 'delete'
                                ? 'bg-rose-950/35 text-rose-300'
                                : 'text-slate-400'
                              : 'bg-surface-subtle/10'
                          }`}
                        >
                          {row.left && (
                            <>
                              <span className="w-6 text-[10px] text-slate-600 select-none shrink-0 text-right pr-1">
                                {row.left.line.oldLineNumber || ''}
                              </span>
                              <span className="inline-block w-3 text-slate-600 select-none shrink-0 font-bold">
                                {row.left.line.type === 'delete' ? '-' : ' '}
                              </span>
                              <span className="whitespace-pre flex-1 truncate">
                                {row.left.tokens ? (
                                  row.left.tokens.map((tok, tIdx) => (
                                    <span
                                      key={tIdx}
                                      className={tok.isChanged ? 'bg-rose-500/35 text-rose-100 font-semibold rounded-xs px-0.5' : ''}
                                    >
                                      {tok.text}
                                    </span>
                                  ))
                                ) : (
                                  row.left.line.content
                                )}
                              </span>
                            </>
                          )}
                        </div>

                        <div
                          className={`px-1.5 py-0.5 rounded-xs truncate flex items-start ${
                            row.right
                              ? row.right.line.type === 'add'
                                ? 'bg-emerald-950/35 text-emerald-300'
                                : 'text-slate-400'
                              : 'bg-surface-subtle/10'
                          }`}
                        >
                          {row.right && (
                            <>
                              <span className="w-6 text-[10px] text-slate-600 select-none shrink-0 text-right pr-1">
                                {row.right.line.newLineNumber || ''}
                              </span>
                              <span className="inline-block w-3 text-slate-600 select-none shrink-0 font-bold">
                                {row.right.line.type === 'add' ? '+' : ' '}
                              </span>
                              <span className="whitespace-pre flex-1 truncate">
                                {row.right.tokens ? (
                                  row.right.tokens.map((tok, tIdx) => (
                                    <span
                                      key={tIdx}
                                      className={tok.isChanged ? 'bg-emerald-500/35 text-emerald-100 font-semibold rounded-xs px-0.5' : ''}
                                    >
                                      {tok.text}
                                    </span>
                                  ))
                                ) : (
                                  row.right.line.content
                                )}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // If commits are selected from the graph, show Inspector for single or multi-commit range
  if (selectedCommits.length > 0 && headCommitSelected) {
    return (
      <aside
        className="bg-surface border-l border-surface-border flex flex-col shrink-0 text-slate-300"
        style={{ width: `${width}px` }}
      >
        <div className="p-3 border-b border-surface-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isMultiSelection ? (
              <GitCompare className="w-4 h-4 text-sky-400" />
            ) : (
              <CommitIcon className="w-4 h-4 text-sky-400" />
            )}
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {isMultiSelection
                ? `Range (${selectedCommits.length} Commits)`
                : 'Commit Details'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {isMultiSelection && (
              <button
                type="button"
                onClick={handleCopyHashes}
                className="px-2 py-0.5 rounded text-[10px] font-medium bg-surface-subtle hover:bg-surface-hover text-slate-300 border border-surface-border/60 flex items-center gap-1 transition-all active:scale-95"
                title="Copy all selected commit hashes"
              >
                <Copy className="w-3 h-3 text-slate-400" />
                <span>{hasCopiedHashes ? 'Copied!' : 'Copy Hashes'}</span>
              </button>
            )}
            <button
              onClick={onClearSelectedCommits}
              className="p-1 hover:bg-surface-hover rounded text-slate-400 hover:text-white"
              title="Close inspection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          {/* Metadata Card */}
          {isSingleSelection ? (
            <div>
              <h3 className="text-sm font-semibold text-white leading-snug">
                {headCommitSelected.summary}
              </h3>
              {headCommitSelected.message !== headCommitSelected.summary && (
                <p className="mt-2 text-xs text-slate-400 whitespace-pre-wrap font-mono">
                  {headCommitSelected.message}
                </p>
              )}

              <div className="mt-3 p-3 bg-surface-subtle border border-surface-border rounded-lg space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Hash</span>
                  <span className="font-mono text-slate-200 select-all">{headCommitSelected.hash}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Author</span>
                  <span className="text-slate-200">{headCommitSelected.author.name}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Date</span>
                  <span className="text-slate-200">{headCommitSelected.author.date}</span>
                </div>
                {headCommitSelected.parents.length > 0 && (
                  <div className="flex justify-between text-slate-400">
                    <span>Parents</span>
                    <span className="font-mono text-slate-200 truncate max-w-[180px]">
                      {headCommitSelected.parents.map((p) => p.substring(0, 7)).join(', ')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="p-3 bg-surface-subtle border border-surface-border rounded-lg text-xs space-y-2">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="font-semibold text-slate-300">Endpoint Commits</span>
                  <span className="font-mono text-sky-400">
                    {baseCommitSelected?.shortHash}..{headCommitSelected.shortHash}
                  </span>
                </div>
                <div className="text-[11px] text-slate-300">
                  <span className="text-slate-500 font-semibold uppercase text-[10px] block mb-0.5">Head:</span>
                  <div className="truncate font-medium">{headCommitSelected.summary}</div>
                </div>
                <div className="text-[11px] text-slate-300">
                  <span className="text-slate-500 font-semibold uppercase text-[10px] block mb-0.5">Base:</span>
                  <div className="truncate font-medium">{baseCommitSelected?.summary}</div>
                </div>
                {inspectorStatSummary && (
                  <div className="pt-2 border-t border-surface-border/50 text-[11px] text-emerald-400 font-mono">
                    {inspectorStatSummary}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Active File Diff (when an inspected file is clicked) */}
          {activeInspectorFile && (
            renderFileDiffViewer(
              activeInspectorFile.path,
              activeInspectorDiff,
              isInspectorDiffLoading,
              () => setActiveInspectorFile(null),
              true
            )
          )}

          {/* Files Changed List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
              <div className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-sky-400" />
                <span>Files Changed ({inspectorFiles.length})</span>
              </div>
              {isInspectorLoading && (
                <span className="text-[10px] text-slate-500 normal-case animate-pulse">Loading...</span>
              )}
            </div>

            {renderFileFilterInput(inspectorFiles.length)}

            {inspectorFiles.length === 0 && !isInspectorLoading ? (
              <div className="p-4 rounded-lg bg-surface-subtle/50 border border-surface-border text-center text-xs text-slate-500">
                No changed files in this commit selection.
              </div>
            ) : filteredInspectorFiles.length === 0 ? (
              <div className="p-4 rounded-lg bg-surface-subtle/50 border border-surface-border text-center text-xs text-slate-500">
                No files match '{fileFilter}'.
              </div>
            ) : (
              <div className="space-y-1">
                {filteredInspectorFiles.map((file) => {
                  const isActive = activeInspectorFile?.path === file.path
                  const statusColors: Record<string, string> = {
                    modified: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
                    added: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
                    deleted: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
                    renamed: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
                  }
                  const badgeClass = statusColors[file.status] || 'text-slate-400 bg-slate-500/10 border-slate-500/30'

                  return (
                    <div
                      key={file.path}
                      onClick={() => setActiveInspectorFile(isActive ? null : file)}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors border ${
                        isActive
                          ? 'bg-sky-500/15 border-sky-500/40 text-white'
                          : 'bg-surface-subtle/60 border-surface-border/50 hover:bg-surface-hover text-slate-300'
                      }`}
                    >
                      <span className="font-mono truncate max-w-[220px]" title={file.path}>
                        {file.path}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {onQuickEditFile && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              onQuickEditFile(file.path)
                            }}
                            className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-sky-400"
                            title="Quick View / Edit file in Gih"
                          >
                            <FileCode className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onOpenInEditor && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              onOpenInEditor(file.path)
                            }}
                            className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-indigo-400"
                            title="Open in external editor"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase ${badgeClass}`}>
                          {file.status[0]}
                        </span>
                        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isActive ? 'rotate-90 text-sky-400' : 'text-slate-600'}`} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </aside>
    )
  }

  return (
    <aside
      className="bg-surface border-l border-surface-border flex flex-col shrink-0 text-slate-300"
      style={{ width: `${width}px` }}
    >
      {/* Diff Modal / Flyout if active working tree file is clicked */}
      {activeFile && (
        renderFileDiffViewer(
          activeFile.path,
          activeDiff,
          isDiffLoading,
          () => setActiveFile(null),
          false
        )
      )}

      {/* Staged & Unstaged Lists */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {renderFileFilterInput(files.length)}

        {/* Conflicted Section (Shown during merge / rebase conflicts) */}
        {filteredConflictedFiles.length > 0 && (
          <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-800/60 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-rose-400">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                <span>Conflicts ({filteredConflictedFiles.length}{fileFilter ? `/${conflictedFiles.length}` : ''})</span>
              </div>
              <span className="text-[10px] text-rose-300/80 font-normal">Resolve to proceed</span>
            </div>

            <div className="space-y-1.5">
              {filteredConflictedFiles.map((file) => (
                <div key={file.path} className="p-2 rounded bg-[#090b10] border border-rose-900/40 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-white truncate max-w-[200px]" title={file.path}>{file.path}</span>
                    <span className="text-[10px] uppercase font-bold text-rose-400">Unmerged</span>
                  </div>
                  <div className="flex items-center gap-1 font-sans">
                    <button
                      type="button"
                      onClick={() => onResolveConflict && onResolveConflict(file.path, 'ours')}
                      className="px-2 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 text-[10px] font-medium border border-sky-500/30 active:scale-95 transition-all"
                      title="Keep current branch version (--ours)"
                    >
                      Keep Ours
                    </button>
                    <button
                      type="button"
                      onClick={() => onResolveConflict && onResolveConflict(file.path, 'theirs')}
                      className="px-2 py-0.5 rounded bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-[10px] font-medium border border-indigo-500/30 active:scale-95 transition-all"
                      title="Keep incoming branch version (--theirs)"
                    >
                      Keep Theirs
                    </button>
                    <button
                      type="button"
                      onClick={() => onResolveConflict && onResolveConflict(file.path, 'mark-resolved')}
                      className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-medium border border-emerald-500/30 active:scale-95 transition-all"
                      title="Mark file resolved and stage into index"
                    >
                      Mark Resolved
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Staged Section */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Staged Changes ({filteredStagedFiles.length}{fileFilter ? `/${stagedFiles.length}` : ''})
            </span>
            {stagedFiles.length > 0 && (
              <button
                onClick={onUnstageAll}
                className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
              >
                <Minus className="w-3 h-3" />
                Unstage All
              </button>
            )}
          </div>

          <div className="space-y-0.5">
            {filteredStagedFiles.map((file) => (
              <div
                key={file.path}
                onClick={() => setActiveFile(file)}
                className={`flex items-center justify-between p-1.5 rounded text-xs cursor-pointer group ${
                  activeFile?.path === file.path ? 'bg-surface-hover' : 'hover:bg-surface-subtle'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate text-slate-200">{file.path}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase">
                    {file.status[0]}
                  </span>
                  {onQuickEditFile && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onQuickEditFile(file.path)
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-sky-400"
                      title="Quick View / Edit file in Gih"
                    >
                      <FileCode className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {onOpenInEditor && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onOpenInEditor(file.path)
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-indigo-400"
                      title="Open in external editor"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onUnstageFile(file.path)
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-rose-400"
                    title="Unstage file"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {stagedFiles.length === 0 && (
              <p className="text-xs text-slate-500 italic p-2 bg-surface-subtle/40 rounded border border-surface-border/40 text-center">
                No changes staged
              </p>
            )}
            {stagedFiles.length > 0 && filteredStagedFiles.length === 0 && (
              <p className="text-xs text-slate-500 italic p-1.5 text-center">
                No staged files match filter
              </p>
            )}
          </div>
        </div>

        {/* Unstaged Section */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
              Unstaged Changes ({filteredUnstagedFiles.length}{fileFilter ? `/${unstagedFiles.length}` : ''})
            </span>
            {unstagedFiles.length > 0 && (
              <div className="flex items-center gap-2">
                {onDiscardAll && (
                  <button
                    type="button"
                    onClick={onDiscardAll}
                    className="text-[11px] text-rose-400/80 hover:text-rose-300 flex items-center gap-1 transition-colors"
                    title="Discard all unstaged changes (revert tracked files and clean untracked files)"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Discard All
                  </button>
                )}
                {onDiscardAll && <span className="text-slate-600 text-[10px]">|</span>}
                <button
                  type="button"
                  onClick={onStageAll}
                  className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Stage All
                </button>
              </div>
            )}
          </div>

          <div className="space-y-0.5">
            {filteredUnstagedFiles.map((file) => {
              const ext = file.path.includes('.') ? file.path.split('.').pop() : null
              const dir = file.path.includes('/') ? file.path.split('/')[0] : file.path.includes('\\') ? file.path.split('\\')[0] : null

              return (
                <div
                  key={file.path}
                  onClick={() => setActiveFile(file)}
                  className={`relative flex items-center justify-between p-1.5 rounded text-xs cursor-pointer group ${
                    activeFile?.path === file.path ? 'bg-surface-hover' : 'hover:bg-surface-subtle'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="truncate text-slate-200">{file.path}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-mono font-bold text-amber-400 uppercase">
                      {file.status[0]}
                    </span>
                    {onQuickEditFile && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onQuickEditFile(file.path)
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-sky-400"
                        title="Quick View / Edit file in Gih"
                      >
                        <FileCode className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {onOpenInEditor && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onOpenInEditor(file.path)
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-indigo-400"
                        title="Open in external editor"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onStageFile(file.path)
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-emerald-400"
                      title="Stage file"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    {onIgnorePattern && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setIgnoreMenuFile((prev) => (prev?.path === file.path ? null : file))
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-amber-400"
                        title="Add to .gitignore"
                      >
                        <EyeOff className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onDiscardChanges(file.path)
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-rose-400"
                      title="Discard changes"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Quick .gitignore Popover */}
                  {ignoreMenuFile?.path === file.path && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={(e) => {
                          e.stopPropagation()
                          setIgnoreMenuFile(null)
                        }}
                      />
                      <div
                        className="absolute right-0 top-full mt-1 z-50 bg-[#0f172a] border border-surface-border rounded-xl shadow-2xl p-1.5 min-w-[200px] text-xs space-y-1 backdrop-blur-md animate-fade-in"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="px-2 py-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider border-b border-surface-border/50">
                          Add to .gitignore
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setIgnoreMenuFile(null)
                            onIgnorePattern?.(file.path)
                          }}
                          className="w-full text-left px-2 py-1 rounded hover:bg-surface-hover text-slate-200 transition-colors truncate"
                          title={`Ignore ${file.path}`}
                        >
                          <span className="font-mono text-[11px] text-sky-400">{file.path}</span>
                        </button>
                        {ext && (
                          <button
                            type="button"
                            onClick={() => {
                              setIgnoreMenuFile(null)
                              onIgnorePattern?.(`*.${ext}`)
                            }}
                            className="w-full text-left px-2 py-1 rounded hover:bg-surface-hover text-slate-200 transition-colors truncate"
                            title={`Ignore all *${ext} files`}
                          >
                            <span className="font-mono text-[11px] text-amber-400">*.{ext}</span>
                          </button>
                        )}
                        {dir && dir !== '.' && (
                          <button
                            type="button"
                            onClick={() => {
                              setIgnoreMenuFile(null)
                              onIgnorePattern?.(`${dir}/`)
                            }}
                            className="w-full text-left px-2 py-1 rounded hover:bg-surface-hover text-slate-200 transition-colors truncate"
                            title={`Ignore folder ${dir}/`}
                          >
                            <span className="font-mono text-[11px] text-emerald-400">{dir}/</span>
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
            {unstagedFiles.length === 0 && (
              <p className="text-xs text-slate-500 italic p-2 bg-surface-subtle/40 rounded border border-surface-border/40 text-center">
                Working tree clean
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Commit Box Form */}
      <form onSubmit={handleCommitSubmit} className="p-3 border-t border-surface-border bg-surface-subtle/60">
        {/* Conventional Commit Helper Pills & 50/72 Rule Counter */}
        <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-surface-border/40 select-none">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider shrink-0 mr-0.5">prefix:</span>
            {CONVENTIONAL_TYPES.map(({ type, label, desc, color }) => (
              <button
                key={type}
                type="button"
                onClick={() => handleApplyConventionalPrefix(type)}
                title={desc}
                className={`px-1.5 py-0.5 text-[10px] font-mono rounded bg-surface border border-surface-border/70 shrink-0 transition-all active:scale-95 ${color}`}
              >
                {label}
              </button>
            ))}
          </div>

          {firstLineLen > 0 && (
            <div
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0 ml-1.5 transition-colors ${
                firstLineLen <= 50
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                  : firstLineLen <= 72
                  ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                  : 'text-rose-400 bg-rose-500/10 border-rose-500/30 font-semibold'
              }`}
              title={
                firstLineLen <= 50
                  ? 'Great summary length (<= 50 chars)'
                  : firstLineLen <= 72
                  ? 'Acceptable summary length (<= 72 chars)'
                  : 'Git warning: First line exceeds 72 characters'
              }
            >
              {firstLineLen}/72
            </div>
          )}
        </div>

        <textarea
          ref={commitTextareaRef}
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          placeholder="Commit message (Ctrl+Enter to commit)..."
          rows={3}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              handleCommitSubmit(e)
            }
          }}
          className="w-full bg-[#0c0e14] border border-surface-border rounded-lg p-2.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-brand resize-none font-sans"
        />

        {hasMultipleLines && !secondLineEmpty && (
          <div className="mt-1.5 text-[10px] text-amber-400/90 flex items-center gap-1 font-mono">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            <span>Git style tip: Leave 2nd line blank between summary and body.</span>
          </div>
        )}

        <div className="flex items-center justify-between mt-2.5">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer hover:text-slate-200">
              <input
                type="checkbox"
                checked={signOff}
                onChange={(e) => setSignOff(e.target.checked)}
                className="rounded bg-surface-border border-surface-border text-brand focus:ring-0"
              />
              <span>Sign-off (-s)</span>
            </label>

            <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer hover:text-slate-200" title="Amend previous commit (HEAD)">
              <input
                type="checkbox"
                checked={isAmend}
                onChange={(e) => {
                  const checked = e.target.checked
                  setIsAmend(checked)
                  if (checked && !commitMessage.trim() && headCommit) {
                    setCommitMessage(headCommit.message)
                  }
                }}
                className="rounded bg-surface-border border-surface-border text-amber-400 focus:ring-0"
              />
              <span className={isAmend ? 'text-amber-400 font-semibold' : ''}>Amend</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={!commitMessage.trim() || (!isAmend && stagedFiles.length === 0)}
            className={`flex items-center gap-1.5 px-3 py-1.5 font-semibold rounded text-xs transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm ${
              isAmend
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                : 'bg-brand hover:bg-brand-hover text-slate-950'
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            <span>{isAmend ? 'Amend Commit' : `Commit (${stagedFiles.length})`}</span>
          </button>
        </div>
      </form>
    </aside>
  )
}
