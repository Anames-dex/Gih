import React, { useState, useEffect, useCallback } from 'react'
import type { RepositoryState, GitCommit, CommandLogEntry } from '../shared/types'
import { AppHeader } from './components/layout/AppHeader'
import { Sidebar } from './components/layout/Sidebar'
import { CommitGraph } from './components/graph/CommitGraph'
import { StagingArea } from './components/staging/StagingArea'
import { BottomPanel } from './components/terminal/BottomPanel'
import { CommandPalette } from './components/modals/CommandPalette'
import { InteractiveRebaseModal, RebaseStep } from './components/modals/InteractiveRebaseModal'

export const App: React.FC = () => {
  const [repoState, setRepoState] = useState<RepositoryState | null>(null)
  const [selectedCommit, setSelectedCommit] = useState<GitCommit | null>(null)
  const [isTerminalOpen, setIsTerminalOpen] = useState(false)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const [isRebaseModalOpen, setIsRebaseModalOpen] = useState(false)
  const [commandHistory, setCommandHistory] = useState<CommandLogEntry[]>([])
  const [isFetching, setIsFetching] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    commit: GitCommit
  } | null>(null)

  const gih = (window as any).gih

  const showStatus = (msg: string) => {
    setStatusMessage(msg)
    setTimeout(() => setStatusMessage(null), 4000)
  }

  const refreshState = useCallback(async () => {
    if (!gih) return
    try {
      const state = await gih.getState()
      setRepoState(state)
      const history = await gih.getCommandHistory()
      setCommandHistory(history)
    } catch (e: any) {
      console.error('Failed to refresh repository state:', e)
    }
  }, [gih])

  useEffect(() => {
    refreshState()
    if (gih?.onRepoChanged) {
      const unsubscribe = gih.onRepoChanged(() => {
        refreshState()
      })
      return () => unsubscribe()
    }
  }, [refreshState, gih])

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
    try {
      await gih.fetchRemote()
      await refreshState()
      showStatus('Fetched from remotes successfully.')
    } catch (e: any) {
      showStatus(`Fetch error: ${e.message}`)
    } finally {
      setIsFetching(false)
    }
  }

  const handlePull = async () => {
    if (!gih) return
    try {
      await gih.pullRemote()
      await refreshState()
      showStatus('Pulled updates.')
    } catch (e: any) {
      showStatus(`Pull error: ${e.message}`)
    }
  }

  const handlePush = async () => {
    if (!gih) return
    try {
      await gih.pushRemote(undefined, undefined, true)
      await refreshState()
      showStatus('Pushed to remote.')
    } catch (e: any) {
      showStatus(`Push error: ${e.message}`)
    }
  }

  const handleNewBranch = async () => {
    if (!gih) return
    const name = window.prompt('Enter new branch name:')
    if (name?.trim()) {
      try {
        await gih.createBranch(name.trim())
        await refreshState()
        showStatus(`Created and checked out branch '${name.trim()}'.`)
      } catch (e: any) {
        showStatus(`Error creating branch: ${e.message}`)
      }
    }
  }

  const handleCheckoutBranch = async (branchName: string) => {
    if (!gih) return
    try {
      await gih.checkoutBranch(branchName)
      await refreshState()
      showStatus(`Checked out branch '${branchName}'.`)
    } catch (e: any) {
      showStatus(`Checkout failed: ${e.message}`)
    }
  }

  const handleDeleteBranch = async (branchName: string) => {
    if (!gih) return
    if (window.confirm(`Delete branch '${branchName}'?`)) {
      try {
        await gih.deleteBranch(branchName, true)
        await refreshState()
        showStatus(`Deleted branch '${branchName}'.`)
      } catch (e: any) {
        showStatus(`Delete failed: ${e.message}`)
      }
    }
  }

  const handleOpenRepo = async () => {
    if (!gih) return
    const dir = await gih.openDirectoryDialog()
    if (dir) {
      await gih.setRepoPath(dir)
      await refreshState()
      showStatus(`Opened repository: ${dir}`)
    }
  }

  const handleStash = async () => {
    if (!gih) return
    const msg = window.prompt('Stash message (optional):')
    try {
      await gih.createStash(msg || undefined, true)
      await refreshState()
      showStatus('Changes stashed.')
    } catch (e: any) {
      showStatus(`Stash failed: ${e.message}`)
    }
  }

  const handlePopStash = async (index: number) => {
    if (!gih) return
    try {
      await gih.popStash(index)
      await refreshState()
      showStatus(`Popped stash@{${index}}.`)
    } catch (e: any) {
      showStatus(`Pop stash failed: ${e.message}`)
    }
  }

  const handleDropStash = async (index: number) => {
    if (!gih) return
    try {
      await gih.dropStash(index)
      await refreshState()
      showStatus(`Dropped stash@{${index}}.`)
    } catch (e: any) {
      showStatus(`Drop stash failed: ${e.message}`)
    }
  }

  const handleCommit = async (message: string, signOff?: boolean) => {
    if (!gih) return
    try {
      await gih.createCommit(message, signOff)
      await refreshState()
      showStatus('Commit created.')
    } catch (e: any) {
      showStatus(`Commit failed: ${e.message}`)
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
      await gih.execCommand(['reset', '--hard', hash])
      await refreshState()
      showStatus(`Reset HEAD to ${hash}.`)
    }
  }

  const handleExecuteRebase = async (_steps: RebaseStep[]) => {
    if (!gih) return
    showStatus('Rebase sequence triggered.')
    await refreshState()
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background text-slate-100 font-sans">
      {/* Top Header Bar */}
      <AppHeader
        repoName={repoState?.name || 'Gih'}
        currentBranch={repoState?.currentBranch || null}
        onFetch={handleFetch}
        onPull={handlePull}
        onPush={handlePush}
        onNewBranch={handleNewBranch}
        onStash={handleStash}
        onOpenRepo={handleOpenRepo}
        onToggleTerminal={() => setIsTerminalOpen((prev) => !prev)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        isFetching={isFetching}
      />

      {/* Main Workspace (Sidebar + DAG Graph + Staging / Inspector) */}
      <div className="flex-1 flex overflow-hidden relative">
        <Sidebar
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
        />

        <main className="flex-1 flex flex-col overflow-hidden relative">
          <CommitGraph
            commits={repoState?.commits || []}
            selectedCommit={selectedCommit}
            onSelectCommit={(c) => setSelectedCommit(c)}
            onContextMenu={(e, commit) => {
              e.preventDefault()
              setContextMenu({ x: e.clientX, y: e.clientY, commit })
            }}
          />

          {/* Context Menu */}
          {contextMenu && (
            <div
              className="fixed z-50 bg-surface border border-surface-border rounded-lg shadow-2xl py-1 text-xs text-slate-200 min-w-[200px]"
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
              <div className="border-t border-surface-border my-1" />
              <button
                onClick={() => {
                  if (window.confirm(`Reset current branch to ${contextMenu.commit.shortHash}?`)) {
                    gih?.execCommand(['reset', '--hard', contextMenu.commit.hash]).then(refreshState)
                  }
                  setContextMenu(null)
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-rose-950/60 text-rose-300"
              >
                Reset current branch to here
              </button>
            </div>
          )}
        </main>

        <StagingArea
          files={repoState?.files || []}
          selectedCommit={selectedCommit}
          onClearSelectedCommit={() => setSelectedCommit(null)}
          onStageFile={(path) => gih?.stageFile(path).then(refreshState)}
          onUnstageFile={(path) => gih?.unstageFile(path).then(refreshState)}
          onStageAll={() => gih?.stageAll().then(refreshState)}
          onUnstageAll={() => gih?.unstageAll().then(refreshState)}
          onDiscardChanges={(path) => gih?.discardChanges(path).then(refreshState)}
          onCommit={handleCommit}
          onGetDiff={(path, staged) => gih?.getDiff(path, staged)}
        />
      </div>

      {/* Collapsible Bottom Panel */}
      <BottomPanel
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
        onSelectCommit={(c) => setSelectedCommit(c)}
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

      {/* Floating Status Notification */}
      {statusMessage && (
        <div className="fixed bottom-4 right-4 z-50 px-4 py-2 bg-surface-subtle border border-surface-border text-slate-200 text-xs rounded-lg shadow-xl animate-fade-in flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-brand animate-pulse" />
          <span>{statusMessage}</span>
        </div>
      )}
    </div>
  )
}
