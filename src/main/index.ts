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

function parseLaunchDirectory(args: string[]): string | null {
  const relevantArgs = args.slice(app.isPackaged ? 1 : 2)
  for (const arg of relevantArgs) {
    if (arg && !arg.startsWith('-') && !arg.startsWith('--')) {
      const candidate = path.resolve(arg)
      if (fs.existsSync(candidate)) {
        try {
          const stat = fs.statSync(candidate)
          if (stat.isDirectory()) {
            return candidate
          }
          if (stat.isFile()) {
            return path.dirname(candidate)
          }
        } catch {
          // ignore invalid paths
        }
      }
    }
  }
  return null
}

let win: BrowserWindow | null = null
const preload = path.join(__dirname, 'preload.mjs')
const url = process.env.VITE_DEV_SERVER_URL
const indexHtml = path.join(process.env.DIST, 'index.html')

const initialRepoPath = parseLaunchDirectory(process.argv) || process.cwd()
const gitService = new GitService(initialRepoPath)
let gitWatcher: fs.FSWatcher | null = null
let worktreeWatcher: fs.FSWatcher | null = null
let watcherDebounceTimer: NodeJS.Timeout | null = null

function triggerRepoChangedDebounced() {
  if (watcherDebounceTimer) {
    clearTimeout(watcherDebounceTimer)
  }
  watcherDebounceTimer = setTimeout(() => {
    if (win && !win.isDestroyed() && !gitService.isExecuting()) {
      win.webContents.send('git:changed')
    }
  }, 350)
}

function setupGitWatcher(repoPath: string) {
  if (gitWatcher) {
    try {
      gitWatcher.close()
    } catch {
      // ignore
    }
    gitWatcher = null
  }
  if (worktreeWatcher) {
    try {
      worktreeWatcher.close()
    } catch {
      // ignore
    }
    worktreeWatcher = null
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

      triggerRepoChangedDebounced()
    }

    try {
      gitWatcher = fs.watch(realGitDir, isRecursiveSupported ? { recursive: true } : {}, watchCallback)
    } catch {
      // Fall back to non-recursive watch if platform unsupported
      gitWatcher = fs.watch(realGitDir, {}, watchCallback)
    }

    // Watch working tree directory so newly created, edited, or deleted files appear immediately
    const worktreeCallback = (_: string, filename: string | null) => {
      if (filename) {
        const normalized = filename.replace(/\\/g, '/').toLowerCase()
        if (
          normalized === '.git' ||
          normalized.startsWith('.git/') ||
          normalized.startsWith('node_modules/') ||
          normalized.startsWith('dist/') ||
          normalized.startsWith('dist-electron/') ||
          normalized.startsWith('release/')
        ) {
          return
        }
      }
      triggerRepoChangedDebounced()
    }

    try {
      worktreeWatcher = fs.watch(repoPath, isRecursiveSupported ? { recursive: true } : {}, worktreeCallback)
    } catch {
      worktreeWatcher = fs.watch(repoPath, {}, worktreeCallback)
    }
  } catch (e) {
    console.warn('Failed to watch repository directory:', e)
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

  win.on('focus', () => {
    if (GitService.resolveGitDir(gitService.getRepositoryPath())) {
      triggerRepoChangedDebounced()
    }
  })

  if (url) {
    win.loadURL(url)
  } else {
    win.loadFile(indexHtml)
  }
}

