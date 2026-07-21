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
      <section className="glass-card rounded-2xl p-6">
        <h1 className="text-2xl font-bold text-white mb-1">Import Students</h1>
        <p className="text-slate-400">Upload an XLSX or CSV file to add student records.</p>
      </section>

      <section className="glass-card rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Required Columns</h2>
        <p className="text-sm text-slate-400 mb-2">Name, University Roll Number, Course, Branch, Year, Section</p>
        <p className="text-xs text-slate-500 mb-2">Optional column: Class Roll Number</p>
        <p className="text-xs text-slate-500">
          Accepted formats: .xlsx, .csv (max 5MB)
        </p>
      </section>

      <section className="glass-card rounded-2xl p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <label htmlFor="student-import-file" className="flex items-center gap-3 text-slate-300">
            <HiOutlineDocumentAdd className="text-indigo-400" />
            <span>Select File</span>
          </label>
          <input
            id="student-import-file"
            type="file"
            accept=".xlsx,.csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:text-white hover:file:bg-indigo-500"
            required
          />

          <button type="submit" disabled={uploading} className="btn-primary inline-flex items-center gap-2">
            <HiOutlineUpload />
            {uploading ? 'Importing...' : 'Import Students'}
          </button>
        </form>

        {error ? <p role="alert" className="mt-4 text-sm text-red-300">{error}</p> : null}
      </section>

      {result ? (
        <section aria-live="polite" className="glass-card rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Import Result</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="rounded-xl bg-white/5 p-4">
              <p className="text-xs text-slate-400">Total Rows</p>
              <p className="text-xl font-bold text-white">{result.total}</p>
            </div>
            <div className="rounded-xl bg-emerald-500/10 p-4 border border-emerald-500/20">
              <p className="text-xs text-emerald-300">Imported</p>
              <p className="text-xl font-bold text-emerald-200">{result.imported}</p>
            </div>
            <div className="rounded-xl bg-amber-500/10 p-4 border border-amber-500/20">
              <p className="text-xs text-amber-300">Skipped</p>
              <p className="text-xl font-bold text-amber-200">{result.skipped}</p>
            </div>
          </div>

          {result.errors?.length ? (
            <div>
              <h3 className="text-sm font-semibold text-red-300 mb-2">Skipped Row Details</h3>
              <ul className="space-y-1 text-sm text-slate-300">
                {result.errors.map((item, index) => (
                  <li key={`${item}-${index}`}>• {item}</li>
                ))}
              </ul>
              {result.omittedErrors ? (
                <p className="mt-2 text-xs text-slate-400">
                  {result.omittedErrors} additional row errors were omitted from this response.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-emerald-300">No row-level errors found.</p>
          )}
        </section>
      ) : null}
    </div>
  )
}
