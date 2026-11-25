import { useEffect, useRef } from 'react'
import type React from 'react'

export function useBackdropClose(onClose?: () => void) {
  const startedOnBackdropRef = useRef(false)
  return {
    onMouseDown: (e: React.MouseEvent<HTMLElement>) => {
      startedOnBackdropRef.current = e.target === e.currentTarget
    },
    onClick: (e: React.MouseEvent<HTMLElement>) => {
      if (startedOnBackdropRef.current && e.target === e.currentTarget) {
        onClose?.()
      }
      startedOnBackdropRef.current = false
    },
  }
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

// Stack of active modal IDs so Escape always closes only the topmost modal
const activeModalStack: symbol[] = []

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement
  )
}

export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  isOpen: boolean,
  onClose?: () => void
) {
  const modalIdRef = useRef<symbol>(Symbol('modal'))
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!isOpen) return

    const modalId = modalIdRef.current
    const previousFocus = document.activeElement as HTMLElement | null
    activeModalStack.push(modalId)

    // Move initial focus inside the modal if it isn't already there
    const focusTimer = window.setTimeout(() => {
      const container = containerRef.current
      if (!container) return
      if (!container.contains(document.activeElement)) {
        const autoFocusEl = container.querySelector<HTMLElement>('[autofocus]')
        const focusables = getFocusableElements(container)
        const target = autoFocusEl || focusables[0] || container
        target.focus()
      }
    }, 0)

    const isTopmost = () => activeModalStack[activeModalStack.length - 1] === modalId

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isTopmost()) return
      const container = containerRef.current
      if (!container) return

      if (e.key === 'Escape') {
        if (onCloseRef.current) {
          e.preventDefault()
          e.stopPropagation()
          onCloseRef.current()
        }
        return
      }

      if (e.key === 'Tab') {
        const targetEl = e.target as HTMLElement | null
        if (targetEl?.dataset.allowTab === 'true') {
          return
        }
        const focusables = getFocusableElements(container)
        if (focusables.length === 0) {
          e.preventDefault()
          container.focus()
          return
        }

        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        const active = document.activeElement as HTMLElement | null

        if (!active || !container.contains(active)) {
          e.preventDefault()
          ;(e.shiftKey ? last : first).focus()
          return
        }

        if (e.shiftKey && active === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && active === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    const handleFocusIn = (e: FocusEvent) => {
      if (!isTopmost()) return
      const container = containerRef.current
      if (!container) return
      const target = e.target as Node | null
      if (target && !container.contains(target)) {
        const focusables = getFocusableElements(container)
        ;(focusables[0] || container).focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    document.addEventListener('focusin', handleFocusIn, true)

    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', handleKeyDown, true)
      document.removeEventListener('focusin', handleFocusIn, true)
      const idx = activeModalStack.lastIndexOf(modalId)
      if (idx !== -1) {
        activeModalStack.splice(idx, 1)
      }
      if (previousFocus && typeof previousFocus.focus === 'function') {
        previousFocus.focus()
      }
    }
  }, [isOpen, containerRef])
}
