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
  GitOperationType,
  CommitRangeDiff,
  RemoteProviderInfo
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

  /**
   * Resolves the actual git directory path, correctly supporting both traditional
   * repositories and git worktrees / submodules where .git is a file containing `gitdir: <path>`
   */
  public static resolveGitDir(repoPath: string): string | null {
    const gitPath = path.join(path.resolve(repoPath), '.git')
    if (!fs.existsSync(gitPath)) return null
    try {
      const stat = fs.statSync(gitPath)
      if (stat.isDirectory()) {
        return gitPath
      }
      if (stat.isFile()) {
        const content = fs.readFileSync(gitPath, 'utf8').trim()
        if (content.startsWith('gitdir:')) {
          const rawDir = content.substring(7).trim()
          return path.isAbsolute(rawDir) ? rawDir : path.resolve(repoPath, rawDir)
        }
      }
    } catch {
      return null
    }
    return null
  }

  public setRepositoryPath(repoPath: string) {
    this.currentRepoPath = path.resolve(repoPath)
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
    const realGitDir = GitService.resolveGitDir(this.currentRepoPath)
    const isGitRepo = realGitDir !== null

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
    const operation = this.getOperationState(realGitDir)

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

  private validateGitArg(arg: string, name: string): string {
    const trimmed = arg.trim()
    if (trimmed.startsWith('-')) {
      throw new Error(`Invalid ${name}: cannot begin with a hyphen ('${arg}')`)
    }
    return trimmed
  }

  public async createTag(name: string, message?: string, targetHash?: string): Promise<void> {
    const safeName = this.validateGitArg(name, 'tag name')
    const args = ['tag']
    if (message) {
      args.push('-a', safeName, '-m', message)
    } else {
      args.push('--', safeName)
    }
    if (targetHash) {
      args.push(this.validateGitArg(targetHash, 'commit hash'))
    }
    await this.execGit(args)
  }

  public async deleteTag(name: string): Promise<void> {
    const safeName = this.validateGitArg(name, 'tag name')
    await this.execGit(['tag', '-d', '--', safeName])
  }

  public async branchFromStash(branchName: string, index: number = 0): Promise<void> {
    const safeBranch = this.validateGitArg(branchName, 'branch name')
    await this.execGit(['stash', 'branch', safeBranch, `stash@{${index}}`])
  }

  public async getStashDiff(index: number = 0): Promise<string> {
    const { stdout } = await this.execGit(['stash', 'show', '-p', `stash@{${index}}`])
    return stdout
  }

  public async createCommit(
    message: string,
    signOff?: boolean,
    amend?: boolean
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const args = ['commit', '-m', message]
    if (signOff) args.push('-s')
    if (amend) args.push('--amend')
    return await this.execGit(args)
  }

  public async resetBranch(
    targetHash: string,
    mode: 'soft' | 'mixed' | 'hard' = 'mixed'
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const safeHash = this.validateGitArg(targetHash, 'target hash')
    return await this.execGit(['reset', `--${mode}`, '--', safeHash])
  }

  public async checkoutBranch(
    branchName: string
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const safeBranch = this.validateGitArg(branchName, 'branch name')
    return await this.execGit(['checkout', safeBranch])
  }

  public async createBranch(
    branchName: string,
    startPoint?: string
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const safeBranch = this.validateGitArg(branchName, 'branch name')
    const args = ['checkout', '-b', safeBranch]
    if (startPoint) {
      args.push(this.validateGitArg(startPoint, 'start point'))
    }
    return await this.execGit(args)
  }

  public async deleteBranch(
    branchName: string,
    force?: boolean
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const safeBranch = this.validateGitArg(branchName, 'branch name')
    const flag = force ? '-D' : '-d'
    return await this.execGit(['branch', flag, '--', safeBranch])
  }

  public async renameBranch(
    oldName: string,
    newName: string
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const safeOld = this.validateGitArg(oldName, 'old branch name')
    const safeNew = this.validateGitArg(newName, 'new branch name')
    return await this.execGit(['branch', '-m', '--', safeOld, safeNew])
  }

  public async cloneRepository(
    url: string,
    targetPath: string
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const safeUrl = this.validateGitArg(url, 'clone URL')
    const parentDir = path.dirname(path.resolve(targetPath))
    return await this.execGit(['clone', '--progress', '--', safeUrl, targetPath], parentDir)
  }

  public async mergeBranch(
    branchOrRef: string
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const safeRef = this.validateGitArg(branchOrRef, 'branch or ref')
    return await this.execGit(['merge', '--', safeRef])
  }

  public async rebaseBranch(
    upstream: string
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const safeUpstream = this.validateGitArg(upstream, 'upstream ref')
    return await this.execGit(['rebase', safeUpstream])
  }

  public async cherryPick(
    commitHash: string
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const safeHash = this.validateGitArg(commitHash, 'commit hash')
    return await this.execGit(['cherry-pick', safeHash])
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

  private unquoteGitPath(pathStr: string): string {
    const trimmed = pathStr.trim()
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      return trimmed.slice(1, -1)
    }
    return trimmed
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
        const filePath = this.unquoteGitPath(parts.slice(8).join(' '))

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
        const newPath = this.unquoteGitPath(paths[0])
        const oldPath = paths[1] ? this.unquoteGitPath(paths[1]) : undefined

        files.push({
          path: newPath,
          oldPath,
          status: 'renamed',
          staged: stagedCode !== '.',
        })
      } else if (type === 'u') {
        // Unmerged/conflicted file: "u <xy> <sub> <m1> <m2> <m3> <mW> <h1> <h2> <h3> <path>"
        const filePath = this.unquoteGitPath(parts.slice(10).join(' '))
        files.push({
          path: filePath,
          status: 'conflicted',
          staged: false,
        })
      } else if (type === '?') {
        // Untracked file
        const filePath = this.unquoteGitPath(parts.slice(1).join(' '))
        files.push({
          path: filePath,
          status: 'untracked',
          staged: false,
        })
      }
    }

    return files
  }

  public async resolveConflict(
    filePath: string,
    resolution: 'ours' | 'theirs' | 'mark-resolved'
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    if (resolution === 'ours') {
      await this.execGit(['checkout', '--ours', '--', filePath])
      return await this.execGit(['add', '--', filePath])
    } else if (resolution === 'theirs') {
      await this.execGit(['checkout', '--theirs', '--', filePath])
      return await this.execGit(['add', '--', filePath])
    } else {
      return await this.execGit(['add', '--', filePath])
    }
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
   * Push changes to remote repository with optional upstream tracking and safe force-with-lease
   */
  public async pushRemote(
    remoteName?: string,
    branchName?: string,
    setUpstream?: boolean,
    forceWithLease?: boolean
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const args = ['push']
    if (setUpstream) args.push('-u')
    if (forceWithLease) args.push('--force-with-lease')
    if (remoteName) {
      args.push(this.validateGitArg(remoteName, 'remote name'))
    }
    if (branchName) {
      args.push(this.validateGitArg(branchName, 'branch name'))
    }
    return await this.execGit(args)
  }

  /**
   * Detects remote hosting provider (GitHub, GitLab, Bitbucket) and constructs deep-links
   */
  public async getRemoteProviderInfo(remoteName: string = 'origin'): Promise<RemoteProviderInfo | null> {
    const { stdout, exitCode } = await this.execGit(['remote', 'get-url', remoteName])
    if (exitCode !== 0 || !stdout.trim()) {
      return null
    }
    return this.parseRemoteUrl(stdout.trim())
  }

  public parseRemoteUrl(url: string): RemoteProviderInfo | null {
    if (!url) return null
    let webUrl = ''
    let name: RemoteProviderInfo['name'] = 'generic'

    const sshMatch = url.match(/^git@([^:]+):([^\/]+)\/(.+?)(?:\.git)?$/)
    const httpsMatch = url.match(/^https?:\/\/([^@\/]+@)?([^\/]+)\/([^\/]+)\/(.+?)(?:\.git)?$/)

    if (sshMatch) {
      const [, host, owner, repo] = sshMatch
      webUrl = `https://${host}/${owner}/${repo}`
      if (host.includes('github.com')) name = 'github'
      else if (host.includes('gitlab.com')) name = 'gitlab'
      else if (host.includes('bitbucket.org')) name = 'bitbucket'
    } else if (httpsMatch) {
      const [, , host, owner, repo] = httpsMatch
      webUrl = `https://${host}/${owner}/${repo}`
      if (host.includes('github.com')) name = 'github'
      else if (host.includes('gitlab.com')) name = 'gitlab'
      else if (host.includes('bitbucket.org')) name = 'bitbucket'
    } else {
      webUrl = url.replace(/\.git$/, '')
    }

    let commitUrlTemplate = `${webUrl}/commit/{hash}`
    let prUrlTemplate = `${webUrl}/compare/{branch}?expand=1`
    let branchUrlTemplate = `${webUrl}/tree/{branch}`

    if (name === 'gitlab') {
      commitUrlTemplate = `${webUrl}/-/commit/{hash}`
      prUrlTemplate = `${webUrl}/-/merge_requests/new?merge_request%5Bsource_branch%5D={branch}`
      branchUrlTemplate = `${webUrl}/-/tree/{branch}`
    } else if (name === 'bitbucket') {
      commitUrlTemplate = `${webUrl}/commits/{hash}`
      prUrlTemplate = `${webUrl}/pull-requests/new?source={branch}`
      branchUrlTemplate = `${webUrl}/src/{branch}`
    }

    return {
      name,
      webUrl,
      commitUrlTemplate,
      prUrlTemplate,
      branchUrlTemplate,
    }
  }

  /**
   * Get files changed in a single commit and overall stat summary
   */
  public async getCommitFiles(hash: string): Promise<{ files: GitFileStatus[]; statSummary: string }> {
    const { stdout } = await this.execGit(['diff-tree', '--no-commit-id', '--name-status', '-r', '--root', hash])
    const statRes = await this.execGit(['diff-tree', '--no-commit-id', '--stat', '-r', '--root', hash])
    const files = this.parseNameStatusOutput(stdout)
    const statSummary = statRes.stdout.trim().split('\n').pop() || ''
    return { files, statSummary }
  }

  /**
   * Get files changed and stat summary across a range of commits (from base to head)
   */
  public async getRangeDiff(baseHash: string, headHash: string): Promise<CommitRangeDiff> {
    if (baseHash === headHash) {
      const res = await this.getCommitFiles(headHash)
      return {
        baseHash,
        headHash,
        statSummary: res.statSummary,
        files: res.files,
      }
    }

    const revRes = await this.execGit(['rev-parse', '--verify', `${baseHash}~1`])
    const baseRef = revRes.exitCode === 0 ? `${baseHash}~1` : baseHash

    const { stdout } = await this.execGit(['diff', '--name-status', baseRef, headHash])
    const statRes = await this.execGit(['diff', '--stat', baseRef, headHash])
    const files = this.parseNameStatusOutput(stdout)
    const statSummary = statRes.stdout.trim().split('\n').pop() || ''

    return {
      baseHash,
      headHash,
      statSummary,
      files,
    }
  }

  /**
   * Get parsed unified diff for a single file within a commit or commit range
   */
  public async getCommitFileDiff(baseHash: string, headHash: string, filePath: string): Promise<FileDiff> {
    if (baseHash === headHash) {
      const { stdout } = await this.execGit(['diff-tree', '-p', '--no-color', '-U3', headHash, '--', filePath])
      return this.parseUnifiedDiff(stdout, filePath)
    }

    const revRes = await this.execGit(['rev-parse', '--verify', `${baseHash}~1`])
    const baseRef = revRes.exitCode === 0 ? `${baseHash}~1` : baseHash

    const { stdout } = await this.execGit(['diff', '--no-color', '-U3', baseRef, headHash, '--', filePath])
    return this.parseUnifiedDiff(stdout, filePath)
  }

  private parseNameStatusOutput(output: string): GitFileStatus[] {
    if (!output.trim()) return []
    const files: GitFileStatus[] = []
    const lines = output.trim().split('\n')
    for (const line of lines) {
      const parts = line.split('\t')
      if (parts.length < 2) continue
      const statusCode = parts[0].trim()[0]
      let path = this.unquoteGitPath(parts[1])
      let oldPath: string | undefined
      if (parts.length >= 3) {
        oldPath = this.unquoteGitPath(parts[1])
        path = this.unquoteGitPath(parts[2])
      }
      files.push({
        path,
        oldPath,
        status: this.parseStatusCode(statusCode),
        staged: false,
      })
    }
    return files
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
