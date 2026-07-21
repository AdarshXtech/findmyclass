import { useEffect, useState } from 'react'
import { HiOutlinePencil, HiOutlinePlus, HiOutlineSearch, HiOutlineTrash } from 'react-icons/hi'
import { useNavigate } from 'react-router-dom'
import adminApi from '../admin/api'
import { clearAdminSession } from '../admin/auth'

const initialForm = {
  name: '',
  university_roll_number: '',
  class_roll_number: '',
  course: '',
  branch: '',
  year: '',
  section: '',
}

export default function AdminStudentsPage() {
  const navigate = useNavigate()
  const [students, setStudents] = useState([])
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [search, setSearch] = useState('')
  const [sectionFilter, setSectionFilter] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetchData()
  }, [sectionFilter])

  const handleUnauthorized = () => {
    clearAdminSession()
    navigate('/admin/login', { replace: true })
  }

  const fetchData = async (searchValue = search) => {
    setLoading(true)
    setError('')

    try {
      const [studentsRes, sectionsRes] = await Promise.all([
        adminApi.get('/students', {
          params: {
            search: searchValue || undefined,
            section: sectionFilter || undefined,
          },
        }),
        adminApi.get('/sections'),
      ])
      setStudents(studentsRes.data.data || [])
      setSections(sectionsRes.data.data || [])
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        handleUnauthorized()
        return
      }
      setError('Failed to load students. Please try again.')
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
      name: form.name.trim(),
      university_roll_number: form.university_roll_number.trim().replace(/\s+/g, '').toUpperCase() || null,
      class_roll_number: form.class_roll_number ? Number(form.class_roll_number) : null,
      course: form.course.trim(),
      branch: form.branch.trim(),
      year: Number(form.year),
      section: form.section.trim().toUpperCase(),
    }

    if (!payload.name || !payload.course || !payload.branch || !payload.year || !payload.section) {
      setError('Name, course, branch, year, and section are required.')
      return
    }
    if (!payload.university_roll_number) {
      setError('University roll number is required.')
      return
    }
    if (payload.university_roll_number && !/^[A-Z0-9-]{4,30}$/.test(payload.university_roll_number)) {
      setError('Please enter a valid university roll number.')
      return
    }
    if (payload.class_roll_number !== null && (!Number.isInteger(payload.class_roll_number) || payload.class_roll_number < 1 || payload.class_roll_number > 999)) {
      setError('Class roll number must be between 1 and 999.')
      return
    }
    if (!Number.isInteger(payload.year) || payload.year < 1 || payload.year > 8) {
      setError('Year must be between 1 and 8.')
      return
    }

    setSaving(true)
    try {
      if (editingId) {
        await adminApi.put(`/students/${editingId}`, payload)
        setSuccess('Student updated successfully.')
      } else {
        await adminApi.post('/students', payload)
        setSuccess('Student added successfully.')
      }

      resetForm()
      await fetchData()
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        handleUnauthorized()
        return
      }
      setError(err.response?.data?.message || 'Failed to save student.')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (student) => {
    setEditingId(student.student_id)
    setForm({
      name: student.name || '',
      university_roll_number: student.university_roll_number || '',
      class_roll_number: student.class_roll_number || '',
      course: student.course || '',
      branch: student.branch || '',
      year: student.year || '',
      section: student.section || '',
    })
    setError('')
    setSuccess('')
  }

  const handleDelete = async (student) => {
    const confirmed = window.confirm(`Delete student "${student.name}"?`)
    if (!confirmed) {
      return
    }

    setDeletingId(student.student_id)
    setError('')
    setSuccess('')
    try {
      await adminApi.delete(`/students/${student.student_id}`)
      setSuccess('Student deleted successfully.')
      if (editingId === student.student_id) {
        resetForm()
      }
      await fetchData()
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        handleUnauthorized()
        return
      }
      setError(err.response?.data?.message || 'Failed to delete student.')
    } finally {
      setDeletingId(null)
    }
  }

  const onSearchSubmit = async (e) => {
    e.preventDefault()
    await fetchData(search)
  }

  return (
    <div className="space-y-6">
      <section className="glass-card rounded-2xl p-6">
        <h1 className="text-2xl font-bold text-white mb-1">Students Management</h1>
        <p className="text-slate-400">Add, update, search, and delete student records.</p>
      </section>

      <section className="glass-card rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          {editingId ? 'Edit Student' : 'Add Student'}
        </h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input className="input-field" aria-label="Full name" placeholder="Full Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="input-field" aria-label="University roll number" placeholder="University Roll Number" value={form.university_roll_number} onChange={(e) => setForm({ ...form, university_roll_number: e.target.value.toUpperCase() })} required />
          <input className="input-field" aria-label="Class roll number" type="number" min={1} max={999} placeholder="Class Roll Number" value={form.class_roll_number} onChange={(e) => setForm({ ...form, class_roll_number: e.target.value })} />
          <input className="input-field" aria-label="Course" placeholder="Course (e.g. B.Tech)" value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} required />
          <input className="input-field" aria-label="Branch" placeholder="Branch (e.g. CSE)" value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} required />
          <input className="input-field" aria-label="Year" type="number" min={1} max={8} placeholder="Year" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} required />
          <input className="input-field" aria-label="Section" placeholder="Section (e.g. CSE-A)" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value.toUpperCase() })} required />

          <div className="md:col-span-2 flex flex-wrap gap-3">
            <button type="submit" disabled={saving} className="btn-primary inline-flex items-center gap-2">
              <HiOutlinePlus />
              {saving ? 'Saving...' : editingId ? 'Update Student' : 'Add Student'}
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

        {error ? <p role="alert" className="mt-4 text-sm text-red-300">{error}</p> : null}
        {success ? <p role="status" className="mt-4 text-sm text-emerald-300">{success}</p> : null}
      </section>

      <section className="glass-card rounded-2xl p-6">
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between mb-4">
          <form onSubmit={onSearchSubmit} className="flex gap-3 flex-1">
            <div className="relative flex-1">
              <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="input-field pl-11"
                aria-label="Search students"
                placeholder="Search by name or university roll number"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button type="submit" className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 transition text-white">
              Search
            </button>
          </form>

          <select
            className="input-field md:w-56 py-3"
            aria-label="Filter students by section"
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
          <p className="text-slate-400">Loading students...</p>
        ) : students.length === 0 ? (
          <p className="text-slate-400">No students found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-700">
                  <th className="py-3 pr-3">Name</th>
                  <th className="py-3 pr-3">University Roll</th>
                  <th className="py-3 pr-3">Class Roll</th>
                  <th className="py-3 pr-3">Course</th>
                  <th className="py-3 pr-3">Branch</th>
                  <th className="py-3 pr-3">Year</th>
                  <th className="py-3 pr-3">Section</th>
                  <th className="py-3 pr-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.student_id} className="border-b border-slate-800">
                    <td className="py-3 pr-3 text-white">{student.name}</td>
                    <td className="py-3 pr-3 whitespace-nowrap">{student.university_roll_number || '-'}</td>
                    <td className="py-3 pr-3">{student.class_roll_number || '-'}</td>
                    <td className="py-3 pr-3">{student.course}</td>
                    <td className="py-3 pr-3">{student.branch}</td>
                    <td className="py-3 pr-3">{student.year}</td>
                    <td className="py-3 pr-3">{student.section}</td>
                    <td className="py-3 pr-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(student)}
                          className="px-3 py-2 rounded-lg border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10 transition inline-flex items-center gap-1"
                        >
                          <HiOutlinePencil />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(student)}
                          disabled={deletingId === student.student_id}
                          className="px-3 py-2 rounded-lg border border-red-500/30 text-red-300 hover:bg-red-500/10 transition inline-flex items-center gap-1 disabled:opacity-60"
                        >
                          <HiOutlineTrash />
                          {deletingId === student.student_id ? 'Deleting...' : 'Delete'}
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
