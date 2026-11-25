import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type {
  RepositoryState,
  GitCommit,
  GitStash,
  CommandLogEntry,
  RemoteProviderInfo,
  GitInstallationStatus,
  GitAuthorConfig,
  RecentRepository,
  RemoteProgressEvent
} from '../shared/types'
import { FolderGit2, AlertTriangle, CheckCircle2, XCircle, Clock, ExternalLink, RotateCcw, FileDiff, Tag, Copy, Check, X } from 'lucide-react'
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
import { QuickEditorModal } from './components/modals/QuickEditorModal'
import { GitBlameModal } from './components/modals/GitBlameModal'
import { ApplyPatchModal } from './components/modals/ApplyPatchModal'
import { KeyboardShortcutsModal } from './components/modals/KeyboardShortcutsModal'
import { CreateStashModal } from './components/modals/CreateStashModal'
import { StashInspectorModal } from './components/modals/StashInspectorModal'
import { CreateTagModal } from './components/modals/CreateTagModal'
import { ActionDialogModal, type DialogRequest } from './components/modals/ActionDialogModal'
import { registerDialogListener, showConfirm, showPrompt } from './utils/dialog'
import { useFocusTrap } from './hooks/useFocusTrap'

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
  const [repoFiles, setRepoFiles] = useState<string[]>([])
  const [dialogRequest, setDialogRequest] = useState<DialogRequest | null>(null)
  const [remoteProgress, setRemoteProgress] = useState<RemoteProgressEvent | null>(null)
  const [copiedToastId, setCopiedToastId] = useState<string | null>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    registerDialogListener(setDialogRequest)
    return () => registerDialogListener(null)
  }, [])
  const [hasMoreCommits, setHasMoreCommits] = useState(false)
  const [isLoadingMoreCommits, setIsLoadingMoreCommits] = useState(false)
  const isLoadingMoreRef = useRef(false)
  const [showAllBranches, setShowAllBranches] = useState(true)
  const showAllBranchesRef = useRef(true)
  const [graphFilePathFilter, setGraphFilePathFilter] = useState<string | null>(null)
  const graphFilePathFilterRef = useRef<string | null>(null)
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
  const [activePane, setActivePane] = useState<'sidebar' | 'graph' | 'staging' | 'terminal'>('graph')
  const [isTerminalOpen, setIsTerminalOpen] = useState(false)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const [isRebaseModalOpen, setIsRebaseModalOpen] = useState(false)
  const [rebaseTargetCommit, setRebaseTargetCommit] = useState<GitCommit | null>(null)
  const [resetModalCommit, setResetModalCommit] = useState<GitCommit | null>(null)
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false)
  const [editingFilePath, setEditingFilePath] = useState<string | null>(null)
  const [blameFilePath, setBlameFilePath] = useState<string | null>(null)
  const [isApplyPatchModalOpen, setIsApplyPatchModalOpen] = useState(false)
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false)
  const [isCreateStashModalOpen, setIsCreateStashModalOpen] = useState(false)
  const [inspectingStash, setInspectingStash] = useState<GitStash | null>(null)
  const [isCreateTagModalOpen, setIsCreateTagModalOpen] = useState(false)
  const [createTagTargetCommit, setCreateTagTargetCommit] = useState<GitCommit | null>(null)
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
  const [selectedMenuItemIndex, setSelectedMenuItemIndex] = useState(0)

  useFocusTrap(contextMenuRef, !!contextMenu, () => setContextMenu(null))

  const gih = (window as any).gih

  useEffect(() => {
    if (!gih?.onRemoteProgress) return
    return gih.onRemoteProgress((progress: RemoteProgressEvent) => {
      setRemoteProgress(progress)
    })
  }, [gih])
  const isRefreshingRef = useRef(false)
  const refreshPendingRef = useRef(false)

  const showToast = useCallback((toast: Omit<ToastNotice, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
    setToasts((prev) => [...prev, { ...toast, id }])
    const duration = toast.type === 'error' ? 12000 : 4500
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, duration)
  }, [])

  const refreshState = useCallback(async (allBranches: boolean = showAllBranchesRef.current, filePath: string | null = graphFilePathFilterRef.current) => {
    if (!gih) return
    if (isRefreshingRef.current) {
      refreshPendingRef.current = true
      return
    }
    isRefreshingRef.current = true

    try {
      const state = await gih.getState(allBranches, filePath || undefined)
      setRepoState(state)
      setHasMoreCommits((state?.commits?.length ?? 0) >= 400)
      const history = await gih.getCommandHistory()
      setCommandHistory(history)
      if (gih.getRepoFiles && state?.isGitRepo) {
        const filesList = await gih.getRepoFiles()
        setRepoFiles(Array.isArray(filesList) ? filesList : [])
      } else {
        setRepoFiles([])
      }
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

  const handleLoadMoreCommits = useCallback(async () => {
    if (!gih?.getCommits || isLoadingMoreRef.current || !repoState?.isGitRepo) return
    isLoadingMoreRef.current = true
    setIsLoadingMoreCommits(true)
    try {
      const currentCount = repoState.commits.length
      const nextBatch = await gih.getCommits(
        400,
        showAllBranchesRef.current,
        graphFilePathFilterRef.current || undefined,
        currentCount
      )
      setHasMoreCommits(nextBatch.length >= 400)
      if (nextBatch.length > 0) {
        setRepoState((prev) => {
          if (!prev) return prev
          const seen = new Set(prev.commits.map((c) => c.hash))
          const unique = nextBatch.filter((c) => !seen.has(c.hash))
          return unique.length > 0 ? { ...prev, commits: [...prev.commits, ...unique] } : prev
        })
      }
    } catch (e) {
      console.error('Failed to load older commits:', e)
    } finally {
      isLoadingMoreRef.current = false
      setIsLoadingMoreCommits(false)
    }
  }, [gih, repoState?.isGitRepo, repoState?.commits.length])

  const handleSetGraphFilePathFilter = (filePath: string | null) => {
    graphFilePathFilterRef.current = filePath
    setGraphFilePathFilter(filePath)
    refreshState(showAllBranchesRef.current, filePath)
    if (filePath) {
      showToast({
        type: 'info',
        command: `git log -- ${filePath}`,
        message: `Filtered graph to commits modifying ${filePath}`,
      })
    }
  }

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
      // Don't intercept when user is inside input/textarea unless it is a pane switch shortcut
      const target = e.target as HTMLElement | null
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsCommandPaletteOpen((prev) => !prev)
      } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'j' || e.code === 'Backquote')) {
        e.preventDefault()
        setIsTerminalOpen((prev) => {
          const next = !prev
          if (next) setActivePane('terminal')
          return next
        })
      } else if ((e.ctrlKey || e.metaKey) && e.key === '1') {
        e.preventDefault()
        setActivePane('sidebar')
      } else if ((e.ctrlKey || e.metaKey) && e.key === '2') {
        e.preventDefault()
        setActivePane('graph')
      } else if ((e.ctrlKey || e.metaKey) && e.key === '3') {
        e.preventDefault()
        setActivePane('staging')
      } else if ((e.ctrlKey || e.metaKey) && e.key === '4') {
        e.preventDefault()
        setIsTerminalOpen(true)
        setActivePane('terminal')
      } else if (e.key === 'F6' && !isInput) {
        e.preventDefault()
        const paneOrder: ('sidebar' | 'graph' | 'staging' | 'terminal')[] = isTerminalOpen
          ? ['sidebar', 'graph', 'staging', 'terminal']
          : ['sidebar', 'graph', 'staging']
        setActivePane((curr) => {
          const idx = paneOrder.indexOf(curr)
          if (idx === -1) return 'graph'
          return e.shiftKey
            ? paneOrder[(idx - 1 + paneOrder.length) % paneOrder.length]
            : paneOrder[(idx + 1) % paneOrder.length]
        })
      } else if ((e.key === '?' || e.key === 'F1') && !isInput) {
        e.preventDefault()
        setIsShortcutsModalOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isTerminalOpen])

  // Close context menu on outside click
  useEffect(() => {
    const handleClick = () => setContextMenu(null)
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [])

  // Action Handlers
  const handleAddRemote = async () => {
    if (!gih?.addRemote) return
    const name = await showPrompt({
      title: 'Add Git Remote (Step 1/2)',
      message: 'Enter a name for the remote:',
      defaultValue: 'origin',
      placeholder: 'origin',
      confirmLabel: 'Next',
    })
    if (!name) return
    const url = await showPrompt({
      title: 'Add Git Remote (Step 2/2)',
      message: `Enter the repository URL for remote '${name}':`,
      placeholder: 'https://github.com/username/repo.git',
      confirmLabel: 'Add Remote',
    })
    if (!url) return
    const t0 = performance.now()
    try {
      const res = await gih.addRemote(name, url)
      await refreshState()
      if (res.exitCode !== 0) {
        showToast({
          type: 'error',
          command: `git remote add ${name} ${url}`,
          message: res.stderr || 'Failed to add remote',
        })
      } else {
        showToast({
          type: 'success',
          command: `git remote add ${name} ${url}`,
          message: `Added remote '${name}'`,
          durationMs: Math.round(performance.now() - t0),
        })
      }
    } catch (e: any) {
      showToast({ type: 'error', command: 'git remote add', message: e.message })
    }
  }

  const handleRemoveRemote = async (name: string) => {
    if (!gih?.removeRemote) return
    const ok = await showConfirm({
      title: 'Remove Remote',
      message: `Remove remote '${name}' from this repository?`,
      confirmLabel: 'Remove Remote',
      danger: true,
    })
    if (!ok) return
    const t0 = performance.now()
    try {
      const res = await gih.removeRemote(name)
      await refreshState()
      if (res.exitCode !== 0) {
        showToast({ type: 'error', command: `git remote remove ${name}`, message: res.stderr || 'Failed to remove remote' })
      } else {
        showToast({
          type: 'info',
          command: `git remote remove ${name}`,
          message: `Removed remote '${name}'`,
          durationMs: Math.round(performance.now() - t0),
        })
      }
    } catch (e: any) {
      showToast({ type: 'error', command: 'git remote remove', message: e.message })
    }
  }

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
      setRemoteProgress(null)
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
      setRemoteProgress(null)
    }
  }

  const handlePush = async (forceWithLease: boolean = false) => {
    if (!gih) return
    setIsPushing(true)
    const t0 = performance.now()
    const currentBranch = repoState?.currentBranch || undefined
    const cmdStr = forceWithLease
      ? `git push --force-with-lease${currentBranch ? ` ${currentBranch}` : ''}`
      : `git push -u${currentBranch ? ` ${currentBranch}` : ''}`
    try {
      const res = await gih.pushRemote(
        undefined,
        currentBranch,
        !forceWithLease,
        forceWithLease
      )
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
      setRemoteProgress(null)
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
    const name = await showPrompt({
      title: 'Create Branch',
      message: 'Enter a name for the new branch:',
      placeholder: 'e.g. feat/new-feature',
      confirmLabel: 'Create Branch',
    })
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

  const handlePruneBranches = async () => {
    if (!gih) return
    const confirmed = await showConfirm({
      title: 'Prune Stale Branches',
      message:
        'This runs "git fetch --prune" to remove deleted remote tracking references and safely deletes local branches whose upstream was deleted.',
      confirmLabel: 'Prune Branches',
    })
    if (!confirmed) return
    const t0 = performance.now()
    try {
      const res = await gih.pruneBranches()
      await refreshState()
      const delCount = res.deletedLocalBranches.length
      const errCount = res.errors.length
      showToast({
        type: errCount > 0 ? 'info' : 'success',
        command: 'git fetch --prune && git branch -d',
        message: `Pruned remotes. Deleted ${delCount} stale local branch${delCount === 1 ? '' : 'es'}${errCount > 0 ? ` (${errCount} retained due to unmerged changes)` : ''}.`,
        durationMs: Math.round(performance.now() - t0),
      })
    } catch (e: any) {
      showToast({ type: 'error', command: 'git prune', message: e.message })
    }
  }

  const handleAddWorktree = async () => {
    if (!gih?.addWorktree) return
    const targetPath = await showPrompt({
      title: 'Add Git Worktree (Step 1/2)',
      message: 'Enter the directory path for the new worktree:',
      placeholder: 'e.g. ../my-feature',
      confirmLabel: 'Next',
    })
    if (!targetPath) return
    const branchName = await showPrompt({
      title: 'Add Git Worktree (Step 2/2)',
      message: `Enter the branch to check out in "${targetPath}" (existing or new):`,
      placeholder: 'e.g. feat/my-feature',
      confirmLabel: 'Create Worktree',
    })
    if (!branchName) return
    const t0 = performance.now()
    try {
      const res = await gih.addWorktree(targetPath, branchName)
      await refreshState()
      if (res.exitCode !== 0) {
        showToast({
          type: 'error',
          command: `git worktree add ${targetPath} ${branchName}`,
          message: res.stderr || 'Failed to add worktree',
        })
      } else {
        showToast({
          type: 'success',
          command: `git worktree add ${targetPath} ${branchName}`,
          message: `Created worktree at ${targetPath}`,
          durationMs: Math.round(performance.now() - t0),
        })
      }
    } catch (e: any) {
      showToast({ type: 'error', command: 'git worktree', message: e.message })
    }
  }

  const handleSwitchWorktree = async (wtPath: string) => {
    if (!gih) return
    await gih.setRepoPath(wtPath)
    await refreshState()
    showToast({ type: 'info', message: `Switched workspace to worktree ${wtPath.split(/[/\\]/).pop()}` })
  }

  const handleRemoveWorktree = async (wtPath: string) => {
    if (!gih?.removeWorktree) return
    const confirmed = await showConfirm({
      title: 'Remove Worktree',
      message: `Remove worktree at:\n${wtPath}\n\nThis removes the working tree directory.`,
      confirmLabel: 'Remove Worktree',
      danger: true,
    })
    if (!confirmed) return
    const t0 = performance.now()
    try {
      const res = await gih.removeWorktree(wtPath)
      await refreshState()
      if (res.exitCode !== 0) {
        showToast({
          type: 'error',
          command: `git worktree remove ${wtPath}`,
          message: res.stderr || 'Failed to remove worktree',
        })
      } else {
        showToast({
          type: 'success',
          command: `git worktree remove ${wtPath}`,
          message: `Removed worktree ${wtPath.split(/[/\\]/).pop()}`,
          durationMs: Math.round(performance.now() - t0),
        })
      }
    } catch (e: any) {
      showToast({ type: 'error', command: 'git worktree remove', message: e.message })
    }
  }

  const handleExportPatch = async (commit: GitCommit) => {
    if (!gih?.formatPatch) return
    try {
      const patch = await gih.formatPatch(commit.hash)
      if (!patch.trim()) {
        showToast({ type: 'error', message: 'Failed to generate patch' })
        return
      }
      const safeSubject = (commit.message || 'commit').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30)
      const defaultName = `${commit.shortHash}-${safeSubject}.patch`
      if (gih.savePatchFile) {
        const res = await gih.savePatchFile(defaultName, patch)
        if (res.success && res.filePath) {
          showToast({
            type: 'success',
            command: `git format-patch -1 ${commit.shortHash}`,
            message: `Saved patch to ${res.filePath.split(/[/\\]/).pop()}`,
          })
          return
        }
      }
      await navigator.clipboard.writeText(patch)
      showToast({
        type: 'success',
        command: `git format-patch -1 ${commit.shortHash}`,
        message: 'Copied formatted patch to clipboard',
      })
    } catch (e: any) {
      showToast({ type: 'error', command: 'git format-patch', message: e.message })
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
    if (
      await showConfirm({
        title: 'Delete Branch',
        message: `Delete branch '${branchName}'?`,
        confirmLabel: 'Delete Branch',
        danger: true,
      })
    ) {
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

  const handleRevertCommit = async (commit: GitCommit) => {
    if (!gih) return
    const confirmed = await showConfirm({
      title: 'Revert Commit',
      message: `Revert commit "${commit.message}" (${commit.shortHash})?\n\nThis creates a new commit on the current branch that safely inverts changes introduced by this commit.`,
      confirmLabel: 'Revert Commit',
    })
    if (!confirmed) return
    const t0 = performance.now()
    try {
      const res = await gih.revertCommit(commit.hash)
      await refreshState()
      if (res.exitCode !== 0) {
        showToast({
          type: 'error',
          command: `git revert --no-edit ${commit.shortHash}`,
          message: res.stderr || 'Revert conflict encountered. Resolve conflicts in staging panel.',
        })
      } else {
        showToast({
          type: 'success',
          command: `git revert --no-edit ${commit.shortHash}`,
          message: `Reverted commit ${commit.shortHash} ("${commit.message}")`,
          durationMs: Math.round(performance.now() - t0),
        })
      }
    } catch (e: any) {
      showToast({ type: 'error', command: `git revert`, message: e.message })
    }
  }

  const handleDiscardAll = async () => {
    if (!gih) return
    const confirmed = await showConfirm({
      title: 'Discard All Unstaged Changes',
      message:
        'Are you sure you want to discard ALL unstaged changes?\n\nThis will permanently revert modified tracked files and delete untracked files. This action cannot be undone.',
      confirmLabel: 'Discard All',
      danger: true,
    })
    if (!confirmed) return
    const t0 = performance.now()
    try {
      const res = await gih.discardAllChanges()
      await refreshState()
      if (res.exitCode !== 0) {
        showToast({
          type: 'error',
          command: 'git checkout -- . && git clean -df',
          message: res.stderr || 'Failed to discard all changes.',
        })
      } else {
        showToast({
          type: 'info',
          command: 'git checkout -- . && git clean -df',
          message: 'Discarded all unstaged changes in working tree',
          durationMs: Math.round(performance.now() - t0),
        })
      }
    } catch (e: any) {
      showToast({ type: 'error', command: 'git discard', message: e.message })
    }
  }

  const handleOpenInEditor = async (filePath: string) => {
    if (!gih?.openInEditor) return
    const prefEditor = localStorage.getItem('gih_preferred_editor') || 'vscode'
    try {
      const res = await gih.openInEditor(filePath, prefEditor)
      if (!res.success && res.error) {
        showToast({ type: 'error', message: res.error })
      } else {
        showToast({
          type: 'info',
          message: `Opened ${filePath.split(/[\\/]/).pop()} in editor`,
        })
      }
    } catch (e: any) {
      showToast({ type: 'error', message: e.message })
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

  const handleStash = () => {
    setIsCreateStashModalOpen(true)
  }

  const handleConfirmCreateStash = async (
    message: string,
    includeUntracked: boolean,
    keepIndex: boolean
  ) => {
    if (!gih) return
    setIsStashing(true)
    const t0 = performance.now()
    try {
      await gih.createStash(message || undefined, includeUntracked, keepIndex)
      await refreshState()
      showToast({
        type: 'success',
        command: `git stash push ${includeUntracked ? '-u ' : ''}${keepIndex ? '--keep-index ' : ''}${message ? `-m "${message}"` : ''}`.trim(),
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

  const handleOpenCreateTagModal = (targetCommit?: GitCommit | null) => {
    setCreateTagTargetCommit(targetCommit || null)
    setIsCreateTagModalOpen(true)
  }

  const handleConfirmCreateTag = async (
    name: string,
    message: string,
    targetHash?: string,
    pushImmediately?: boolean
  ) => {
    if (!gih) return
    const t0 = performance.now()
    try {
      await gih.createTag(name, message || undefined, targetHash || undefined)
      let pushMsg = ''
      if (pushImmediately && gih.pushTag) {
        const pushRes = await gih.pushTag(name)
        if (pushRes.exitCode === 0) {
          pushMsg = ' & pushed to origin'
        }
      }
      await refreshState()
      showToast({
        type: 'success',
        command: `git tag ${message ? '-a ' : ''}${name}${targetHash ? ` ${targetHash.slice(0, 7)}` : ''}`,
        message: `Created tag '${name}'${pushMsg}`,
        durationMs: Math.round(performance.now() - t0),
      })
    } catch (e: any) {
      showToast({ type: 'error', command: `git tag ${name}`, message: e.message })
    }
  }

  const handlePushTag = async (tagName: string) => {
    if (!gih?.pushTag) return
    const t0 = performance.now()
    try {
      const res = await gih.pushTag(tagName)
      if (res.exitCode === 0) {
        showToast({
          type: 'success',
          command: `git push origin ${tagName}`,
          message: `Pushed tag '${tagName}' to origin`,
          durationMs: Math.round(performance.now() - t0),
        })
      } else {
        showToast({ type: 'error', command: `git push origin ${tagName}`, message: res.stderr || 'Push failed' })
      }
    } catch (e: any) {
      showToast({ type: 'error', command: `git push origin ${tagName}`, message: e.message })
    }
  }

  const handlePushAllTags = async () => {
    if (!gih?.pushAllTags) return
    const t0 = performance.now()
    try {
      const res = await gih.pushAllTags()
      if (res.exitCode === 0) {
        showToast({
          type: 'success',
          command: `git push origin --tags`,
          message: `Pushed all tags to remote origin`,
          durationMs: Math.round(performance.now() - t0),
        })
      } else {
        showToast({ type: 'error', command: `git push origin --tags`, message: res.stderr || 'Push failed' })
      }
    } catch (e: any) {
      showToast({ type: 'error', command: `git push origin --tags`, message: e.message })
    }
  }

  const handleDeleteTag = async (tagName: string) => {
    if (!gih) return
    if (
      await showConfirm({
        title: 'Delete Tag',
        message: `Delete tag '${tagName}'?`,
        confirmLabel: 'Delete Tag',
        danger: true,
      })
    ) {
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

  const handleUpdateSubmodules = async () => {
    if (!gih?.updateSubmodules) return
    const t0 = performance.now()
    try {
      const res = await gih.updateSubmodules()
      await refreshState()
      if (res.exitCode === 0) {
        showToast({
          type: 'success',
          command: 'git submodule update --init --recursive',
          message: res.stdout || 'Submodules synchronized and updated',
          durationMs: Math.round(performance.now() - t0),
        })
      } else {
        showToast({ type: 'error', command: 'git submodule update', message: res.stderr || 'Update failed' })
      }
    } catch (e: any) {
      showToast({ type: 'error', command: 'git submodule update', message: e.message })
    }
  }

  const handleOpenSubmoduleRepo = async (submoduleRelativePath: string) => {
    if (!gih || !repoState?.path) return
    const fullPath = `${repoState.path}/${submoduleRelativePath}`.replace(/[\\/]+/g, '/')
    await gih.setRepoPath(fullPath)
    await refreshState()
    showToast({
      type: 'info',
      message: `Opened submodule repository at ${submoduleRelativePath}`,
    })
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

  const handleCommit = async (message: string, signOff?: boolean, amend?: boolean, gpgSign?: boolean) => {
    if (!gih) return

    // If author name or email is unset, prompt user with author modal before committing
    if (!authorConfig || !authorConfig.name || !authorConfig.email) {
      setPendingCommitAction(() => () => handleCommit(message, signOff, amend, gpgSign))
      setIsAuthorModalOpen(true)
      return
    }

    const t0 = performance.now()
    try {
      const res = await gih.createCommit(message, signOff, amend, gpgSign)
      if (res.exitCode !== 0) {
        // If git failed specifically due to missing author identity
        if (
          res.stderr.toLowerCase().includes('user.email') ||
          res.stderr.toLowerCase().includes('tell me who you are') ||
          res.stderr.toLowerCase().includes('author identity unknown')
        ) {
          setPendingCommitAction(() => () => handleCommit(message, signOff, amend, gpgSign))
          setIsAuthorModalOpen(true)
          return
        }
        showToast({ type: 'error', command: 'git commit', message: res.stderr || 'Commit failed' })
      } else {
        await refreshState()
        showToast({
          type: 'success',
          command: `git commit ${amend ? '--amend ' : ''}${signOff ? '-s ' : ''}${gpgSign ? '-S ' : ''}-m "${message.slice(0, 20)}..."`.trim(),
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

  const handleStartBisect = async (badHash: string, goodHash?: string) => {
    if (!gih) return
    const t0 = performance.now()
    try {
      const res = await gih.bisectStart(badHash, goodHash)
      await refreshState()
      if (res.exitCode === 0) {
        showToast({
          type: 'success',
          command: `git bisect start ${badHash.slice(0, 7)}${goodHash ? ` ${goodHash.slice(0, 7)}` : ''}`,
          message: res.stdout || 'Bisect session initiated',
          durationMs: Math.round(performance.now() - t0),
        })
      } else {
        showToast({ type: 'error', command: 'git bisect start', message: res.stderr || 'Failed to start bisect' })
      }
    } catch (e: any) {
      showToast({ type: 'error', command: 'git bisect start', message: e.message })
    }
  }

  const handleBisectStep = async (action: 'good' | 'bad' | 'skip') => {
    if (!gih) return
    const t0 = performance.now()
    try {
      const res = await gih.bisectStep(action)
      await refreshState()
      if (res.exitCode === 0) {
        const isFinished = res.stdout.includes('is the first bad commit')
        showToast({
          type: isFinished ? 'success' : 'info',
          command: `git bisect ${action}`,
          message: isFinished ? `Found culprit! ${res.stdout.split('\n')[0]}` : res.stdout.split('\n')[0] || `Marked ${action}`,
          durationMs: Math.round(performance.now() - t0),
        })
      } else {
        showToast({ type: 'error', command: `git bisect ${action}`, message: res.stderr || `Failed to mark ${action}` })
      }
    } catch (e: any) {
      showToast({ type: 'error', command: `git bisect ${action}`, message: e.message })
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
    if (
      !(await showConfirm({
        title: `Abort ${op}`,
        message: `Abort current ${op} operation and discard in-progress steps?`,
        confirmLabel: `Abort ${op}`,
        danger: true,
      }))
    )
      return
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
    if (args.length === 0) return
    const t0 = performance.now()
    const cmdLabel = `git ${args.join(' ')}`
    try {
      const res = await gih.execCommand(args)
      await refreshState()
      if (res && res.exitCode !== 0) {
        showToast({
          type: 'error',
          command: cmdLabel,
          message: res.stderr?.trim() || res.stdout?.trim() || `Command exited with code ${res.exitCode}`,
        })
      } else {
        const out = res?.stdout?.trim() || res?.stderr?.trim()
        showToast({
          type: 'success',
          command: cmdLabel,
          message: out ? out.split('\n')[0] : 'Command completed',
          durationMs: Math.round(performance.now() - t0),
        })
      }
    } catch (e: any) {
      showToast({ type: 'error', command: cmdLabel, message: e?.message || 'Failed to execute command' })
    }
  }

  const handleResetToReflog = async (hash: string) => {
    if (!gih) return
    if (
      await showConfirm({
        title: 'Reset HEAD (Hard)',
        message: `Reset repository HEAD to ${hash.slice(0, 7)}? Uncommitted changes will be lost.`,
        confirmLabel: 'Reset Hard',
        danger: true,
      })
    ) {
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

  const contextMenuItems = useMemo(() => {
    if (!contextMenu) return []
    const items: {
      id: string
      label: string
      icon?: any
      className?: string
      hasDividerBefore?: boolean
      action: () => void
    }[] = [
      {
        id: 'checkout',
        label: 'Checkout this commit',
        action: () => {
          gih?.execCommand(['checkout', contextMenu.commit.hash]).then(refreshState)
          setContextMenu(null)
        },
      },
      {
        id: 'branch',
        label: 'Create branch here...',
        action: async () => {
          const targetHash = contextMenu.commit.hash
          setContextMenu(null)
          const bName = await showPrompt({
            title: 'Create Branch at Commit',
            message: `Create a new branch starting at ${targetHash.slice(0, 7)}:`,
            placeholder: 'e.g. fix/hotfix-branch',
            confirmLabel: 'Create Branch',
          })
          if (bName) {
            gih?.createBranch(bName, targetHash).then(refreshState)
          }
        },
      },
      {
        id: 'create-tag',
        label: 'Create tag here...',
        icon: Tag,
        action: () => {
          handleOpenCreateTagModal(contextMenu.commit)
          setContextMenu(null)
        },
      },
      {
        id: 'cherrypick',
        label: 'Cherry-pick commit',
        action: () => {
          gih?.execCommand(['cherry-pick', contextMenu.commit.hash]).then(refreshState)
          setContextMenu(null)
        },
      },
      {
        id: 'export-patch',
        label: 'Export as .patch...',
        icon: FileDiff,
        className: 'text-emerald-300',
        action: () => {
          handleExportPatch(contextMenu.commit)
          setContextMenu(null)
        },
      },
      {
        id: 'revert',
        label: 'Revert commit (git revert)',
        icon: RotateCcw,
        className: 'text-amber-300',
        action: () => {
          handleRevertCommit(contextMenu.commit)
          setContextMenu(null)
        },
      },
      {
        id: 'rebase',
        label: 'Interactive rebase onto here...',
        className: 'text-brand',
        action: () => {
          setRebaseTargetCommit(contextMenu.commit)
          setIsRebaseModalOpen(true)
          setContextMenu(null)
        },
      },
    ]

    if (remoteInfo) {
      items.push({
        id: 'view-remote',
        label: `View on ${remoteInfo.name}`,
        icon: ExternalLink,
        className: 'text-sky-400 capitalize',
        hasDividerBefore: true,
        action: () => {
          const url = remoteInfo.commitUrlTemplate.replace('{hash}', contextMenu.commit.hash)
          gih?.openExternal(url)
          setContextMenu(null)
        },
      })
      if (repoState?.currentBranch) {
        items.push({
          id: 'create-pr',
          label: 'Create Pull Request',
          icon: ExternalLink,
          className: 'text-indigo-400',
          action: () => {
            const prUrl = remoteInfo.prUrlTemplate.replace('{branch}', encodeURIComponent(repoState.currentBranch || ''))
            gih?.openExternal(prUrl)
            setContextMenu(null)
          },
        })
      }
    }

    items.push({
      id: 'reset',
      label: 'Reset branch to here...',
      className: 'text-rose-300 hover:bg-rose-950/60',
      hasDividerBefore: true,
      action: () => {
        setResetModalCommit(contextMenu.commit)
        setContextMenu(null)
      },
    })

    // Bisect actions
    if (repoState?.operation?.type === 'bisect') {
      items.push(
        {
          id: 'bisect-bad',
          label: 'Bisect: Mark as Bad (bug present)',
          hasDividerBefore: true,
          className: 'text-rose-400 font-medium',
          action: () => {
            handleBisectStep('bad')
            setContextMenu(null)
          },
        },
        {
          id: 'bisect-good',
          label: 'Bisect: Mark as Good (bug absent)',
          className: 'text-emerald-400 font-medium',
          action: () => {
            handleBisectStep('good')
            setContextMenu(null)
          },
        },
        {
          id: 'bisect-skip',
          label: 'Bisect: Skip this commit',
          className: 'text-slate-300',
          action: () => {
            handleBisectStep('skip')
            setContextMenu(null)
          },
        }
      )
    } else {
      if (selectedCommits.length === 2) {
        items.push({
          id: 'bisect-start-range',
          label: `Start Git Bisect (${selectedCommits[0].shortHash} bad, ${selectedCommits[1].shortHash} good)`,
          hasDividerBefore: true,
          className: 'text-amber-400 font-medium',
          action: () => {
            handleStartBisect(selectedCommits[0].hash, selectedCommits[1].hash)
            setContextMenu(null)
          },
        })
      } else {
        items.push({
          id: 'bisect-start-bad',
          label: 'Start Git Bisect (mark as Bad / Culprit)',
          hasDividerBefore: true,
          className: 'text-amber-400 font-medium',
          action: () => {
            handleStartBisect(contextMenu.commit.hash)
            setContextMenu(null)
          },
        })
      }
    }

    return items
  }, [
    contextMenu,
    gih,
    refreshState,
    handleExportPatch,
    handleRevertCommit,
    remoteInfo,
    repoState?.currentBranch,
    repoState?.operation?.type,
    selectedCommits,
    handleStartBisect,
    handleBisectStep,
  ])

  useEffect(() => {
    setSelectedMenuItemIndex(0)
  }, [contextMenu])

  useEffect(() => {
    if (!contextMenu || contextMenuItems.length === 0) return
    const handleMenuKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedMenuItemIndex((prev) => (prev + 1) % contextMenuItems.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedMenuItemIndex((prev) => (prev - 1 + contextMenuItems.length) % contextMenuItems.length)
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        const target = contextMenuItems[selectedMenuItemIndex]
        target?.action()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setContextMenu(null)
      }
    }
    window.addEventListener('keydown', handleMenuKeyDown)
    return () => window.removeEventListener('keydown', handleMenuKeyDown)
  }, [contextMenu, contextMenuItems, selectedMenuItemIndex])

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background text-slate-100 font-sans">
      {/* Top Header Bar */}
      <AppHeader
        repoName={repoState?.name || 'Gih'}
        currentBranch={repoState?.currentBranch || null}
        branches={repoState?.branches || []}
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
        onCheckoutBranch={handleCheckoutBranch}
        onNewBranch={handleNewBranch}
        onStash={handleStash}
        onOpenRepo={handleOpenRepo}
        onCloneRepo={() => setIsCloneModalOpen(true)}
        onToggleTerminal={() => setIsTerminalOpen((prev) => !prev)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenShortcuts={() => setIsShortcutsModalOpen(true)}
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
            {repoState.operation.type === 'bisect' ? (
              <>
                <button
                  onClick={() => handleBisectStep('bad')}
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded text-xs transition-colors shadow-sm"
                  title="Mark current tested commit as Bad (contains the bug)"
                >
                  Mark Bad
                </button>
                <button
                  onClick={() => handleBisectStep('good')}
                  className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded text-xs transition-colors shadow-sm"
                  title="Mark current tested commit as Good (does not contain bug)"
                >
                  Mark Good
                </button>
                <button
                  onClick={() => handleBisectStep('skip')}
                  className="px-2.5 py-1 bg-surface-subtle hover:bg-surface-hover border border-surface-border text-slate-200 font-medium rounded text-xs transition-colors"
                  title="Skip current commit (untestable)"
                >
                  Skip
                </button>
                <button
                  onClick={handleAbortOperation}
                  className="px-2.5 py-1 bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/50 text-rose-300 font-medium rounded text-xs transition-colors"
                  title="Reset and finish Git bisect session"
                >
                  Reset / Abort
                </button>
              </>
            ) : (
              <>
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
              </>
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
          <div
            className={`h-full flex shrink-0 relative transition-all ${
              activePane === 'sidebar' ? 'ring-1 ring-inset ring-sky-500/50' : ''
            }`}
            onMouseDown={() => setActivePane('sidebar')}
          >
            <Sidebar
              width={sidebarWidth}
              branches={repoState?.branches || []}
              remotes={repoState?.remotes || []}
              tags={repoState?.tags || []}
              stashes={repoState?.stashes || []}
              worktrees={repoState?.worktrees || []}
              submodules={repoState?.submodules || []}
              currentBranch={repoState?.currentBranch || null}
              onCheckoutBranch={handleCheckoutBranch}
              onCreateBranch={handleNewBranch}
              onDeleteBranch={handleDeleteBranch}
              onApplyStash={(idx) => gih?.applyStash(idx).then(refreshState)}
              onPopStash={handlePopStash}
              onDropStash={handleDropStash}
              onInspectStash={(stash) => setInspectingStash(stash)}
              onCreateTag={() => handleOpenCreateTagModal()}
              onDeleteTag={handleDeleteTag}
              onPushTag={handlePushTag}
              onPushAllTags={handlePushAllTags}
              onBranchFromStash={handleBranchFromStash}
              onRenameBranch={handleRenameBranch}
              onPruneBranches={handlePruneBranches}
              onUpdateSubmodules={handleUpdateSubmodules}
              onOpenSubmoduleRepo={handleOpenSubmoduleRepo}
              currentRepoPath={repoState?.path}
              onAddWorktree={handleAddWorktree}
              onSwitchWorktree={handleSwitchWorktree}
              onRemoveWorktree={handleRemoveWorktree}
              onAddRemote={handleAddRemote}
              onRemoveRemote={handleRemoveRemote}
              repoFiles={repoFiles}
              onOpenFileInEditor={(fp) => setEditingFilePath(fp)}
              isActivePane={activePane === 'sidebar'}
            />
          </div>

          {/* Drag Splitter: Sidebar -> Graph */}
          <div
            onMouseDown={() => {
              isDraggingSidebar.current = true
              document.body.style.cursor = 'col-resize'
            }}
            className="w-1 hover:w-1.5 z-20 cursor-col-resize hover:bg-brand active:bg-brand transition-colors bg-surface-border/60 select-none shrink-0"
            title="Drag to resize sidebar"
          />

          <main
            className={`flex-1 flex flex-col overflow-hidden relative transition-all ${
              activePane === 'graph' ? 'ring-1 ring-inset ring-sky-500/50' : ''
            }`}
            onMouseDown={() => setActivePane('graph')}
          >
            <CommitGraph
              commits={repoState?.commits || []}
              selectedCommits={selectedCommits}
              showAllBranches={showAllBranches}
              onToggleShowAllBranches={(all) => {
                showAllBranchesRef.current = all
                setShowAllBranches(all)
                refreshState(all)
              }}
              onSelectCommit={handleSelectCommit}
              onClearSelection={handleClearSelectedCommits}
              onContextMenu={(e, commit) => {
                e.preventDefault()
                setContextMenu({ x: e.clientX, y: e.clientY, commit })
              }}
              onMergeBranch={handleMergeBranch}
              onRebaseBranch={handleRebaseBranch}
              onCherryPick={handleCherryPick}
              isActivePane={activePane === 'graph'}
              filePathFilter={graphFilePathFilter}
              onClearFilePathFilter={() => handleSetGraphFilePathFilter(null)}
              hasMoreCommits={hasMoreCommits}
              isLoadingMore={isLoadingMoreCommits}
              onLoadMoreCommits={handleLoadMoreCommits}
            />

            {/* Context Menu */}
            {contextMenu && (
              <div
                ref={contextMenuRef}
                role="menu"
                tabIndex={-1}
                className="fixed z-50 bg-surface border border-surface-border rounded-lg shadow-2xl py-1 text-xs text-slate-200 min-w-[220px] outline-none"
                style={{
                  top: `${Math.min(window.innerHeight - 340, Math.max(10, contextMenu.y))}px`,
                  left: `${Math.min(window.innerWidth - 240, Math.max(10, contextMenu.x))}px`,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-3 py-1 text-[10px] text-slate-500 font-mono border-b border-surface-border flex items-center justify-between">
                  <span>{contextMenu.commit.shortHash}</span>
                  <span className="text-[9px] text-slate-600 font-sans">↑/↓ Enter Esc</span>
                </div>
                {contextMenuItems.map((item, idx) => (
                  <React.Fragment key={item.id}>
                    {item.hasDividerBefore && <div className="border-t border-surface-border my-1" />}
                    <button
                      type="button"
                      tabIndex={0}
                      onClick={item.action}
                      onMouseEnter={() => setSelectedMenuItemIndex(idx)}
                      className={`w-full text-left px-3 py-1.5 transition-colors flex items-center justify-between text-xs outline-none ${
                        idx === selectedMenuItemIndex
                          ? 'bg-surface-hover text-white ring-1 ring-inset ring-sky-400/50'
                          : 'text-slate-200'
                      } ${item.className || ''}`}
                    >
                      <span>{item.label}</span>
                      {item.icon && <item.icon className="w-3 h-3 ml-2 shrink-0" />}
                    </button>
                  </React.Fragment>
                ))}
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

          <div
            className={`h-full flex shrink-0 relative transition-all ${
              activePane === 'staging' ? 'ring-1 ring-inset ring-sky-500/50' : ''
            }`}
            onMouseDown={() => setActivePane('staging')}
          >
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
              onDiscardAll={handleDiscardAll}
              onOpenInEditor={handleOpenInEditor}
              onQuickEditFile={(path) => setEditingFilePath(path)}
              onBlameFile={(path) => setBlameFilePath(path)}
              onFilterGraphByFile={handleSetGraphFilePathFilter}
              onIgnorePattern={async (pattern) => {
                if (!gih?.addToGitIgnore) return
                const res = await gih.addToGitIgnore(pattern)
                if (res.success) {
                  showToast({
                    type: 'success',
                    command: `echo ${pattern} >> .gitignore`,
                    message: `Added '${pattern}' to .gitignore`,
                  })
                  refreshState()
                } else {
                  showToast({ type: 'error', message: res.error || 'Failed to update .gitignore' })
                }
              }}
              onCommit={handleCommit}
              onGetDiff={(path, staged) => gih?.getDiff(path, staged)}
              onGetCommitFiles={(hash) => gih?.getCommitFiles(hash)}
              onGetRangeDiff={(base, head) => gih?.getRangeDiff(base, head)}
              onGetCommitFileDiff={(base, head, path) => gih?.getCommitFileDiff(base, head, path)}
              onApplyHunkPatch={handleApplyHunkPatch}
              onResolveConflict={handleResolveConflict}
              headCommit={repoState?.commits.find((c) => c.isHead) || repoState?.commits[0] || null}
              isActivePane={activePane === 'staging'}
            />
          </div>
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
      <div
        className={`relative transition-all ${
          activePane === 'terminal' ? 'ring-1 ring-inset ring-sky-500/50' : ''
        }`}
        onMouseDown={() => setActivePane('terminal')}
      >
        <BottomPanel
          height={bottomHeight}
          isOpen={isTerminalOpen}
          onClose={() => setIsTerminalOpen(false)}
          commandHistory={commandHistory}
          onExecCommand={handleExecCommand}
          onGetReflog={() => gih?.getReflog(50) || Promise.resolve([])}
          onResetToReflog={handleResetToReflog}
          isActivePane={activePane === 'terminal'}
        />
      </div>

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
        onAction={async (id) => {
          if (id === 'fetch') handleFetch()
          if (id === 'pull') handlePull()
          if (id === 'push') handlePush()
          if (id === 'stash') handleStash()
          if (id === 'apply-patch') setIsApplyPatchModalOpen(true)
          if (id === 'author-identity') setIsAuthorModalOpen(true)
          if (id === 'context-menu') {
            if (gih?.isExplorerContextMenuRegistered && gih?.toggleExplorerContextMenu) {
              const isRegistered = await gih.isExplorerContextMenuRegistered()
              const res = await gih.toggleExplorerContextMenu(!isRegistered)
              if (res.success) {
                showToast({
                  type: 'success',
                  message: res.enabled
                    ? 'Added "Open with Gih" to Windows Explorer right-click menu'
                    : 'Removed "Open with Gih" from Windows Explorer right-click menu',
                })
              } else {
                showToast({ type: 'error', message: res.error || 'Failed to update Explorer menu' })
              }
            } else {
              showToast({ type: 'info', message: 'Context menu integration is only available on Windows' })
            }
          }
          if (id === 'terminal') setIsTerminalOpen((p) => !p)
        }}
      />

      <InteractiveRebaseModal
        isOpen={isRebaseModalOpen}
        onClose={() => {
          setIsRebaseModalOpen(false)
          setRebaseTargetCommit(null)
        }}
        commits={(() => {
          const all = repoState?.commits || []
          if (!rebaseTargetCommit) return all.slice(0, 20)
          const idx = all.findIndex((c) => c.hash === rebaseTargetCommit.hash)
          return idx > 0 ? all.slice(0, idx) : all.slice(0, 20)
        })()}
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

      {editingFilePath && (
        <QuickEditorModal
          filePath={editingFilePath}
          onClose={() => setEditingFilePath(null)}
          onSaved={() => {
            refreshState()
            showToast({
              type: 'success',
              message: `Saved changes to ${editingFilePath.split(/[\\/]/).pop()}`,
            })
          }}
        />
      )}

      {blameFilePath && (
        <GitBlameModal
          filePath={blameFilePath}
          onClose={() => setBlameFilePath(null)}
          onOpenInEditor={handleOpenInEditor}
          onSelectCommitHash={(hash) => {
            const commit = repoState?.commits.find((c) => c.hash === hash)
            if (commit) {
              setSelectedCommits([commit])
              setBlameFilePath(null)
              showToast({
                type: 'info',
                message: `Focused commit ${commit.shortHash} in graph`,
              })
            }
          }}
        />
      )}

      <ApplyPatchModal
        isOpen={isApplyPatchModalOpen}
        onClose={() => setIsApplyPatchModalOpen(false)}
        onPatchApplied={() => {
          refreshState()
          showToast({
            type: 'success',
            message: 'Applied patch to working tree',
          })
        }}
      />

      <KeyboardShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />

      <CreateStashModal
        isOpen={isCreateStashModalOpen}
        onClose={() => setIsCreateStashModalOpen(false)}
        onConfirm={handleConfirmCreateStash}
      />

      <StashInspectorModal
        stash={inspectingStash}
        onClose={() => setInspectingStash(null)}
        onApply={async (idx) => {
          if (gih) {
            await gih.applyStash(idx)
            await refreshState()
            showToast({ type: 'success', message: `Applied stash@{${idx}}` })
          }
        }}
        onPop={async (idx) => {
          if (gih) {
            await gih.popStash(idx)
            await refreshState()
            showToast({ type: 'success', message: `Popped stash@{${idx}}` })
          }
        }}
        onDrop={async (idx) => {
          if (gih) {
            await gih.dropStash(idx)
            await refreshState()
            showToast({ type: 'info', message: `Dropped stash@{${idx}}` })
          }
        }}
        onBranch={async (bName, idx) => {
          if (gih) {
            await gih.branchFromStash(bName, idx)
            await refreshState()
            showToast({ type: 'success', message: `Created branch ${bName} from stash@{${idx}}` })
          }
        }}
        onGetStashDiff={(idx) => gih?.getStashDiff(idx) || Promise.resolve('')}
      />

      <CreateTagModal
        isOpen={isCreateTagModalOpen}
        targetCommit={createTagTargetCommit}
        onClose={() => {
          setIsCreateTagModalOpen(false)
          setCreateTagTargetCommit(null)
        }}
        onConfirm={handleConfirmCreateTag}
      />

      {/* Top-Center Command Feedback Island */}
      <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-1.5 pointer-events-none max-w-xl w-full px-4">
        {remoteProgress && (
          <div className="pointer-events-auto px-4 py-2 rounded-full border border-sky-500/40 bg-[#0d1726]/95 text-sky-100 shadow-2xl backdrop-blur-md flex items-center gap-3 animate-fade-in max-w-full">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping shrink-0" />
            <span className="text-xs font-semibold capitalize">{remoteProgress.operation}:</span>
            <span className="text-xs text-sky-200 truncate max-w-[200px]">{remoteProgress.phase}</span>
            {remoteProgress.percent !== null && (
              <span className="text-[11px] font-mono bg-sky-500/20 px-1.5 py-0.5 rounded text-sky-300 font-semibold">
                {remoteProgress.percent}%
              </span>
            )}
          </div>
        )}
        {toasts.map((toast) => {
          const isError = toast.type === 'error'
          const copyPayload = toast.command ? `${toast.command}\n${toast.message}` : toast.message
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto border shadow-2xl backdrop-blur-md flex gap-3 animate-fade-in transition-all max-w-full ${
                isError
                  ? 'w-full px-3.5 py-2.5 rounded-xl items-start bg-[#1e1014]/95 border-rose-800/80 text-rose-100 shadow-rose-950/40'
                  : toast.type === 'info'
                  ? 'px-4 py-2 rounded-full items-center bg-surface/95 border-surface-border text-slate-100'
                  : 'px-4 py-2 rounded-full items-center bg-[#0f1923]/95 border-emerald-500/40 text-slate-100 shadow-emerald-950/30'
              }`}
            >
              {isError ? (
                <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              )}

              <div className={`min-w-0 flex-1 ${isError ? 'space-y-1' : 'flex items-center gap-2'}`}>
                <div
                  className={
                    isError
                      ? 'text-xs font-medium whitespace-pre-wrap break-words select-text max-h-32 overflow-y-auto pr-1 font-mono leading-relaxed'
                      : 'text-xs font-semibold truncate'
                  }
                >
                  {toast.message}
                </div>
                {toast.command && (
                  <div className="flex items-center gap-2 min-w-0">
                    {!isError && <span className="text-slate-600 text-xs">•</span>}
                    <span className="text-[11px] font-mono text-sky-400 truncate max-w-[280px] select-text">
                      ${toast.command.startsWith(' ') ? '' : ' '}{toast.command}
                    </span>
                  </div>
                )}
              </div>

              {toast.durationMs !== undefined && !isError && (
                <span className="text-[10px] font-mono text-slate-400 bg-surface-subtle px-1.5 py-0.5 rounded-full shrink-0">
                  {toast.durationMs}ms
                </span>
              )}

              {isError && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(copyPayload)
                      setCopiedToastId(toast.id)
                      setTimeout(() => setCopiedToastId((cur) => (cur === toast.id ? null : cur)), 1500)
                    }}
                    className="p-1 rounded hover:bg-rose-900/50 text-rose-300 hover:text-white transition-colors"
                    title="Copy error message"
                  >
                    {copiedToastId === toast.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                    className="p-1 rounded hover:bg-rose-900/50 text-rose-300 hover:text-white transition-colors"
                    title="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <ActionDialogModal
        request={dialogRequest}
        onClose={() => setDialogRequest(null)}
      />
    </div>
  )
}
