import { useEffect, useState } from 'react'
import { HiOutlinePencil, HiOutlinePlus, HiOutlineTrash } from 'react-icons/hi'
import { useNavigate } from 'react-router-dom'
import adminApi from '../admin/api'
import { clearAdminSession } from '../admin/auth'

const initialForm = {
  section: '',
  subject: '',
  floor: '',
  wing: '',
  room: '',
}

export default function AdminClassroomsPage() {
  const navigate = useNavigate()
  const [classrooms, setClassrooms] = useState([])
  const [subjects, setSubjects] = useState([])
  const [sections, setSections] = useState([])
  const [sectionFilter, setSectionFilter] = useState('')
  const [form, setForm] = useState(initialForm)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetchData()
  }, [sectionFilter])

  const handleUnauthorized = () => {
    clearAdminSession()
    navigate('/admin/login', { replace: true })
  }

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const [classroomsRes, subjectsRes, sectionsRes] = await Promise.all([
        adminApi.get('/classrooms', { params: { section: sectionFilter || undefined } }),
        adminApi.get('/subjects'),
        adminApi.get('/sections'),
      ])
      setClassrooms(classroomsRes.data.data || [])
      setSubjects(subjectsRes.data.data || [])
      setSections(sectionsRes.data.data || [])
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        handleUnauthorized()
        return
      }
      setError('Failed to load classrooms data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setEditingId(null)
    setForm(initialForm)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const payload = {
      section: form.section.trim().toUpperCase(),
      subject: form.subject.trim(),
      floor: form.floor.trim(),
      wing: form.wing.trim().toUpperCase(),
      room: form.room.trim(),
    }

    if (!payload.section || !payload.subject || !payload.floor || !payload.wing || !payload.room) {
      setError('All fields are required.')
      return
    }
    if (!['A', 'B', 'C'].includes(payload.wing)) {
      setError('Wing must be A, B, or C.')
      return
    }

    setSaving(true)
    try {
      if (editingId) {
        await adminApi.put(`/classrooms/${editingId}`, payload)
        setSuccess('Classroom assignment updated successfully.')
      } else {
        await adminApi.post('/classrooms', payload)
        setSuccess('Classroom assignment added successfully.')
      }
      resetForm()
      await fetchData()
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        handleUnauthorized()
        return
      }
      setError(err.response?.data?.message || 'Failed to save classroom assignment.')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (classroom) => {
    setEditingId(classroom.classroom_id)
    setForm({
      section: classroom.section || '',
      subject: classroom.subject || '',
      floor: classroom.floor || '',
      wing: classroom.wing || '',
      room: classroom.room || '',
    })
    setError('')
    setSuccess('')
  }

  const handleDelete = async (classroom) => {
    const confirmed = window.confirm(`Delete "${classroom.subject}" for section "${classroom.section}"?`)
    if (!confirmed) {
      return
    }

    setDeletingId(classroom.classroom_id)
    setError('')
    setSuccess('')
    try {
      await adminApi.delete(`/classrooms/${classroom.classroom_id}`)
      setSuccess('Classroom assignment deleted successfully.')
      if (editingId === classroom.classroom_id) {
        resetForm()
      }
      await fetchData()
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        handleUnauthorized()
        return
      }
      setError(err.response?.data?.message || 'Failed to delete classroom assignment.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <section className="glass-card rounded-2xl p-6">
        <h1 className="text-2xl font-bold text-white mb-1">Classrooms Management</h1>
        <p className="text-slate-400">Maintain section-wise subject classroom assignments.</p>
      </section>

      <section className="glass-card rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">{editingId ? 'Edit Assignment' : 'Add Assignment'}</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            className="input-field"
            placeholder="Section (e.g. CSE-A)"
            value={form.section}
            onChange={(e) => setForm({ ...form, section: e.target.value.toUpperCase() })}
            list="sections-list"
          />
          <datalist id="sections-list">
            {sections.map((section) => (
              <option key={section} value={section} />
            ))}
          </datalist>

          <input
            className="input-field"
            placeholder="Subject"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            list="subjects-list"
          />
          <datalist id="subjects-list">
            {subjects.map((subject) => (
              <option key={subject.subject_id} value={subject.subject_name} />
            ))}
          </datalist>

          <input
            className="input-field"
            placeholder="Floor (e.g. 3rd Floor)"
            value={form.floor}
            onChange={(e) => setForm({ ...form, floor: e.target.value })}
          />
          <select
            className="input-field"
            value={form.wing}
            onChange={(e) => setForm({ ...form, wing: e.target.value })}
          >
            <option value="">Select Wing</option>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
          </select>
          <input
            className="input-field md:col-span-2"
            placeholder="Room (e.g. 305 or Lab-501)"
            value={form.room}
            onChange={(e) => setForm({ ...form, room: e.target.value })}
          />

          <div className="md:col-span-2 flex flex-wrap gap-3">
            <button type="submit" disabled={saving} className="btn-primary inline-flex items-center gap-2">
              <HiOutlinePlus />
              {saving ? 'Saving...' : editingId ? 'Update Assignment' : 'Add Assignment'}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="px-5 py-3 rounded-xl border border-slate-600 hover:border-slate-400 transition"
              >
                Cancel Edit
              </button>
            ) : null}
          </div>
        </form>

        {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
        {success ? <p className="mt-4 text-sm text-emerald-300">{success}</p> : null}
      </section>

      <section className="glass-card rounded-2xl p-6">
        <div className="mb-4">
          <select
            className="input-field md:w-56 py-3"
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
          >
            <option value="">All Sections</option>
            {sections.map((section) => (
              <option key={section} value={section}>{section}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="text-slate-400">Loading classroom assignments...</p>
        ) : classrooms.length === 0 ? (
          <p className="text-slate-400">No classroom assignments found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-700">
                  <th className="py-3 pr-3">Section</th>
                  <th className="py-3 pr-3">Subject</th>
                  <th className="py-3 pr-3">Floor</th>
                  <th className="py-3 pr-3">Wing</th>
                  <th className="py-3 pr-3">Room</th>
                  <th className="py-3 pr-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {classrooms.map((classroom) => (
                  <tr key={classroom.classroom_id} className="border-b border-slate-800">
                    <td className="py-3 pr-3 text-white">{classroom.section}</td>
                    <td className="py-3 pr-3">{classroom.subject}</td>
                    <td className="py-3 pr-3">{classroom.floor}</td>
                    <td className="py-3 pr-3">{classroom.wing}</td>
                    <td className="py-3 pr-3">{classroom.room}</td>
                    <td className="py-3 pr-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(classroom)}
                          className="px-3 py-2 rounded-lg border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10 transition inline-flex items-center gap-1"
                        >
                          <HiOutlinePencil />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(classroom)}
                          disabled={deletingId === classroom.classroom_id}
                          className="px-3 py-2 rounded-lg border border-red-500/30 text-red-300 hover:bg-red-500/10 transition inline-flex items-center gap-1 disabled:opacity-60"
                        >
                          <HiOutlineTrash />
                          {deletingId === classroom.classroom_id ? 'Deleting...' : 'Delete'}
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
    </div>
  )
}
