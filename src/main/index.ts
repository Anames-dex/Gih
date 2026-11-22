import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { GitService } from './gitService'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged
  ? process.env.DIST
  : path.join(process.env.DIST, '../public')

let win: BrowserWindow | null = null
const preload = path.join(__dirname, 'preload.mjs')
const url = process.env.VITE_DEV_SERVER_URL
const indexHtml = path.join(process.env.DIST, 'index.html')

const gitService = new GitService(process.cwd())
let gitWatcher: fs.FSWatcher | null = null
let watcherDebounceTimer: NodeJS.Timeout | null = null

function setupGitWatcher(repoPath: string) {
  if (gitWatcher) {
    try {
      gitWatcher.close()
    } catch {
      // ignore
    }
    gitWatcher = null
  }

  const gitDir = path.join(repoPath, '.git')
  if (fs.existsSync(gitDir)) {
    try {
      gitWatcher = fs.watch(gitDir, { recursive: true }, (_, filename) => {
        // Filter out noisy internal git temporary / lock files
        if (filename) {
          const lower = filename.toLowerCase()
          if (
            lower.endsWith('.lock') ||
            lower.includes('commit_editmsg') ||
            lower.includes('orig_head') ||
            lower.includes('fetch_head')
          ) {
            return
          }
        }

        // Debounce by 350ms and do not notify if Gih itself is executing a git command
        if (watcherDebounceTimer) {
          clearTimeout(watcherDebounceTimer)
        }
        watcherDebounceTimer = setTimeout(() => {
          if (win && !win.isDestroyed() && !gitService.isExecuting()) {
            win.webContents.send('git:changed')
          }
        }, 350)
      })
    } catch (e) {
      console.warn('Failed to watch .git directory:', e)
    }
  }
}

function createWindow() {
  const iconPath = path.join(process.cwd(), 'GIH_LOGO.png')

  win = new BrowserWindow({
    title: 'Gih — Visual Git Shell',
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    backgroundColor: '#0c0e14',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0c0e14',
      symbolColor: '#94a3b8',
      height: 38,
    },
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  setupGitWatcher(gitService.getRepositoryPath())

  if (url) {
    win.loadURL(url)
  } else {
    win.loadFile(indexHtml)
  }
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// IPC Handlers
ipcMain.handle('git:getState', async () => {
  return await gitService.getRepositoryState()
})

ipcMain.handle('git:setRepoPath', async (_, repoPath: string) => {
  gitService.setRepositoryPath(repoPath)
  setupGitWatcher(repoPath)
  return await gitService.getRepositoryState()
})

ipcMain.handle('git:init', async (_, branchName?: string) => {
  const result = await gitService.initRepository(branchName)
  setupGitWatcher(gitService.getRepositoryPath())
  return result
})

ipcMain.handle('app:openDirectoryDialog', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Select Git Repository',
  })
  if (result.canceled || result.filePaths.length === 0) {
    return null
  }
  return result.filePaths[0]
})

ipcMain.handle('git:exec', async (_, args: string[]) => {
  return await gitService.execGit(args)
})

ipcMain.handle('git:getDiff', async (_, filePath: string, staged?: boolean) => {
  return await gitService.getFileDiff(filePath, staged)
})

ipcMain.handle('git:getReflog', async (_, count?: number) => {
  return await gitService.getReflog(count)
})

ipcMain.handle('git:getCommandHistory', async () => {
  return gitService.getCommandHistory()
})

ipcMain.handle('git:stageFile', async (_, filePath: string) => {
  await gitService.execGit(['add', '--', filePath])
})

ipcMain.handle('git:unstageFile', async (_, filePath: string) => {
  await gitService.execGit(['restore', '--staged', '--', filePath])
})

ipcMain.handle('git:stageAll', async () => {
  await gitService.execGit(['add', '-A'])
})

ipcMain.handle('git:unstageAll', async () => {
  await gitService.execGit(['reset', 'HEAD'])
})

ipcMain.handle('git:discardChanges', async (_, filePath: string) => {
  await gitService.execGit(['restore', '--', filePath])
})

ipcMain.handle('git:applyPatch', async (_, patch: string, options?: { cached?: boolean; reverse?: boolean }) => {
  return await gitService.applyPatch(patch, options)
})

ipcMain.handle('git:createCommit', async (_, message: string, signOff?: boolean, amend?: boolean) => {
  return await gitService.createCommit(message, signOff, amend)
})

ipcMain.handle('git:resetBranch', async (_, targetHash: string, mode: 'soft' | 'mixed' | 'hard') => {
  return await gitService.resetBranch(targetHash, mode)
})

ipcMain.handle('git:checkoutBranch', async (_, branchName: string) => {
  await gitService.execGit(['checkout', branchName])
})

ipcMain.handle('git:createBranch', async (_, branchName: string, startPoint?: string) => {
  const args = ['checkout', '-b', branchName]
  if (startPoint) args.push(startPoint)
  await gitService.execGit(args)
})

ipcMain.handle('git:deleteBranch', async (_, branchName: string, force?: boolean) => {
  const flag = force ? '-D' : '-d'
  await gitService.execGit(['branch', flag, branchName])
})

ipcMain.handle('git:fetch', async (_, remoteName?: string) => {
  const args = ['fetch', '--prune']
  if (remoteName) args.push(remoteName)
  await gitService.execGit(args)
})

ipcMain.handle('git:pull', async (_, remoteName?: string, branchName?: string) => {
  const args = ['pull']
  if (remoteName) args.push(remoteName)
  if (branchName) args.push(branchName)
  await gitService.execGit(args)
})

ipcMain.handle('git:push', async (_, remoteName?: string, branchName?: string, setUpstream?: boolean) => {
  const args = ['push']
  if (setUpstream) args.push('-u')
  if (remoteName) args.push(remoteName)
  if (branchName) args.push(branchName)
  await gitService.execGit(args)
})

ipcMain.handle('git:createStash', async (_, message?: string, includeUntracked?: boolean) => {
  const args = ['stash', 'push']
  if (includeUntracked) args.push('-u')
  if (message) args.push('-m', message)
  await gitService.execGit(args)
})

ipcMain.handle('git:popStash', async (_, index: number = 0) => {
  await gitService.execGit(['stash', 'pop', `stash@{${index}}`])
})

ipcMain.handle('git:applyStash', async (_, index: number = 0) => {
  await gitService.execGit(['stash', 'apply', `stash@{${index}}`])
})

ipcMain.handle('git:dropStash', async (_, index: number = 0) => {
  await gitService.execGit(['stash', 'drop', `stash@{${index}}`])
})

ipcMain.handle('git:branchFromStash', async (_, branchName: string, index: number = 0) => {
  await gitService.branchFromStash(branchName, index)
})

ipcMain.handle('git:getStashDiff', async (_, index: number = 0) => {
  return await gitService.getStashDiff(index)
})

ipcMain.handle('git:createTag', async (_, name: string, message?: string, targetHash?: string) => {
  await gitService.createTag(name, message, targetHash)
})

ipcMain.handle('git:deleteTag', async (_, name: string) => {
  await gitService.deleteTag(name)
})

ipcMain.handle('git:continueOperation', async (_, type: any) => {
  return await gitService.continueOperation(type)
})

ipcMain.handle('git:abortOperation', async (_, type: any) => {
  return await gitService.abortOperation(type)
})

ipcMain.handle('git:skipOperation', async (_, type: any) => {
  return await gitService.skipOperation(type)
})
