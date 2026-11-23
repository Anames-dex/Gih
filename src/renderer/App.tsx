import React, { useState, useEffect, useCallback, useRef } from 'react'
import type {
  RepositoryState,
  GitCommit,
  CommandLogEntry,
  RemoteProviderInfo,
  GitInstallationStatus,
  GitAuthorConfig,
  RecentRepository
} from '../shared/types'
import { FolderGit2, AlertTriangle, CheckCircle2, XCircle, Clock, ExternalLink } from 'lucide-react'
import { AppHeader } from './components/layout/AppHeader'
import { Sidebar } from './components/layout/Sidebar'
import { CommitGraph } from './components/graph/CommitGraph'
import { StagingArea } from './components/staging/StagingArea'
import { BottomPanel } from './components/terminal/BottomPanel'
import { CommandPalette } from './components/modals/CommandPalette'
import { InteractiveRebaseModal, RebaseStep } from './components/modals/InteractiveRebaseModal'
import { ResetBranchModal, ResetMode } from './components/modals/ResetBranchModal'
import { CloneRepositoryModal } from './components/modals/CloneRepositoryModal'
import { GitMissingView } from './components/layout/GitMissingView'
import { GitAuthorModal } from './components/modals/GitAuthorModal'

interface ToastNotice {
  id: string
  type: 'success' | 'error' | 'info'
  command?: string
  message: string
  durationMs?: number
}

