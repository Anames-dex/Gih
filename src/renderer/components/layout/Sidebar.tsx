import React, { useState, useMemo, useEffect } from 'react'
import { showPrompt } from '@/renderer/utils/dialog'
import type { GitBranch, GitTag, GitStash, GitWorktree, GitSubmodule } from '@/shared/types'
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
  Check,
  Scissors,
  Eye,
  UploadCloud,
  Package,
  RefreshCw
} from 'lucide-react'

type SidebarSection = 'branches' | 'remotes' | 'tags' | 'submodules' | 'stashes' | 'worktrees'

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
  onInspectStash?: (stash: GitStash) => void
  onCreateTag?: () => void
  onDeleteTag?: (name: string) => void
  onPushTag?: (name: string) => void
  onPushAllTags?: () => void
  onBranchFromStash?: (name: string, index: number) => void
  onRenameBranch?: (oldName: string, newName: string) => void
  onPruneBranches?: () => void
  currentRepoPath?: string
  submodules?: GitSubmodule[]
  onUpdateSubmodules?: () => void
  onOpenSubmoduleRepo?: (path: string) => void
  onAddWorktree?: () => void
  onSwitchWorktree?: (path: string) => void
  onRemoveWorktree?: (path: string) => void
  isActivePane?: boolean
}

