import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'

const focusableSelector = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export default function ConfirmDialog({
  title,
  description,
  confirmLabel,
  busy = false,
  returnFocusTo,
  onCancel,
  onConfirm,
}) {
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef(null)
  const cancelRef = useRef(null)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    cancelRef.current?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
      if (returnFocusTo?.isConnected) returnFocusTo.focus()
    }
  }, [returnFocusTo])

  const handleKeyDown = (event) => {
    if (event.key === 'Escape' && !busy) {
      event.preventDefault()
      onCancel()
      return
    }

    if (event.key !== 'Tab') return
    const focusable = [...(dialogRef.current?.querySelectorAll(focusableSelector) || [])]
    if (!focusable.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#20211e]/60 px-5 py-8"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel()
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-busy={busy}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onKeyDown={handleKeyDown}
        className="w-full max-w-md border border-[#20211e] bg-[#fffdf7] p-6 text-[#20211e] shadow-[8px_8px_0_#a33a2b]"
      >
        <h2 id={titleId} className="font-display text-2xl font-bold">{title}</h2>
        <p id={descriptionId} className="mt-3 leading-6 text-[var(--text-muted)]">{description}</p>
        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="min-h-11 border border-[#20211e] px-5 py-2.5 font-bold transition hover:bg-[#eee8dc] disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (!busy) onConfirm()
            }}
            disabled={busy}
            className="min-h-11 bg-[#a33a2b] px-5 py-2.5 font-bold text-white transition hover:bg-[#842d22] disabled:opacity-60"
          >
            {busy ? 'Deleting...' : confirmLabel}
          </button>
        </div>
      </section>
    </div>,
    document.body
  )
}
