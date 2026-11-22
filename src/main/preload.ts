import { contextBridge, ipcRenderer } from 'electron'
import type { RepositoryState, FileDiff, ReflogEntry, CommandLogEntry } from '../shared/types'

export interface GihAPI {
  getState: () => Promise<RepositoryState>
  setRepoPath: (repoPath: string) => Promise<RepositoryState>
  initRepository: (branchName?: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  cloneRepository: (url: string, targetPath: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  openDirectoryDialog: () => Promise<string | null>
  execCommand: (args: string[]) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  getDiff: (filePath: string, staged?: boolean) => Promise<FileDiff>
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
  fetchRemote: (remoteName?: string) => Promise<void>
  pullRemote: (remoteName?: string, branchName?: string) => Promise<void>
  pushRemote: (remoteName?: string, branchName?: string, setUpstream?: boolean) => Promise<void>
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
  getState: () => ipcRenderer.invoke('git:getState'),
  setRepoPath: (path: string) => ipcRenderer.invoke('git:setRepoPath', path),
  initRepository: (branchName?: string) => ipcRenderer.invoke('git:init', branchName),
  cloneRepository: (url: string, targetPath: string) => ipcRenderer.invoke('git:clone', url, targetPath),
  openDirectoryDialog: () => ipcRenderer.invoke('app:openDirectoryDialog'),
  execCommand: (args: string[]) => ipcRenderer.invoke('git:exec', args),
  getDiff: (filePath: string, staged?: boolean) => ipcRenderer.invoke('git:getDiff', filePath, staged),
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
  fetchRemote: (remoteName?: string) => ipcRenderer.invoke('git:fetch', remoteName),
  pullRemote: (remoteName?: string, branchName?: string) => ipcRenderer.invoke('git:pull', remoteName, branchName),
  pushRemote: (remoteName?: string, branchName?: string, setUpstream?: boolean) => ipcRenderer.invoke('git:push', remoteName, branchName, setUpstream),
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
