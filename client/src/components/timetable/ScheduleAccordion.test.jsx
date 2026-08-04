import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import DailySchedule from './DailySchedule'
import DayAccordion from './DayAccordion'

const emptyDailyProps = {
  activeEntry: null,
  currentTime: '08:00',
  formattedDate: 'Monday, 20 July 2026',
  priorityEntry: null,
  todayClasses: [],
  todayEntries: [],
}

describe('schedule accordions', () => {
  it('reports the correct expanded state for today classes', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    const { rerender } = render(
      <DailySchedule {...emptyDailyProps} expanded={false} onToggle={onToggle} />
    )

    const button = screen.getByRole('button', { name: /other classes/i })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    await user.click(button)
    expect(onToggle).toHaveBeenCalledOnce()

    rerender(<DailySchedule {...emptyDailyProps} expanded onToggle={onToggle} />)
    expect(button).toHaveAttribute('aria-expanded', 'true')
  })

  it('reports the correct expanded state for a weekly day', () => {
    render(
      <DayAccordion
        day={{ id: 1, name: 'Monday', shortName: 'MON' }}
        entries={[]}
        expanded
        onToggle={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: /monday/i })).toHaveAttribute('aria-expanded', 'true')
  })
})
