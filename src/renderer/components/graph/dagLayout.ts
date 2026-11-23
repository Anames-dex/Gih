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

const MAX_LANES_CAP = 24

export function computeDagLayout(commits: GitCommit[]): {
  nodes: GraphNode[]
  edges: GraphEdge[]
  maxLane: number
} {
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  const commitHashMap = new Map<string, { row: number; lane: number }>()

  // Active lanes array holds the commit hash that next expects a parent on that lane
  const activeLanes: (string | null)[] = []

  commits.forEach((commit, rowIndex) => {
    // 1. Find if this commit is already expected on an active lane
    let lane = activeLanes.indexOf(commit.hash)
    if (lane === -1) {
      // Find first empty slot in activeLanes or append
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
    commitHashMap.set(commit.hash, { row: rowIndex, lane })

    // Vacate current slot
    activeLanes[lane] = null

    // 2. Assign parents to lanes
    commit.parents.forEach((parentHash, pIdx) => {
      if (pIdx === 0) {
        // First parent prefers staying on the same lane
        if (activeLanes[lane] === null) {
          activeLanes[lane] = parentHash
        } else {
          // Lane is occupied, find new lane
          const nextEmpty = activeLanes.indexOf(null)
          if (nextEmpty !== -1) {
            activeLanes[nextEmpty] = parentHash
          } else if (activeLanes.length < MAX_LANES_CAP) {
            activeLanes.push(parentHash)
          } else {
            activeLanes[MAX_LANES_CAP - 1] = parentHash
          }
        }
      } else {
        // Additional parents (merge commit) get separate lanes
        const nextEmpty = activeLanes.indexOf(null)
        if (nextEmpty !== -1) {
          activeLanes[nextEmpty] = parentHash
        } else if (activeLanes.length < MAX_LANES_CAP) {
          activeLanes.push(parentHash)
        } else {
          activeLanes[MAX_LANES_CAP - 1] = parentHash
        }
      }
    })
  })

  // 3. Generate edges now that all commit positions are known
  nodes.forEach((node) => {
    node.commit.parents.forEach((parentHash) => {
      const parentPos = commitHashMap.get(parentHash)
      if (parentPos) {
        edges.push({
          fromRow: node.row,
          fromLane: node.lane,
          toRow: parentPos.row,
          toLane: parentPos.lane,
          color: node.color,
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
