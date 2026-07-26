import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import adminApi from '../admin/api'
import AdminTimetablePage from './AdminTimetablePage'

vi.mock('../admin/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

const timetableClass = { course: 'B.Tech', branch: 'CSE AI', year: 2, section: 'CSAI2B' }

describe('AdminTimetablePage', () => {
  beforeEach(() => {
    adminApi.get.mockImplementation((url) => Promise.resolve({
      data: { data: url === '/timetables' ? { classes: [timetableClass] } : { rows: [] } },
    }))
    adminApi.post.mockReset()
  })

  it('offers all three manager modes with persistent field labels', async () => {
    render(<AdminTimetablePage />)
    expect(await screen.findByRole('tab', { name: /Add Manually/i })).toBeVisible()
    expect(screen.getByRole('tab', { name: /Import from Image\/Text/i })).toBeVisible()
    expect(screen.getByRole('tab', { name: /Edit Existing/i })).toBeVisible()
    expect(screen.getByLabelText('Course, year and class')).toBeVisible()
    expect(screen.getByLabelText('Classroom')).toBeVisible()
  })

  it('shows imported rows in a preview without saving them', async () => {
    const user = userEvent.setup()
    adminApi.post.mockResolvedValueOnce({
      data: {
        data: {
          saved: false,
          rows: [{
            clientId: 'row-1',
            day: 'Monday',
            startTime: '10:00',
            endTime: '11:00',
            subjectName: 'Digital Logic Design',
            facultyName: 'Mr. Sharma',
            sessionType: 'Lecture',
            classroom: '407',
            status: 'valid',
            errors: [],
            parsedLocation: { displayLabel: 'Floor 4 · Wing A · Room 407' },
          }],
        },
      },
    })
    render(<AdminTimetablePage />)
    await user.selectOptions(await screen.findByLabelText('Course, year and class'), 'CSAI2B')
    await user.click(screen.getByRole('tab', { name: /Import from Image\/Text/i }))
    await user.type(screen.getByLabelText('Timetable text'), 'Day | Time | Subject | Teacher | Room')
    await user.click(screen.getByRole('button', { name: 'Create editable preview' }))

    expect(await screen.findByText('Import preview')).toBeVisible()
    expect(screen.getByDisplayValue('Digital Logic Design')).toBeVisible()
    expect(adminApi.post).toHaveBeenCalledTimes(1)
    expect(adminApi.post.mock.calls[0][0]).toBe('/timetables/import')
    await waitFor(() => expect(screen.getByText(/Nothing is saved/)).toBeVisible())
  })
})
