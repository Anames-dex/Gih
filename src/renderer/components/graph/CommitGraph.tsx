import React, { useMemo, useState, useEffect, useRef } from 'react'
import type { GitCommit } from '@/shared/types'
import { computeDagLayout } from './dagLayout'
import { GitBranch as GitBranchIcon, Tag as TagIcon, CheckCircle2, Search, X } from 'lucide-react'

interface CommitGraphProps {
  commits: GitCommit[]
  selectedCommit: GitCommit | null
  onSelectCommit: (commit: GitCommit) => void
  onContextMenu: (e: React.MouseEvent, commit: GitCommit) => void
}

const ROW_HEIGHT = 44
const LANE_WIDTH = 22
const GRAPH_PADDING_LEFT = 24

export const CommitGraph: React.FC<CommitGraphProps> = ({
  commits,
  selectedCommit,
  onSelectCommit,
  onContextMenu,
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const matchingCommitHashes = useMemo(() => {
    if (!searchQuery.trim()) return new Set<string>()
    const q = searchQuery.toLowerCase().trim()
    const set = new Set<string>()
    for (const c of commits) {
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
  }, [commits, searchQuery])

  const { nodes, edges, maxLane } = useMemo(() => {
    return computeDagLayout(commits)
  }, [commits])

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

        {searchQuery.trim() && (
          <span className="text-[11px] font-medium text-sky-300 bg-sky-950/60 px-2 py-0.5 rounded border border-sky-800/40 font-mono">
            {matchingCommitHashes.size} / {commits.length} matching
          </span>
        )}
      </div>

      <div className="flex-1 overflow-auto relative">
        <div
          className="relative"
          style={{ height: `${commits.length * ROW_HEIGHT}px`, minWidth: '100%' }}
        >
          {/* SVG Curve Layer for Edges */}
          <svg
            className="absolute top-0 left-0 pointer-events-none z-0"
            style={{
              width: `${graphWidth}px`,
              height: `${commits.length * ROW_HEIGHT}px`,
            }}
          >
            {edges.map((edge, idx) => {
              const x1 = GRAPH_PADDING_LEFT + edge.fromLane * LANE_WIDTH
              const y1 = edge.fromRow * ROW_HEIGHT + ROW_HEIGHT / 2
              const x2 = GRAPH_PADDING_LEFT + edge.toLane * LANE_WIDTH
              const y2 = edge.toRow * ROW_HEIGHT + ROW_HEIGHT / 2

              // Cubic bezier connection between parent and child commits
              const cy1 = y1 + (y2 - y1) * 0.5
              const cy2 = y1 + (y2 - y1) * 0.5
              const pathData = `M ${x1} ${y1} C ${x1} ${cy1}, ${x2} ${cy2}, ${x2} ${y2}`

              return (
                <path
                  key={`edge-${idx}`}
                  d={pathData}
                  fill="none"
                  stroke={edge.color}
                  strokeWidth={2.5}
                  strokeOpacity={0.8}
                  strokeLinecap="round"
                />
              )
            })}

            {/* Commit Nodes (Circles) */}
            {nodes.map((node) => {
              const cx = GRAPH_PADDING_LEFT + node.lane * LANE_WIDTH
              const cy = node.row * ROW_HEIGHT + ROW_HEIGHT / 2
              const isSelected = selectedCommit?.hash === node.commit.hash
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

          {/* Commit List Rows */}
          <div className="absolute top-0 left-0 right-0 z-10">
            {nodes.map((node) => {
              const commit = node.commit
              const isSelected = selectedCommit?.hash === commit.hash
              const isSearchActive = searchQuery.trim().length > 0
              const isMatch = isSearchActive ? matchingCommitHashes.has(commit.hash) : true

              return (
                <div
                  key={commit.hash}
                  onClick={() => onSelectCommit(commit)}
                  onContextMenu={(e) => onContextMenu(e, commit)}
                  className={`flex items-center h-[44px] px-3 cursor-pointer border-b border-surface-border/40 transition-all ${
                    isSelected
                      ? 'bg-surface-subtle/90 border-l-2 border-l-brand'
                      : isSearchActive && isMatch
                      ? 'bg-sky-950/20 hover:bg-sky-950/30'
                      : 'hover:bg-surface/50'
                  } ${isSearchActive && !isMatch ? 'opacity-30' : 'opacity-100'}`}
                  style={{ paddingLeft: `${graphWidth + 12}px` }}
                >
                {/* Branch / Tag Badges */}
                <div className="flex items-center gap-1.5 mr-3 shrink-0">
                  {commit.isHead && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      <CheckCircle2 className="w-3 h-3" />
                      HEAD
                    </span>
                  )}
                  {commit.branches.map((branch) => (
                    <span
                      key={branch}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-sky-500/20 text-sky-300 border border-sky-500/30 hover:bg-sky-500/30"
                    >
                      <GitBranchIcon className="w-3 h-3" />
                      {branch}
                    </span>
                  ))}
                  {commit.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    >
                      <TagIcon className="w-3 h-3" />
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Commit Message */}
                <div className="flex-1 truncate text-sm text-slate-200 font-medium">
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
                <div className="flex items-center gap-3 ml-4 shrink-0 text-xs text-slate-500 font-mono">
                  <span>{commit.author.date}</span>
                  <span className="px-1.5 py-0.5 bg-surface-border/60 rounded text-slate-400">
                    {commit.shortHash}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  </div>
  )
}