const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', (_, commandLine) => {
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()

      const targetDir = parseLaunchDirectory(commandLine)
      if (targetDir) {
        gitService.setRepositoryPath(targetDir)
        setupGitWatcher(targetDir)
        win.webContents.send('git:changed')
      }
    }
  })

  app.whenReady().then(() => {
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      }
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// IPC Handlers
ipcMain.handle('app:toggleExplorerContextMenu', async (_, enable: boolean) => {
  if (process.platform !== 'win32') {
    return { success: false, error: 'Context menu integration is only applicable on Windows' }
  }
  const exePath = app.getPath('exe')

  return new Promise((resolve) => {
    if (enable) {
      // Add "Open with Gih" for directories and directory backgrounds in HKCU (no admin required)
      const cmd = `reg add "HKCU\\Software\\Classes\\Directory\\shell\\Gih" /ve /d "Open with Gih" /f && reg add "HKCU\\Software\\Classes\\Directory\\shell\\Gih" /v "Icon" /d "\\"${exePath}\\"" /f && reg add "HKCU\\Software\\Classes\\Directory\\shell\\Gih\\command" /ve /d "\\"${exePath}\\" \\"%V\\"" /f && reg add "HKCU\\Software\\Classes\\Directory\\Background\\shell\\Gih" /ve /d "Open with Gih" /f && reg add "HKCU\\Software\\Classes\\Directory\\Background\\shell\\Gih" /v "Icon" /d "\\"${exePath}\\"" /f && reg add "HKCU\\Software\\Classes\\Directory\\Background\\shell\\Gih\\command" /ve /d "\\"${exePath}\\" \\"%V\\"" /f`
      const child = spawn('cmd.exe', ['/c', cmd], { windowsHide: true })
      child.on('close', (code) => {
        resolve({ success: code === 0, enabled: true })
      })
    } else {
      const cmd = `reg delete "HKCU\\Software\\Classes\\Directory\\shell\\Gih" /f & reg delete "HKCU\\Software\\Classes\\Directory\\Background\\shell\\Gih" /f`
      const child = spawn('cmd.exe', ['/c', cmd], { windowsHide: true })
      child.on('close', (code) => {
        resolve({ success: code === 0, enabled: false })
      })
    }
  })
})

ipcMain.handle('app:isExplorerContextMenuRegistered', async () => {
  if (process.platform !== 'win32') return false
  return new Promise((resolve) => {
    const child = spawn('reg', ['query', 'HKCU\\Software\\Classes\\Directory\\shell\\Gih'], { windowsHide: true })
    child.on('close', (code) => {
      resolve(code === 0)
    })
  })
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

ipcMain.handle('git:getState', async (_, allBranches?: boolean, filePath?: string) => {
  return await gitService.getRepositoryState(allBranches ?? true, filePath)
})

ipcMain.handle('git:getCommits', async (_, limit?: number, allBranches?: boolean, filePath?: string, skip?: number) => {
  return await gitService.getCommits(limit ?? 400, allBranches ?? true, filePath, skip ?? 0)
})

ipcMain.handle('git:searchCommits', async (_, query: string, limit?: number, allBranches?: boolean, filePath?: string) => {
  return await gitService.searchCommits(query, limit ?? 150, allBranches ?? true, filePath)
})

ipcMain.handle('git:getAuthorConfig', async () => {
  return await gitService.getAuthorConfig()
})

ipcMain.handle('git:setAuthorConfig', async (_, name: string, email: string, isGlobal?: boolean) => {
  return await gitService.setAuthorConfig(name, email, isGlobal)
})

ipcMain.handle('git:addToGitIgnore', async (_, pattern: string) => {
  return await gitService.addToGitIgnore(pattern)
})

ipcMain.handle('git:setRepoPath', async (_, repoPath: string, allBranches?: boolean) => {
  if (typeof repoPath === 'string' && fs.existsSync(repoPath)) {
    const resolved = path.resolve(repoPath)
    gitService.setRepositoryPath(resolved)
    setupGitWatcher(resolved)
  }
  return await gitService.getRepositoryState(allBranches ?? true)
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

ipcMain.handle('git:clone', async (event, url: string, targetPath: string) => {
  return await gitService.cloneRepository(url, targetPath, (progress) => {
    if (!event.sender.isDestroyed()) {
      event.sender.send('git:clone-progress', progress)
    }
  })
})

ipcMain.handle('git:exec', async (_, args: string[]) => {
  if (!Array.isArray(args) || args.some((a) => typeof a !== 'string')) {
    return { stdout: '', stderr: 'Invalid arguments: expected array of strings', exitCode: 1 }
  }
  return await gitService.execGit(args, undefined, true)
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

ipcMain.handle('app:openInEditor', async (_, filePath: string, editorChoice?: string) => {
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(gitService.getRepositoryPath(), filePath)
  if (!editorChoice || editorChoice === 'system') {
    const err = await shell.openPath(fullPath)
    if (err) {
      return { success: false, error: err }
    }
    return { success: true }
  }
  return await gitService.openInEditor(filePath, editorChoice)
})

ipcMain.handle('app:readFileContent', async (_, filePath: string) => {
  return await gitService.readFileContent(filePath)
})

ipcMain.handle('app:saveFileContent', async (_, filePath: string, content: string) => {
  return await gitService.saveFileContent(filePath, content)
})

ipcMain.handle('git:getDiff', async (_, filePath: string, staged?: boolean) => {
  return await gitService.getFileDiff(filePath, staged)
})

ipcMain.handle('git:getFileBlame', async (_, filePath: string) => {
  return await gitService.getFileBlame(filePath)
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
  await gitService.execGit(['add', '--', filePath], undefined, true)
})

ipcMain.handle('git:unstageFile', async (_, filePath: string) => {
  await gitService.execGit(['restore', '--staged', '--', filePath], undefined, true)
})

ipcMain.handle('git:stageAll', async () => {
  await gitService.execGit(['add', '-A'], undefined, true)
})

ipcMain.handle('git:unstageAll', async () => {
  await gitService.unstageAll()
})

ipcMain.handle('git:discardChanges', async (_, filePath: string) => {
  await gitService.execGit(['restore', '--', filePath], undefined, true)
})

ipcMain.handle('git:discardAllChanges', async () => {
  return await gitService.discardAllChanges()
})

ipcMain.handle('git:resolveConflict', async (_, filePath: string, resolution: 'ours' | 'theirs' | 'mark-resolved') => {
  return await gitService.resolveConflict(filePath, resolution)
})

ipcMain.handle('git:applyPatch', async (_, patch: string, options?: { cached?: boolean; reverse?: boolean }) => {
  return await gitService.applyPatch(patch, options)
})

ipcMain.handle('git:formatPatch', async (_, commitHash: string) => {
  return await gitService.formatPatch(commitHash)
})

ipcMain.handle('app:savePatchFile', async (_, defaultFileName: string, content: string) => {
  const win = BrowserWindow.getFocusedWindow()
  const { canceled, filePath } = await dialog.showSaveDialog(win || (BrowserWindow.getAllWindows()[0] as any), {
    title: 'Export Git Patch',
    defaultPath: defaultFileName,
    filters: [{ name: 'Git Patch', extensions: ['patch', 'diff'] }],
  })
  if (canceled || !filePath) {
    return { success: false }
  }
  fs.writeFileSync(filePath, content, 'utf8')
  return { success: true, filePath }
})

ipcMain.handle('git:createCommit', async (_, message: string, signOff?: boolean, amend?: boolean, gpgSign?: boolean) => {
  return await gitService.createCommit(message, signOff, amend, gpgSign)
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

ipcMain.handle('git:revertCommit', async (_, commitHash: string) => {
  return await gitService.revertCommit(commitHash)
})

ipcMain.handle('git:fetch', async (event, remoteName?: string) => {
  const args = ['fetch', '--prune', '--progress']
  if (remoteName) args.push(remoteName)
  await gitService.execGitWithProgress(args, gitService.getRepositoryPath(), (progress) => {
    if (!event.sender.isDestroyed()) {
      event.sender.send('git:remote-progress', { operation: 'fetch', ...progress })
    }
  }, 'Fetching')
})

ipcMain.handle('git:pruneBranches', async (_, remoteName?: string) => {
  return await gitService.pruneMergedBranches(remoteName)
})

ipcMain.handle('git:addWorktree', async (_, targetPath: string, branchName: string) => {
  return await gitService.addWorktree(targetPath, branchName)
})

ipcMain.handle('git:removeWorktree', async (_, worktreePath: string, force?: boolean) => {
  return await gitService.removeWorktree(worktreePath, force)
})

ipcMain.handle('git:pull', async (event, remoteName?: string, branchName?: string) => {
  const args = ['pull', '--progress']
  if (remoteName) args.push(remoteName)
  if (branchName) args.push(branchName)
  await gitService.execGitWithProgress(args, gitService.getRepositoryPath(), (progress) => {
    if (!event.sender.isDestroyed()) {
      event.sender.send('git:remote-progress', { operation: 'pull', ...progress })
    }
  }, 'Pulling')
})

ipcMain.handle('git:push', async (event, remoteName?: string, branchName?: string, setUpstream?: boolean, forceWithLease?: boolean) => {
  return await gitService.pushRemote(remoteName, branchName, setUpstream, forceWithLease, (progress) => {
    if (!event.sender.isDestroyed()) {
      event.sender.send('git:remote-progress', { operation: 'push', ...progress })
    }
  })
})

ipcMain.handle('git:addRemote', async (_, name: string, url: string) => {
  return await gitService.addRemote(name, url)
})

ipcMain.handle('git:removeRemote', async (_, name: string) => {
  return await gitService.removeRemote(name)
})

ipcMain.handle('git:createStash', async (_, message?: string, includeUntracked?: boolean, keepIndex?: boolean) => {
  const args = ['stash', 'push']
  if (includeUntracked) args.push('-u')
  if (keepIndex) args.push('--keep-index')
  if (message) args.push('-m', message)
  await gitService.execGit(args, undefined, true)
})

ipcMain.handle('git:popStash', async (_, index: number = 0) => {
  await gitService.execGit(['stash', 'pop', `stash@{${index}}`], undefined, true)
})

ipcMain.handle('git:applyStash', async (_, index: number = 0) => {
  await gitService.execGit(['stash', 'apply', `stash@{${index}}`], undefined, true)
})

ipcMain.handle('git:dropStash', async (_, index: number = 0) => {
  await gitService.execGit(['stash', 'drop', `stash@{${index}}`], undefined, true)
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

ipcMain.handle('git:pushTag', async (_, tagName: string, remoteName?: string) => {
  return await gitService.pushTag(tagName, remoteName)
})

ipcMain.handle('git:pushAllTags', async (_, remoteName?: string) => {
  return await gitService.pushAllTags(remoteName)
})

ipcMain.handle('git:updateSubmodules', async (_, recursive?: boolean, init?: boolean) => {
  return await gitService.updateSubmodules(recursive ?? true, init ?? true)
})

ipcMain.handle('git:syncSubmodules', async (_, recursive?: boolean) => {
  return await gitService.syncSubmodules(recursive ?? true)
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

ipcMain.handle('git:bisectStart', async (_, badCommit?: string, goodCommit?: string) => {
  return await gitService.bisectStart(badCommit, goodCommit)
})

ipcMain.handle('git:bisectStep', async (_, action: 'good' | 'bad' | 'skip') => {
  return await gitService.bisectStep(action)
})

ipcMain.handle('git:bisectReset', async () => {
  return await gitService.bisectReset()
})
