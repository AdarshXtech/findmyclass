import { useState } from 'react'
import { HiOutlineDocumentAdd, HiOutlineUpload } from 'react-icons/hi'
import { useNavigate } from 'react-router-dom'
import adminApi from '../admin/api'
import { clearAdminSession } from '../admin/auth'

export default function AdminImportPage() {
  const navigate = useNavigate()
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setResult(null)

    if (!file) {
      setError('Please select an XLSX or CSV file.')
      return
    }

    const formData = new FormData()
    formData.append('file', file)

    setUploading(true)
    try {
      const response = await adminApi.post('/import/students', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResult(response.data.data)
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        clearAdminSession()
        navigate('/admin/login', { replace: true })
        return
      }
      setError(err.response?.data?.message || 'Failed to import students.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border-default bg-surface-primary p-6 shadow-admin">
        <h1 className="mb-1 text-2xl font-bold text-text-primary">Import Students</h1>
        <p className="text-text-secondary">Upload an XLSX or CSV file to add student records.</p>
      </section>

      <section className="rounded-2xl border border-border-default bg-surface-primary p-6 shadow-admin">
        <h2 className="mb-4 text-lg font-semibold text-text-primary">Required Columns</h2>
        <p className="mb-2 text-sm text-text-secondary">Name, University Roll Number, Course, Branch, Year, Section</p>
        <p className="mb-2 text-xs text-text-secondary">Optional column: Class Roll Number</p>
        <p className="text-xs text-text-secondary">
          Accepted formats: .xlsx, .csv (max 5MB)
        </p>
      </section>

      <section className="rounded-2xl border border-border-default bg-surface-primary p-6 shadow-admin">
        <form onSubmit={handleSubmit} className="space-y-4">
          <label htmlFor="student-import-file" className="flex items-center gap-3 text-text-secondary">
            <HiOutlineDocumentAdd className="text-accent-primary" />
            <span>Select File</span>
          </label>
          <input
            id="student-import-file"
            type="file"
            accept=".xlsx,.csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-text-secondary file:mr-4 file:rounded-lg file:border-0 file:bg-accent-primary file:px-4 file:py-2 file:text-text-on-accent hover:file:bg-accent-strong"
            required
          />

          <button type="submit" disabled={uploading} className="btn-primary inline-flex items-center gap-2">
            <HiOutlineUpload />
            {uploading ? 'Importing...' : 'Import Students'}
          </button>
        </form>

        {error ? <p role="alert" className="mt-4 text-sm text-status-danger">{error}</p> : null}
      </section>

      {result ? (
        <section aria-live="polite" className="rounded-2xl border border-border-default bg-surface-primary p-6 shadow-admin">
          <h2 className="mb-4 text-lg font-semibold text-text-primary">Import Result</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="rounded-xl bg-surface-muted p-4">
              <p className="text-xs text-text-secondary">Total Rows</p>
              <p className="text-xl font-bold text-text-primary">{result.total}</p>
            </div>
            <div className="rounded-xl border border-border-success bg-surface-success p-4">
              <p className="text-xs text-status-success">Imported</p>
              <p className="text-xl font-bold text-status-success">{result.imported}</p>
            </div>
            <div className="rounded-xl border border-border-warning bg-surface-highlight p-4">
              <p className="text-xs text-status-warning">Skipped</p>
              <p className="text-xl font-bold text-status-warning">{result.skipped}</p>
            </div>
          </div>

          {result.errors?.length ? (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-status-danger">Skipped Row Details</h3>
              <ul className="space-y-1 text-sm text-text-secondary">
                {result.errors.map((item, index) => (
                  <li key={`${item}-${index}`}>• {item}</li>
                ))}
              </ul>
              {result.omittedErrors ? (
                <p className="mt-2 text-xs text-text-secondary">
                  {result.omittedErrors} additional row errors were omitted from this response.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-status-success">No row-level errors found.</p>
          )}
        </section>
      ) : null}
    </div>
  )
}
