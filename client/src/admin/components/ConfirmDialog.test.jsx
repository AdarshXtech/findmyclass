import { useRef, useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ConfirmDialog from './ConfirmDialog'

function DialogHarness() {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef(null)

  return (
    <>
      <button ref={triggerRef} type="button" onClick={() => setOpen(true)}>Remove student</button>
      {open ? (
        <ConfirmDialog
          title="Delete student?"
          description="This will remove Rudransh Kumar Singh from CSAI 2B."
          confirmLabel="Delete student"
          returnFocusTo={triggerRef.current}
          onCancel={() => setOpen(false)}
          onConfirm={vi.fn()}
        />
      ) : null}
    </>
  )
}

describe('ConfirmDialog', () => {
  it('traps focus, closes with Escape, and returns focus to its trigger', async () => {
    const user = userEvent.setup()
    render(<DialogHarness />)

    const trigger = screen.getByRole('button', { name: 'Remove student' })
    await user.click(trigger)

    const cancel = screen.getByRole('button', { name: 'Cancel' })
    const confirm = screen.getByRole('button', { name: 'Delete student' })
    expect(screen.getByRole('dialog', { name: 'Delete student?' })).toBeInTheDocument()
    expect(cancel).toHaveFocus()

    await user.keyboard('{Shift>}{Tab}{/Shift}')
    expect(confirm).toHaveFocus()
    await user.tab()
    expect(cancel).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })
})
