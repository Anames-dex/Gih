export interface CommitAuthor {
  name: string
  email: string
  date: string
}

export interface GitCommit {
  hash: string
  shortHash: string
  author: CommitAuthor
  message: string
  summary: string
  parents: string[]
  branches: string[]
  tags: string[]
  isHead: boolean
  lane?: number
  row?: number
}

export interface GitBranch {
  name: string
  isCurrent: boolean
  isRemote: boolean
  remoteName?: string
  upstream?: string
  ahead: number
  behind: number
  targetHash: string
}

export interface GitTag {
  name: string
  targetHash: string
  message?: string
}

export interface GitStash {
  index: number
  name: string
  hash: string
  date: string
  message: string
}

export interface GitFileStatus {
  path: string
  oldPath?: string
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'copied'
  staged: boolean
}

export interface DiffLine {
  type: 'add' | 'delete' | 'context'
  content: string
  oldLineNumber?: number
  newLineNumber?: number
}

export interface DiffHunk {
  header: string
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  lines: DiffLine[]
}

export interface FileDiff {
  path: string
  oldPath?: string
  isBinary: boolean
  hunks: DiffHunk[]
}

export interface ReflogEntry {
  selector: string
  hash: string
  action: string
  message: string
  date: string
}

export interface GitWorktree {
  path: string
  head: string
  branch: string
  isBare: boolean
  isLocked?: boolean
}

export interface CommandLogEntry {
  id: string
  command: string
  timestamp: number
  exitCode: number
  output: string
  isError: boolean
}

export interface RepositoryState {
  path: string
  name: string
  isGitRepo: boolean
  currentBranch: string | null
  isDetached: boolean
  branches: GitBranch[]
  tags: GitTag[]
  stashes: GitStash[]
  commits: GitCommit[]
  files: GitFileStatus[]
  worktrees: GitWorktree[]
}
