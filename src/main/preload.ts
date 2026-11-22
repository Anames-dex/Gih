import { contextBridge, ipcRenderer } from 'electron'
import type { RepositoryState, FileDiff, ReflogEntry, CommandLogEntry } from '../shared/types'

export interface GihAPI {
  getState: () => Promise<RepositoryState>
  setRepoPath: (repoPath: string) => Promise<RepositoryState>
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
  createCommit: (message: string, signOff?: boolean) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  checkoutBranch: (branchName: string) => Promise<void>
  createBranch: (branchName: string, startPoint?: string) => Promise<void>
  deleteBranch: (branchName: string, force?: boolean) => Promise<void>
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
  onRepoChanged: (callback: () => void) => () => void
}

const api: GihAPI = {
  getState: () => ipcRenderer.invoke('git:getState'),
  setRepoPath: (path: string) => ipcRenderer.invoke('git:setRepoPath', path),
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
  createCommit: (message: string, signOff?: boolean) => ipcRenderer.invoke('git:createCommit', message, signOff),
  checkoutBranch: (branchName: string) => ipcRenderer.invoke('git:checkoutBranch', branchName),
  createBranch: (branchName: string, startPoint?: string) => ipcRenderer.invoke('git:createBranch', branchName, startPoint),
  deleteBranch: (branchName: string, force?: boolean) => ipcRenderer.invoke('git:deleteBranch', branchName, force),
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
  onRepoChanged: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('git:changed', handler)
    return () => {
      ipcRenderer.removeListener('git:changed', handler)
    }
  },
}

contextBridge.exposeInMainWorld('gih', api)
