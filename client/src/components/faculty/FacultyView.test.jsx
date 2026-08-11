import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import FacultyView from './FacultyView'

test('shows timetable faculty even when contact information is missing', () => {
  render(<FacultyView section="CSAI2B" contacts={[
    { id: 1, name: 'Ms. Jyoti Yadav', role: 'Coordinator', phoneNumber: '9876543210' },
    { id: 2, name: 'Dr. Amit Sharma', role: 'Faculty', phoneNumber: null },
  ]} />)

  expect(screen.getByText('Ms. Jyoti Yadav')).toBeInTheDocument()
  expect(screen.getByText('Dr. Amit Sharma')).toBeInTheDocument()
  expect(screen.getByText('Contact information not available.')).toBeInTheDocument()
  expect(screen.getAllByRole('link', { name: /call/i })).toHaveLength(2)
});

test('does not duplicate the coordinator in other faculty', () => {
  render(<FacultyView section="CSAI2B" contacts={[
    { id: 1, name: 'Ms. Jyoti Yadav', role: 'Coordinator', phoneNumber: null },
  ]} />)

  expect(screen.getAllByText('Ms. Jyoti Yadav')).toHaveLength(1)
});
