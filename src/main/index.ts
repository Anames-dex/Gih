import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { spawn } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { GitService } from './gitService'

// Augment PATH on POSIX platforms to ensure git is accessible when launched from GUI environments
if (process.platform === 'darwin' || process.platform === 'linux') {
  const commonBinDirs = ['/usr/local/bin', '/opt/homebrew/bin', '/usr/bin', '/bin']
  const currentPath = process.env.PATH || ''
  const missing = commonBinDirs.filter((p) => !currentPath.includes(p) && fs.existsSync(p))
  if (missing.length > 0) {
    process.env.PATH = `${missing.join(':')}:${currentPath}`
  }
}

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

  const realGitDir = GitService.resolveGitDir(repoPath)
  if (!realGitDir || !fs.existsSync(realGitDir)) return

  try {
    const isRecursiveSupported = process.platform === 'win32' || process.platform === 'darwin'
    const watchCallback = (_: string, filename: string | null) => {
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
    }

    try {
      gitWatcher = fs.watch(realGitDir, isRecursiveSupported ? { recursive: true } : {}, watchCallback)
    } catch {
      // Fall back to non-recursive watch if platform unsupported
      gitWatcher = fs.watch(realGitDir, {}, watchCallback)
    }
  } catch (e) {
    console.warn('Failed to watch .git directory:', e)
  }
}