export const Sidebar: React.FC<SidebarProps> = ({
  width = 260,
  branches,
  tags,
  stashes,
  worktrees,
  submodules = [],
  currentBranch,
  currentRepoPath,
  onCheckoutBranch,
  onCreateBranch,
  onDeleteBranch,
  onPopStash,
  onDropStash,
  onInspectStash,
  onCreateTag,
  onDeleteTag,
  onPushTag,
  onPushAllTags,
  onBranchFromStash,
  onRenameBranch,
  onPruneBranches,
  onUpdateSubmodules,
  onOpenSubmoduleRepo,
  onAddWorktree,
  onSwitchWorktree,
  onRemoveWorktree,
  isActivePane = false,
}) => {
  const [renamingBranch, setRenamingBranch] = useState<string | null>(null)
  const [renamingValue, setRenamingValue] = useState('')
  const [sectionOrder, setSectionOrder] = useState<SidebarSection[]>([
    'branches',
    'remotes',
    'tags',
    'submodules',
    'stashes',
    'worktrees',
  ])
  const [draggedSectionIndex, setDraggedSectionIndex] = useState<number | null>(null)

  const [localExpanded, setLocalExpanded] = useState(true)
  const [remotesExpanded, setRemotesExpanded] = useState(true)
  const [tagsExpanded, setTagsExpanded] = useState(false)
  const [submodulesExpanded, setSubmodulesExpanded] = useState(true)
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

  type NavItem =
    | { id: string; type: 'branch'; name: string }
    | { id: string; type: 'remoteBranch'; name: string }
    | { id: string; type: 'tag'; name: string }
    | { id: string; type: 'submodule'; path: string }
    | { id: string; type: 'stash'; index: number }
    | { id: string; type: 'worktree'; path: string }

  const navItems = useMemo<NavItem[]>(() => {
    const items: NavItem[] = []
    if (localExpanded) {
      filteredLocal.forEach((b) => items.push({ id: `branch-${b.name}`, type: 'branch', name: b.name }))
    }
    if (remotesExpanded) {
      filteredRemote.forEach((b) => items.push({ id: `remote-${b.name}`, type: 'remoteBranch', name: b.name }))
    }
    if (tagsExpanded) {
      tags.forEach((t) => items.push({ id: `tag-${t.name}`, type: 'tag', name: t.name }))
    }
    if (submodulesExpanded) {
      submodules.forEach((sm) => items.push({ id: `submodule-${sm.path}`, type: 'submodule', path: sm.path }))
    }
    if (stashesExpanded) {
      stashes.forEach((s) => items.push({ id: `stash-${s.index}`, type: 'stash', index: s.index }))
    }
    if (worktreesExpanded) {
      worktrees.forEach((w) => items.push({ id: `worktree-${w.path}`, type: 'worktree', path: w.path }))
    }
    return items
  }, [
    localExpanded,
    filteredLocal,
    remotesExpanded,
    filteredRemote,
    tagsExpanded,
    tags,
    submodulesExpanded,
    submodules,
    stashesExpanded,
    stashes,
    worktreesExpanded,
    worktrees,
  ])

  const [focusedNavIndex, setFocusedNavIndex] = useState<number>(0)

  useEffect(() => {
    setFocusedNavIndex((prev) => {
      if (navItems.length === 0) return 0
      return Math.max(0, Math.min(prev, navItems.length - 1))
    })
  }, [navItems])

  useEffect(() => {
    const item = navItems[focusedNavIndex]
    if (!item) return
    const el = document.querySelector(`[data-sidebar-id="${item.id}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [focusedNavIndex, navItems])

  useEffect(() => {
    if (!isActivePane) return
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)

      if (isInput) return

      if (e.key === 'ArrowDown' || e.key === 'j') {
        if (navItems.length === 0) return
        e.preventDefault()
        setFocusedNavIndex((prev) => Math.min(navItems.length - 1, prev + 1))
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        if (navItems.length === 0) return
        e.preventDefault()
        setFocusedNavIndex((prev) => Math.max(0, prev - 1))
      } else if (e.key === 'Enter') {
        if (navItems.length === 0) return
        e.preventDefault()
        const current = navItems[focusedNavIndex]
        if (!current) return
        if (current.type === 'branch' || current.type === 'remoteBranch') {
          onCheckoutBranch(current.name)
        } else if (current.type === 'stash') {
          onPopStash(current.index)
        } else if (current.type === 'submodule' && onOpenSubmoduleRepo) {
          onOpenSubmoduleRepo(current.path)
        } else if (current.type === 'worktree' && onSwitchWorktree) {
          onSwitchWorktree(current.path)
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        const current = navItems[focusedNavIndex]
        if (current && current.type === 'branch' && current.name !== currentBranch) {
          e.preventDefault()
          onDeleteBranch(current.name)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    isActivePane,
    navItems,
    focusedNavIndex,
    currentBranch,
    onCheckoutBranch,
    onDeleteBranch,
    onPopStash,
    onSwitchWorktree,
  ])

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
                {onPruneBranches && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onPruneBranches()
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-amber-300 transition-opacity"
                    title="Prune stale branches (git fetch --prune & clean gone branches)"
                  >
                    <Scissors className="w-3.5 h-3.5" />
                  </button>
                )}
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

                  const isItemFocused =
                    isActivePane && navItems[focusedNavIndex]?.id === `branch-${b.name}`

                  return (
                    <div
                      key={b.name}
                      data-sidebar-id={`branch-${b.name}`}
                      tabIndex={0}
                      onClick={() => {
                        const idx = navItems.findIndex((it) => it.id === `branch-${b.name}`)
                        if (idx !== -1) setFocusedNavIndex(idx)
                      }}
                      onDoubleClick={() => onCheckoutBranch(b.name)}
                      className={`flex items-center justify-between px-2 py-1 rounded text-xs group cursor-pointer outline-none transition-all ${
                        isItemFocused
                          ? 'bg-sky-500/20 ring-1 ring-inset ring-sky-400 text-white'
                          : isActive
                          ? 'bg-sky-500/15 text-sky-300 font-medium border-l-2 border-sky-400'
                          : 'hover:bg-surface-hover text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <BranchIcon className={`w-3 h-3 shrink-0 ${isActive ? 'text-sky-400' : 'text-slate-500'}`} />
                        <span className="truncate">{b.name}</span>
                        {(Boolean(b.ahead) || Boolean(b.behind)) && (
                          <span className="flex items-center gap-1 text-[10px] font-mono px-1 rounded bg-surface border border-surface-border/60 text-slate-400 shrink-0 select-none">
                            {Boolean(b.ahead) && <span className="text-emerald-400 font-medium">↑{b.ahead}</span>}
                            {Boolean(b.behind) && <span className="text-rose-400 font-medium">↓{b.behind}</span>}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
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
                {filteredRemote.map((b) => {
                  const isItemFocused =
                    isActivePane && navItems[focusedNavIndex]?.id === `remote-${b.name}`
                  return (
                    <div
                      key={b.name}
                      data-sidebar-id={`remote-${b.name}`}
                      tabIndex={0}
                      onClick={() => {
                        const idx = navItems.findIndex((it) => it.id === `remote-${b.name}`)
                        if (idx !== -1) setFocusedNavIndex(idx)
                      }}
                      onDoubleClick={() => onCheckoutBranch(b.name)}
                      className={`flex items-center justify-between px-2 py-1 rounded text-xs text-slate-300 group cursor-pointer outline-none transition-all ${
                        isItemFocused ? 'bg-sky-500/20 ring-1 ring-inset ring-sky-400 text-white' : 'hover:bg-surface-hover'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Globe className="w-3 h-3 text-slate-500" />
                        <span className="truncate">{b.name}</span>
                      </div>
                    </div>
                  )
                })}
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
                {onPushAllTags && tags.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onPushAllTags()
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-sky-300 transition-opacity"
                    title="Push all tags to remote origin (git push origin --tags)"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                  </button>
                )}
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
                {tags.map((t) => {
                  const isItemFocused =
                    isActivePane && navItems[focusedNavIndex]?.id === `tag-${t.name}`
                  return (
                    <div
                      key={t.name}
                      data-sidebar-id={`tag-${t.name}`}
                      tabIndex={0}
                      onClick={() => {
                        const idx = navItems.findIndex((it) => it.id === `tag-${t.name}`)
                        if (idx !== -1) setFocusedNavIndex(idx)
                      }}
                      className={`flex items-center justify-between px-2 py-1 rounded text-xs text-slate-300 group cursor-pointer outline-none transition-all ${
                        isItemFocused ? 'bg-sky-500/20 ring-1 ring-inset ring-sky-400 text-white' : 'hover:bg-surface-hover'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <TagIcon className="w-3 h-3 text-emerald-400" />
                        <span className="truncate">{t.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {onPushTag && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              onPushTag(t.name)
                            }}
                            className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 p-0.5 hover:text-sky-300"
                            title={`Push tag '${t.name}' to remote origin`}
                          >
                            <UploadCloud className="w-3 h-3" />
                          </button>
                        )}
                        {onDeleteTag && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              onDeleteTag(t.name)
                            }}
                            className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 p-0.5 hover:text-rose-400"
                            title="Delete tag"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
                {tags.length === 0 && (
                  <p className="text-[11px] text-slate-500 px-2 py-1">No tags</p>
                )}
              </div>
            )}
          </div>
        )

      case 'submodules':
        return (
          <div
            key="submodules"
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(idx)}
            className="group/sec rounded-lg border border-transparent hover:border-surface-border/40 transition-colors"
          >
            <div
              onClick={() => setSubmodulesExpanded(!submodulesExpanded)}
              className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-surface-hover cursor-pointer text-xs font-semibold text-slate-400 uppercase tracking-wider group"
            >
              <div className="flex items-center gap-1.5">
                <GripVertical className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity" />
                {submodulesExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                <Package className="w-3.5 h-3.5 text-teal-400" />
                <span>Submodules</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] bg-surface-subtle px-1.5 py-0.2 rounded text-slate-400">
                  {submodules.length}
                </span>
                {onUpdateSubmodules && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onUpdateSubmodules()
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-teal-300 transition-opacity"
                    title="Update all submodules (git submodule update --init --recursive)"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {submodulesExpanded && (
              <div className="pl-4 mt-0.5 space-y-0.5">
                {submodules.map((sm) => {
                  const isItemFocused =
                    isActivePane && navItems[focusedNavIndex]?.id === `submodule-${sm.path}`

                  return (
                    <div
                      key={sm.path}
                      data-sidebar-id={`submodule-${sm.path}`}
                      tabIndex={0}
                      onClick={() => {
                        const navIdx = navItems.findIndex((it) => it.id === `submodule-${sm.path}`)
                        if (navIdx !== -1) setFocusedNavIndex(navIdx)
                      }}
                      onDoubleClick={() => onOpenSubmoduleRepo?.(sm.path)}
                      className={`flex items-center justify-between px-2 py-1 rounded text-xs group cursor-pointer transition-colors outline-none ${
                        isItemFocused
                          ? 'bg-teal-500/20 ring-1 ring-inset ring-sky-400 text-white'
                          : 'hover:bg-surface-hover text-slate-300'
                      }`}
                      title={`Submodule: ${sm.name}\nPath: ${sm.path}\nCommit: ${sm.hash}${
                        sm.describe ? ` (${sm.describe})` : ''
                      }\nStatus: ${sm.status}\nDouble-click to open in Gih`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Package className="w-3 h-3 text-teal-400 shrink-0" />
                        <span className="truncate font-medium">{sm.name}</span>
                        <span className="text-[10px] font-mono text-slate-500 truncate">
                          {sm.hash.slice(0, 7)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`text-[9px] font-mono px-1 py-0.2 rounded border uppercase ${
                            sm.status === 'clean'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : sm.status === 'uninitialized'
                              ? 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}
                        >
                          {sm.status}
                        </span>
                        {onOpenSubmoduleRepo && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              onOpenSubmoduleRepo(sm.path)
                            }}
                            className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 p-0.5 hover:text-teal-300"
                            title="Open submodule in Gih"
                          >
                            <Play className="w-2.5 h-2.5 fill-current" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
                {submodules.length === 0 && (
                  <p className="text-[11px] text-slate-500 px-2 py-1">No submodules configured</p>
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
                {stashes.map((s) => {
                  const isItemFocused =
                    isActivePane && navItems[focusedNavIndex]?.id === `stash-${s.index}`
                  return (
                    <div
                      key={s.name}
                      data-sidebar-id={`stash-${s.index}`}
                      tabIndex={0}
                      onClick={() => {
                        const idx = navItems.findIndex((it) => it.id === `stash-${s.index}`)
                        if (idx !== -1) setFocusedNavIndex(idx)
                      }}
                      onDoubleClick={() => onInspectStash?.(s)}
                      className={`flex items-center justify-between px-2 py-1 rounded text-xs text-slate-300 group outline-none transition-all ${
                        isItemFocused ? 'bg-sky-500/20 ring-1 ring-inset ring-sky-400 text-white' : 'hover:bg-surface-hover'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Archive className="w-3 h-3 text-purple-400" />
                        <span className="truncate" title={s.message}>{s.message || s.name}</span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
                        {onInspectStash && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              onInspectStash(s)
                            }}
                            className="p-1 hover:text-purple-300 text-slate-400"
                            title="Inspect stash diff"
                          >
                            <Eye className="w-3 h-3" />
                          </button>
                        )}
                        {onBranchFromStash && (
                          <button
                            type="button"
                            onClick={async () => {
                              const bName = await showPrompt({
                                title: 'Branch from Stash',
                                message: 'Enter a new branch name to create from this stash:',
                                placeholder: 'e.g. feat/stashed-work',
                                confirmLabel: 'Create Branch',
                              })
                              if (bName) onBranchFromStash(bName, s.index)
                            }}
                            className="text-[10px] px-1 py-0.5 bg-surface-subtle hover:bg-surface-border rounded text-amber-400"
                            title="Branch from stash"
                          >
                            Branch
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onPopStash(s.index)}
                          className="text-[10px] px-1 py-0.5 bg-surface-subtle hover:bg-surface-border rounded text-sky-400"
                          title="Pop stash (Enter)"
                        >
                          Pop
                        </button>
                        <button
                          type="button"
                          onClick={() => onDropStash(s.index)}
                          className="p-0.5 hover:text-rose-400"
                          title="Drop stash"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )
                })}
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
              <div className="flex items-center gap-1">
                <span className="text-[10px] bg-surface-subtle px-1.5 py-0.2 rounded text-slate-400">
                  {worktrees.length}
                </span>
                {onAddWorktree && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onAddWorktree()
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-white transition-opacity"
                    title="Add worktree (git worktree add)"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {worktreesExpanded && (
              <div className="pl-4 mt-0.5 space-y-0.5">
                {worktrees.map((wt, wtIdx) => {
                  const normalizedCurrent = currentRepoPath?.replace(/\\/g, '/').toLowerCase()
                  const normalizedWt = wt.path.replace(/\\/g, '/').toLowerCase()
                  const isCurrent = normalizedCurrent === normalizedWt
                  const isMain = wtIdx === 0
                  const isItemFocused =
                    isActivePane && navItems[focusedNavIndex]?.id === `worktree-${wt.path}`

                  return (
                    <div
                      key={wt.path}
                      data-sidebar-id={`worktree-${wt.path}`}
                      tabIndex={0}
                      onClick={() => {
                        const idx = navItems.findIndex((it) => it.id === `worktree-${wt.path}`)
                        if (idx !== -1) setFocusedNavIndex(idx)
                      }}
                      onDoubleClick={() => !isCurrent && onSwitchWorktree?.(wt.path)}
                      className={`flex items-center justify-between px-2 py-1 rounded text-xs group cursor-pointer transition-colors outline-none ${
                        isItemFocused
                          ? 'bg-amber-500/20 ring-1 ring-inset ring-sky-400 text-white'
                          : isCurrent
                          ? 'bg-amber-500/15 text-amber-300 font-medium border-l-2 border-amber-400'
                          : 'hover:bg-surface-hover text-slate-300'
                      }`}
                      title={`${wt.path}\nBranch: ${wt.branch || '(detached)'}\nDouble-click to open in Gih`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Layers className={`w-3 h-3 shrink-0 ${isCurrent ? 'text-amber-400' : 'text-slate-500'}`} />
                        <span className="truncate">{wt.branch || wt.path.split(/[/\\]/).pop()}</span>
                        {isCurrent && (
                          <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-300 font-semibold select-none">
                            active
                          </span>
                        )}
                        {isMain && !isCurrent && (
                          <span className="text-[9px] px-1 rounded bg-surface border border-surface-border text-slate-400 select-none">
                            main
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!isCurrent && onSwitchWorktree && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              onSwitchWorktree(wt.path)
                            }}
                            className="p-1 hover:text-sky-300"
                            title="Switch Gih to this worktree"
                          >
                            <Play className="w-2.5 h-2.5 fill-current" />
                          </button>
                        )}
                        {!isMain && onRemoveWorktree && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              onRemoveWorktree(wt.path)
                            }}
                            className="p-1 hover:text-rose-400"
                            title="Remove worktree (git worktree remove)"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
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