export const App: React.FC = () => {
  const [gitStatus, setGitStatus] = useState<GitInstallationStatus | null>(null)
  const [repoState, setRepoState] = useState<RepositoryState | null>(null)
  const [authorConfig, setAuthorConfig] = useState<GitAuthorConfig | null>(null)
  const [isAuthorModalOpen, setIsAuthorModalOpen] = useState(false)
  const [pendingCommitAction, setPendingCommitAction] = useState<(() => void) | null>(null)
  const [recentRepos, setRecentRepos] = useState<RecentRepository[]>(() => {
    try {
      const saved = localStorage.getItem('gih:recent_repos')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [selectedCommits, setSelectedCommits] = useState<GitCommit[]>([])
  const [anchorCommit, setAnchorCommit] = useState<GitCommit | null>(null)
  const [remoteInfo, setRemoteInfo] = useState<RemoteProviderInfo | null>(null)
  const [isTerminalOpen, setIsTerminalOpen] = useState(false)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const [isRebaseModalOpen, setIsRebaseModalOpen] = useState(false)
  const [resetModalCommit, setResetModalCommit] = useState<GitCommit | null>(null)
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false)
  const [commandHistory, setCommandHistory] = useState<CommandLogEntry[]>([])
  const [isFetching, setIsFetching] = useState(false)
  const [isPulling, setIsPulling] = useState(false)
  const [isPushing, setIsPushing] = useState(false)
  const [isStashing, setIsStashing] = useState(false)
  const [toasts, setToasts] = useState<ToastNotice[]>([])

  // Resizable Panes Dimensions
  const [sidebarWidth, setSidebarWidth] = useState(260)
  const [stagingWidth, setStagingWidth] = useState(380)
  const [bottomHeight, setBottomHeight] = useState(260)

  const isDraggingSidebar = useRef(false)
  const isDraggingStaging = useRef(false)
  const isDraggingBottom = useRef(false)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingSidebar.current) {
        setSidebarWidth(Math.max(180, Math.min(500, e.clientX)))
      } else if (isDraggingStaging.current) {
        setStagingWidth(Math.max(260, Math.min(650, window.innerWidth - e.clientX)))
      } else if (isDraggingBottom.current) {
        setBottomHeight(Math.max(120, Math.min(600, window.innerHeight - e.clientY)))
      }
    }

    const handleMouseUp = () => {
      isDraggingSidebar.current = false
      isDraggingStaging.current = false
      isDraggingBottom.current = false
      document.body.style.cursor = 'default'
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    commit: GitCommit
  } | null>(null)

  const gih = (window as any).gih
  const isRefreshingRef = useRef(false)
  const refreshPendingRef = useRef(false)

  const showToast = useCallback((toast: Omit<ToastNotice, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
    setToasts((prev) => [...prev, { ...toast, id }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4500)
  }, [])

  const refreshState = useCallback(async () => {
    if (!gih) return
    if (isRefreshingRef.current) {
      refreshPendingRef.current = true
      return
    }
    isRefreshingRef.current = true

    try {
      const state = await gih.getState()
      setRepoState(state)
      const history = await gih.getCommandHistory()
      setCommandHistory(history)
      if (gih.getRemoteInfo) {
        const rInfo = await gih.getRemoteInfo()
        setRemoteInfo(rInfo)
      }
      if (gih.getAuthorConfig) {
        const author = await gih.getAuthorConfig()
        setAuthorConfig(author)
      }
      if (state?.isGitRepo && state.path) {
        setRecentRepos((prev) => {
          const filtered = prev.filter((r) => r.path !== state.path)
          const next = [{ path: state.path, name: state.name, lastOpened: Date.now() }, ...filtered].slice(0, 10)
          try {
            localStorage.setItem('gih:recent_repos', JSON.stringify(next))
          } catch {}
          return next
        })
      }
    } catch (e: any) {
      console.error('Failed to refresh repository state:', e)
    } finally {
      isRefreshingRef.current = false
      if (refreshPendingRef.current) {
        refreshPendingRef.current = false
        refreshState()
      }
    }
  }, [gih])

  const checkGit = useCallback(async () => {
    if (!gih?.checkGitInstallation) return
    try {
      const status = await gih.checkGitInstallation()
      setGitStatus(status)
      if (status.isInstalled) {
        refreshState()
      }
    } catch (e: any) {
      console.warn('Failed to verify Git installation:', e)
    }
  }, [gih, refreshState])

  useEffect(() => {
    checkGit()
    if (gih?.onRepoChanged) {
      const unsubscribe = gih.onRepoChanged(() => {
        refreshState()
      })
      return () => unsubscribe()
    }
  }, [checkGit, refreshState, gih])

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsCommandPaletteOpen((prev) => !prev)
      } else if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault()
        setIsTerminalOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Close context menu on outside click
  useEffect(() => {
    const handleClick = () => setContextMenu(null)
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [])

  // Action Handlers
  const handleFetch = async () => {
    if (!gih) return
    setIsFetching(true)
    const t0 = performance.now()
    try {
      await gih.fetchRemote()
      await refreshState()
      showToast({
        type: 'success',
        command: 'git fetch --prune',
        message: 'Fetched all remote branches',
        durationMs: Math.round(performance.now() - t0),
      })
    } catch (e: any) {
      showToast({ type: 'error', command: 'git fetch', message: e.message })
    } finally {
      setIsFetching(false)
    }
  }

  const handlePull = async () => {
    if (!gih) return
    setIsPulling(true)
    const t0 = performance.now()
    try {
      await gih.pullRemote()
      await refreshState()
      showToast({
        type: 'success',
        command: 'git pull',
        message: 'Pulled upstream updates',
        durationMs: Math.round(performance.now() - t0),
      })
    } catch (e: any) {
      showToast({ type: 'error', command: 'git pull', message: e.message })
    } finally {
      setIsPulling(false)
    }
  }

  const handlePush = async (forceWithLease: boolean = false) => {
    if (!gih) return
    setIsPushing(true)
    const t0 = performance.now()
    const cmdStr = forceWithLease ? 'git push --force-with-lease' : 'git push -u origin'
    try {
      const res = await gih.pushRemote(undefined, undefined, !forceWithLease, forceWithLease)
      await refreshState()
      if (res && res.exitCode !== 0) {
        showToast({
          type: 'error',
          command: cmdStr,
          message: res.stderr || 'Push rejected by remote host',
        })
      } else {
        showToast({
          type: 'success',
          command: cmdStr,
          message: forceWithLease ? 'Force-pushed (with lease) to remote' : 'Pushed commits to remote',
          durationMs: Math.round(performance.now() - t0),
        })
      }
    } catch (e: any) {
      showToast({ type: 'error', command: cmdStr, message: e.message })
    } finally {
      setIsPushing(false)
    }
  }

  const handleSelectCommit = useCallback(
    (commit: GitCommit, multiSelect?: boolean, rangeSelect?: boolean) => {
      if (!repoState?.commits) return

      if (rangeSelect && anchorCommit) {
        const anchorIdx = repoState.commits.findIndex((c) => c.hash === anchorCommit.hash)
        const targetIdx = repoState.commits.findIndex((c) => c.hash === commit.hash)

        if (anchorIdx !== -1 && targetIdx !== -1) {
          const start = Math.min(anchorIdx, targetIdx)
          const end = Math.max(anchorIdx, targetIdx)
          const slice = repoState.commits.slice(start, end + 1)
          setSelectedCommits(slice)
          return
        }
      }

      if (multiSelect) {
        setSelectedCommits((prev) => {
          const exists = prev.some((c) => c.hash === commit.hash)
          if (exists) {
            const next = prev.filter((c) => c.hash !== commit.hash)
            if (next.length === 0) setAnchorCommit(null)
            return next
          } else {
            setAnchorCommit(commit)
            return [...prev, commit]
          }
        })
      } else {
        setSelectedCommits([commit])
        setAnchorCommit(commit)
      }
    },
    [repoState?.commits, anchorCommit]
  )

  const handleClearSelectedCommits = useCallback(() => {
    setSelectedCommits([])
    setAnchorCommit(null)
  }, [])

  const handleNewBranch = async () => {
    if (!gih) return
    const name = window.prompt('Enter new branch name:')
    if (name?.trim()) {
      const t0 = performance.now()
      try {
        await gih.createBranch(name.trim())
        await refreshState()
        showToast({
          type: 'success',
          command: `git checkout -b ${name.trim()}`,
          message: `Created and checked out '${name.trim()}'`,
          durationMs: Math.round(performance.now() - t0),
        })
      } catch (e: any) {
        showToast({ type: 'error', command: `git checkout -b ${name.trim()}`, message: e.message })
      }
    }
  }

  const handleCheckoutBranch = async (branchName: string) => {
    if (!gih) return
    const t0 = performance.now()
    try {
      await gih.checkoutBranch(branchName)
      await refreshState()
      showToast({
        type: 'success',
        command: `git checkout ${branchName}`,
        message: `Switched to branch '${branchName}'`,
        durationMs: Math.round(performance.now() - t0),
      })
    } catch (e: any) {
      showToast({ type: 'error', command: `git checkout ${branchName}`, message: e.message })
    }
  }

  const handleDeleteBranch = async (branchName: string) => {
    if (!gih) return
    if (window.confirm(`Delete branch '${branchName}'?`)) {
      const t0 = performance.now()
      try {
        await gih.deleteBranch(branchName, true)
        await refreshState()
        showToast({
          type: 'info',
          command: `git branch -D ${branchName}`,
          message: `Deleted branch '${branchName}'`,
          durationMs: Math.round(performance.now() - t0),
        })
      } catch (e: any) {
        showToast({ type: 'error', command: `git branch -D ${branchName}`, message: e.message })
      }
    }
  }

  const handleRenameBranch = async (oldName: string, newName: string) => {
    if (!gih || !newName.trim() || oldName === newName.trim()) return
    const t0 = performance.now()
    try {
      const res = await gih.renameBranch(oldName, newName.trim())
      if (res.exitCode !== 0) {
        showToast({ type: 'error', command: `git branch -m ${oldName} ${newName.trim()}`, message: res.stderr || 'Rename failed' })
      } else {
        await refreshState()
        showToast({
          type: 'success',
          command: `git branch -m ${oldName} ${newName.trim()}`,
          message: `Renamed branch to '${newName.trim()}'`,
          durationMs: Math.round(performance.now() - t0),
        })
      }
    } catch (e: any) {
      showToast({ type: 'error', command: `git branch -m`, message: e.message })
    }
  }

  const handleMergeBranch = async (sourceBranch: string, targetRef: string) => {
    if (!gih) return
    const t0 = performance.now()
    try {
      const res = await gih.mergeBranch(sourceBranch)
      await refreshState()
      if (res.exitCode !== 0) {
        showToast({
          type: 'error',
          command: `git merge ${sourceBranch}`,
          message: res.stderr || 'Merge resulted in conflicts. Check staging panel.',
        })
      } else {
        showToast({
          type: 'success',
          command: `git merge ${sourceBranch}`,
          message: `Merged ${sourceBranch} into ${targetRef}`,
          durationMs: Math.round(performance.now() - t0),
        })
      }
    } catch (e: any) {
      showToast({ type: 'error', command: `git merge ${sourceBranch}`, message: e.message })
    }
  }

  const handleRebaseBranch = async (sourceBranch: string, upstreamRef: string) => {
    if (!gih) return
    const t0 = performance.now()
    try {
      const res = await gih.rebaseBranch(upstreamRef)
      await refreshState()
      if (res.exitCode !== 0) {
        showToast({
          type: 'error',
          command: `git rebase ${upstreamRef}`,
          message: res.stderr || 'Rebase stopped with conflicts. Use HUD to continue or abort.',
        })
      } else {
        showToast({
          type: 'success',
          command: `git rebase ${upstreamRef}`,
          message: `Rebased ${sourceBranch} onto ${upstreamRef}`,
          durationMs: Math.round(performance.now() - t0),
        })
      }
    } catch (e: any) {
      showToast({ type: 'error', command: `git rebase ${upstreamRef}`, message: e.message })
    }
  }

  const handleCherryPick = async (commitHash: string) => {
    if (!gih) return
    const t0 = performance.now()
    try {
      const res = await gih.cherryPick(commitHash)
      await refreshState()
      if (res.exitCode !== 0) {
        showToast({
          type: 'error',
          command: `git cherry-pick ${commitHash.slice(0, 7)}`,
          message: res.stderr || 'Cherry-pick conflict. Check staging panel.',
        })
      } else {
        showToast({
          type: 'success',
          command: `git cherry-pick ${commitHash.slice(0, 7)}`,
          message: `Cherry-picked ${commitHash.slice(0, 7)} onto current branch`,
          durationMs: Math.round(performance.now() - t0),
        })
      }
    } catch (e: any) {
      showToast({ type: 'error', command: `git cherry-pick`, message: e.message })
    }
  }

  const handleOpenRepo = async () => {
    if (!gih) return
    const dir = await gih.openDirectoryDialog()
    if (dir) {
      await gih.setRepoPath(dir)
      await refreshState()
      showToast({ type: 'info', message: `Opened ${dir}` })
    }
  }

  const handleInitRepo = async () => {
    if (!gih) return
    const t0 = performance.now()
    try {
      await gih.initRepository('main')
      await refreshState()
      showToast({
        type: 'success',
        command: 'git init -b main',
        message: 'Initialized empty Git repository',
        durationMs: Math.round(performance.now() - t0),
      })
    } catch (e: any) {
      showToast({ type: 'error', command: 'git init', message: e.message })
    }
  }

  const handleStash = async () => {
    if (!gih) return
    const msg = window.prompt('Stash message (optional):')
    setIsStashing(true)
    const t0 = performance.now()
    try {
      await gih.createStash(msg || undefined, true)
      await refreshState()
      showToast({
        type: 'success',
        command: 'git stash push -u',
        message: 'Working changes saved to stash',
        durationMs: Math.round(performance.now() - t0),
      })
    } catch (e: any) {
      showToast({ type: 'error', command: 'git stash', message: e.message })
    } finally {
      setIsStashing(false)
    }
  }

  const handleResolveConflict = async (filePath: string, resolution: 'ours' | 'theirs' | 'mark-resolved') => {
    if (!gih) return
    const t0 = performance.now()
    try {
      const res = await gih.resolveConflict(filePath, resolution)
      if (res.exitCode !== 0) {
        showToast({ type: 'error', command: `git checkout --${resolution}`, message: res.stderr || 'Conflict resolution failed' })
      } else {
        await refreshState()
        showToast({
          type: 'success',
          command: resolution === 'mark-resolved' ? `git add ${filePath}` : `git checkout --${resolution} ${filePath}`,
          message: `Resolved conflict for ${filePath.split(/[\\/]/).pop()} (${resolution})`,
          durationMs: Math.round(performance.now() - t0),
        })
      }
    } catch (e: any) {
      showToast({ type: 'error', message: e.message })
    }
  }

  const handleApplyHunkPatch = async (patch: string, options: { cached?: boolean; reverse?: boolean }) => {
    if (!gih) return
    const t0 = performance.now()
    try {
      const res = await gih.applyPatch(patch, options)
      if (res.exitCode !== 0) {
        showToast({ type: 'error', command: 'git apply', message: res.stderr || 'Failed to apply hunk patch' })
      } else {
        await refreshState()
        showToast({
          type: 'success',
          command: `git apply ${options.cached ? '--cached ' : ''}${options.reverse ? '--reverse' : ''}`.trim(),
          message: options.reverse ? 'Discarded hunk' : options.cached ? 'Staged hunk' : 'Applied hunk',
          durationMs: Math.round(performance.now() - t0),
        })
      }
    } catch (err: any) {
      showToast({ type: 'error', command: 'git apply', message: err.message })
    }
  }

  const handlePopStash = async (index: number) => {
    if (!gih) return
    const t0 = performance.now()
    try {
      await gih.popStash(index)
      await refreshState()
      showToast({
        type: 'success',
        command: `git stash pop stash@{${index}}`,
        message: `Applied and dropped stash@{${index}}`,
        durationMs: Math.round(performance.now() - t0),
      })
    } catch (e: any) {
      showToast({ type: 'error', command: `git stash pop`, message: e.message })
    }
  }

  const handleDropStash = async (index: number) => {
    if (!gih) return
    const t0 = performance.now()
    try {
      await gih.dropStash(index)
      await refreshState()
      showToast({
        type: 'info',
        command: `git stash drop stash@{${index}}`,
        message: `Dropped stash@{${index}}`,
        durationMs: Math.round(performance.now() - t0),
      })
    } catch (e: any) {
      showToast({ type: 'error', command: `git stash drop`, message: e.message })
    }
  }

  const handleCreateTag = async () => {
    if (!gih) return
    const name = window.prompt('Tag name:')
    if (!name?.trim()) return
    const msg = window.prompt('Tag message (optional):')
    const t0 = performance.now()
    try {
      await gih.createTag(name.trim(), msg || undefined)
      await refreshState()
      showToast({
        type: 'success',
        command: `git tag ${name.trim()}`,
        message: `Created tag '${name.trim()}'`,
        durationMs: Math.round(performance.now() - t0),
      })
    } catch (e: any) {
      showToast({ type: 'error', command: `git tag ${name.trim()}`, message: e.message })
    }
  }

  const handleDeleteTag = async (tagName: string) => {
    if (!gih) return
    if (window.confirm(`Delete tag '${tagName}'?`)) {
      const t0 = performance.now()
      try {
        await gih.deleteTag(tagName)
        await refreshState()
        showToast({
          type: 'info',
          command: `git tag -d ${tagName}`,
          message: `Deleted tag '${tagName}'`,
          durationMs: Math.round(performance.now() - t0),
        })
      } catch (e: any) {
        showToast({ type: 'error', command: `git tag -d`, message: e.message })
      }
    }
  }

  const handleBranchFromStash = async (branchName: string, index: number) => {
    if (!gih) return
    const t0 = performance.now()
    try {
      await gih.branchFromStash(branchName, index)
      await refreshState()
      showToast({
        type: 'success',
        command: `git stash branch ${branchName} stash@{${index}}`,
        message: `Created and checked out '${branchName}' from stash`,
        durationMs: Math.round(performance.now() - t0),
      })
    } catch (e: any) {
      showToast({ type: 'error', command: `git stash branch`, message: e.message })
    }
  }

  const handleCommit = async (message: string, signOff?: boolean, amend?: boolean) => {
    if (!gih) return

    // If author name or email is unset, prompt user with author modal before committing
    if (!authorConfig || !authorConfig.name || !authorConfig.email) {
      setPendingCommitAction(() => () => handleCommit(message, signOff, amend))
      setIsAuthorModalOpen(true)
      return
    }

    const t0 = performance.now()
    try {
      const res = await gih.createCommit(message, signOff, amend)
      if (res.exitCode !== 0) {
        // If git failed specifically due to missing author identity
        if (
          res.stderr.toLowerCase().includes('user.email') ||
          res.stderr.toLowerCase().includes('tell me who you are') ||
          res.stderr.toLowerCase().includes('author identity unknown')
        ) {
          setPendingCommitAction(() => () => handleCommit(message, signOff, amend))
          setIsAuthorModalOpen(true)
          return
        }
        showToast({ type: 'error', command: 'git commit', message: res.stderr || 'Commit failed' })
      } else {
        await refreshState()
        showToast({
          type: 'success',
          command: `git commit ${amend ? '--amend ' : ''}${signOff ? '-s ' : ''}-m "${message.slice(0, 20)}..."`.trim(),
          message: amend ? 'Amended HEAD commit' : 'Commit created',
          durationMs: Math.round(performance.now() - t0),
        })
      }
    } catch (e: any) {
      showToast({ type: 'error', command: 'git commit', message: e.message })
    }
  }

  const handleExecuteReset = async (commit: GitCommit, mode: ResetMode) => {
    if (!gih) return
    const t0 = performance.now()
    try {
      const res = await gih.resetBranch(commit.hash, mode)
      if (res.exitCode !== 0) {
        showToast({ type: 'error', command: `git reset --${mode}`, message: res.stderr || 'Reset failed' })
      } else {
        await refreshState()
        showToast({
          type: 'info',
          command: `git reset --${mode} ${commit.shortHash}`,
          message: `Reset branch to ${commit.shortHash} (--${mode})`,
          durationMs: Math.round(performance.now() - t0),
        })
      }
    } catch (e: any) {
      showToast({ type: 'error', command: `git reset --${mode}`, message: e.message })
    }
  }

  const handleContinueOperation = async () => {
    if (!gih || !repoState?.operation) return
    const op = repoState.operation.type
    const t0 = performance.now()
    try {
      const res = await gih.continueOperation(op)
      await refreshState()
      if (res.exitCode === 0) {
        showToast({
          type: 'success',
          command: `git ${op} --continue`,
          message: `${op} step continued successfully`,
          durationMs: Math.round(performance.now() - t0),
        })
      } else {
        showToast({
          type: 'error',
          command: `git ${op} --continue`,
          message: res.stderr || 'Continue failed. Check conflicts in staging.',
        })
      }
    } catch (e: any) {
      showToast({ type: 'error', message: e.message })
    }
  }

  const handleAbortOperation = async () => {
    if (!gih || !repoState?.operation) return
    const op = repoState.operation.type
    if (!window.confirm(`Abort current ${op} operation and discard in-progress steps?`)) return
    const t0 = performance.now()
    try {
      await gih.abortOperation(op)
      await refreshState()
      showToast({
        type: 'info',
        command: `git ${op} --abort`,
        message: `Aborted ${op} operation`,
        durationMs: Math.round(performance.now() - t0),
      })
    } catch (e: any) {
      showToast({ type: 'error', message: e.message })
    }
  }

  const handleSkipOperation = async () => {
    if (!gih || !repoState?.operation) return
    const op = repoState.operation.type
    const t0 = performance.now()
    try {
      await gih.skipOperation(op)
      await refreshState()
      showToast({
        type: 'info',
        command: `git ${op} --skip`,
        message: `Skipped commit in ${op}`,
        durationMs: Math.round(performance.now() - t0),
      })
    } catch (e: any) {
      showToast({ type: 'error', message: e.message })
    }
  }

  const handleExecCommand = async (commandStr: string) => {
    if (!gih) return
    const args = commandStr.split(/\s+/).filter(Boolean)
    await gih.execCommand(args)
    await refreshState()
  }

  const handleResetToReflog = async (hash: string) => {
    if (!gih) return
    if (window.confirm(`Reset repository HEAD to ${hash}?`)) {
      const t0 = performance.now()
      await gih.execCommand(['reset', '--hard', hash])
      await refreshState()
      showToast({
        type: 'info',
        command: `git reset --hard ${hash.slice(0, 7)}`,
        message: `Reset HEAD to ${hash.slice(0, 7)}`,
        durationMs: Math.round(performance.now() - t0),
      })
    }
  }

  const handleExecuteRebase = async (_steps: RebaseStep[]) => {
    if (!gih) return
    showToast({
      type: 'info',
      command: 'git rebase -i',
      message: 'Rebase sequence triggered',
    })
    await refreshState()
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background text-slate-100 font-sans">
      {/* Top Header Bar */}
      <AppHeader
        repoName={repoState?.name || 'Gih'}
        currentBranch={repoState?.currentBranch || null}
        remoteInfo={remoteInfo}
        recentRepos={recentRepos}
        onSelectRecentRepo={async (targetPath) => {
          if (!gih) return
          await gih.setRepoPath(targetPath)
          await refreshState()
          showToast({ type: 'info', message: `Switched to ${targetPath.split(/[\\/]/).pop()}` })
        }}
        onRemoveRecentRepo={(targetPath) => {
          setRecentRepos((prev) => {
            const next = prev.filter((r) => r.path !== targetPath)
            try {
              localStorage.setItem('gih:recent_repos', JSON.stringify(next))
            } catch {}
            return next
          })
        }}
        onConfigureAuthor={() => setIsAuthorModalOpen(true)}
        onFetch={handleFetch}
        onPull={handlePull}
        onPush={handlePush}
        onOpenRemoteUrl={(url) => gih?.openExternal(url)}
        onNewBranch={handleNewBranch}
        onStash={handleStash}
        onOpenRepo={handleOpenRepo}
        onCloneRepo={() => setIsCloneModalOpen(true)}
        onToggleTerminal={() => setIsTerminalOpen((prev) => !prev)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        isFetching={isFetching}
        isPulling={isPulling}
        isPushing={isPushing}
        isStashing={isStashing}
      />

      {/* In-Progress Git Operation HUD Banner (Rebase / Merge / Cherry-Pick / Bisect) */}
      {repoState?.operation && repoState.operation.type !== 'none' && (
        <div className="h-10 px-4 bg-amber-500/10 border-b border-amber-500/30 flex items-center justify-between text-xs select-none shrink-0 z-30">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 animate-pulse" />
            <span className="font-bold uppercase tracking-wider text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">
              {repoState.operation.type} in progress
            </span>
            <span className="text-slate-200 font-medium">
              {repoState.operation.message}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {repoState.operation.canContinue && (
              <button
                onClick={handleContinueOperation}
                className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded text-xs transition-colors shadow-sm"
              >
                Continue
              </button>
            )}
            {repoState.operation.canSkip && (
              <button
                onClick={handleSkipOperation}
                className="px-2.5 py-1 bg-surface-subtle hover:bg-surface-hover border border-surface-border text-slate-200 font-medium rounded text-xs transition-colors"
              >
                Skip
              </button>
            )}
            {repoState.operation.canAbort && (
              <button
                onClick={handleAbortOperation}
                className="px-2.5 py-1 bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/50 text-rose-300 font-medium rounded text-xs transition-colors"
              >
                Abort
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Workspace (Sidebar + DAG Graph + Staging / Inspector) */}
      {gitStatus && !gitStatus.isInstalled ? (
        <GitMissingView
          status={gitStatus}
          onRecheck={async () => {
            if (gih?.checkGitInstallation) {
              const status = await gih.checkGitInstallation()
              setGitStatus(status)
              if (status.isInstalled) {
                showToast({ type: 'success', message: 'Git binary detected!' })
                refreshState()
              } else {
                showToast({ type: 'error', message: 'Git was not found on your system PATH.' })
              }
            }
          }}
          onInstall={async (method) => {
            if (gih?.installGit) {
              return await gih.installGit(method)
            }
            return { success: false, message: 'Installer invocation not available' }
          }}
        />
      ) : repoState && !repoState.isGitRepo ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#0c0e14]">
          <div className="max-w-md w-full p-8 rounded-2xl bg-surface border border-surface-border shadow-2xl flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-5 shadow-inner">
              <FolderGit2 className="w-7 h-7" />
            </div>

            <h2 className="text-lg font-bold text-white tracking-tight">Not a Git Repository</h2>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              This directory hasn't been initialized as a Git repository yet.
            </p>

            <div className="mt-4 px-3 py-1.5 bg-surface-subtle border border-surface-border/60 rounded-lg text-xs font-mono text-slate-300 max-w-full truncate">
              {repoState.path}
            </div>

            <div className="flex items-center gap-3 mt-6 w-full">
              <button
                onClick={handleOpenRepo}
                className="flex-1 px-4 py-2.5 rounded-lg border border-surface-border hover:bg-surface-hover text-slate-300 text-xs font-medium transition-colors"
              >
                Choose Another Folder
              </button>
              <button
                onClick={handleInitRepo}
                className="flex-1 px-4 py-2.5 rounded-lg bg-brand hover:bg-brand-hover text-slate-950 text-xs font-bold transition-colors shadow-sm"
              >
                Initialize (git init)
              </button>
            </div>

            {/* Quick jump to recent repositories */}
            {recentRepos.length > 0 && (
              <div className="w-full mt-6 pt-5 border-t border-surface-border/80 text-left">
                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2 flex items-center justify-between">
                  <span>Recent Repositories</span>
                  <Clock className="w-3 h-3 text-slate-500" />
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {recentRepos.slice(0, 4).map((r) => (
                    <button
                      key={r.path}
                      onClick={async () => {
                        if (!gih) return
                        await gih.setRepoPath(r.path)
                        await refreshState()
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg bg-surface-subtle hover:bg-surface-hover border border-surface-border/50 text-xs flex items-center justify-between transition-colors group"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-medium text-slate-200 truncate">{r.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono truncate">{r.path}</div>
                      </div>
                      <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-sky-400 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden relative">
          <Sidebar
            width={sidebarWidth}
            branches={repoState?.branches || []}
            tags={repoState?.tags || []}
            stashes={repoState?.stashes || []}
            worktrees={repoState?.worktrees || []}
            currentBranch={repoState?.currentBranch || null}
            onCheckoutBranch={handleCheckoutBranch}
            onCreateBranch={handleNewBranch}
            onDeleteBranch={handleDeleteBranch}
            onApplyStash={(idx) => gih?.applyStash(idx).then(refreshState)}
            onPopStash={handlePopStash}
            onDropStash={handleDropStash}
            onCreateTag={handleCreateTag}
            onDeleteTag={handleDeleteTag}
            onBranchFromStash={handleBranchFromStash}
            onRenameBranch={handleRenameBranch}
          />

          {/* Drag Splitter: Sidebar -> Graph */}
          <div
            onMouseDown={() => {
              isDraggingSidebar.current = true
              document.body.style.cursor = 'col-resize'
            }}
            className="w-1 hover:w-1.5 z-20 cursor-col-resize hover:bg-brand active:bg-brand transition-colors bg-surface-border/60 select-none shrink-0"
            title="Drag to resize sidebar"
          />

          <main className="flex-1 flex flex-col overflow-hidden relative">
            <CommitGraph
              commits={repoState?.commits || []}
              selectedCommits={selectedCommits}
              onSelectCommit={handleSelectCommit}
              onClearSelection={handleClearSelectedCommits}
              onContextMenu={(e, commit) => {
                e.preventDefault()
                setContextMenu({ x: e.clientX, y: e.clientY, commit })
              }}
              onMergeBranch={handleMergeBranch}
              onRebaseBranch={handleRebaseBranch}
              onCherryPick={handleCherryPick}
            />

            {/* Context Menu */}
            {contextMenu && (
              <div
                className="fixed z-50 bg-surface border border-surface-border rounded-lg shadow-2xl py-1 text-xs text-slate-200 min-w-[210px]"
                style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-3 py-1 text-[10px] text-slate-500 font-mono border-b border-surface-border">
                  {contextMenu.commit.shortHash}
                </div>
                <button
                  onClick={() => {
                    gih?.execCommand(['checkout', contextMenu.commit.hash]).then(refreshState)
                    setContextMenu(null)
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-surface-hover"
                >
                  Checkout this commit
                </button>
                <button
                  onClick={() => {
                    const bName = window.prompt('Create branch from this commit:')
                    if (bName) {
                      gih?.createBranch(bName, contextMenu.commit.hash).then(refreshState)
                    }
                    setContextMenu(null)
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-surface-hover"
                >
                  Create branch here...
                </button>
                <button
                  onClick={() => {
                    gih?.execCommand(['cherry-pick', contextMenu.commit.hash]).then(refreshState)
                    setContextMenu(null)
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-surface-hover"
                >
                  Cherry-pick commit
                </button>
                <button
                  onClick={() => {
                    setIsRebaseModalOpen(true)
                    setContextMenu(null)
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-surface-hover text-brand"
                >
                  Interactive rebase onto here...
                </button>

                {remoteInfo && (
                  <>
                    <div className="border-t border-surface-border my-1" />
                    <button
                      onClick={() => {
                        const url = remoteInfo.commitUrlTemplate.replace('{hash}', contextMenu.commit.hash)
                        gih?.openExternal(url)
                        setContextMenu(null)
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-surface-hover text-sky-400 flex items-center justify-between"
                    >
                      <span className="capitalize">View on {remoteInfo.name}</span>
                      <ExternalLink className="w-3 h-3 text-sky-400" />
                    </button>
                    {repoState?.currentBranch && (
                      <button
                        onClick={() => {
                          const prUrl = remoteInfo.prUrlTemplate.replace('{branch}', encodeURIComponent(repoState.currentBranch || ''))
                          gih?.openExternal(prUrl)
                          setContextMenu(null)
                        }}
                        className="w-full text-left px-3 py-1.5 hover:bg-surface-hover text-indigo-400 flex items-center justify-between"
                      >
                        <span>Create Pull Request</span>
                        <ExternalLink className="w-3 h-3 text-indigo-400" />
                      </button>
                    )}
                  </>
                )}

                <div className="border-t border-surface-border my-1" />
                <button
                  onClick={() => {
                    setResetModalCommit(contextMenu.commit)
                    setContextMenu(null)
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-rose-950/60 text-rose-300"
                >
                  Reset branch to here...
                </button>
              </div>
            )}
          </main>

          {/* Drag Splitter: Graph -> Staging */}
          <div
            onMouseDown={() => {
              isDraggingStaging.current = true
              document.body.style.cursor = 'col-resize'
            }}
            className="w-1 hover:w-1.5 z-20 cursor-col-resize hover:bg-brand active:bg-brand transition-colors bg-surface-border/60 select-none shrink-0"
            title="Drag to resize staging panel"
          />

          <StagingArea
            width={stagingWidth}
            files={repoState?.files || []}
            selectedCommits={selectedCommits}
            onClearSelectedCommits={handleClearSelectedCommits}
            onStageFile={(path) => gih?.stageFile(path).then(refreshState)}
            onUnstageFile={(path) => gih?.unstageFile(path).then(refreshState)}
            onStageAll={() => gih?.stageAll().then(refreshState)}
            onUnstageAll={() => gih?.unstageAll().then(refreshState)}
            onDiscardChanges={(path) => gih?.discardChanges(path).then(refreshState)}
            onCommit={handleCommit}
            onGetDiff={(path, staged) => gih?.getDiff(path, staged)}
            onGetCommitFiles={(hash) => gih?.getCommitFiles(hash)}
            onGetRangeDiff={(base, head) => gih?.getRangeDiff(base, head)}
            onGetCommitFileDiff={(base, head, path) => gih?.getCommitFileDiff(base, head, path)}
            onApplyHunkPatch={handleApplyHunkPatch}
            onResolveConflict={handleResolveConflict}
            headCommit={repoState?.commits.find((c) => c.isHead) || repoState?.commits[0] || null}
          />
        </div>
      )}

      {/* Drag Splitter: Workspace -> Bottom Dock */}
      {isTerminalOpen && (
        <div
          onMouseDown={() => {
            isDraggingBottom.current = true
            document.body.style.cursor = 'row-resize'
          }}
          className="h-1 hover:h-1.5 z-20 cursor-row-resize hover:bg-brand active:bg-brand transition-colors bg-surface-border/60 select-none shrink-0"
          title="Drag to resize terminal panel"
        />
      )}

      {/* Collapsible Bottom Panel */}
      <BottomPanel
        height={bottomHeight}
        isOpen={isTerminalOpen}
        onClose={() => setIsTerminalOpen(false)}
        commandHistory={commandHistory}
        onExecCommand={handleExecCommand}
        onGetReflog={() => gih?.getReflog(50) || Promise.resolve([])}
        onResetToReflog={handleResetToReflog}
      />

      {/* Modals */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        branches={repoState?.branches || []}
        commits={repoState?.commits || []}
        onCheckoutBranch={handleCheckoutBranch}
        onSelectCommit={(c) => {
          setSelectedCommits([c])
          setAnchorCommit(c)
        }}
        onAction={(id) => {
          if (id === 'fetch') handleFetch()
          if (id === 'pull') handlePull()
          if (id === 'push') handlePush()
          if (id === 'stash') handleStash()
          if (id === 'terminal') setIsTerminalOpen((p) => !p)
        }}
      />

      <InteractiveRebaseModal
        isOpen={isRebaseModalOpen}
        onClose={() => setIsRebaseModalOpen(false)}
        commits={repoState?.commits || []}
        onExecuteRebase={handleExecuteRebase}
      />

      <ResetBranchModal
        isOpen={Boolean(resetModalCommit)}
        commit={resetModalCommit}
        currentBranch={repoState?.currentBranch || null}
        onClose={() => setResetModalCommit(null)}
        onConfirmReset={handleExecuteReset}
      />

      <CloneRepositoryModal
        isOpen={isCloneModalOpen}
        onClose={() => setIsCloneModalOpen(false)}
        onBrowseFolder={() => gih?.openDirectoryDialog() || Promise.resolve(null)}
        onExecuteClone={(url, path) =>
          gih?.cloneRepository(url, path) || Promise.resolve({ stdout: '', stderr: 'API unavailable', exitCode: 1 })
        }
        onCloneSuccess={async (targetPath) => {
          if (gih) {
            await gih.setRepoPath(targetPath)
            await refreshState()
            showToast({
              type: 'success',
              message: `Cloned and opened: ${targetPath.split(/[\\/]/).pop()}`,
            })
          }
        }}
      />

      <GitAuthorModal
        isOpen={isAuthorModalOpen}
        onClose={() => {
          setIsAuthorModalOpen(false)
          setPendingCommitAction(null)
        }}
        currentName={authorConfig?.name || ''}
        currentEmail={authorConfig?.email || ''}
        onSave={async (name, email, isGlobal) => {
          if (!gih?.setAuthorConfig) return { success: false, error: 'API unavailable' }
          const res = await gih.setAuthorConfig(name, email, isGlobal)
          if (res.success) {
            setAuthorConfig({ name, email })
            showToast({
              type: 'success',
              command: `git config ${isGlobal ? '--global' : '--local'} user.name "${name}"`,
              message: `Configured author identity as ${name}`,
            })
            if (pendingCommitAction) {
              const runAction = pendingCommitAction
              setPendingCommitAction(null)
              setTimeout(() => runAction(), 100)
            }
          }
          return res
        }}
      />

      {/* Top-Center Command Feedback Island */}
      <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-1.5 pointer-events-none max-w-lg w-full px-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto px-4 py-2 rounded-full border shadow-2xl backdrop-blur-md flex items-center gap-3 animate-fade-in transition-all ${
              toast.type === 'error'
                ? 'bg-[#1e1014]/95 border-rose-800/80 text-rose-100 shadow-rose-950/40'
                : toast.type === 'info'
                ? 'bg-surface/95 border-surface-border text-slate-100'
                : 'bg-[#0f1923]/95 border-emerald-500/40 text-slate-100 shadow-emerald-950/30'
            }`}
          >
            {toast.type === 'error' ? (
              <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}

            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-semibold whitespace-nowrap">{toast.message}</span>
              {toast.command && (
                <>
                  <span className="text-slate-600 text-xs">•</span>
                  <span className="text-[11px] font-mono text-sky-400 truncate max-w-[220px]">
                    ${toast.command.startsWith(' ') ? '' : ' '}{toast.command}
                  </span>
                </>
              )}
              {toast.durationMs !== undefined && (
                <span className="text-[10px] font-mono text-slate-400 bg-surface-subtle px-1.5 py-0.5 rounded-full shrink-0">
                  {toast.durationMs}ms
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
