import { useEffect, useState } from 'react'
import { HiOutlinePencil, HiOutlinePlus, HiOutlineTrash } from 'react-icons/hi'
import { useNavigate } from 'react-router-dom'
import adminApi from '../admin/api'
import { clearAdminSession } from '../admin/auth'
import ConfirmDialog from '../admin/components/ConfirmDialog'

export default function AdminSubjectsPage() {
  const navigate = useNavigate()
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [subjectName, setSubjectName] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetchSubjects()
  }, [])

  const handleUnauthorized = () => {
    clearAdminSession()
    navigate('/admin/login', { replace: true })
  }

  const fetchSubjects = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await adminApi.get('/subjects')
      setSubjects(response.data.data || [])
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        handleUnauthorized()
        return
      }
      setError('Failed to load subjects. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setEditingId(null)
    setSubjectName('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    const payload = { subject_name: subjectName.trim() }

    if (!payload.subject_name) {
      setError('Subject name is required.')
      return
    }

    setSaving(true)
    const previousSubjects = subjects
    const submittedName = subjectName
    const submittedEditingId = editingId
    const optimisticId = editingId || `optimistic-${Date.now()}`
    const optimisticSubject = { subject_id: optimisticId, subject_name: payload.subject_name }
    setSubjects((current) => [
      ...current.filter((subject) => subject.subject_id !== editingId),
      optimisticSubject,
    ].sort((a, b) => a.subject_name.localeCompare(b.subject_name)))
    resetForm()

    try {
      let response
      if (editingId) {
        response = await adminApi.put(`/subjects/${editingId}`, payload)
        setSuccess('Subject updated successfully.')
      } else {
        response = await adminApi.post('/subjects', payload)
        setSuccess('Subject added successfully.')
      }

      const savedSubject = response.data.data
      setSubjects((current) => [
        ...current.filter((subject) => (
          subject.subject_id !== optimisticId && subject.subject_id !== submittedEditingId
        )),
        savedSubject,
      ].sort((a, b) => a.subject_name.localeCompare(b.subject_name)))
    } catch (err) {
      setSubjects(previousSubjects)
      setEditingId(submittedEditingId)
      setSubjectName(submittedName)
      if (err.response?.status === 401 || err.response?.status === 403) {
        handleUnauthorized()
        return
      }
      setError(`${err.response?.data?.message || 'Failed to save subject.'} Changes were rolled back.`)
      setSuccess('')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (subject) => {
    setEditingId(subject.subject_id)
    setSubjectName(subject.subject_name || '')
    setError('')
    setSuccess('')
  }

  const handleDelete = async (subject) => {
    setDeletingId(subject.subject_id)
    setError('')
    setSuccess('')
    const previousSubjects = subjects
    const wasEditing = editingId === subject.subject_id
    setSubjects((current) => current.filter((entry) => entry.subject_id !== subject.subject_id))
    if (wasEditing) resetForm()

    try {
      await adminApi.delete(`/subjects/${subject.subject_id}`)
      setSuccess('Subject deleted successfully.')
    } catch (err) {
      setSubjects(previousSubjects)
      if (wasEditing) handleEdit(subject)
      if (err.response?.status === 401 || err.response?.status === 403) {
        handleUnauthorized()
        return
      }
      setError(`${err.response?.data?.message || 'Failed to delete subject.'} The subject was restored.`)
      setSuccess('')
    } finally {
      setDeletingId(null)
      setPendingDelete(null)
    }
  }

  return (
    <div className="space-y-6">
      <section className="glass-card rounded-2xl p-6">
        <h1 className="text-2xl font-bold text-white mb-1">Subjects Management</h1>
        <p className="text-slate-400">Create and manage subject master data.</p>
      </section>

      <section className="glass-card rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">{editingId ? 'Edit Subject' : 'Add Subject'}</h2>
        <form onSubmit={handleSubmit} className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="subject-name" className="mb-2 block text-sm font-bold text-slate-300">Subject name</label>
            <input
              id="subject-name"
              className="input-field"
              placeholder="For example, Digital Logic Design"
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value)}
              required
            />
          </div>
          <button type="submit" disabled={saving} className="btn-primary inline-flex items-center justify-center gap-2 sm:w-auto">
            <HiOutlinePlus />
            {saving ? 'Saving...' : editingId ? 'Update Subject' : 'Add Subject'}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={resetForm}
              className="px-5 py-3 rounded-xl border border-slate-600 hover:border-slate-400 transition"
            >
              Cancel
            </button>
          ) : null}
        </form>

        {error ? <p role="alert" className="mt-4 text-sm text-red-300">{error}</p> : null}
        {success ? <p role="status" className="mt-4 text-sm text-emerald-300">{success}</p> : null}
      </section>

      <section className="glass-card rounded-2xl p-6">
        {loading ? (
          <p className="text-slate-400">Loading subjects...</p>
        ) : subjects.length === 0 ? (
          <p className="text-slate-400">No subjects found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-700">
                  <th className="py-3 pr-3">Subject Name</th>
                  <th className="py-3 pr-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((subject) => (
                  <tr key={subject.subject_id} className="border-b border-slate-800">
                    <td className="py-3 pr-3 text-white">{subject.subject_name}</td>
                    <td className="py-3 pr-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(subject)}
                          className="px-3 py-2 rounded-lg border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10 transition inline-flex items-center gap-1"
                        >
                          <HiOutlinePencil />
                          Edit
                        </button>
                        <button
                          onClick={(event) => setPendingDelete({ subject, trigger: event.currentTarget })}
                          disabled={deletingId === subject.subject_id}
                          className="min-h-11 px-3 py-2 rounded-lg border border-red-500/30 text-red-300 hover:bg-red-500/10 transition inline-flex items-center gap-1 disabled:opacity-60"
                        >
                          <HiOutlineTrash />
                          {deletingId === subject.subject_id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {pendingDelete ? (
        <ConfirmDialog
          title="Delete subject?"
          description={`This will remove ${pendingDelete.subject.subject_name} from the subject list.`}
          confirmLabel="Delete subject"
          busy={deletingId === pendingDelete.subject.subject_id}
          returnFocusTo={pendingDelete.trigger}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => handleDelete(pendingDelete.subject)}
        />
      ) : null}
    </div>
  )
}
