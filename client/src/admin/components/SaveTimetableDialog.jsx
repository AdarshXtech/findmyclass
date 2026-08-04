import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'

export default function SaveTimetableDialog({ busy, error, onCancel, onSave }) {
  const titleId = useId()
  const dialogRef = useRef(null)
  const cancelRef = useRef(null)

  useEffect(() => {
    cancelRef.current?.focus()
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !busy) onCancel()
      if (event.key !== 'Tab') return
      const controls = [...dialogRef.current.querySelectorAll('button:not([disabled])')]
      const first = controls[0]
      const last = controls.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [busy, onCancel])

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay-dialog p-5">
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-lg border border-border-strong bg-surface-primary p-6 shadow-brand"
      >
        <h2 id={titleId} className="font-display text-2xl font-bold">How should this timetable be saved?</h2>
        <p className="mt-2 text-text-secondary">Replace the complete class schedule, or merge these rows into it.</p>
        {error ? <p role="alert" className="mt-4 border-l-4 border-status-danger pl-3 text-sm text-status-danger">{error}</p> : null}
        <div className="mt-6 grid gap-3">
          <button type="button" disabled={busy} onClick={() => onSave('replace')} className="min-h-11 bg-accent-primary px-4 py-3 font-bold text-text-on-accent disabled:opacity-60">
            Replace existing timetable
          </button>
          <button type="button" disabled={busy} onClick={() => onSave('merge')} className="min-h-11 border border-border-strong px-4 py-3 font-bold disabled:opacity-60">
            Merge with existing timetable
          </button>
          <button ref={cancelRef} type="button" disabled={busy} onClick={onCancel} className="min-h-11 px-4 py-3 font-bold text-text-secondary">
            Cancel
          </button>
        </div>
      </section>
    </div>,
    document.body
  )
}
