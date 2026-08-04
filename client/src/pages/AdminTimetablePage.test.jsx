import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import adminApi from '../admin/api'
import AdminTimetablePage from './AdminTimetablePage'

vi.mock('../admin/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

const timetableClass = { course: 'B.Tech', branch: 'CSE AI', year: 2, section: 'CSAI2B' }
const timetableEntry = {
  timetableEntryId: 12,
  day: 'Monday',
  startTime: '10:00',
  endTime: '11:00',
  subjectName: 'Digital Logic Design',
  facultyName: 'Mr. Sharma',
  sessionType: 'Lecture',
  classroom: '407',
  parsedLocation: { displayLabel: 'Floor 4 · Wing A · Room 407' },
}

async function selectClass(user) {
  await user.selectOptions(await screen.findByLabelText('Course'), 'B.Tech::CSE AI')
  await user.selectOptions(screen.getByLabelText('Year'), '2')
  await user.selectOptions(screen.getByLabelText('Class / Section'), 'CSAI2B')
}

function mockSchedule(rows = []) {
  adminApi.get.mockImplementation((url) => Promise.resolve({
    data: { data: url === '/timetables' ? { classes: [timetableClass] } : { rows } },
  }))
}

describe('AdminTimetablePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSchedule()
  })

  it('offers all four manager modes with persistent class and entry labels', async () => {
    render(<AdminTimetablePage />)
    expect(await screen.findByRole('tab', { name: /Add Manually/i })).toBeVisible()
    expect(screen.getByRole('tab', { name: /Import Timetable/i })).toBeVisible()
    expect(screen.getByRole('tab', { name: /Edit Existing/i })).toBeVisible()
    expect(screen.getByRole('tab', { name: /Delete Timetable/i })).toBeVisible()
    expect(screen.getByLabelText('Course')).toBeVisible()
    expect(screen.getByLabelText('Year')).toBeVisible()
    expect(screen.getByLabelText('Class / Section')).toBeVisible()
    expect(screen.getByLabelText('Classroom')).toBeVisible()
  })

  it('shows imported rows in a preview without saving them', async () => {
    const user = userEvent.setup()
    adminApi.post.mockResolvedValueOnce({
      data: {
        data: {
          saved: false,
          rows: [{
            ...timetableEntry,
            clientId: 'row-1',
            status: 'valid',
            errors: [],
          }],
        },
      },
    })
    render(<AdminTimetablePage />)
    await selectClass(user)
    await user.click(screen.getByRole('tab', { name: /Import Timetable/i }))
    await user.type(screen.getByLabelText('Timetable text'), 'Day | Time | Subject | Teacher | Room')
    await user.click(screen.getByRole('button', { name: 'Create editable preview' }))

    expect(await screen.findByText('Import preview')).toBeVisible()
    expect(screen.getByDisplayValue('Digital Logic Design')).toBeVisible()
    expect(adminApi.post).toHaveBeenCalledTimes(1)
    expect(adminApi.post.mock.calls[0][0]).toBe('/timetables/import')
    await waitFor(() => expect(screen.getByText(/Nothing is saved/)).toBeVisible())
  })

  it('validates and adds a manual timetable entry', async () => {
    const user = userEvent.setup()
    adminApi.post.mockImplementation((url, body) => {
      if (url === '/timetables/validate') {
        return Promise.resolve({
          data: {
            data: {
              valid: true,
              rows: [{
                ...body.rows[0],
                day: 'Monday',
                status: 'valid',
                errors: [],
                parsedLocation: timetableEntry.parsedLocation,
              }],
            },
          },
        })
      }
      return Promise.resolve({ data: { success: true } })
    })
    render(<AdminTimetablePage />)
    await selectClass(user)
    await user.type(screen.getByLabelText('Subject'), 'Digital Logic Design')
    await user.type(screen.getByLabelText('Teacher'), 'Mr. Sharma')
    await user.type(screen.getByLabelText('Classroom'), '407')
    await user.click(screen.getByRole('button', { name: 'Add timetable entry' }))

    await waitFor(() => expect(adminApi.post).toHaveBeenCalledWith('/timetables', expect.objectContaining({
      mode: 'merge',
      section: 'CSAI2B',
    })))
    expect(await screen.findByText('Timetable entry added successfully.')).toBeVisible()
  })

  it('edits an existing timetable entry and preserves its selected class', async () => {
    const user = userEvent.setup()
    mockSchedule([timetableEntry])
    adminApi.put.mockResolvedValue({ data: { success: true } })
    render(<AdminTimetablePage />)
    await selectClass(user)
    await user.click(screen.getByRole('tab', { name: /Edit Existing/i }))
    const subject = await screen.findByDisplayValue('Digital Logic Design')
    await user.clear(subject)
    await user.type(subject, 'Updated Digital Logic')
    await user.click(screen.getByRole('button', { name: /Save edit/i }))

    await waitFor(() => expect(adminApi.put).toHaveBeenCalledWith('/timetables/12', expect.objectContaining({
      subjectName: 'Updated Digital Logic',
    })))
    expect(screen.getByLabelText('Class / Section')).toHaveValue('CSAI2B')
    expect(await screen.findByText('Timetable entry updated.')).toBeVisible()
  })

  it('shows lunch as an editable break without counting it as a class', async () => {
    const user = userEvent.setup()
    mockSchedule([
      timetableEntry,
      { timetableEntryId: 13, day: 'Monday', startTime: '13:00', endTime: '14:00', subjectName: 'Lunch break', facultyName: '', sessionType: 'Break', classroom: '' },
    ])
    render(<AdminTimetablePage />)
    await selectClass(user)
    await user.click(screen.getByRole('tab', { name: /Edit Existing/i }))

    expect(await screen.findByText('Monday', { selector: 'summary' })).toHaveTextContent('Monday (1)')
    expect(screen.getByDisplayValue('Lunch break')).toBeVisible()
    expect(screen.getAllByRole('button', { name: /Save edit/i })).toHaveLength(2)
  })

  it('cancels a single-entry deletion without calling the API', async () => {
    const user = userEvent.setup()
    mockSchedule([timetableEntry])
    render(<AdminTimetablePage />)
    await selectClass(user)
    await user.click(screen.getByRole('tab', { name: /Edit Existing/i }))
    await user.click(await screen.findByRole('button', { name: 'Delete' }))

    expect(screen.getByRole('dialog', { name: 'Delete timetable entry?' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(adminApi.delete).not.toHaveBeenCalled()
    expect(screen.getByDisplayValue('Digital Logic Design')).toBeVisible()
  })

  it('deletes one entry and refreshes the selected timetable', async () => {
    const user = userEvent.setup()
    let scheduleLoads = 0
    adminApi.get.mockImplementation((url) => Promise.resolve({
      data: { data: url === '/timetables' ? { classes: [timetableClass] } : { rows: scheduleLoads++ ? [] : [timetableEntry] } },
    }))
    adminApi.delete.mockResolvedValue({ data: { success: true } })
    render(<AdminTimetablePage />)
    await selectClass(user)
    await user.click(screen.getByRole('tab', { name: /Edit Existing/i }))
    await user.click(await screen.findByRole('button', { name: 'Delete' }))
    await user.click(screen.getByRole('button', { name: 'Delete entry' }))

    await waitFor(() => expect(adminApi.delete).toHaveBeenCalledWith('/timetables/12'))
    expect(await screen.findByText('Timetable entry deleted successfully.')).toBeVisible()
    await waitFor(() => expect(screen.queryByDisplayValue('Digital Logic Design')).not.toBeInTheDocument())
  })

  it('keeps an entry visible and shows a backend delete error inside the dialog', async () => {
    const user = userEvent.setup()
    mockSchedule([timetableEntry])
    adminApi.delete.mockRejectedValue({ response: { status: 500, data: {} } })
    render(<AdminTimetablePage />)
    await selectClass(user)
    await user.click(screen.getByRole('tab', { name: /Edit Existing/i }))
    await user.click(await screen.findByRole('button', { name: 'Delete' }))
    await user.click(screen.getByRole('button', { name: 'Delete entry' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not delete timetable entry. Please try again.')
    expect(screen.getByDisplayValue('Digital Logic Design')).toBeVisible()
  })

  it('requires DELETE before removing a complete timetable', async () => {
    const user = userEvent.setup()
    mockSchedule([timetableEntry])
    adminApi.delete.mockResolvedValue({ data: { success: true, deletedCount: 1 } })
    render(<AdminTimetablePage />)
    await selectClass(user)
    await user.click(screen.getByRole('tab', { name: /Delete Timetable/i }))
    await user.click(await screen.findByRole('button', { name: 'Delete complete timetable' }))

    const dialog = screen.getByRole('dialog', { name: 'Delete full timetable for CSAI2B?' })
    const finalDelete = within(dialog).getByRole('button', { name: 'Delete complete timetable' })
    expect(finalDelete).toBeDisabled()
    await user.type(screen.getByLabelText('Type DELETE to confirm'), 'delete')
    expect(finalDelete).toBeEnabled()
    await user.click(finalDelete)

    await waitFor(() => expect(adminApi.delete).toHaveBeenCalledWith('/timetables/class/CSAI2B'))
    expect(await screen.findByText('Complete timetable for CSAI2B deleted successfully.')).toBeVisible()
  })

  it('shows an empty state instead of enabling complete deletion', async () => {
    const user = userEvent.setup()
    render(<AdminTimetablePage />)
    await selectClass(user)
    await user.click(screen.getByRole('tab', { name: /Delete Timetable/i }))

    expect(await screen.findByText('No timetable entries found for this class.')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Delete complete timetable' })).not.toBeInTheDocument()
  })
})
