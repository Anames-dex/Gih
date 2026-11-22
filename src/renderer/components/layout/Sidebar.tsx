import React, { useState } from 'react'
import type { GitBranch, GitTag, GitStash, GitWorktree } from '@/shared/types'
import {
  GitBranch as BranchIcon,
  Globe,
  Tag as TagIcon,
  Archive,
  Layers,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Play,
  GripVertical,
  Pencil,
  Check
} from 'lucide-react'

type SidebarSection = 'branches' | 'remotes' | 'tags' | 'stashes' | 'worktrees'

interface SidebarProps {
  width?: number
  branches: GitBranch[]
  tags: GitTag[]
  stashes: GitStash[]
  worktrees: GitWorktree[]
  currentBranch: string | null
  onCheckoutBranch: (branchName: string) => void
  onCreateBranch: () => void
  onDeleteBranch: (branchName: string) => void
  onApplyStash: (index: number) => void
  onPopStash: (index: number) => void
  onDropStash: (index: number) => void
  onCreateTag?: () => void
  onDeleteTag?: (name: string) => void
  onBranchFromStash?: (name: string, index: number) => void
  onRenameBranch?: (oldName: string, newName: string) => void
}

export const Sidebar: React.FC<SidebarProps> = ({
  width = 260,
  branches,
  tags,
  stashes,
  worktrees,
  currentBranch,
  onCheckoutBranch,
  onCreateBranch,
  onDeleteBranch,
  onPopStash,
  onDropStash,
  onCreateTag,
  onDeleteTag,
  onBranchFromStash,
  onRenameBranch,
}) => {
  const [renamingBranch, setRenamingBranch] = useState<string | null>(null)
  const [renamingValue, setRenamingValue] = useState('')
  const [sectionOrder, setSectionOrder] = useState<SidebarSection[]>([
    'branches',
    'remotes',
    'tags',
    'stashes',
    'worktrees',
  ])
  const [draggedSectionIndex, setDraggedSectionIndex] = useState<number | null>(null)

  const [localExpanded, setLocalExpanded] = useState(true)
  const [remotesExpanded, setRemotesExpanded] = useState(true)
  const [tagsExpanded, setTagsExpanded] = useState(false)
  const [stashesExpanded, setStashesExpanded] = useState(false)
  const [worktreesExpanded, setWorktreesExpanded] = useState(false)
  const [filterQuery, setFilterQuery] = useState('')

  const localBranches = branches.filter((b) => !b.isRemote)
  const remoteBranches = branches.filter((b) => b.isRemote)

  const filteredLocal = localBranches.filter((b) =>
    b.name.toLowerCase().includes(filterQuery.toLowerCase())
  )
  const filteredRemote = remoteBranches.filter((b) =>
    b.name.toLowerCase().includes(filterQuery.toLowerCase())
  )

  const handleDragStart = (idx: number) => {
    setDraggedSectionIndex(idx)
  }

  const handleDrop = (targetIdx: number) => {
    if (draggedSectionIndex === null || draggedSectionIndex === targetIdx) return
    setSectionOrder((prev) => {
      const copy = [...prev]
      const [item] = copy.splice(draggedSectionIndex, 1)
      copy.splice(targetIdx, 0, item)
      return copy
    })
    setDraggedSectionIndex(null)
  }

  const renderSection = (sec: SidebarSection, idx: number) => {
    switch (sec) {
      case 'branches':
        return (
          <div
            key="branches"
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(idx)}
            className="group/sec rounded-lg border border-transparent hover:border-surface-border/40 transition-colors"
          >
            <div
              onClick={() => setLocalExpanded(!localExpanded)}
              className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-surface-hover cursor-pointer text-xs font-semibold text-slate-400 uppercase tracking-wider group"
            >
              <div className="flex items-center gap-1.5">
                <GripVertical className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity" />
                {localExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                <BranchIcon className="w-3.5 h-3.5 text-sky-400" />
                <span>Local Branches</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] bg-surface-subtle px-1.5 py-0.2 rounded text-slate-400">
                  {localBranches.length}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onCreateBranch()
                  }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-white transition-opacity"
                  title="New branch"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {localExpanded && (
              <div className="pl-4 mt-0.5 space-y-0.5">
                {filteredLocal.map((b) => {
                  const isActive = b.name === currentBranch
                  const isRenaming = renamingBranch === b.name

                  if (isRenaming) {
                    return (
                      <div key={b.name} className="flex items-center gap-1.5 px-2 py-1 bg-surface-hover rounded text-xs">
                        <BranchIcon className="w-3 h-3 text-brand shrink-0" />
                        <input
                          autoFocus
                          value={renamingValue}
                          onChange={(e) => setRenamingValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              if (renamingValue.trim() && renamingValue.trim() !== b.name && onRenameBranch) {
                                onRenameBranch(b.name, renamingValue.trim())
                              }
                              setRenamingBranch(null)
                            } else if (e.key === 'Escape') {
                              setRenamingBranch(null)
                            }
                          }}
                          onBlur={() => {
                            if (renamingValue.trim() && renamingValue.trim() !== b.name && onRenameBranch) {
                              onRenameBranch(b.name, renamingValue.trim())
                            }
                            setRenamingBranch(null)
                          }}
                          className="w-full bg-[#0c0e14] border border-brand rounded px-1.5 py-0.5 text-xs text-white focus:outline-none"
                        />
                      </div>
                    )
                  }

                  return (
                    <div
                      key={b.name}
                      onDoubleClick={() => onCheckoutBranch(b.name)}
                      className={`flex items-center justify-between px-2 py-1 rounded text-xs group cursor-pointer ${
                        isActive
                          ? 'bg-sky-500/15 text-sky-300 font-medium border-l-2 border-sky-400'
                          : 'hover:bg-surface-hover text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <BranchIcon className={`w-3 h-3 ${isActive ? 'text-sky-400' : 'text-slate-500'}`} />
                        <span className="truncate">{b.name}</span>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setRenamingBranch(b.name)
                            setRenamingValue(b.name)
                          }}
                          className="p-1 hover:text-amber-300"
                          title="Rename branch"
                        >
                          <Pencil className="w-2.5 h-2.5" />
                        </button>

                        {!isActive && (
                          <>
                            <button
                              onClick={() => onCheckoutBranch(b.name)}
                              className="p-1 hover:text-sky-300"
                              title="Checkout branch"
                            >
                              <Play className="w-2.5 h-2.5 fill-current" />
                            </button>
                            <button
                              onClick={() => onDeleteBranch(b.name)}
                              className="p-1 hover:text-rose-400"
                              title="Delete branch"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )

      case 'remotes':
        return (
          <div
            key="remotes"
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(idx)}
            className="group/sec rounded-lg border border-transparent hover:border-surface-border/40 transition-colors"
          >
            <div
              onClick={() => setRemotesExpanded(!remotesExpanded)}
              className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-surface-hover cursor-pointer text-xs font-semibold text-slate-400 uppercase tracking-wider group"
            >
              <div className="flex items-center gap-1.5">
                <GripVertical className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity" />
                {remotesExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                <Globe className="w-3.5 h-3.5 text-indigo-400" />
                <span>Remotes</span>
              </div>
              <span className="text-[10px] bg-surface-subtle px-1.5 py-0.2 rounded text-slate-400">
                {remoteBranches.length}
              </span>
            </div>

            {remotesExpanded && (
              <div className="pl-4 mt-0.5 space-y-0.5">
                {filteredRemote.map((b) => (
                  <div
                    key={b.name}
                    onDoubleClick={() => onCheckoutBranch(b.name)}
                    className="flex items-center justify-between px-2 py-1 rounded text-xs hover:bg-surface-hover text-slate-300 group cursor-pointer"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Globe className="w-3 h-3 text-slate-500" />
                      <span className="truncate">{b.name}</span>
                    </div>
                  </div>
                ))}
                {filteredRemote.length === 0 && (
                  <p className="text-[11px] text-slate-500 px-2 py-1">No remote branches tracked</p>
                )}
              </div>
            )}
          </div>
        )

      case 'tags':
        return (
          <div
            key="tags"
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(idx)}
            className="group/sec rounded-lg border border-transparent hover:border-surface-border/40 transition-colors"
          >
            <div
              onClick={() => setTagsExpanded(!tagsExpanded)}
              className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-surface-hover cursor-pointer text-xs font-semibold text-slate-400 uppercase tracking-wider group"
            >
              <div className="flex items-center gap-1.5">
                <GripVertical className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity" />
                {tagsExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                <TagIcon className="w-3.5 h-3.5 text-emerald-400" />
                <span>Tags</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] bg-surface-subtle px-1.5 py-0.2 rounded text-slate-400">
                  {tags.length}
                </span>
                {onCreateTag && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onCreateTag()
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-white transition-opacity"
                    title="Create tag"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {tagsExpanded && (
              <div className="pl-4 mt-0.5 space-y-0.5">
                {tags.map((t) => (
                  <div
                    key={t.name}
                    className="flex items-center justify-between px-2 py-1 rounded text-xs hover:bg-surface-hover text-slate-300 group cursor-pointer"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <TagIcon className="w-3 h-3 text-emerald-400" />
                      <span className="truncate">{t.name}</span>
                    </div>
                    {onDeleteTag && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onDeleteTag(t.name)
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-rose-400"
                        title="Delete tag"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
                {tags.length === 0 && (
                  <p className="text-[11px] text-slate-500 px-2 py-1">No tags</p>
                )}
              </div>
            )}
          </div>
        )

      case 'stashes':
        return (
          <div
            key="stashes"
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(idx)}
            className="group/sec rounded-lg border border-transparent hover:border-surface-border/40 transition-colors"
          >
            <div
              onClick={() => setStashesExpanded(!stashesExpanded)}
              className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-surface-hover cursor-pointer text-xs font-semibold text-slate-400 uppercase tracking-wider group"
            >
              <div className="flex items-center gap-1.5">
                <GripVertical className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity" />
                {stashesExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                <Archive className="w-3.5 h-3.5 text-purple-400" />
                <span>Stashes</span>
              </div>
              <span className="text-[10px] bg-surface-subtle px-1.5 py-0.2 rounded text-slate-400">
                {stashes.length}
              </span>
            </div>

            {stashesExpanded && (
              <div className="pl-4 mt-0.5 space-y-0.5">
                {stashes.map((s) => (
                  <div
                    key={s.name}
                    className="flex items-center justify-between px-2 py-1 rounded text-xs hover:bg-surface-hover text-slate-300 group"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Archive className="w-3 h-3 text-purple-400" />
                      <span className="truncate" title={s.message}>{s.message || s.name}</span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                      {onBranchFromStash && (
                        <button
                          onClick={() => {
                            const bName = window.prompt('New branch name from stash:')
                            if (bName) onBranchFromStash(bName, s.index)
                          }}
                          className="text-[10px] px-1 py-0.5 bg-surface-subtle hover:bg-surface-border rounded text-amber-400"
                          title="Branch from stash"
                        >
                          Branch
                        </button>
                      )}
                      <button
                        onClick={() => onPopStash(s.index)}
                        className="text-[10px] px-1 py-0.5 bg-surface-subtle hover:bg-surface-border rounded text-sky-400"
                        title="Pop stash"
                      >
                        Pop
                      </button>
                      <button
                        onClick={() => onDropStash(s.index)}
                        className="p-0.5 hover:text-rose-400"
                        title="Drop stash"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
                {stashes.length === 0 && (
                  <p className="text-[11px] text-slate-500 px-2 py-1">No stashes saved</p>
                )}
              </div>
            )}
          </div>
        )

      case 'worktrees':
        return (
          <div
            key="worktrees"
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(idx)}
            className="group/sec rounded-lg border border-transparent hover:border-surface-border/40 transition-colors"
          >
            <div
              onClick={() => setWorktreesExpanded(!worktreesExpanded)}
              className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-surface-hover cursor-pointer text-xs font-semibold text-slate-400 uppercase tracking-wider group"
            >
              <div className="flex items-center gap-1.5">
                <GripVertical className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity" />
                {worktreesExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                <span>Worktrees</span>
              </div>
              <span className="text-[10px] bg-surface-subtle px-1.5 py-0.2 rounded text-slate-400">
                {worktrees.length}
              </span>
            </div>

            {worktreesExpanded && (
              <div className="pl-4 mt-0.5 space-y-0.5">
                {worktrees.map((wt) => (
                  <div
                    key={wt.path}
                    className="flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-surface-hover text-slate-300"
                    title={wt.path}
                  >
                    <Layers className="w-3 h-3 text-amber-400" />
                    <span className="truncate">{wt.branch || wt.path.split(/[/\\]/).pop()}</span>
                  </div>
                ))}
                {worktrees.length === 0 && (
                  <p className="text-[11px] text-slate-500 px-2 py-1">Single worktree</p>
                )}
              </div>
            )}
          </div>
        )
    }
  }

  return (
    <aside
      className="bg-surface/90 border-r border-surface-border flex flex-col shrink-0 text-slate-300 select-none"
      style={{ width: `${width}px` }}
    >
      {/* Search Filter */}
      <div className="p-2 border-b border-surface-border">
        <input
          type="text"
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
          placeholder="Filter branches, tags..."
          className="w-full bg-surface-subtle border border-surface-border rounded px-2.5 py-1 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-brand"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {sectionOrder.map((sec, idx) => renderSection(sec, idx))}
      </div>
    </aside>
  )
}