function createWindow() {
  const possibleIconPaths = [
    path.join(process.env.VITE_PUBLIC || '', 'logo.png'),
    path.join(__dirname, '../public/logo.png'),
    path.join(__dirname, '../GIH_LOGO.png'),
    path.join(process.cwd(), 'public/logo.png'),
    path.join(process.cwd(), 'GIH_LOGO.png'),
  ]
  const iconPath = possibleIconPaths.find((p) => p && fs.existsSync(p))

  win = new BrowserWindow({
    title: 'Gih — Visual Git Shell',
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    icon: iconPath,
    backgroundColor: '#0c0e14',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    titleBarOverlay:
      process.platform === 'darwin'
        ? false
        : {
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

  // Security: prevent rogue in-app navigations
  win.webContents.on('will-navigate', (event, navigationUrl) => {
    if (!url || !navigationUrl.startsWith(url)) {
      event.preventDefault()
    }
  })

  // Security: restrict window opening to external safe URLs
  win.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    try {
      const parsed = new URL(targetUrl)
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        shell.openExternal(targetUrl)
      }
    } catch {
      // ignore invalid URL
    }
    return { action: 'deny' }
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
ipcMain.handle('git:checkInstallation', async () => {
  return await gitService.checkGitInstallation()
})

ipcMain.handle('git:installGit', async (_, method?: string) => {
  const platform = process.platform
  if (platform === 'win32') {
    if (method === 'winget') {
      try {
        const child = spawn(
          'cmd.exe',
          [
            '/c',
            'start',
            'cmd.exe',
            '/k',
            'echo ======================================================== && echo Installing Git via Windows Package Manager (winget)... && echo ======================================================== && winget install --id Git.Git -e --source winget && echo. && echo Git installation completed! && echo You can close this window now and click "Re-check Git Status" in Gih. && pause',
          ],
          { detached: true, stdio: 'ignore' }
        )
        child.unref()
        return { success: true, message: 'Launched Windows Package Manager (winget) in an installation window.' }
      } catch {
        await shell.openExternal('https://git-scm.com/download/win')
        return { success: true, message: 'Opened Git for Windows official download site.' }
      }
    }
    await shell.openExternal('https://git-scm.com/download/win')
    return { success: true, message: 'Opened Git for Windows official download site.' }
  } else if (platform === 'darwin') {
    if (method === 'xcode') {
      try {
        const child = spawn('xcode-select', ['--install'], { detached: true, stdio: 'ignore' })
        child.unref()
        return { success: true, message: 'Triggered Apple Command Line Tools installer dialog.' }
      } catch {
        await shell.openExternal('https://git-scm.com/download/mac')
        return { success: true, message: 'Opened Git for macOS download site.' }
      }
    }
    await shell.openExternal('https://git-scm.com/download/mac')
    return { success: true, message: 'Opened Git for macOS download site.' }
  } else {
    await shell.openExternal('https://git-scm.com/download/linux')
    return { success: true, message: 'Opened Git for Linux download site.' }
  }
})

ipcMain.handle('git:getState', async () => {
  return await gitService.getRepositoryState()
})

ipcMain.handle('git:getAuthorConfig', async () => {
  return await gitService.getAuthorConfig()
})

ipcMain.handle('git:setAuthorConfig', async (_, name: string, email: string, isGlobal?: boolean) => {
  return await gitService.setAuthorConfig(name, email, isGlobal)
})

ipcMain.handle('git:setRepoPath', async (_, repoPath: string) => {
  if (typeof repoPath === 'string' && fs.existsSync(repoPath)) {
    const resolved = path.resolve(repoPath)
    gitService.setRepositoryPath(resolved)
    setupGitWatcher(resolved)
  }
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

ipcMain.handle('git:clone', async (_, url: string, targetPath: string) => {
  return await gitService.cloneRepository(url, targetPath)
})

ipcMain.handle('git:exec', async (_, args: string[]) => {
  if (!Array.isArray(args) || args.some((a) => typeof a !== 'string')) {
    return { stdout: '', stderr: 'Invalid arguments: expected array of strings', exitCode: 1 }
  }
  return await gitService.execGit(args)
})

ipcMain.handle('app:openExternal', async (_, targetUrl: string) => {
  if (typeof targetUrl === 'string') {
    try {
      const parsed = new URL(targetUrl)
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        await shell.openExternal(targetUrl)
      }
    } catch {
      // ignore invalid URL
    }
  }
})

ipcMain.handle('git:getDiff', async (_, filePath: string, staged?: boolean) => {
  return await gitService.getFileDiff(filePath, staged)
})

ipcMain.handle('git:getCommitFiles', async (_, hash: string) => {
  return await gitService.getCommitFiles(hash)
})

ipcMain.handle('git:getRangeDiff', async (_, baseHash: string, headHash: string) => {
  return await gitService.getRangeDiff(baseHash, headHash)
})

ipcMain.handle('git:getCommitFileDiff', async (_, baseHash: string, headHash: string, filePath: string) => {
  return await gitService.getCommitFileDiff(baseHash, headHash, filePath)
})

ipcMain.handle('git:getRemoteInfo', async (_, remoteName?: string) => {
  return await gitService.getRemoteProviderInfo(remoteName)
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

ipcMain.handle('git:resolveConflict', async (_, filePath: string, resolution: 'ours' | 'theirs' | 'mark-resolved') => {
  return await gitService.resolveConflict(filePath, resolution)
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
  return await gitService.checkoutBranch(branchName)
})

ipcMain.handle('git:createBranch', async (_, branchName: string, startPoint?: string) => {
  return await gitService.createBranch(branchName, startPoint)
})

ipcMain.handle('git:deleteBranch', async (_, branchName: string, force?: boolean) => {
  return await gitService.deleteBranch(branchName, force)
})

ipcMain.handle('git:renameBranch', async (_, oldName: string, newName: string) => {
  return await gitService.renameBranch(oldName, newName)
})

ipcMain.handle('git:merge', async (_, branchOrRef: string) => {
  return await gitService.mergeBranch(branchOrRef)
})

ipcMain.handle('git:rebase', async (_, upstream: string) => {
  return await gitService.rebaseBranch(upstream)
})

ipcMain.handle('git:cherryPick', async (_, commitHash: string) => {
  return await gitService.cherryPick(commitHash)
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

ipcMain.handle('git:push', async (_, remoteName?: string, branchName?: string, setUpstream?: boolean, forceWithLease?: boolean) => {
  return await gitService.pushRemote(remoteName, branchName, setUpstream, forceWithLease)
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
