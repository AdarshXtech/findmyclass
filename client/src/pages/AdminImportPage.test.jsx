import { MemoryRouter } from 'react-router-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import adminApi from '../admin/api'
import AdminImportPage from './AdminImportPage'

vi.mock('../admin/api', () => ({
  default: { post: vi.fn() },
}))

describe('AdminImportPage', () => {
  it('collects the missing class defaults when a PDF roster is selected', async () => {
    const user = userEvent.setup()
    adminApi.post.mockResolvedValue({ data: { data: { total: 1, imported: 1, skipped: 0, errors: [] } } })
    render(<MemoryRouter><AdminImportPage /></MemoryRouter>)

    await user.upload(screen.getByLabelText('Select File'), new File(['%PDF-1.7'], 'roster.pdf', { type: 'application/pdf' }))
    expect(screen.getByRole('group', { name: 'Details applied to every student in this PDF' })).toBeVisible()

    await user.type(screen.getByLabelText('Course'), 'B.Tech')
    await user.type(screen.getByLabelText('Branch'), 'CSAI')
    await user.selectOptions(screen.getByLabelText('Year'), '2')
    fireEvent.submit(screen.getByRole('button', { name: 'Import Students' }).closest('form'))

    await waitFor(() => expect(adminApi.post).toHaveBeenCalledTimes(1))
    const body = adminApi.post.mock.calls[0][1]
    expect(body.get('course')).toBe('B.Tech')
    expect(body.get('branch')).toBe('CSAI')
    expect(body.get('year')).toBe('2')
  })
})
