import { execFile, spawn } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
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
  RepositoryState,
  GitOperationState,
  GitOperationType
} from '../shared/types'

export class GitService {
  private currentRepoPath: string = process.cwd()
  private commandHistory: CommandLogEntry[] = []
  private activeExecutions: number = 0

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

  public isExecuting(): boolean {
    return this.activeExecutions > 0
  }

  /**
   * Fast native git execution with direct child process, output buffering & telemetry
   */
  public async execGit(args: string[], cwd: string = this.currentRepoPath): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const commandStr = `git ${args.join(' ')}`
    const startTime = Date.now()
    this.activeExecutions++

    return new Promise((resolve) => {
      execFile(
        'git',
        args,
        {
          cwd,
          maxBuffer: 32 * 1024 * 1024,
          windowsHide: true,
          env: { ...process.env, LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' },
        },
        (error, stdout, stderr) => {
          this.activeExecutions--
          const exitCode = error ? (error.code ? Number(error.code) : 1) : 0
          const entry: CommandLogEntry = {
            id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            command: commandStr,
            timestamp: startTime,
            exitCode,
            output: stdout || stderr || (error ? error.message : ''),
            isError: exitCode !== 0,
          }
          this.commandHistory.unshift(entry)
          if (this.commandHistory.length > 500) {
            this.commandHistory.pop()
          }

          resolve({
            stdout: stdout || '',
            stderr: stderr || (error && exitCode !== 0 ? error.message : ''),
            exitCode,
          })
        }
      )
    })
  }

  /**
   * Fast native git execution with stdin streaming (e.g. git apply)
   */
  public async execGitWithStdin(
    args: string[],
    stdinInput: string,
    cwd: string = this.currentRepoPath
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const commandStr = `git ${args.join(' ')}`
    const startTime = Date.now()
    this.activeExecutions++

    return new Promise((resolve) => {
      const child = spawn('git', args, {
        cwd,
        windowsHide: true,
        env: { ...process.env, LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' },
      })

      let stdout = ''
      let stderr = ''

      child.stdout.on('data', (data) => {
        stdout += data.toString()
      })
      child.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      child.on('error', (err) => {
        stderr += err.message
      })

      child.on('close', (code) => {
        this.activeExecutions--
        const exitCode = code ?? (stderr ? 1 : 0)
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

        resolve({
          stdout,
          stderr,
          exitCode,
        })
      })

      try {
        child.stdin.write(stdinInput)
        child.stdin.end()
      } catch (err: any) {
        stderr += err.message
      }
    })
  }

  /**
   * Apply a unified diff patch to index, working tree, or in reverse
   */
  public async applyPatch(
    patch: string,
    options: { cached?: boolean; reverse?: boolean } = {}
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const args = ['apply', '--whitespace=nowarn', '--recount']
    if (options.cached) args.push('--cached')
    if (options.reverse) args.push('--reverse')
    args.push('-')

    return await this.execGitWithStdin(args, patch)
  }

  /**
   * Fetch complete repository state for visual representation
   */
  public async getRepositoryState(): Promise<RepositoryState> {
    const repoName = path.basename(this.currentRepoPath)
    const gitDir = path.join(this.currentRepoPath, '.git')
    const isGitRepo = fs.existsSync(gitDir)

    if (!isGitRepo) {
      return {
        path: this.currentRepoPath,
        name: repoName,
        isGitRepo: false,
        operation: { type: 'none' },
        currentBranch: null,
        isDetached: false,
        branches: [],
        tags: [],
        stashes: [],
        commits: [],
        files: [],
        worktrees: [],
      }
    }

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
    const operation = this.getOperationState(gitDir)

    return {
      path: this.currentRepoPath,
      name: repoName,
      isGitRepo: true,
      operation,
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

  private getOperationState(gitDir: string): GitOperationState {
    if (fs.existsSync(path.join(gitDir, 'rebase-merge')) || fs.existsSync(path.join(gitDir, 'rebase-apply'))) {
      return { type: 'rebase', message: 'Interactive rebase in progress', canContinue: true, canSkip: true, canAbort: true }
    }
    if (fs.existsSync(path.join(gitDir, 'MERGE_HEAD'))) {
      return { type: 'merge', message: 'Merge conflict in progress', canContinue: true, canAbort: true }
    }
    if (fs.existsSync(path.join(gitDir, 'CHERRY_PICK_HEAD'))) {
      return { type: 'cherry-pick', message: 'Cherry-pick in progress', canContinue: true, canSkip: true, canAbort: true }
    }
    if (fs.existsSync(path.join(gitDir, 'REVERT_HEAD'))) {
      return { type: 'revert', message: 'Revert in progress', canContinue: true, canAbort: true }
    }
    if (fs.existsSync(path.join(gitDir, 'BISECT_LOG'))) {
      return { type: 'bisect', message: 'Git bisect in progress', canAbort: true }
    }
    return { type: 'none' }
  }

  public async continueOperation(type: GitOperationType): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    if (type === 'rebase') return await this.execGit(['rebase', '--continue'])
    if (type === 'cherry-pick') return await this.execGit(['cherry-pick', '--continue'])
    if (type === 'merge') return await this.execGit(['commit', '--no-edit'])
    return { stdout: '', stderr: 'No operation to continue', exitCode: 1 }
  }

  public async abortOperation(type: GitOperationType): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    if (type === 'rebase') return await this.execGit(['rebase', '--abort'])
    if (type === 'cherry-pick') return await this.execGit(['cherry-pick', '--abort'])
    if (type === 'merge') return await this.execGit(['merge', '--abort'])
    if (type === 'revert') return await this.execGit(['revert', '--abort'])
    if (type === 'bisect') return await this.execGit(['bisect', 'reset'])
    return { stdout: '', stderr: 'No operation to abort', exitCode: 1 }
  }

  public async skipOperation(type: GitOperationType): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    if (type === 'rebase') return await this.execGit(['rebase', '--skip'])
    if (type === 'cherry-pick') return await this.execGit(['cherry-pick', '--skip'])
    return { stdout: '', stderr: 'No operation to skip', exitCode: 1 }
  }

  public async initRepository(branchName: string = 'main'): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return await this.execGit(['init', '-b', branchName])
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

  public async createTag(name: string, message?: string, targetHash?: string): Promise<void> {
    const args = ['tag']
    if (message) {
      args.push('-a', name, '-m', message)
    } else {
      args.push(name)
    }
    if (targetHash) {
      args.push(targetHash)
    }
    await this.execGit(args)
  }

  public async deleteTag(name: string): Promise<void> {
    await this.execGit(['tag', '-d', name])
  }

  public async branchFromStash(branchName: string, index: number = 0): Promise<void> {
    await this.execGit(['stash', 'branch', branchName, `stash@{${index}}`])
  }

  public async getStashDiff(index: number = 0): Promise<string> {
    const { stdout } = await this.execGit(['stash', 'show', '-p', `stash@{${index}}`])
    return stdout
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
    let currentHunkRawLines: string[] = []
    let oldLine = 0
    let newLine = 0

    const finalizeHunk = () => {
      if (currentHunk) {
        currentHunk.rawHunk = currentHunkRawLines.join('\n') + '\n'
      }
    }

    for (const line of lines) {
      if (line.startsWith('@@')) {
        finalizeHunk()
        currentHunkRawLines = [line]
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
      currentHunkRawLines.push(line)

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

    finalizeHunk()

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
