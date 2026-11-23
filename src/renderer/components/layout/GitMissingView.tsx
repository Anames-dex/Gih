import React, { useState } from 'react'
import type { GitInstallationStatus } from '@/shared/types'
import {
  Download,
  Terminal,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  AlertTriangle,
  Sparkles,
  ShieldAlert
} from 'lucide-react'

interface GitMissingViewProps {
  status: GitInstallationStatus | null
  onRecheck: () => Promise<void>
  onInstall: (method?: string) => Promise<{ success: boolean; message: string }>
}

export const GitMissingView: React.FC<GitMissingViewProps> = ({
  status,
  onRecheck,
  onInstall,
}) => {
  const [isChecking, setIsChecking] = useState(false)
  const [isInstalling, setIsInstalling] = useState(false)
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const platform = status?.platform || (typeof navigator !== 'undefined' && /Mac/.test(navigator.userAgent) ? 'darwin' : /Linux/.test(navigator.userAgent) ? 'linux' : 'win32')
  const isWindows = platform === 'win32'
  const isMac = platform === 'darwin'
  const isLinux = platform === 'linux'

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiedCmd(label)
    setTimeout(() => setCopiedCmd(null), 2500)
  }

  const handleRecheckClick = async () => {
    setIsChecking(true)
    setFeedback(null)
    try {
      await onRecheck()
    } finally {
      setIsChecking(false)
    }
  }

  const handleInstallClick = async (method?: string) => {
    setIsInstalling(true)
    setFeedback(null)
    try {
      const res = await onInstall(method)
      if (res?.message) {
        setFeedback(res.message)
      }
    } catch (err: any) {
      setFeedback(err?.message || 'Failed to trigger Git installer')
    } finally {
      setIsInstalling(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#0c0e14] overflow-y-auto select-none">
      <div className="max-w-xl w-full p-8 rounded-2xl bg-surface border border-surface-border shadow-2xl flex flex-col items-center text-center animate-fade-in">
        {/* Brand & Alert Badge */}
        <div className="relative mb-5">
          <img
            src="/logo.png"
            alt="Gih"
            className="h-16 w-auto object-contain drop-shadow select-none mx-auto"
          />
          <div className="absolute -bottom-2 -right-2 bg-amber-500/20 border border-amber-500/40 rounded-full p-1.5 text-amber-400">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>

        <h1 className="text-xl font-bold text-white tracking-tight">Git Is Not Installed</h1>
        <p className="text-xs text-slate-400 mt-2 max-w-md leading-relaxed">
          Gih is a visual Git workbench, but the <code className="px-1.5 py-0.5 rounded bg-surface-subtle font-mono text-sky-400">git</code> executable was not found on your system PATH. Would you like to install Git now?
        </p>

        {status?.error && (
          <div className="mt-3 px-3 py-1.5 rounded-lg bg-surface-subtle border border-surface-border/60 text-[11px] font-mono text-slate-400 max-w-full truncate">
            {status.error}
          </div>
        )}

        {/* Installation Options tailored to OS */}
        <div className="w-full mt-6 space-y-3 text-left">
          {isWindows && (
            <>
              {/* Option 1: Official Windows Installer */}
              <div className="p-4 rounded-xl bg-surface-subtle border border-surface-border hover:border-sky-500/30 transition-all flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-200">Official Git for Windows (Recommended)</span>
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                      Standard
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Downloads the official 64-bit setup executable from git-scm.com.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleInstallClick()}
                  disabled={isInstalling}
                  className="px-3.5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 active:scale-95 text-slate-950 text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
              </div>

              {/* Option 2: Windows Package Manager (winget) */}
              <div className="p-4 rounded-xl bg-surface-subtle border border-surface-border hover:border-indigo-500/30 transition-all flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-200">Windows Package Manager (winget)</span>
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      Automated
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Installs automatically in a console terminal window.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleInstallClick('winget')}
                  disabled={isInstalling}
                  className="px-3.5 py-2 rounded-lg bg-surface-hover hover:bg-surface-active active:scale-95 border border-surface-border text-slate-200 text-xs font-medium transition-all shadow-sm flex items-center gap-1.5 shrink-0"
                >
                  <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Run winget</span>
                </button>
              </div>
            </>
          )}

          {isMac && (
            <>
              {/* Option 1: macOS Developer Tools */}
              <div className="p-4 rounded-xl bg-surface-subtle border border-surface-border hover:border-sky-500/30 transition-all flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-200">Apple Command Line Tools (Recommended)</span>
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                      Native
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Triggers Apple's built-in developer tools and Git installer dialog.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleInstallClick('xcode')}
                  disabled={isInstalling}
                  className="px-3.5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 active:scale-95 text-slate-950 text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Install</span>
                </button>
              </div>

              {/* Option 2: Homebrew */}
              <div className="p-4 rounded-xl bg-surface-subtle border border-surface-border flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-slate-200">Homebrew Terminal Command</span>
                  <div className="mt-1 font-mono text-[11px] text-slate-300 bg-background/80 px-2.5 py-1 rounded border border-surface-border/50 flex items-center justify-between gap-2">
                    <span>brew install git</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy('brew install git', 'brew')}
                  className="px-3 py-1.5 rounded bg-surface-hover hover:bg-surface-active text-xs text-slate-300 flex items-center gap-1.5 shrink-0"
                >
                  {copiedCmd === 'brew' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCmd === 'brew' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </>
          )}

          {isLinux && (
            <>
              {/* Option 1: Package Manager Commands */}
              <div className="p-4 rounded-xl bg-surface-subtle border border-surface-border space-y-2.5">
                <span className="text-xs font-semibold text-slate-200">Package Manager Commands</span>
                
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-slate-300 bg-background/80 px-2.5 py-1 rounded border border-surface-border/50">
                    <span className="truncate">sudo apt update && sudo apt install git</span>
                    <button
                      type="button"
                      onClick={() => handleCopy('sudo apt update && sudo apt install git', 'apt')}
                      className="p-1 hover:text-white text-slate-400 shrink-0"
                      title="Copy command"
                    >
                      {copiedCmd === 'apt' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-slate-300 bg-background/80 px-2.5 py-1 rounded border border-surface-border/50">
                    <span className="truncate">sudo dnf install git</span>
                    <button
                      type="button"
                      onClick={() => handleCopy('sudo dnf install git', 'dnf')}
                      className="p-1 hover:text-white text-slate-400 shrink-0"
                      title="Copy command"
                    >
                      {copiedCmd === 'dnf' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Option 2: Linux Download Guide */}
              <div className="p-4 rounded-xl bg-surface-subtle border border-surface-border flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-slate-200">Official Linux Installation Guide</span>
                  <p className="text-[11px] text-slate-400 mt-0.5">Instructions for Arch, openSUSE, Alpine, and more.</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleInstallClick()}
                  className="px-3.5 py-2 rounded-lg bg-surface-hover hover:bg-surface-active active:scale-95 border border-surface-border text-slate-200 text-xs font-medium transition-all shadow-sm flex items-center gap-1.5 shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
                  <span>Open Guide</span>
                </button>
              </div>
            </>
          )}
        </div>

        {feedback && (
          <div className="mt-4 px-3.5 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}

        {/* Bottom Re-check Button */}
        <div className="mt-6 pt-5 border-t border-surface-border/80 w-full flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={handleRecheckClick}
            disabled={isChecking}
            className="w-full py-2.5 px-4 rounded-xl bg-brand hover:bg-brand-hover active:scale-[0.98] text-slate-950 text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
            <span>{isChecking ? 'Checking System PATH...' : "I've Installed Git — Re-check Status"}</span>
          </button>
          <span className="text-[11px] text-slate-500">
            Once Git is installed, Gih will immediately load your repositories.
          </span>
        </div>
      </div>
    </div>
  )
}
