import type { GitCommit } from '@/shared/types'

export interface GraphNode {
  commit: GitCommit
  row: number
  lane: number
  color: string
}

export interface GraphEdge {
  fromRow: number
  fromLane: number
  toRow: number
  toLane: number
  color: string
  isMerge: boolean
}

const LANE_COLORS = [
  '#38bdf8', // Cyan
  '#a855f7', // Purple
  '#22c55e', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#3b82f6', // Blue
  '#14b8a6', // Teal
  '#f97316', // Orange
]

const MAX_LANES_CAP = 48

function allocateLane(activeLanes: (string | null)[], parentHash: string): void {
  if (activeLanes.includes(parentHash)) return
  const emptyIdx = activeLanes.indexOf(null)
  if (emptyIdx !== -1) {
    activeLanes[emptyIdx] = parentHash
  } else if (activeLanes.length < MAX_LANES_CAP) {
    activeLanes.push(parentHash)
  } else {
    activeLanes[MAX_LANES_CAP - 1] = parentHash
  }
}

export function computeDagLayout(commits: GitCommit[]): {
  nodes: GraphNode[]
  edges: GraphEdge[]
  maxLane: number
} {
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  const commitPosMap = new Map<string, { row: number; lane: number; color: string }>()

  // Active lanes hold the commit hash next expected along that column
  const activeLanes: (string | null)[] = []

  commits.forEach((commit, rowIndex) => {
    // 1. Find leftmost lane already expecting this commit, or reuse first free slot
    let lane = activeLanes.indexOf(commit.hash)
    if (lane === -1) {
      lane = activeLanes.indexOf(null)
      if (lane === -1) {
        if (activeLanes.length < MAX_LANES_CAP) {
          lane = activeLanes.length
          activeLanes.push(null)
        } else {
          lane = MAX_LANES_CAP - 1
        }
      }
    }

    const color = LANE_COLORS[lane % LANE_COLORS.length]
    nodes.push({
      commit,
      row: rowIndex,
      lane,
      color,
    })
    commitPosMap.set(commit.hash, { row: rowIndex, lane, color })

    // Clear all lanes that were waiting on this commit so merged/converged columns are freed immediately
    for (let i = 0; i < activeLanes.length; i++) {
      if (activeLanes[i] === commit.hash) {
        activeLanes[i] = null
      }
    }

    // 2. Assign parents to lanes without duplicating any parent already tracked
    commit.parents.forEach((parentHash, pIdx) => {
      if (activeLanes.includes(parentHash)) {
        return
      }
      if (pIdx === 0 && activeLanes[lane] === null) {
        // Primary parent stays in the same column whenever possible
        activeLanes[lane] = parentHash
      } else {
        allocateLane(activeLanes, parentHash)
      }
    })

    // Collapse trailing empty columns so non-interfering branches stay compact
    while (activeLanes.length > 0 && activeLanes[activeLanes.length - 1] === null) {
      activeLanes.pop()
    }
  })

  // 3. Build edges using final node positions
  nodes.forEach((node) => {
    node.commit.parents.forEach((parentHash, pIdx) => {
      const parentPos = commitPosMap.get(parentHash)
      if (parentPos) {
        const isMerge = pIdx > 0
        edges.push({
          fromRow: node.row,
          fromLane: node.lane,
          toRow: parentPos.row,
          toLane: parentPos.lane,
          color: isMerge ? parentPos.color : node.color,
          isMerge,
        })
      }
    })
  })

  let maxLane = 0
  nodes.forEach((n) => {
    if (n.lane > maxLane) maxLane = n.lane
  })
  maxLane = Math.min(maxLane, MAX_LANES_CAP - 1)

  return { nodes, edges, maxLane }
}
