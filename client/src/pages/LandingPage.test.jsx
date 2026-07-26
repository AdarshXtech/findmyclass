import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { lookupStudentSchedule } from '../api/publicApi'
import LandingPage from './LandingPage'

vi.mock('../api/publicApi', () => ({
  lookupStudentSchedule: vi.fn(),
}))

function renderLandingPage() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/result" element={<p>Timetable opened</p>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('LandingPage identity lookup', () => {
  beforeEach(() => {
    lookupStudentSchedule.mockReset()
  })

  it('provides visible, persistent labels for both fields', () => {
    renderLandingPage()

    expect(screen.getByLabelText('Student name')).toBeVisible()
    expect(screen.getByLabelText('Phone number')).toBeVisible()
  })

  it('normalizes name case, extra spaces, and a +91 phone prefix', async () => {
    const user = userEvent.setup()
    lookupStudentSchedule.mockResolvedValue({
      data: { data: { student: {}, timetable: [], classrooms: [] } },
    })
    renderLandingPage()

    await user.type(screen.getByLabelText('Student name'), '  aDaRsH   tIwArI  ')
    await user.type(screen.getByLabelText('Phone number'), '+91 9110081610')
    await user.click(screen.getByRole('button', { name: 'Open my timetable' }))

    await waitFor(() => {
      expect(lookupStudentSchedule).toHaveBeenCalledWith(
        { name: 'ADARSH TIWARI', phoneNumber: '9110081610' },
        expect.objectContaining({ onRetry: expect.any(Function) })
      )
    })
    expect(screen.getByText('Timetable opened')).toBeVisible()
  })

  it('preserves entered values after an unsuccessful lookup', async () => {
    const user = userEvent.setup()
    lookupStudentSchedule.mockRejectedValue({
      response: { data: { message: 'Student details not found.' } },
    })
    renderLandingPage()

    const nameInput = screen.getByLabelText('Student name')
    const phoneInput = screen.getByLabelText('Phone number')
    await user.type(nameInput, 'Adarsh Tiwari')
    await user.type(phoneInput, '9110081610')
    await user.click(screen.getByRole('button', { name: 'Open my timetable' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Student details not found.')
    expect(nameInput).toHaveValue('Adarsh Tiwari')
    expect(phoneInput).toHaveValue('9110081610')
  })

  it('does not render a full phone number as page content', () => {
    renderLandingPage()

    expect(screen.queryByText('9110081610')).not.toBeInTheDocument()
    expect(document.body).not.toHaveTextContent('9110081610')
  })
})
