import React, { useState, useEffect } from 'react'
import type { GitFileStatus, FileDiff, GitCommit } from '@/shared/types'
import {
  FileText,
  Plus,
  Minus,
  Check,
  RotateCcw,
  GitCommit as CommitIcon,
  X,
  FileDiff as DiffIcon
} from 'lucide-react'

interface StagingAreaProps {
  files: GitFileStatus[]
  selectedCommit: GitCommit | null
  onClearSelectedCommit: () => void
  onStageFile: (path: string) => void
  onUnstageFile: (path: string) => void
  onStageAll: () => void
  onUnstageAll: () => void
  onDiscardChanges: (path: string) => void
  onCommit: (message: string, signOff?: boolean) => void
  onGetDiff: (path: string, staged: boolean) => Promise<FileDiff>
}

export const StagingArea: React.FC<StagingAreaProps> = ({
  files,
  selectedCommit,
  onClearSelectedCommit,
  onStageFile,
  onUnstageFile,
  onStageAll,
  onUnstageAll,
  onDiscardChanges,
  onCommit,
  onGetDiff,
}) => {
  const [activeFile, setActiveFile] = useState<GitFileStatus | null>(null)
  const [activeDiff, setActiveDiff] = useState<FileDiff | null>(null)
  const [commitMessage, setCommitMessage] = useState('')
  const [signOff, setSignOff] = useState(false)
  const [isDiffLoading, setIsDiffLoading] = useState(false)

  const stagedFiles = files.filter((f) => f.staged)
  const unstagedFiles = files.filter((f) => !f.staged)

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
    if (!commitMessage.trim() || stagedFiles.length === 0) return
    onCommit(commitMessage.trim(), signOff)
    setCommitMessage('')
  }

  // If a commit is selected from the graph, show its inspector
  if (selectedCommit) {
    return (
      <aside className="w-96 bg-surface border-l border-surface-border flex flex-col shrink-0 text-slate-300">
        <div className="p-3 border-b border-surface-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CommitIcon className="w-4 h-4 text-sky-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Commit Details
            </span>
          </div>
          <button
            onClick={onClearSelectedCommit}
            className="p-1 hover:bg-surface-hover rounded text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-white leading-snug">
              {selectedCommit.summary}
            </h3>
            {selectedCommit.message !== selectedCommit.summary && (
              <p className="mt-2 text-xs text-slate-400 whitespace-pre-wrap font-mono">
                {selectedCommit.message}
              </p>
            )}
          </div>

          <div className="p-3 bg-surface-subtle border border-surface-border rounded-lg space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Hash</span>
              <span className="font-mono text-slate-200 select-all">{selectedCommit.hash}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Author</span>
              <span className="text-slate-200">{selectedCommit.author.name}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Date</span>
              <span className="text-slate-200">{selectedCommit.author.date}</span>
            </div>
            {selectedCommit.parents.length > 0 && (
              <div className="flex justify-between text-slate-400">
                <span>Parents</span>
                <span className="font-mono text-slate-200 truncate max-w-[180px]">
                  {selectedCommit.parents.map((p) => p.substring(0, 7)).join(', ')}
                </span>
              </div>
            )}
          </div>
        </div>
      </aside>
    )
  }

  return (
    <aside className="w-96 bg-surface border-l border-surface-border flex flex-col shrink-0 text-slate-300">
      {/* Diff Modal / Flyout if active file is clicked */}
      {activeFile && (
        <div className="border-b border-surface-border bg-surface-subtle/50 p-2">
          <div className="flex items-center justify-between pb-1 mb-1 border-b border-surface-border/50 text-xs">
            <div className="flex items-center gap-1.5 truncate">
              <DiffIcon className="w-3.5 h-3.5 text-sky-400" />
              <span className="font-mono text-white truncate">{activeFile.path}</span>
            </div>
            <button
              onClick={() => setActiveFile(null)}
              className="p-0.5 hover:bg-surface-hover rounded"
            >
              <X className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>

          <div className="max-h-48 overflow-y-auto text-xs font-mono bg-[#0c0e14] p-2 rounded border border-surface-border/40">
            {isDiffLoading && <p className="text-slate-500">Loading diff...</p>}
            {activeDiff && activeDiff.hunks.length === 0 && !isDiffLoading && (
              <p className="text-slate-500">No text differences found.</p>
            )}
            {activeDiff?.hunks.map((hunk, hIdx) => (
              <div key={hIdx} className="mb-2 last:mb-0">
                <div className="text-[10px] text-indigo-400 bg-indigo-950/30 px-1 py-0.5 rounded">
                  {hunk.header}
                </div>
                {hunk.lines.map((line, lIdx) => (
                  <div
                    key={lIdx}
                    className={`leading-tight px-1 ${
                      line.type === 'add'
                        ? 'bg-emerald-950/40 text-emerald-300'
                        : line.type === 'delete'
                        ? 'bg-rose-950/40 text-rose-300'
                        : 'text-slate-400'
                    }`}
                  >
                    <span className="inline-block w-4 text-slate-600 select-none">
                      {line.type === 'add' ? '+' : line.type === 'delete' ? '-' : ' '}
                    </span>
                    {line.content}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Staged & Unstaged Lists */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Staged Section */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Staged Changes ({stagedFiles.length})
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
            {stagedFiles.map((file) => (
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
          </div>
        </div>

        {/* Unstaged Section */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
              Unstaged Changes ({unstagedFiles.length})
            </span>
            {unstagedFiles.length > 0 && (
              <button
                onClick={onStageAll}
                className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Stage All
              </button>
            )}
          </div>

          <div className="space-y-0.5">
            {unstagedFiles.map((file) => (
              <div
                key={file.path}
                onClick={() => setActiveFile(file)}
                className={`flex items-center justify-between p-1.5 rounded text-xs cursor-pointer group ${
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
              </div>
            ))}
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
        <textarea
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

        <div className="flex items-center justify-between mt-2">
          <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={signOff}
              onChange={(e) => setSignOff(e.target.checked)}
              className="rounded bg-surface-border border-surface-border text-brand focus:ring-0"
            />
            <span>Sign-off (-s)</span>
          </label>

          <button
            type="submit"
            disabled={stagedFiles.length === 0 || !commitMessage.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand hover:bg-brand-hover text-slate-950 font-semibold rounded text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Commit ({stagedFiles.length})</span>
          </button>
        </div>
      </form>
    </aside>
  )
}
