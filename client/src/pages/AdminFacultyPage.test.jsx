import { MemoryRouter } from 'react-router-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import adminApi from '../admin/api'
import AdminFacultyPage from './AdminFacultyPage'

vi.mock('../admin/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

const classes = [{ course: 'B.Tech', branch: 'CSE AI', year: 2, section: 'CSAI2B' }]
const detectedFaculty = {
  id: 12,
  section: 'CSAI2B',
  name: 'Dr. Amit Sharma',
  phoneNumber: null,
  designation: null,
  department: null,
  role: 'Faculty',
}

describe('AdminFacultyPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    adminApi.get.mockResolvedValue({ data: { data: { classes, contacts: [detectedFaculty] } } })
    adminApi.post.mockResolvedValue({ data: { success: true } })
  })

  it('uses a timetable-detected name when adding optional contact details', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><AdminFacultyPage /></MemoryRouter>)

    expect(await screen.findByText('Dr. Amit Sharma')).toBeVisible()
    expect(screen.getByText('Phone number not added')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Add phone number' }))
    expect(screen.getByLabelText('Faculty name')).toHaveValue('Dr. Amit Sharma')
    await user.type(screen.getByLabelText('Phone number (optional)'), '+91 98765 43210')
    await user.type(screen.getByLabelText('Designation (optional)'), 'Assistant Professor')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(adminApi.put).toHaveBeenCalledWith('/faculty/12', expect.objectContaining({
      name: 'Dr. Amit Sharma',
      phoneNumber: '+91 98765 43210',
      designation: 'Assistant Professor',
      section: 'CSAI2B',
    })))
  })
})
