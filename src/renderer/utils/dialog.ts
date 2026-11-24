import type { DialogRequest } from '@/renderer/components/modals/ActionDialogModal'

type DialogListener = (req: DialogRequest) => void

let listener: DialogListener | null = null

export function registerDialogListener(fn: DialogListener | null) {
  listener = fn
}

export function showConfirm(options: {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}): Promise<boolean> {
  return new Promise((resolve) => {
    if (!listener) {
      resolve(window.confirm(`${options.title}\n\n${options.message}`))
      return
    }
    listener({
      mode: 'confirm',
      ...options,
      resolve: (val) => resolve(Boolean(val)),
    })
  })
}

export function showPrompt(options: {
  title: string
  message: string
  defaultValue?: string
  placeholder?: string
  confirmLabel?: string
  cancelLabel?: string
}): Promise<string | null> {
  return new Promise((resolve) => {
    if (!listener) {
      resolve(window.prompt(options.message, options.defaultValue))
      return
    }
    listener({
      mode: 'prompt',
      ...options,
      resolve: (val) => resolve(typeof val === 'string' ? val : null),
    })
  })
}
