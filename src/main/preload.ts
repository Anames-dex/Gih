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
  GitAuthorConfig
} from '../shared/types'

export interface GihAPI {
  checkGitInstallation: () => Promise<GitInstallationStatus>
  installGit: (method?: string) => Promise<{ success: boolean; message: string }>
  getAuthorConfig: () => Promise<GitAuthorConfig>
  setAuthorConfig: (name: string, email: string, isGlobal?: boolean) => Promise<{ success: boolean; error?: string }>
  toggleExplorerContextMenu: (enable: boolean) => Promise<{ success: boolean; enabled: boolean; error?: string }>
  isExplorerContextMenuRegistered: () => Promise<boolean>
  getState: () => Promise<RepositoryState>
  setRepoPath: (repoPath: string) => Promise<RepositoryState>
  initRepository: (branchName?: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  cloneRepository: (url: string, targetPath: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  openDirectoryDialog: () => Promise<string | null>
  openExternal: (url: string) => Promise<void>
  execCommand: (args: string[]) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  getDiff: (filePath: string, staged?: boolean) => Promise<FileDiff>
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
  resolveConflict: (filePath: string, resolution: 'ours' | 'theirs' | 'mark-resolved') => Promise<{ stdout: string; stderr: string; exitCode: number }>
  applyPatch: (patch: string, options?: { cached?: boolean; reverse?: boolean }) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  createCommit: (message: string, signOff?: boolean, amend?: boolean) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  resetBranch: (targetHash: string, mode: 'soft' | 'mixed' | 'hard') => Promise<{ stdout: string; stderr: string; exitCode: number }>
  checkoutBranch: (branchName: string) => Promise<void>
  createBranch: (branchName: string, startPoint?: string) => Promise<void>
  deleteBranch: (branchName: string, force?: boolean) => Promise<void>
  renameBranch: (oldName: string, newName: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  mergeBranch: (branchOrRef: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  rebaseBranch: (upstream: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  cherryPick: (commitHash: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  fetchRemote: (remoteName?: string) => Promise<void>
  pullRemote: (remoteName?: string, branchName?: string) => Promise<void>
  pushRemote: (remoteName?: string, branchName?: string, setUpstream?: boolean, forceWithLease?: boolean) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  createStash: (message?: string, includeUntracked?: boolean) => Promise<void>
  popStash: (index?: number) => Promise<void>
  applyStash: (index?: number) => Promise<void>
  dropStash: (index?: number) => Promise<void>
  branchFromStash: (branchName: string, index?: number) => Promise<void>
  getStashDiff: (index?: number) => Promise<string>
  createTag: (name: string, message?: string, targetHash?: string) => Promise<void>
  deleteTag: (name: string) => Promise<void>
  continueOperation: (type: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  abortOperation: (type: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  skipOperation: (type: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  onRepoChanged: (callback: () => void) => () => void
}

const api: GihAPI = {
  checkGitInstallation: () => ipcRenderer.invoke('git:checkInstallation'),
  installGit: (method?: string) => ipcRenderer.invoke('git:installGit', method),
  getAuthorConfig: () => ipcRenderer.invoke('git:getAuthorConfig'),
  setAuthorConfig: (name: string, email: string, isGlobal?: boolean) => ipcRenderer.invoke('git:setAuthorConfig', name, email, isGlobal),
  toggleExplorerContextMenu: (enable: boolean) => ipcRenderer.invoke('app:toggleExplorerContextMenu', enable),
  isExplorerContextMenuRegistered: () => ipcRenderer.invoke('app:isExplorerContextMenuRegistered'),
  getState: () => ipcRenderer.invoke('git:getState'),
  setRepoPath: (path: string) => ipcRenderer.invoke('git:setRepoPath', path),
  initRepository: (branchName?: string) => ipcRenderer.invoke('git:init', branchName),
  cloneRepository: (url: string, targetPath: string) => ipcRenderer.invoke('git:clone', url, targetPath),
  openDirectoryDialog: () => ipcRenderer.invoke('app:openDirectoryDialog'),
  openExternal: (url: string) => ipcRenderer.invoke('app:openExternal', url),
  execCommand: (args: string[]) => ipcRenderer.invoke('git:exec', args),
  getDiff: (filePath: string, staged?: boolean) => ipcRenderer.invoke('git:getDiff', filePath, staged),
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
  resolveConflict: (filePath: string, resolution: 'ours' | 'theirs' | 'mark-resolved') => ipcRenderer.invoke('git:resolveConflict', filePath, resolution),
  applyPatch: (patch: string, options?: { cached?: boolean; reverse?: boolean }) => ipcRenderer.invoke('git:applyPatch', patch, options),
  createCommit: (message: string, signOff?: boolean, amend?: boolean) => ipcRenderer.invoke('git:createCommit', message, signOff, amend),
  resetBranch: (targetHash: string, mode: 'soft' | 'mixed' | 'hard') => ipcRenderer.invoke('git:resetBranch', targetHash, mode),
  checkoutBranch: (branchName: string) => ipcRenderer.invoke('git:checkoutBranch', branchName),
  createBranch: (branchName: string, startPoint?: string) => ipcRenderer.invoke('git:createBranch', branchName, startPoint),
  deleteBranch: (branchName: string, force?: boolean) => ipcRenderer.invoke('git:deleteBranch', branchName, force),
  renameBranch: (oldName: string, newName: string) => ipcRenderer.invoke('git:renameBranch', oldName, newName),
  mergeBranch: (branchOrRef: string) => ipcRenderer.invoke('git:merge', branchOrRef),
  rebaseBranch: (upstream: string) => ipcRenderer.invoke('git:rebase', upstream),
  cherryPick: (commitHash: string) => ipcRenderer.invoke('git:cherryPick', commitHash),
  fetchRemote: (remoteName?: string) => ipcRenderer.invoke('git:fetch', remoteName),
  pullRemote: (remoteName?: string, branchName?: string) => ipcRenderer.invoke('git:pull', remoteName, branchName),
  pushRemote: (remoteName?: string, branchName?: string, setUpstream?: boolean, forceWithLease?: boolean) => ipcRenderer.invoke('git:push', remoteName, branchName, setUpstream, forceWithLease),
  createStash: (message?: string, includeUntracked?: boolean) => ipcRenderer.invoke('git:createStash', message, includeUntracked),
  popStash: (index?: number) => ipcRenderer.invoke('git:popStash', index),
  applyStash: (index?: number) => ipcRenderer.invoke('git:applyStash', index),
  dropStash: (index?: number) => ipcRenderer.invoke('git:dropStash', index),
  branchFromStash: (branchName: string, index?: number) => ipcRenderer.invoke('git:branchFromStash', branchName, index),
  getStashDiff: (index?: number) => ipcRenderer.invoke('git:getStashDiff', index),
  createTag: (name: string, message?: string, targetHash?: string) => ipcRenderer.invoke('git:createTag', name, message, targetHash),
  deleteTag: (name: string) => ipcRenderer.invoke('git:deleteTag', name),
  continueOperation: (type: string) => ipcRenderer.invoke('git:continueOperation', type),
  abortOperation: (type: string) => ipcRenderer.invoke('git:abortOperation', type),
  skipOperation: (type: string) => ipcRenderer.invoke('git:skipOperation', type),
  onRepoChanged: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('git:changed', handler)
    return () => {
      ipcRenderer.removeListener('git:changed', handler)
    }
  },
}

contextBridge.exposeInMainWorld('gih', api)
