import { useState } from 'react'
import { HiOutlineDocumentAdd, HiOutlineDownload, HiOutlineUpload } from 'react-icons/hi'
import { useNavigate } from 'react-router-dom'
import adminApi from '../admin/api'
import { clearAdminSession } from '../admin/auth'

export default function AdminImportPage() {
  const navigate = useNavigate()
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [pdfDefaults, setPdfDefaults] = useState({ course: '', branch: '', year: '' })
  const isPdf = /\.pdf$/i.test(file?.name || '')

  const downloadTemplate = () => {
    const headers = 'Name,Phone Number,University Roll Number,Class Roll Number,Course,Branch,Year,Section\n'
    const url = URL.createObjectURL(new Blob([headers], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'student-import-template.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0] || null
    setError('')
    setResult(null)

    if (selectedFile && !/\.(csv|xls|xlsx|pdf)$/i.test(selectedFile.name)) {
      setFile(null)
      setError('Choose a PDF, CSV, or Excel file (.pdf, .csv, .xls, or .xlsx).')
      event.target.value = ''
      return
    }
    if (selectedFile && selectedFile.size > 5 * 1024 * 1024) {
      setFile(null)
      setError('The file exceeds the 5MB upload limit.')
      event.target.value = ''
      return
    }
    setFile(selectedFile)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setResult(null)

    if (!file) {
      setError('Please select a PDF, CSV, or Excel file.')
      return
    }

    if (isPdf && (!pdfDefaults.course.trim() || !pdfDefaults.branch.trim() || !pdfDefaults.year)) {
      setError('Enter the course, branch, and year for this PDF roster.')
      return
    }

    const formData = new FormData()
    formData.append('file', file)
    if (isPdf) {
      formData.append('course', pdfDefaults.course.trim())
      formData.append('branch', pdfDefaults.branch.trim())
      formData.append('year', pdfDefaults.year)
    }

    setUploading(true)
    try {
      const response = await adminApi.post('/import/students', formData)
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
        <p className="text-text-secondary">Add many students at once from a BBDU roster PDF, CSV, or Excel spreadsheet.</p>
      </section>

      <section className="rounded-2xl border border-border-default bg-surface-primary p-6 shadow-admin">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="mb-2 text-lg font-semibold text-text-primary">Spreadsheet columns</h2>
            <p className="text-sm text-text-secondary">Required: Name, University Roll Number, Course, Branch, Year, Section</p>
            <p className="mt-1 text-sm text-text-secondary">Optional: Phone Number, Class Roll Number</p>
            <p className="mt-2 text-xs text-text-secondary">Spreadsheets use the first worksheet. Text-based PDFs use every page. Maximum file size: 5MB.</p>
          </div>
          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-border-accent px-4 py-2 font-semibold text-accent-primary transition hover:bg-surface-highlight"
          >
            <HiOutlineDownload />
            Download CSV template
          </button>
        </div>
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
            accept=".pdf,.csv,.xls,.xlsx"
            onChange={handleFileChange}
            className="block w-full text-sm text-text-secondary file:mr-4 file:rounded-lg file:border-0 file:bg-accent-primary file:px-4 file:py-2 file:text-text-on-accent hover:file:bg-accent-strong"
            required
          />

          <p className="text-xs text-text-secondary">Accepted formats: PDF, CSV, XLS, XLSX</p>

          {isPdf ? (
            <fieldset className="grid gap-4 border-t border-border-default pt-4 sm:grid-cols-3">
              <legend className="mb-3 text-sm font-semibold text-text-primary">Details applied to every student in this PDF</legend>
              <label className="text-sm font-medium text-text-primary">
                Course
                <input className="input-field mt-2" value={pdfDefaults.course} onChange={(event) => setPdfDefaults({ ...pdfDefaults, course: event.target.value })} placeholder="For example, B.Tech" required />
              </label>
              <label className="text-sm font-medium text-text-primary">
                Branch
                <input className="input-field mt-2" value={pdfDefaults.branch} onChange={(event) => setPdfDefaults({ ...pdfDefaults, branch: event.target.value })} placeholder="For example, CSAI" required />
              </label>
              <label className="text-sm font-medium text-text-primary">
                Year
                <select className="input-field mt-2" value={pdfDefaults.year} onChange={(event) => setPdfDefaults({ ...pdfDefaults, year: event.target.value })} required>
                  <option value="">Select year</option>
                  {[1, 2, 3, 4].map((year) => <option key={year} value={year}>Year {year}</option>)}
                </select>
              </label>
            </fieldset>
          ) : null}

          <button type="submit" disabled={uploading} aria-busy={uploading} className="btn-primary inline-flex items-center gap-2">
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
              <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
                {result.errors.map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
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
