import React, { useState, useEffect, useRef } from 'react'
import type { CommandLogEntry, ReflogEntry } from '@/shared/types'
import {
  Terminal as TerminalIcon,
  Clock,
  History,
  Send,
  RotateCcw,
  ChevronDown,
  CheckCircle,
  AlertCircle
} from 'lucide-react'

interface BottomPanelProps {
  height?: number
  isOpen: boolean
  onClose: () => void
  commandHistory: CommandLogEntry[]
  onExecCommand: (commandStr: string) => Promise<void>
  onGetReflog: () => Promise<ReflogEntry[]>
  onResetToReflog: (hash: string) => void
  isActivePane?: boolean
}

export const BottomPanel: React.FC<BottomPanelProps> = ({
  height = 260,
  isOpen,
  onClose,
  commandHistory,
  onExecCommand,
  onGetReflog,
  onResetToReflog,
  isActivePane = false,
}) => {
  const [activeTab, setActiveTab] = useState<'terminal' | 'log' | 'reflog'>('terminal')
  const [cliInput, setCliInput] = useState('')
  const [reflogEntries, setReflogEntries] = useState<ReflogEntry[]>([])
  const [isExecuting, setIsExecuting] = useState(false)
  const cliInputRef = useRef<HTMLInputElement>(null)
  const cliOutputEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isActivePane && isOpen && activeTab === 'terminal') {
      cliInputRef.current?.focus()
    }
  }, [isActivePane, isOpen, activeTab])

  useEffect(() => {
    if (isOpen && activeTab === 'terminal') {
      cliOutputEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [commandHistory.length, isOpen, activeTab])

  useEffect(() => {
    if (activeTab === 'reflog' && isOpen) {
      onGetReflog().then(setReflogEntries)
    }
  }, [activeTab, isOpen])

  const handleCommandSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cliInput.trim() || isExecuting) return

    let cmd = cliInput.trim()
    if (cmd.startsWith('git ')) {
      cmd = cmd.substring(4)
    }

    setIsExecuting(true)
    try {
      await onExecCommand(cmd)
      setCliInput('')
    } finally {
      setIsExecuting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="bg-surface border-t border-surface-border flex flex-col shrink-0 select-none"
      style={{ height: `${height}px` }}
    >
      {/* Panel Tab Bar */}
      <div className="h-9 bg-surface-subtle border-b border-surface-border flex items-center justify-between px-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('terminal')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
              activeTab === 'terminal'
                ? 'bg-surface text-brand border border-surface-border'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <TerminalIcon className="w-3.5 h-3.5" />
            <span>Visual CLI</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('log')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
              activeTab === 'log'
                ? 'bg-surface text-brand border border-surface-border'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Command Stream</span>
            {commandHistory.length > 0 && (
              <span className="text-[10px] bg-surface-border px-1.5 rounded-full text-slate-300">
                {commandHistory.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('reflog')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
              activeTab === 'reflog'
                ? 'bg-surface text-brand border border-surface-border'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5 text-amber-400" />
            <span>Reflog & Undo</span>
          </button>
        </div>

        <button
          onClick={onClose}
          className="p-1 hover:bg-surface-hover rounded text-slate-400 hover:text-white"
          title="Close panel"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto font-mono text-xs p-3 bg-[#0a0c10]">
        {/* Visual CLI Tab */}
        {activeTab === 'terminal' && (
          <div className="flex flex-col h-full justify-between">
            <div className="flex-1 overflow-y-auto space-y-2 mb-2 pr-2">
              <div className="text-slate-500 text-[11px] font-sans pb-2 border-b border-surface-border/40">
                Type any native Git command below (e.g. <code className="text-sky-300">rebase -i HEAD~3</code>, <code className="text-sky-300">reset --hard HEAD~1</code>, <code className="text-sky-300">branch -m new-name</code>). Visual graph updates automatically.
              </div>

              {commandHistory.slice(0, 10).reverse().map((entry) => (
                <div
                  key={entry.id}
                  className={`p-2 rounded bg-surface/50 border select-text ${
                    entry.isError ? 'border-rose-800/60' : 'border-surface-border/30'
                  }`}
                >
                  <div className="flex items-center gap-2 text-slate-300">
                    {entry.isError ? (
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    ) : (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    )}
                    <span className="text-sky-400 font-bold">$</span>
                    <span className="truncate">{entry.command}</span>
                    <span className="text-[10px] text-slate-500 ml-auto shrink-0">
                      exit {entry.exitCode} • {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  {entry.output && (
                    <pre
                      className={`mt-1 text-[11px] whitespace-pre-wrap break-words pl-3 border-l ${
                        entry.isError ? 'text-rose-300 border-rose-700' : 'text-slate-400 border-slate-700'
                      }`}
                    >
                      {entry.output}
                    </pre>
                  )}
                </div>
              ))}
              <div ref={cliOutputEndRef} />
            </div>

            <form onSubmit={handleCommandSubmit} className="flex items-center gap-2 pt-2 border-t border-surface-border">
              <span className="text-sky-400 font-bold text-sm">$ git</span>
              <input
                ref={cliInputRef}
                type="text"
                value={cliInput}
                onChange={(e) => setCliInput(e.target.value)}
                placeholder="rebase -i main / cherry-pick 8a7f1 / reset --soft HEAD~1"
                disabled={isExecuting}
                className="flex-1 bg-surface-subtle border border-surface-border rounded px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-brand"
              />
              <button
                type="submit"
                disabled={!cliInput.trim() || isExecuting}
                className="p-1.5 bg-brand text-slate-950 font-bold rounded hover:bg-brand-hover transition-colors disabled:opacity-40"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}

        {/* Command Stream Log Tab */}
        {activeTab === 'log' && (
          <div className="space-y-1.5">
            {commandHistory.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-2 p-1.5 rounded hover:bg-surface-subtle/40 border border-transparent hover:border-surface-border/40"
              >
                {entry.isError ? (
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400 mt-0.5 shrink-0" />
                ) : (
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                )}
                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-200 font-semibold">{entry.command}</span>
                    <span className="text-[10px] text-slate-500">
                      code {entry.exitCode}
                    </span>
                    <span className="text-[10px] text-slate-600 ml-auto">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  {entry.output && (
                    <pre className="mt-1 text-[11px] text-slate-400 whitespace-pre-wrap max-h-24 overflow-y-auto">
                      {entry.output}
                    </pre>
                  )}
                </div>
              </div>
            ))}
            {commandHistory.length === 0 && (
              <p className="text-slate-500 italic text-center py-4">No commands executed yet.</p>
            )}
          </div>
        )}

        {/* Reflog & Undo Tab */}
        {activeTab === 'reflog' && (
          <div className="space-y-1.5">
            <div className="text-[11px] text-slate-500 font-sans pb-2 border-b border-surface-border/40">
              Reflog tracks every single HEAD movement. Click "Reset HEAD" on any entry to immediately rewind your repository state.
            </div>

            {reflogEntries.map((r) => (
              <div
                key={r.selector}
                className="flex items-center justify-between p-1.5 rounded hover:bg-surface-subtle border border-surface-border/30"
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="text-sky-400 font-bold">{r.selector}</span>
                  <span className="text-slate-500">[{r.hash}]</span>
                  <span className="text-amber-300 font-semibold">{r.action}</span>
                  <span className="text-slate-300 truncate" title={r.message}>{r.message}</span>
                </div>

                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <span className="text-[10px] text-slate-500">{r.date}</span>
                  <button
                    onClick={() => onResetToReflog(r.hash)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-surface-subtle hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 border border-surface-border text-[11px] transition-colors"
                    title={`git reset --hard ${r.hash}`}
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset HEAD</span>
                  </button>
                </div>
              </div>
            ))}
            {reflogEntries.length === 0 && (
              <p className="text-slate-500 italic text-center py-4">Loading reflog entries...</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
