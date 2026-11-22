import React, { useState, useEffect, useRef } from 'react'
import type { GitBranch, GitCommit } from '@/shared/types'
import {
  Search,
  GitBranch as BranchIcon,
  GitCommit as CommitIcon,
  Terminal,
  ArrowDown,
  ArrowUp,
  RefreshCw,
  Archive
} from 'lucide-react'

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  branches: GitBranch[]
  commits: GitCommit[]
  onCheckoutBranch: (branch: string) => void
  onSelectCommit: (commit: GitCommit) => void
  onAction: (actionId: string) => void
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  branches,
  commits,
  onCheckoutBranch,
  onSelectCommit,
  onAction,
}) => {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Build items list
  const staticActions = [
    { id: 'fetch', label: 'Git: Fetch All Remotes', icon: RefreshCw, type: 'action' },
    { id: 'pull', label: 'Git: Pull (Fast-forward or merge)', icon: ArrowDown, type: 'action' },
    { id: 'push', label: 'Git: Push to Remote', icon: ArrowUp, type: 'action' },
    { id: 'stash', label: 'Git: Stash All Changes', icon: Archive, type: 'action' },
    { id: 'terminal', label: 'View: Toggle Visual Shell & Terminal', icon: Terminal, type: 'action' },
  ]

  const branchItems = branches.map((b) => ({
    id: `branch:${b.name}`,
    label: `Switch to branch: ${b.name}`,
    branchName: b.name,
    icon: BranchIcon,
    type: 'branch',
  }))

  const commitItems = commits.slice(0, 30).map((c) => ({
    id: `commit:${c.hash}`,
    label: `${c.shortHash} — ${c.summary}`,
    commit: c,
    icon: CommitIcon,
    type: 'commit',
  }))

  const allItems = [...staticActions, ...branchItems, ...commitItems]
  const filteredItems = allItems.filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 15)

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const selected = filteredItems[selectedIndex]
      if (selected) {
        if (selected.type === 'action') {
          onAction(selected.id)
        } else if (selected.type === 'branch' && 'branchName' in selected) {
          onCheckoutBranch(selected.branchName as string)
        } else if (selected.type === 'commit' && 'commit' in selected) {
          onSelectCommit(selected.commit as GitCommit)
        }
        onClose()
      }
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-24"
      onClick={onClose}
    >
      <div
        className="w-[560px] bg-surface border border-surface-border rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command, branch name, or commit hash..."
            className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
          <kbd className="text-[10px] bg-surface-subtle border border-surface-border px-1.5 py-0.5 rounded text-slate-400 font-mono">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-1.5 space-y-0.5">
          {filteredItems.map((item, idx) => {
            const Icon = item.icon
            const isSelected = idx === selectedIndex

            return (
              <div
                key={item.id}
                onMouseEnter={() => setSelectedIndex(idx)}
                onClick={() => {
                  if (item.type === 'action') {
                    onAction(item.id)
                  } else if (item.type === 'branch' && 'branchName' in item) {
                    onCheckoutBranch(item.branchName as string)
                  } else if (item.type === 'commit' && 'commit' in item) {
                    onSelectCommit(item.commit as GitCommit)
                  }
                  onClose()
                }}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                  isSelected ? 'bg-brand text-slate-950 font-medium' : 'text-slate-200 hover:bg-surface-hover'
                }`}
              >
                <Icon className={`w-4 h-4 ${isSelected ? 'text-slate-950' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </div>
            )
          })}
          {filteredItems.length === 0 && (
            <p className="text-xs text-slate-500 text-center py-4">No matching commands or refs found.</p>
          )}
        </div>
      </div>
    </div>
  )
}
