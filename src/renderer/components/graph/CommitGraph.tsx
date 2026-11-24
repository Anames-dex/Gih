import React, { useMemo, useState, useEffect, useRef } from 'react'
import type { GitCommit } from '@/shared/types'
import { computeDagLayout } from './dagLayout'
import {
  GitBranch as GitBranchIcon,
  Tag as TagIcon,
  CheckCircle2,
  Search,
  X,
  GitMerge,
  GitPullRequest,
  ArrowDownToLine,
  GitFork,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react'

interface CommitGraphProps {
  commits: GitCommit[]
  selectedCommits: GitCommit[]
  showAllBranches?: boolean
  onToggleShowAllBranches?: (all: boolean) => void
  onSelectCommit: (commit: GitCommit, multiSelect?: boolean, rangeSelect?: boolean) => void
  onClearSelection?: () => void
  onContextMenu: (e: React.MouseEvent, commit: GitCommit) => void
  onMergeBranch?: (sourceBranch: string, targetRef: string) => void
  onRebaseBranch?: (sourceBranch: string, upstreamRef: string) => void
  onCherryPick?: (commitHash: string) => void
  isActivePane?: boolean
  filePathFilter?: string | null
  onClearFilePathFilter?: () => void
  hasMoreCommits?: boolean
  isLoadingMore?: boolean
  onLoadMoreCommits?: () => void
}

const ROW_HEIGHT = 44
const LANE_WIDTH = 22
const GRAPH_PADDING_LEFT = 24
const OVERSCAN_ROWS = 12

export const CommitGraph: React.FC<CommitGraphProps> = ({
  commits,
  selectedCommits,
  showAllBranches = true,
  onToggleShowAllBranches,
  onSelectCommit,
  onClearSelection,
  onContextMenu,
  onMergeBranch,
  onRebaseBranch,
  onCherryPick,
  isActivePane = true,
  filePathFilter,
  onClearFilePathFilter,
  hasMoreCommits = false,
  isLoadingMore = false,
  onLoadMoreCommits,
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [remoteSearchResults, setRemoteSearchResults] = useState<GitCommit[]>([])
  const [isSearchingRemote, setIsSearchingRemote] = useState(false)
  const [draggedItem, setDraggedItem] = useState<{ type: 'branch' | 'commit'; name?: string; hash: string } | null>(null)
  const [dragOverHash, setDragOverHash] = useState<string | null>(null)
  const [dropMenu, setDropMenu] = useState<{
    source: { type: 'branch' | 'commit'; name?: string; hash: string }
    target: GitCommit
    x: number
    y: number
  } | null>(null)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(800)

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    setViewportHeight(container.clientHeight || 800)

    const handleScroll = () => {
      setScrollTop(container.scrollTop)
      if (
        hasMoreCommits &&
        !isLoadingMore &&
        onLoadMoreCommits &&
        container.scrollTop + container.clientHeight >= container.scrollHeight - ROW_HEIGHT * 18
      ) {
        onLoadMoreCommits()
      }
    }

    const handleResize = () => {
      setViewportHeight(container.clientHeight || 800)
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleResize)

    return () => {
      container.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleResize)
    }
  }, [hasMoreCommits, isLoadingMore, onLoadMoreCommits])

  useEffect(() => {
    const scrollToCommit = (index: number) => {
      if (!scrollContainerRef.current) return
      const rowTop = index * ROW_HEIGHT
      const rowBottom = rowTop + ROW_HEIGHT
      const { scrollTop, clientHeight } = scrollContainerRef.current
      if (rowTop < scrollTop) {
        scrollContainerRef.current.scrollTop = rowTop
      } else if (rowBottom > scrollTop + clientHeight) {
        scrollContainerRef.current.scrollTop = rowBottom - clientHeight
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        searchInputRef.current?.focus()
        return
      }

      // Don't intercept when user is typing in input or textarea
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return
      }

      if (e.key === 'ArrowDown' || e.key === 'j') {
        if (commits.length === 0) return
        e.preventDefault()
        let targetIndex = 0
        if (selectedCommits.length > 0) {
          const lastSelected = selectedCommits[selectedCommits.length - 1]
          const currentIndex = commits.findIndex((c) => c.hash === lastSelected.hash)
          if (currentIndex !== -1) {
            targetIndex = Math.min(commits.length - 1, currentIndex + 1)
          }
        }
        const targetCommit = commits[targetIndex]
        onSelectCommit(targetCommit, false, e.shiftKey)
        scrollToCommit(targetIndex)
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        if (commits.length === 0) return
        e.preventDefault()
        let targetIndex = 0
        if (selectedCommits.length > 0) {
          const firstSelected = selectedCommits[0]
          const currentIndex = commits.findIndex((c) => c.hash === firstSelected.hash)
          if (currentIndex !== -1) {
            targetIndex = Math.max(0, currentIndex - 1)
          }
        }
        const targetCommit = commits[targetIndex]
        onSelectCommit(targetCommit, false, e.shiftKey)
        scrollToCommit(targetIndex)
      } else if (
        (e.key === 'Enter' || e.key === 'm' || e.key === 'ContextMenu') &&
        selectedCommits.length > 0
      ) {
        e.preventDefault()
        const targetCommit = selectedCommits[0]
        const targetIndex = commits.findIndex((c) => c.hash === targetCommit.hash)
        const rect = scrollContainerRef.current?.getBoundingClientRect()
        const clientX = (rect?.left || 200) + 260
        let clientY = (rect?.top || 150) + 120
        if (rect && targetIndex !== -1) {
          const rowScreenY =
            rect.top +
            (targetIndex * ROW_HEIGHT - (scrollContainerRef.current?.scrollTop || 0)) +
            ROW_HEIGHT / 2
          clientY = Math.max(rect.top + 20, Math.min(rect.bottom - 60, rowScreenY))
        }
        onContextMenu(
          {
            clientX,
            clientY,
            preventDefault: () => {},
            stopPropagation: () => {},
          } as any,
          targetCommit
        )
      } else if (e.key === 'Escape') {
        if (searchQuery) {
          setSearchQuery('')
        } else if (selectedCommits.length > 0) {
          onClearSelection?.()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [commits, selectedCommits, searchQuery, onSelectCommit, onClearSelection, onContextMenu])

  useEffect(() => {
    const trimmed = searchQuery.trim()
    if (trimmed.length < 2) {
      setRemoteSearchResults([])
      setIsSearchingRemote(false)
      return
    }
    const gih = (window as any).gih
    if (!gih?.searchCommits) return

    let cancelled = false
    setIsSearchingRemote(true)
    const timer = window.setTimeout(async () => {
      try {
        const results = await gih.searchCommits(trimmed, 150, showAllBranches, filePathFilter || undefined)
        if (!cancelled) {
          setRemoteSearchResults(Array.isArray(results) ? results : [])
        }
      } catch {
        if (!cancelled) setRemoteSearchResults([])
      } finally {
        if (!cancelled) setIsSearchingRemote(false)
      }
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [searchQuery, showAllBranches, filePathFilter])

  const effectiveCommits = useMemo(() => {
    if (!searchQuery.trim() || remoteSearchResults.length === 0) return commits
    const loadedHashes = new Set(commits.map((c) => c.hash))
    const olderMatches = remoteSearchResults.filter((c) => !loadedHashes.has(c.hash))
    return olderMatches.length > 0 ? [...commits, ...olderMatches] : commits
  }, [commits, remoteSearchResults, searchQuery])

  const matchingCommitHashes = useMemo(() => {
    if (!searchQuery.trim()) return new Set<string>()
    const q = searchQuery.toLowerCase().trim()
    const set = new Set<string>()
    for (const c of effectiveCommits) {
      if (
        c.summary.toLowerCase().includes(q) ||
        c.message.toLowerCase().includes(q) ||
        c.shortHash.toLowerCase().includes(q) ||
        c.hash.toLowerCase().includes(q) ||
        c.author.name.toLowerCase().includes(q) ||
        c.branches.some((b) => b.toLowerCase().includes(q)) ||
        c.tags.some((t) => t.toLowerCase().includes(q))
      ) {
        set.add(c.hash)
      }
    }
    return set
  }, [effectiveCommits, searchQuery])

  const selectedCommitHashes = useMemo(() => {
    return new Set(selectedCommits.map((c) => c.hash))
  }, [selectedCommits])

  const { nodes, edges, maxLane } = useMemo(() => {
    return computeDagLayout(effectiveCommits)
  }, [effectiveCommits])

  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN_ROWS)
  const endIndex = Math.min(effectiveCommits.length, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN_ROWS)

  const visibleNodes = useMemo(() => {
    return nodes.slice(startIndex, endIndex)
  }, [nodes, startIndex, endIndex])

  const visibleEdges = useMemo(() => {
    return edges.filter(
      (edge) =>
        Math.max(edge.fromRow, edge.toRow) >= startIndex &&
        Math.min(edge.fromRow, edge.toRow) <= endIndex
    )
  }, [edges, startIndex, endIndex])

  const graphWidth = Math.max(120, GRAPH_PADDING_LEFT + (maxLane + 1) * LANE_WIDTH + 24)

  if (commits.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8">
        <GitBranchIcon className="w-12 h-12 mb-3 stroke-[1.5] text-slate-600" />
        <p className="text-base font-medium text-slate-400">No commits in this repository yet</p>
        <p className="text-xs text-slate-600 mt-1">Make your initial commit in the staging panel to see the graph.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative bg-[#0c0e14] select-none">
      {/* Search Header Bar */}
      <div className="h-9 px-3 bg-surface/90 border-b border-surface-border/60 flex items-center justify-between shrink-0 select-none backdrop-blur-md z-20">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setSearchQuery('')
            }}
            placeholder="Filter graph (message, author, hash)... (Ctrl+F)"
            className="bg-transparent border-none text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none w-full"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="p-0.5 hover:text-white text-slate-400 rounded transition-colors"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onToggleShowAllBranches && (
            <div className="flex items-center bg-[#151922] border border-surface-border/60 rounded-lg p-0.5 text-[10px]">
              <button
                type="button"
                onClick={() => onToggleShowAllBranches(true)}
                className={`px-2 py-0.5 rounded transition-all flex items-center gap-1 ${
                  showAllBranches
                    ? 'bg-sky-500/20 text-sky-300 font-semibold shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Show commits across all branches (git log --all)"
              >
                <GitFork className="w-3 h-3 text-sky-400" />
                <span>All Branches</span>
              </button>
              <button
                type="button"
                onClick={() => onToggleShowAllBranches(false)}
                className={`px-2 py-0.5 rounded transition-all flex items-center gap-1 ${
                  !showAllBranches
                    ? 'bg-sky-500/20 text-sky-300 font-semibold shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Show only commits on current branch (git log HEAD)"
              >
                <GitBranchIcon className="w-3 h-3 text-amber-400" />
                <span>Current Branch</span>
              </button>
            </div>
          )}

          {filePathFilter && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-purple-950/60 border border-purple-700/50 text-[11px] text-purple-200">
              <span className="text-purple-400 font-semibold">File:</span>
              <span className="font-mono text-purple-200 max-w-[180px] truncate" title={filePathFilter}>
                {filePathFilter}
              </span>
              {onClearFilePathFilter && (
                <button
                  type="button"
                  onClick={onClearFilePathFilter}
                  className="p-0.5 hover:text-white text-purple-400 rounded hover:bg-purple-800/50 transition-colors ml-0.5"
                  title="Clear file history filter"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {selectedCommits.length > 1 && (
            <div className="flex items-center gap-1.5 mr-2">
              <span className="text-[11px] font-semibold text-sky-300 bg-sky-950/70 px-2 py-0.5 rounded border border-sky-700/50 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                {selectedCommits.length} commits selected
              </span>
              {onClearSelection && (
                <button
                  type="button"
                  onClick={() => onClearSelection()}
                  className="text-[10px] text-slate-400 hover:text-white px-1.5 py-0.5 rounded hover:bg-surface-hover transition-colors"
                  title="Clear multi-selection (Esc)"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {searchQuery.trim() && (
            <span className="text-[11px] font-medium text-sky-300 bg-sky-950/60 px-2 py-0.5 rounded border border-sky-800/40 font-mono">
              {matchingCommitHashes.size} match{matchingCommitHashes.size === 1 ? '' : 'es'}
              {isSearchingRemote ? ' (searching git...)' : ''}
            </span>
          )}
        </div>
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-auto relative">
        <div
          className="relative"
          style={{ height: `${effectiveCommits.length * ROW_HEIGHT}px`, minWidth: '100%' }}
        >
          {/* SVG Curve Layer for Edges */}
          <svg
            className="absolute top-0 left-0 pointer-events-none z-0"
            style={{
              width: `${graphWidth}px`,
              height: `${effectiveCommits.length * ROW_HEIGHT}px`,
            }}
          >
            {visibleEdges.map((edge, idx) => {
              const x1 = GRAPH_PADDING_LEFT + edge.fromLane * LANE_WIDTH
              const y1 = edge.fromRow * ROW_HEIGHT + ROW_HEIGHT / 2
              const x2 = GRAPH_PADDING_LEFT + edge.toLane * LANE_WIDTH
              const y2 = edge.toRow * ROW_HEIGHT + ROW_HEIGHT / 2

              let pathData: string
              if (x1 === x2) {
                // Straight vertical continuation along the same column
                pathData = `M ${x1} ${y1} L ${x2} ${y2}`
              } else if (y2 - y1 <= ROW_HEIGHT) {
                const cy = (y1 + y2) / 2
                pathData = `M ${x1} ${y1} C ${x1} ${cy}, ${x2} ${cy}, ${x2} ${y2}`
              } else if (edge.isMerge) {
                // Curve out cleanly at the merge commit, then run straight vertically
                const curveEndY = y1 + ROW_HEIGHT
                const cy = y1 + ROW_HEIGHT * 0.5
                pathData = `M ${x1} ${y1} C ${x1} ${cy}, ${x2} ${cy}, ${x2} ${curveEndY} L ${x2} ${y2}`
              } else {
                // Run straight vertically, then curve cleanly into the ancestor branch lane
                const curveStartY = y2 - ROW_HEIGHT
                const cy = curveStartY + ROW_HEIGHT * 0.5
                pathData = `M ${x1} ${y1} L ${x1} ${curveStartY} C ${x1} ${cy}, ${x2} ${cy}, ${x2} ${y2}`
              }

              return (
                <path
                  key={`edge-${idx}-${edge.fromRow}-${edge.toRow}`}
                  d={pathData}
                  fill="none"
                  stroke={edge.color}
                  strokeWidth={2}
                  strokeOpacity={0.85}
                  strokeLinecap="round"
                />
              )
            })}

            {/* Commit Nodes (Circles) */}
            {visibleNodes.map((node) => {
              const cx = GRAPH_PADDING_LEFT + node.lane * LANE_WIDTH
              const cy = node.row * ROW_HEIGHT + ROW_HEIGHT / 2
              const isSelected = selectedCommitHashes.has(node.commit.hash)
              const isSearchActive = searchQuery.trim().length > 0
              const isMatch = isSearchActive ? matchingCommitHashes.has(node.commit.hash) : true

              return (
                <g key={`node-${node.commit.hash}`} opacity={isSearchActive && !isMatch ? 0.3 : 1}>
                  {/* Search highlight ring */}
                  {isSearchActive && isMatch && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={9}
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth={1.5}
                      opacity={0.85}
                    />
                  )}
                  {/* Glow ring for HEAD */}
                  {node.commit.isHead && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={9}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth={1.5}
                      strokeDasharray="2 2"
                      className="animate-spin-slow"
                    />
                  )}
                  {/* Selection ring */}
                  {isSelected && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={8}
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth={2}
                      opacity={0.9}
                    />
                  )}
                  {/* Main Node */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={5}
                    fill={node.color}
                    stroke="#0c0e14"
                    strokeWidth={2}
                  />
                </g>
              )
            })}
          </svg>

          {/* Commit List Rows (Virtual Windowed) */}
          <div className="absolute top-0 left-0 right-0 z-10" style={{ height: `${effectiveCommits.length * ROW_HEIGHT}px` }}>
            {visibleNodes.map((node) => {
              const commit = node.commit
              const isSelected = selectedCommitHashes.has(commit.hash)
              const isSearchActive = searchQuery.trim().length > 0
              const isMatch = isSearchActive ? matchingCommitHashes.has(commit.hash) : true

              const isDragTarget = dragOverHash === commit.hash

              return (
                <div
                  key={commit.hash}
                  onClick={(e) => {
                    if (e.shiftKey) {
                      onSelectCommit(commit, false, true)
                    } else if (e.ctrlKey || e.metaKey) {
                      onSelectCommit(commit, true, false)
                    } else {
                      onSelectCommit(commit, false, false)
                    }
                  }}
                  onContextMenu={(e) => onContextMenu(e, commit)}
                  onDragOver={(e) => {
                    if (draggedItem && draggedItem.hash !== commit.hash) {
                      e.preventDefault()
                      setDragOverHash(commit.hash)
                    }
                  }}
                  onDragLeave={() => {
                    if (dragOverHash === commit.hash) {
                      setDragOverHash(null)
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragOverHash(null)
                    if (draggedItem && draggedItem.hash !== commit.hash) {
                      setDropMenu({
                        source: draggedItem,
                        target: commit,
                        x: e.clientX,
                        y: e.clientY,
                      })
                    }
                  }}
                  className={`flex items-center px-3 cursor-pointer border-b border-surface-border/40 transition-all ${
                    isDragTarget
                      ? 'bg-sky-500/20 ring-2 ring-inset ring-sky-400'
                      : isSelected
                      ? 'bg-sky-500/15 border-l-2 border-l-brand text-white shadow-xs'
                      : isSearchActive && isMatch
                      ? 'bg-sky-950/20 hover:bg-sky-950/30'
                      : 'hover:bg-surface/50'
                  } ${isSearchActive && !isMatch ? 'opacity-30' : 'opacity-100'}`}
                  style={{
                    position: 'absolute',
                    top: `${node.row * ROW_HEIGHT}px`,
                    left: 0,
                    right: 0,
                    height: `${ROW_HEIGHT}px`,
                    paddingLeft: `${graphWidth + 12}px`,
                  }}
                >
                {/* Branch / Tag Badges */}
                {(commit.isHead || commit.branches.length > 0 || commit.tags.length > 0) && (
                  <div className="flex items-center gap-1 mr-3 shrink-0">
                    {commit.isHead && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        <CheckCircle2 className="w-3 h-3" />
                        HEAD
                      </span>
                    )}
                    {commit.branches.map((branch) => (
                      <span
                        key={branch}
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation()
                          setDraggedItem({ type: 'branch', name: branch, hash: commit.hash })
                          e.dataTransfer.setData('text/plain', branch)
                        }}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-sky-500/20 text-sky-300 border border-sky-500/30 hover:bg-sky-500/30 cursor-grab active:cursor-grabbing transition-transform active:scale-95"
                        title={`Drag ${branch} onto another commit to merge, rebase, or cherry-pick`}
                      >
                        <GitBranchIcon className="w-3 h-3 shrink-0" />
                        <span>{branch}</span>
                      </span>
                    ))}
                    {commit.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      >
                        <TagIcon className="w-3 h-3 shrink-0" />
                        <span>{tag}</span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Commit Message */}
                <div className="flex-1 min-w-[140px] truncate text-sm text-slate-200 font-medium">
                  {commit.summary}
                </div>

                {/* Author Avatar Initial & Name */}
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-900"
                    style={{ backgroundColor: node.color }}
                  >
                    {commit.author.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs text-slate-400 max-w-[120px] truncate">
                    {commit.author.name}
                  </span>
                </div>

                {/* Date & Hash */}
                <div className="flex items-center gap-2.5 ml-4 shrink-0 text-xs text-slate-500 font-mono">
                  {commit.signature && commit.signature.status !== 'none' && (
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium border ${
                        commit.signature.status === 'good'
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : commit.signature.status === 'untrusted'
                          ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                      }`}
                      title={`Signature: ${commit.signature.status.toUpperCase()}${
                        commit.signature.signer ? ` by ${commit.signature.signer}` : ''
                      }${commit.signature.keyId ? ` (Key: ${commit.signature.keyId})` : ''}`}
                    >
                      {commit.signature.status === 'good' ? (
                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <ShieldAlert className="w-3 h-3 text-amber-400" />
                      )}
                      <span>
                        {commit.signature.status === 'good'
                          ? 'Verified'
                          : commit.signature.status === 'untrusted'
                          ? 'Unverified'
                          : 'Invalid'}
                      </span>
                    </span>
                  )}
                  <span>{commit.author.date}</span>
                </div>
              </div>
            )
          })}
        </div>
        {(isLoadingMore || hasMoreCommits) && (
          <div className="py-3 px-4 flex items-center justify-center gap-2 text-xs text-slate-400 border-t border-surface-border/40 bg-[#0c0e14]">
            {isLoadingMore ? (
              <span>Loading older commits...</span>
            ) : (
              <button
                type="button"
                onClick={() => onLoadMoreCommits?.()}
                className="px-3 py-1 rounded-md bg-surface-subtle hover:bg-surface-hover border border-surface-border text-slate-300 hover:text-white transition-colors"
              >
                Load more commits ({commits.length.toLocaleString()} loaded)
              </button>
            )}
          </div>
        )}
      </div>

      {/* Drag & Drop Action Popover */}
      {dropMenu && (
        <div
          className="fixed z-50 bg-[#0f172a]/95 border border-surface-border rounded-xl shadow-2xl p-2 backdrop-blur-md min-w-[260px] text-xs space-y-1 animate-fade-in text-slate-200 select-none"
          style={{
            left: Math.max(16, Math.min(window.innerWidth - 280, dropMenu.x - 20)),
            top: Math.max(16, Math.min(window.innerHeight - 200, dropMenu.y - 20)),
          }}
        >
          <div className="px-2 py-1 text-[11px] font-semibold text-slate-400 border-b border-surface-border/50 flex items-center justify-between">
            <span className="truncate max-w-[200px]">
              {dropMenu.source.name ? `Branch: ${dropMenu.source.name}` : `Commit: ${dropMenu.source.hash.slice(0, 7)}`}
            </span>
            <button
              onClick={() => {
                setDropMenu(null)
                setDraggedItem(null)
              }}
              className="p-0.5 hover:text-white text-slate-500 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="pt-1 space-y-0.5">
            {dropMenu.source.type === 'branch' && dropMenu.source.name && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const targetBranch = dropMenu.target.branches[0] || dropMenu.target.shortHash
                    onMergeBranch?.(dropMenu.source.name!, targetBranch)
                    setDropMenu(null)
                    setDraggedItem(null)
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-emerald-950/60 hover:text-emerald-300 text-slate-200 flex items-center gap-2 transition-all active:scale-95"
                >
                  <GitMerge className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">
                    Merge <strong>{dropMenu.source.name}</strong> into <strong>{dropMenu.target.branches[0] || dropMenu.target.shortHash}</strong>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const targetBranch = dropMenu.target.branches[0] || dropMenu.target.shortHash
                    onRebaseBranch?.(dropMenu.source.name!, targetBranch)
                    setDropMenu(null)
                    setDraggedItem(null)
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-indigo-950/60 hover:text-indigo-300 text-slate-200 flex items-center gap-2 transition-all active:scale-95"
                >
                  <GitPullRequest className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="truncate">
                    Rebase <strong>{dropMenu.source.name}</strong> onto <strong>{dropMenu.target.branches[0] || dropMenu.target.shortHash}</strong>
                  </span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => {
                onCherryPick?.(dropMenu.source.hash)
                setDropMenu(null)
                setDraggedItem(null)
              }}
              className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-amber-950/60 hover:text-amber-300 text-slate-200 flex items-center gap-2 transition-all active:scale-95"
            >
              <ArrowDownToLine className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate">
                Cherry-pick <strong>{dropMenu.source.hash.slice(0, 7)}</strong> onto current branch
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  </div>
  )
}
