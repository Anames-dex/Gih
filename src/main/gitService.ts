import { spawn } from 'node:child_process'
import path from 'node:path'
import type {
  GitCommit,
  GitBranch,
  GitTag,
  GitStash,
  GitFileStatus,
  FileDiff,
  DiffHunk,
  ReflogEntry,
  GitWorktree,
  CommandLogEntry,
  RepositoryState
} from '../shared/types'

export class GitService {
  private currentRepoPath: string = process.cwd()
  private commandHistory: CommandLogEntry[] = []

  constructor(repoPath?: string) {
    if (repoPath) {
      this.currentRepoPath = repoPath
    }
  }

  public setRepositoryPath(repoPath: string) {
    this.currentRepoPath = repoPath
  }

  public getRepositoryPath(): string {
    return this.currentRepoPath
  }

  public getCommandHistory(): CommandLogEntry[] {
    return this.commandHistory
  }

  /**
   * Execute any raw git command with streaming output & logging
   */
  public async execGit(args: string[], cwd: string = this.currentRepoPath): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const commandStr = `git ${args.join(' ')}`
    const startTime = Date.now()

    return new Promise((resolve) => {
      const proc = spawn('git', args, {
        cwd,
        env: { ...process.env, LANG: 'en_US.UTF-8' },
        windowsHide: true,
      })

      let stdout = ''
      let stderr = ''

      proc.stdout.on('data', (data) => {
        stdout += data.toString('utf-8')
      })

      proc.stderr.on('data', (data) => {
        stderr += data.toString('utf-8')
      })

      proc.on('close', (code) => {
        const exitCode = code ?? 0
        const entry: CommandLogEntry = {
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          command: commandStr,
          timestamp: startTime,
          exitCode,
          output: stdout || stderr,
          isError: exitCode !== 0,
        }
        this.commandHistory.unshift(entry)
        if (this.commandHistory.length > 500) {
          this.commandHistory.pop()
        }

        resolve({ stdout, stderr, exitCode })
      })

      proc.on('error', (err) => {
        const entry: CommandLogEntry = {
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          command: commandStr,
          timestamp: startTime,
          exitCode: -1,
          output: err.message,
          isError: true,
        }
        this.commandHistory.unshift(entry)
        resolve({ stdout: '', stderr: err.message, exitCode: -1 })
      })
    })
  }

  /**
   * Fetch complete repository state for visual representation
   */
  public async getRepositoryState(): Promise<RepositoryState> {
    const repoName = path.basename(this.currentRepoPath)
    const [branches, tags, stashes, commits, files, worktrees] = await Promise.all([
      this.getBranches(),
      this.getTags(),
      this.getStashes(),
      this.getCommits(250),
      this.getFileStatuses(),
      this.getWorktrees(),
    ])

    const currentBranch = branches.find((b) => b.isCurrent)?.name || null
    const isDetached = currentBranch === null && commits.length > 0

    return {
      path: this.currentRepoPath,
      name: repoName,
      currentBranch,
      isDetached,
      branches,
      tags,
      stashes,
      commits,
      files,
      worktrees,
    }
  }

  /**
   * Read commit DAG
   */
  public async getCommits(limit: number = 300): Promise<GitCommit[]> {
    // Format: Hash, ShortHash, AuthorName, AuthorEmail, Date, Subject, Parents, RefNames
    const delimiter = '||__GIH_FIELD__||'
    const recordDelimiter = '||__GIH_REC__||'
    const format = [
      '%H',
      '%h',
      '%an',
      '%ae',
      '%ad',
      '%s',
      '%P',
      '%D',
    ].join(delimiter) + recordDelimiter

    const { stdout, exitCode } = await this.execGit([
      'log',
      '--all',
      '--date=relative',
      `--max-count=${limit}`,
      `--format=${format}`,
    ])

    if (exitCode !== 0 || !stdout.trim()) {
      return []
    }

    const records = stdout.split(recordDelimiter).filter((r) => r.trim().length > 0)
    const commits: GitCommit[] = []

    for (const record of records) {
      const parts = record.trim().split(delimiter)
      if (parts.length < 8) continue

      const [hash, shortHash, name, email, date, summary, rawParents, rawRefs] = parts
      const parents = rawParents.trim() ? rawParents.trim().split(' ') : []
      
      const branches: string[] = []
      const tags: string[] = []
      let isHead = false

      if (rawRefs.trim()) {
        const refItems = rawRefs.split(',').map((s) => s.trim())
        for (const ref of refItems) {
          if (ref.startsWith('HEAD -> ')) {
            isHead = true
            branches.push(ref.replace('HEAD -> ', ''))
          } else if (ref === 'HEAD') {
            isHead = true
          } else if (ref.startsWith('tag: ')) {
            tags.push(ref.replace('tag: ', ''))
          } else {
            branches.push(ref)
          }
        }
      }

      commits.push({
        hash,
        shortHash,
        author: { name, email, date },
        message: summary,
        summary,
        parents,
        branches,
        tags,
        isHead,
      })
    }

    return commits
  }

  /**
   * List local and remote branches
   */
  public async getBranches(): Promise<GitBranch[]> {
    const { stdout, exitCode } = await this.execGit([
      'branch',
      '-a',
      '-vv',
      '--format=%(HEAD)|%(refname)|%(refname:short)|%(upstream:short)|%(upstream:track)|%(objectname)',
    ])

    if (exitCode !== 0 || !stdout.trim()) {
      return []
    }

    const lines = stdout.split('\n').filter((l) => l.trim().length > 0)
    const branches: GitBranch[] = []

    for (const line of lines) {
      const [isHeadStr, refname, shortName, upstream, track, targetHash] = line.split('|')
      const isCurrent = isHeadStr.trim() === '*'
      const isRemote = refname.startsWith('refs/remotes/')

      let ahead = 0
      let behind = 0
      if (track) {
        const aheadMatch = track.match(/ahead (\d+)/)
        const behindMatch = track.match(/behind (\d+)/)
        if (aheadMatch) ahead = parseInt(aheadMatch[1], 10)
        if (behindMatch) behind = parseInt(behindMatch[1], 10)
      }

      let remoteName: string | undefined
      if (isRemote) {
        const parts = shortName.split('/')
        remoteName = parts[0]
      }

      branches.push({
        name: shortName,
        isCurrent,
        isRemote,
        remoteName,
        upstream: upstream || undefined,
        ahead,
        behind,
        targetHash: targetHash?.trim() || '',
      })
    }

    return branches
  }

  /**
   * List repository tags
   */
  public async getTags(): Promise<GitTag[]> {
    const { stdout, exitCode } = await this.execGit([
      'tag',
      '-l',
      '--format=%(refname:short)|%(objectname)|%(contents:subject)',
    ])

    if (exitCode !== 0 || !stdout.trim()) {
      return []
    }

    return stdout
      .split('\n')
      .filter((l) => l.trim().length > 0)
      .map((line) => {
        const [name, targetHash, message] = line.split('|')
        return {
          name: name.trim(),
          targetHash: targetHash?.trim() || '',
          message: message?.trim(),
        }
      })
  }

  /**
   * List stashes
   */
  public async getStashes(): Promise<GitStash[]> {
    const { stdout, exitCode } = await this.execGit([
      'stash',
      'list',
      '--format=%gd|%H|%gd|%cr|%gs',
    ])

    if (exitCode !== 0 || !stdout.trim()) {
      return []
    }

    return stdout
      .split('\n')
      .filter((l) => l.trim().length > 0)
      .map((line, idx) => {
        const [ref, hash, , date, message] = line.split('|')
        return {
          index: idx,
          name: ref?.trim() || `stash@{${idx}}`,
          hash: hash?.trim() || '',
          date: date?.trim() || '',
          message: message?.trim() || '',
        }
      })
  }

  /**
   * List file status (modified, untracked, staged, deleted, etc.)
   */
  public async getFileStatuses(): Promise<GitFileStatus[]> {
    const { stdout, exitCode } = await this.execGit(['status', '--porcelain=v2'])
    if (exitCode !== 0 || !stdout.trim()) {
      return []
    }

    const lines = stdout.split('\n').filter((l) => l.trim().length > 0)
    const files: GitFileStatus[] = []

    for (const line of lines) {
      const parts = line.split(' ')
      const type = parts[0]

      if (type === '1') {
        // Normal tracked file: "1 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <path>"
        const xy = parts[1]
        const stagedCode = xy[0]
        const unstagedCode = xy[1]
        const filePath = parts.slice(8).join(' ')

        if (stagedCode !== '.') {
          files.push({
            path: filePath,
            status: this.parseStatusCode(stagedCode),
            staged: true,
          })
        }
        if (unstagedCode !== '.') {
          files.push({
            path: filePath,
            status: this.parseStatusCode(unstagedCode),
            staged: false,
          })
        }
      } else if (type === '2') {
        // Renamed/copied file
        const xy = parts[1]
        const stagedCode = xy[0]
        const paths = parts.slice(9).join(' ').split('\t')
        const newPath = paths[0]
        const oldPath = paths[1]

        files.push({
          path: newPath,
          oldPath,
          status: 'renamed',
          staged: stagedCode !== '.',
        })
      } else if (type === '?') {
        // Untracked file
        const filePath = parts.slice(1).join(' ')
        files.push({
          path: filePath,
          status: 'untracked',
          staged: false,
        })
      }
    }

    return files
  }

  private parseStatusCode(code: string): 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' {
    switch (code) {
      case 'M': return 'modified'
      case 'A': return 'added'
      case 'D': return 'deleted'
      case 'R': return 'renamed'
      default: return 'modified'
    }
  }

  /**
   * Get parsed diff for a file
   */
  public async getFileDiff(filePath: string, staged: boolean = false): Promise<FileDiff> {
    const args = ['diff', '--no-color', '-U3']
    if (staged) {
      args.push('--cached')
    }
    args.push('--', filePath)

    const { stdout } = await this.execGit(args)
    return this.parseUnifiedDiff(stdout, filePath)
  }

  private parseUnifiedDiff(rawDiff: string, filePath: string): FileDiff {
    const hunks: DiffHunk[] = []
    const lines = rawDiff.split('\n')
    let currentHunk: DiffHunk | null = null
    let oldLine = 0
    let newLine = 0

    for (const line of lines) {
      if (line.startsWith('@@')) {
        const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/)
        if (match) {
          oldLine = parseInt(match[1], 10)
          const oldLines = match[2] ? parseInt(match[2], 10) : 1
          newLine = parseInt(match[3], 10)
          const newLines = match[4] ? parseInt(match[4], 10) : 1

          currentHunk = {
            header: line,
            oldStart: oldLine,
            oldLines,
            newStart: newLine,
            newLines,
            lines: [],
          }
          hunks.push(currentHunk)
          continue
        }
      }

      if (!currentHunk) continue

      if (line.startsWith('+')) {
        currentHunk.lines.push({
          type: 'add',
          content: line.substring(1),
          newLineNumber: newLine++,
        })
      } else if (line.startsWith('-')) {
        currentHunk.lines.push({
          type: 'delete',
          content: line.substring(1),
          oldLineNumber: oldLine++,
        })
      } else if (line.startsWith(' ') || line === '') {
        currentHunk.lines.push({
          type: 'context',
          content: line.substring(1),
          oldLineNumber: oldLine++,
          newLineNumber: newLine++,
        })
      }
    }

    return {
      path: filePath,
      isBinary: rawDiff.includes('Binary files'),
      hunks,
    }
  }

  /**
   * List Reflog entries
   */
  public async getReflog(count: number = 50): Promise<ReflogEntry[]> {
    const { stdout, exitCode } = await this.execGit([
      'reflog',
      `-n`,
      `${count}`,
      '--format=%gD|%h|%gs|%gd|%cr',
    ])

    if (exitCode !== 0 || !stdout.trim()) {
      return []
    }

    return stdout
      .split('\n')
      .filter((l) => l.trim().length > 0)
      .map((line) => {
        const [selector, hash, message, , date] = line.split('|')
        return {
          selector: selector?.trim() || '',
          hash: hash?.trim() || '',
          action: message?.split(':')[0]?.trim() || '',
          message: message?.trim() || '',
          date: date?.trim() || '',
        }
      })
  }

  /**
   * List Worktrees
   */
  public async getWorktrees(): Promise<GitWorktree[]> {
    const { stdout, exitCode } = await this.execGit(['worktree', 'list', '--porcelain'])
    if (exitCode !== 0 || !stdout.trim()) {
      return []
    }

    const blocks = stdout.split('\n\n').filter((b) => b.trim().length > 0)
    const worktrees: GitWorktree[] = []

    for (const block of blocks) {
      const lines = block.split('\n')
      let wtPath = ''
      let head = ''
      let branch = ''
      let isBare = false
      let isLocked = false

      for (const line of lines) {
        if (line.startsWith('worktree ')) wtPath = line.replace('worktree ', '').trim()
        if (line.startsWith('HEAD ')) head = line.replace('HEAD ', '').trim()
        if (line.startsWith('branch ')) branch = line.replace('branch refs/heads/', '').trim()
        if (line === 'bare') isBare = true
        if (line.startsWith('locked')) isLocked = true
      }

      if (wtPath) {
        worktrees.push({ path: wtPath, head, branch, isBare, isLocked })
      }
    }

    return worktrees
  }
}
