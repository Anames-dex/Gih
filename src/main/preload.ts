import { contextBridge, ipcRenderer } from 'electron'
import type {
  RepositoryState,
  FileDiff,
  ReflogEntry,
  CommandLogEntry,
  GitFileStatus,
  CommitRangeDiff,
  RemoteProviderInfo,
  GitInstallationStatus,
  GitAuthorConfig,
  GitBlameLine,
  GitCommit,
  CloneProgressEvent,
  RemoteProgressEvent
} from '../shared/types'

export interface GihAPI {
  checkGitInstallation: () => Promise<GitInstallationStatus>
  installGit: (method?: string) => Promise<{ success: boolean; message: string }>
  getAuthorConfig: () => Promise<GitAuthorConfig>
  setAuthorConfig: (name: string, email: string, isGlobal?: boolean) => Promise<{ success: boolean; error?: string }>
  toggleExplorerContextMenu: (enable: boolean) => Promise<{ success: boolean; enabled: boolean; error?: string }>
  isExplorerContextMenuRegistered: () => Promise<boolean>
  getState: (allBranches?: boolean, filePath?: string) => Promise<RepositoryState>
  getCommits: (limit?: number, allBranches?: boolean, filePath?: string, skip?: number) => Promise<GitCommit[]>
  searchCommits: (query: string, limit?: number, allBranches?: boolean, filePath?: string) => Promise<GitCommit[]>
  setRepoPath: (repoPath: string, allBranches?: boolean) => Promise<RepositoryState>
  initRepository: (branchName?: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  cloneRepository: (url: string, targetPath: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  onCloneProgress: (callback: (progress: CloneProgressEvent) => void) => () => void
  onRemoteProgress: (callback: (progress: RemoteProgressEvent) => void) => () => void
  openDirectoryDialog: () => Promise<string | null>
  openExternal: (url: string) => Promise<void>
  openInEditor: (filePath: string, editorChoice?: string) => Promise<{ success: boolean; error?: string }>
  readFileContent: (filePath: string) => Promise<{ content: string; isBinary: boolean; size: number; error?: string }>
  saveFileContent: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>
  execCommand: (args: string[]) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  getDiff: (filePath: string, staged?: boolean) => Promise<FileDiff>
  getFileBlame: (filePath: string) => Promise<GitBlameLine[]>
  getCommitFiles: (hash: string) => Promise<{ files: GitFileStatus[]; statSummary: string }>
  getRangeDiff: (baseHash: string, headHash: string) => Promise<CommitRangeDiff>
  getCommitFileDiff: (baseHash: string, headHash: string, filePath: string) => Promise<FileDiff>
  getRemoteInfo: (remoteName?: string) => Promise<RemoteProviderInfo | null>
  getReflog: (count?: number) => Promise<ReflogEntry[]>
  getCommandHistory: () => Promise<CommandLogEntry[]>
  stageFile: (filePath: string) => Promise<void>
  unstageFile: (filePath: string) => Promise<void>
  stageAll: () => Promise<void>
  unstageAll: () => Promise<void>
  discardChanges: (filePath: string) => Promise<void>
  discardAllChanges: () => Promise<{ stdout: string; stderr: string; exitCode: number }>
  addToGitIgnore: (pattern: string) => Promise<{ success: boolean; pattern: string; error?: string }>
  resolveConflict: (filePath: string, resolution: 'ours' | 'theirs' | 'mark-resolved') => Promise<{ stdout: string; stderr: string; exitCode: number }>
  applyPatch: (patch: string, options?: { cached?: boolean; reverse?: boolean }) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  formatPatch: (commitHash: string) => Promise<string>
  savePatchFile: (defaultFileName: string, content: string) => Promise<{ success: boolean; filePath?: string }>
  createCommit: (message: string, signOff?: boolean, amend?: boolean, gpgSign?: boolean) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  resetBranch: (targetHash: string, mode: 'soft' | 'mixed' | 'hard') => Promise<{ stdout: string; stderr: string; exitCode: number }>
  checkoutBranch: (branchName: string) => Promise<void>
  createBranch: (branchName: string, startPoint?: string) => Promise<void>
  deleteBranch: (branchName: string, force?: boolean) => Promise<void>
  renameBranch: (oldName: string, newName: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  mergeBranch: (branchOrRef: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  rebaseBranch: (upstream: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  cherryPick: (commitHash: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  revertCommit: (commitHash: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  fetchRemote: (remoteName?: string) => Promise<void>
  pruneBranches: (remoteName?: string) => Promise<{ prunedRemotes: string; deletedLocalBranches: string[]; errors: string[] }>
  pullRemote: (remoteName?: string, branchName?: string) => Promise<void>
  addWorktree: (targetPath: string, branchName: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  removeWorktree: (worktreePath: string, force?: boolean) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  pushRemote: (remoteName?: string, branchName?: string, setUpstream?: boolean, forceWithLease?: boolean) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  addRemote: (name: string, url: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  removeRemote: (name: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  getRepoFiles: () => Promise<string[]>
  createStash: (message?: string, includeUntracked?: boolean, keepIndex?: boolean) => Promise<void>
  popStash: (index?: number) => Promise<void>
  applyStash: (index?: number) => Promise<void>
  dropStash: (index?: number) => Promise<void>
  branchFromStash: (branchName: string, index?: number) => Promise<void>
  getStashDiff: (index?: number) => Promise<string>
  createTag: (name: string, message?: string, targetHash?: string) => Promise<void>
  deleteTag: (name: string) => Promise<void>
  pushTag: (name: string, remoteName?: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  pushAllTags: (remoteName?: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  updateSubmodules: (recursive?: boolean, init?: boolean) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  syncSubmodules: (recursive?: boolean) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  continueOperation: (type: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  abortOperation: (type: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  skipOperation: (type: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  bisectStart: (badCommit?: string, goodCommit?: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  bisectStep: (action: 'good' | 'bad' | 'skip') => Promise<{ stdout: string; stderr: string; exitCode: number }>
  bisectReset: () => Promise<{ stdout: string; stderr: string; exitCode: number }>
  onRepoChanged: (callback: () => void) => () => void
}

const api: GihAPI = {
  checkGitInstallation: () => ipcRenderer.invoke('git:checkInstallation'),
  installGit: (method?: string) => ipcRenderer.invoke('git:installGit', method),
  getAuthorConfig: () => ipcRenderer.invoke('git:getAuthorConfig'),
  setAuthorConfig: (name: string, email: string, isGlobal?: boolean) => ipcRenderer.invoke('git:setAuthorConfig', name, email, isGlobal),
  toggleExplorerContextMenu: (enable: boolean) => ipcRenderer.invoke('app:toggleExplorerContextMenu', enable),
  isExplorerContextMenuRegistered: () => ipcRenderer.invoke('app:isExplorerContextMenuRegistered'),
  getState: (allBranches?: boolean, filePath?: string) => ipcRenderer.invoke('git:getState', allBranches, filePath),
  getCommits: (limit?: number, allBranches?: boolean, filePath?: string, skip?: number) => ipcRenderer.invoke('git:getCommits', limit, allBranches, filePath, skip),
  searchCommits: (query: string, limit?: number, allBranches?: boolean, filePath?: string) => ipcRenderer.invoke('git:searchCommits', query, limit, allBranches, filePath),
  setRepoPath: (path: string, allBranches?: boolean) => ipcRenderer.invoke('git:setRepoPath', path, allBranches),
  initRepository: (branchName?: string) => ipcRenderer.invoke('git:init', branchName),
  cloneRepository: (url: string, targetPath: string) => ipcRenderer.invoke('git:clone', url, targetPath),
  onCloneProgress: (callback: (progress: CloneProgressEvent) => void) => {
    const handler = (_: unknown, progress: CloneProgressEvent) => callback(progress)
    ipcRenderer.on('git:clone-progress', handler)
    return () => {
      ipcRenderer.removeListener('git:clone-progress', handler)
    }
  },
  onRemoteProgress: (callback: (progress: RemoteProgressEvent) => void) => {
    const handler = (_: unknown, progress: RemoteProgressEvent) => callback(progress)
    ipcRenderer.on('git:remote-progress', handler)
    return () => {
      ipcRenderer.removeListener('git:remote-progress', handler)
    }
  },
  openDirectoryDialog: () => ipcRenderer.invoke('app:openDirectoryDialog'),
  openExternal: (url: string) => ipcRenderer.invoke('app:openExternal', url),
  openInEditor: (filePath: string, editorChoice?: string) => ipcRenderer.invoke('app:openInEditor', filePath, editorChoice),
  readFileContent: (filePath: string) => ipcRenderer.invoke('app:readFileContent', filePath),
  saveFileContent: (filePath: string, content: string) => ipcRenderer.invoke('app:saveFileContent', filePath, content),
  execCommand: (args: string[]) => ipcRenderer.invoke('git:exec', args),
  getDiff: (filePath: string, staged?: boolean) => ipcRenderer.invoke('git:getDiff', filePath, staged),
  getFileBlame: (filePath: string) => ipcRenderer.invoke('git:getFileBlame', filePath),
  getCommitFiles: (hash: string) => ipcRenderer.invoke('git:getCommitFiles', hash),
  getRangeDiff: (baseHash: string, headHash: string) => ipcRenderer.invoke('git:getRangeDiff', baseHash, headHash),
  getCommitFileDiff: (baseHash: string, headHash: string, filePath: string) => ipcRenderer.invoke('git:getCommitFileDiff', baseHash, headHash, filePath),
  getRemoteInfo: (remoteName?: string) => ipcRenderer.invoke('git:getRemoteInfo', remoteName),
  getReflog: (count?: number) => ipcRenderer.invoke('git:getReflog', count),
  getCommandHistory: () => ipcRenderer.invoke('git:getCommandHistory'),
  stageFile: (filePath: string) => ipcRenderer.invoke('git:stageFile', filePath),
  unstageFile: (filePath: string) => ipcRenderer.invoke('git:unstageFile', filePath),
  stageAll: () => ipcRenderer.invoke('git:stageAll'),
  unstageAll: () => ipcRenderer.invoke('git:unstageAll'),
  discardChanges: (filePath: string) => ipcRenderer.invoke('git:discardChanges', filePath),
  discardAllChanges: () => ipcRenderer.invoke('git:discardAllChanges'),
  addToGitIgnore: (pattern: string) => ipcRenderer.invoke('git:addToGitIgnore', pattern),
  resolveConflict: (filePath: string, resolution: 'ours' | 'theirs' | 'mark-resolved') => ipcRenderer.invoke('git:resolveConflict', filePath, resolution),
  applyPatch: (patch: string, options?: { cached?: boolean; reverse?: boolean }) => ipcRenderer.invoke('git:applyPatch', patch, options),
  formatPatch: (commitHash: string) => ipcRenderer.invoke('git:formatPatch', commitHash),
  savePatchFile: (defaultFileName: string, content: string) => ipcRenderer.invoke('app:savePatchFile', defaultFileName, content),
  createCommit: (message: string, signOff?: boolean, amend?: boolean, gpgSign?: boolean) => ipcRenderer.invoke('git:createCommit', message, signOff, amend, gpgSign),
  resetBranch: (targetHash: string, mode: 'soft' | 'mixed' | 'hard') => ipcRenderer.invoke('git:resetBranch', targetHash, mode),
  checkoutBranch: (branchName: string) => ipcRenderer.invoke('git:checkoutBranch', branchName),
  createBranch: (branchName: string, startPoint?: string) => ipcRenderer.invoke('git:createBranch', branchName, startPoint),
  deleteBranch: (branchName: string, force?: boolean) => ipcRenderer.invoke('git:deleteBranch', branchName, force),
  renameBranch: (oldName: string, newName: string) => ipcRenderer.invoke('git:renameBranch', oldName, newName),
  mergeBranch: (branchOrRef: string) => ipcRenderer.invoke('git:merge', branchOrRef),
  rebaseBranch: (upstream: string) => ipcRenderer.invoke('git:rebase', upstream),
  cherryPick: (commitHash: string) => ipcRenderer.invoke('git:cherryPick', commitHash),
  revertCommit: (commitHash: string) => ipcRenderer.invoke('git:revertCommit', commitHash),
  fetchRemote: (remoteName?: string) => ipcRenderer.invoke('git:fetch', remoteName),
  pruneBranches: (remoteName?: string) => ipcRenderer.invoke('git:pruneBranches', remoteName),
  pullRemote: (remoteName?: string, branchName?: string) => ipcRenderer.invoke('git:pull', remoteName, branchName),
  addWorktree: (targetPath: string, branchName: string) => ipcRenderer.invoke('git:addWorktree', targetPath, branchName),
  removeWorktree: (worktreePath: string, force?: boolean) => ipcRenderer.invoke('git:removeWorktree', worktreePath, force),
  pushRemote: (remoteName?: string, branchName?: string, setUpstream?: boolean, forceWithLease?: boolean) => ipcRenderer.invoke('git:push', remoteName, branchName, setUpstream, forceWithLease),
  addRemote: (name: string, url: string) => ipcRenderer.invoke('git:addRemote', name, url),
  removeRemote: (name: string) => ipcRenderer.invoke('git:removeRemote', name),
  getRepoFiles: () => ipcRenderer.invoke('git:getRepoFiles'),
  createStash: (message?: string, includeUntracked?: boolean, keepIndex?: boolean) => ipcRenderer.invoke('git:createStash', message, includeUntracked, keepIndex),
  popStash: (index?: number) => ipcRenderer.invoke('git:popStash', index),
  applyStash: (index?: number) => ipcRenderer.invoke('git:applyStash', index),
  dropStash: (index?: number) => ipcRenderer.invoke('git:dropStash', index),
  branchFromStash: (branchName: string, index?: number) => ipcRenderer.invoke('git:branchFromStash', branchName, index),
  getStashDiff: (index?: number) => ipcRenderer.invoke('git:getStashDiff', index),
  createTag: (name: string, message?: string, targetHash?: string) => ipcRenderer.invoke('git:createTag', name, message, targetHash),
  deleteTag: (name: string) => ipcRenderer.invoke('git:deleteTag', name),
  pushTag: (name: string, remoteName?: string) => ipcRenderer.invoke('git:pushTag', name, remoteName),
  pushAllTags: (remoteName?: string) => ipcRenderer.invoke('git:pushAllTags', remoteName),
  updateSubmodules: (recursive?: boolean, init?: boolean) => ipcRenderer.invoke('git:updateSubmodules', recursive, init),
  syncSubmodules: (recursive?: boolean) => ipcRenderer.invoke('git:syncSubmodules', recursive),
  continueOperation: (type: string) => ipcRenderer.invoke('git:continueOperation', type),
  abortOperation: (type: string) => ipcRenderer.invoke('git:abortOperation', type),
  skipOperation: (type: string) => ipcRenderer.invoke('git:skipOperation', type),
  bisectStart: (badCommit?: string, goodCommit?: string) => ipcRenderer.invoke('git:bisectStart', badCommit, goodCommit),
  bisectStep: (action: 'good' | 'bad' | 'skip') => ipcRenderer.invoke('git:bisectStep', action),
  bisectReset: () => ipcRenderer.invoke('git:bisectReset'),
  onRepoChanged: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('git:changed', handler)
    return () => {
      ipcRenderer.removeListener('git:changed', handler)
    }
  },
}

contextBridge.exposeInMainWorld('gih', api)
