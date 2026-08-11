import { useEffect, useState } from 'react'
import { HiOutlinePencil, HiOutlinePlus, HiOutlineSearch, HiOutlineTrash, HiOutlineUpload } from 'react-icons/hi'
import { Link, useNavigate } from 'react-router-dom'
import adminApi from '../admin/api'
import { clearAdminSession } from '../admin/auth'
import ConfirmDialog from '../admin/components/ConfirmDialog'
import { normalizePhoneNumber } from '../utils/studentIdentity'

const initialForm = {
  name: '',
  phone_number: '',
  masked_phone_number: '',
  university_roll_number: '',
  class_roll_number: '',
  course: '',
  branch: '',
  year: '',
  section: '',
}

function sortStudents(entries) {
  return [...entries].sort((a, b) => a.name.localeCompare(b.name))
}

export default function AdminStudentsPage() {
  const navigate = useNavigate()
  const [students, setStudents] = useState([])
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [search, setSearch] = useState('')
  const [sectionFilter, setSectionFilter] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetchData()
  }, [sectionFilter, page])

  const handleUnauthorized = () => {
    clearAdminSession()
    navigate('/admin/login', { replace: true })
  }

  const fetchData = async (searchValue = search, requestedPage = page) => {
    setLoading(true)
    setError('')

    try {
      const [studentsRes, sectionsRes] = await Promise.all([
        adminApi.get('/students', {
          params: {
            search: searchValue || undefined,
            section: sectionFilter || undefined,
            page: requestedPage,
            limit: 50,
          },
        }),
        adminApi.get('/sections'),
      ])
      setStudents(studentsRes.data.data || [])
      setPagination(studentsRes.data.pagination || { page: 1, pages: 1, total: studentsRes.data.data?.length || 0 })
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

    const enteredPhoneNumber = form.phone_number.trim()
    const normalizedPhoneNumber = enteredPhoneNumber ? normalizePhoneNumber(enteredPhoneNumber) : null
    const payload = {
      name: form.name.trim(),
      university_roll_number: form.university_roll_number.trim().replace(/\s+/g, '').toUpperCase() || null,
      class_roll_number: form.class_roll_number ? Number(form.class_roll_number) : null,
      course: form.course.trim(),
      branch: form.branch.trim(),
      year: Number(form.year),
      section: form.section.trim().toUpperCase(),
    }

    if (enteredPhoneNumber) {
      payload.phone_number = normalizedPhoneNumber
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
    if (enteredPhoneNumber && !normalizedPhoneNumber) {
      setError('Enter a valid 10-digit phone number.')
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
    const previousStudents = students
    const previousSections = sections
    const submittedForm = form
    const submittedEditingId = editingId
    const optimisticId = editingId || `optimistic-${Date.now()}`
    const optimisticStudent = {
      student_id: optimisticId,
      ...payload,
      masked_phone_number: normalizedPhoneNumber
        ? `******${normalizedPhoneNumber.slice(-4)}`
        : form.masked_phone_number || null,
    }
    const matchesCurrentView = (student) => {
      const normalizedSearch = search.trim().toLowerCase()
      return (!sectionFilter || student.section === sectionFilter)
        && (!normalizedSearch
          || student.name.toLowerCase().includes(normalizedSearch)
          || student.university_roll_number.toLowerCase().includes(normalizedSearch))
    }

    setStudents((current) => {
      const withoutCurrent = current.filter((student) => student.student_id !== editingId)
      return matchesCurrentView(optimisticStudent)
        ? sortStudents([...withoutCurrent, optimisticStudent])
        : withoutCurrent
    })
    if (!sections.includes(payload.section)) {
      setSections((current) => [...current, payload.section].sort())
    }
    resetForm()

    try {
      let response
      if (editingId) {
        response = await adminApi.put(`/students/${editingId}`, payload)
        setSuccess('Student updated successfully.')
      } else {
        response = await adminApi.post('/students', payload)
        setSuccess('Student added successfully.')
      }

      const savedStudent = response.data.data
      setStudents((current) => {
        const withoutOptimistic = current.filter((student) => (
          student.student_id !== optimisticId && student.student_id !== submittedEditingId
        ))
        return matchesCurrentView(savedStudent)
          ? sortStudents([...withoutOptimistic, savedStudent])
          : withoutOptimistic
      })
    } catch (err) {
      setStudents(previousStudents)
      setSections(previousSections)
      setEditingId(submittedEditingId)
      setForm(submittedForm)
      if (err.response?.status === 401 || err.response?.status === 403) {
        handleUnauthorized()
        return
      }
      setError(`${err.response?.data?.message || 'Failed to save student.'} Changes were rolled back.`)
      setSuccess('')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (student) => {
    setEditingId(student.student_id)
    setForm({
      name: student.name || '',
      phone_number: '',
      masked_phone_number: student.masked_phone_number || '',
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
    setDeletingId(student.student_id)
    setError('')
    setSuccess('')
    const previousStudents = students
    const wasEditing = editingId === student.student_id
    setStudents((current) => current.filter((entry) => entry.student_id !== student.student_id))
    if (wasEditing) resetForm()

    try {
      await adminApi.delete(`/students/${student.student_id}`)
      setSuccess('Student deleted successfully.')
    } catch (err) {
      setStudents(previousStudents)
      if (wasEditing) handleEdit(student)
      if (err.response?.status === 401 || err.response?.status === 403) {
        handleUnauthorized()
        return
      }
      setError(`${err.response?.data?.message || 'Failed to delete student.'} The student was restored.`)
      setSuccess('')
    } finally {
      setDeletingId(null)
      setPendingDelete(null)
    }
  }

  const onSearchSubmit = async (e) => {
    e.preventDefault()
    setPage(1)
    await fetchData(search, 1)
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border-default bg-surface-primary p-6 shadow-admin">
        <h1 className="mb-1 text-2xl font-bold text-text-primary">Students Management</h1>
        <p className="text-text-secondary">Add, update, search, and delete student records.</p>
      </section>

      <section className="rounded-2xl border border-border-default bg-surface-primary p-6 shadow-admin">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-text-primary">
            {editingId ? 'Edit Student' : 'Add Student'}
          </h2>
          {!editingId ? (
            <Link
              to="/admin/import"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border-accent px-4 py-2 font-semibold text-accent-primary transition hover:bg-surface-highlight"
            >
              <HiOutlineUpload />
              Import CSV or Excel
            </Link>
          ) : null}
        </div>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="student-full-name" className="mb-2 block text-sm font-bold text-text-secondary">Full name</label>
            <input id="student-full-name" className="input-field" placeholder="For example, Rudransh Kumar Singh" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label htmlFor="student-university-roll" className="mb-2 block text-sm font-bold text-text-secondary">University roll number</label>
            <input id="student-university-roll" className="input-field" placeholder="For example, 1220103062" value={form.university_roll_number} onChange={(e) => setForm({ ...form, university_roll_number: e.target.value.toUpperCase() })} required />
          </div>
          <div>
            <label htmlFor="student-phone" className="mb-2 block text-sm font-bold text-text-secondary">Phone number</label>
            <input
              id="student-phone"
              className="input-field"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder={editingId && form.masked_phone_number
                ? `New number; current ${form.masked_phone_number}`
                : '10-digit number'}
              value={form.phone_number}
              onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="student-class-roll" className="mb-2 block text-sm font-bold text-text-secondary">Class roll number</label>
            <input id="student-class-roll" className="input-field" type="number" min={1} max={999} placeholder="For example, 27" value={form.class_roll_number} onChange={(e) => setForm({ ...form, class_roll_number: e.target.value })} />
          </div>
          <div>
            <label htmlFor="student-course" className="mb-2 block text-sm font-bold text-text-secondary">Course</label>
            <input id="student-course" className="input-field" placeholder="For example, B.Tech" value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} required />
          </div>
          <div>
            <label htmlFor="student-branch" className="mb-2 block text-sm font-bold text-text-secondary">Branch</label>
            <input id="student-branch" className="input-field" placeholder="For example, CSAI" value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} required />
          </div>
          <div>
            <label htmlFor="student-year" className="mb-2 block text-sm font-bold text-text-secondary">Year</label>
            <input id="student-year" className="input-field" type="number" min={1} max={8} placeholder="For example, 2" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} required />
          </div>
          <div>
            <label htmlFor="student-section" className="mb-2 block text-sm font-bold text-text-secondary">Section</label>
            <input id="student-section" className="input-field" placeholder="For example, CSAI2B" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value.toUpperCase() })} required />
          </div>

          <div className="md:col-span-2 flex flex-wrap gap-3">
            <button type="submit" disabled={saving} className="btn-primary inline-flex items-center gap-2">
              <HiOutlinePlus />
              {saving ? 'Saving...' : editingId ? 'Update Student' : 'Add Student'}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-border-subtle px-5 py-3 transition hover:border-border-strong"
              >
                Cancel Edit
              </button>
            ) : null}
          </div>
        </form>

        {error ? <p role="alert" className="mt-4 text-sm text-status-danger">{error}</p> : null}
        {success ? <p role="status" className="mt-4 text-sm text-status-success">{success}</p> : null}
      </section>

      <section className="rounded-2xl border border-border-default bg-surface-primary p-6 shadow-admin">
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between mb-4">
          <form onSubmit={onSearchSubmit} className="flex flex-1 flex-col gap-3 sm:flex-row">
            <div className="flex-1">
              <label htmlFor="student-search" className="mb-2 block text-sm font-bold text-text-secondary">Search students</label>
              <div className="relative">
                <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" />
                <input
                  id="student-search"
                  className="input-field pl-11"
                  placeholder="Name or university roll number"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <button type="submit" className="min-h-11 rounded-xl bg-accent-primary px-5 py-3 text-text-on-accent transition hover:bg-accent-strong sm:mt-7">
              Search
            </button>
          </form>

          <div className="md:w-56">
            <label htmlFor="student-section-filter" className="mb-2 block text-sm font-bold text-text-secondary">Filter by section</label>
            <select
              id="student-section-filter"
              className="input-field py-3"
              value={sectionFilter}
              onChange={(e) => { setPage(1); setSectionFilter(e.target.value) }}
            >
              <option value="">All Sections</option>
              {sections.map((section) => (
                <option key={section} value={section}>{section}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <p className="text-text-secondary">Loading students...</p>
        ) : students.length === 0 ? (
          <p className="text-text-secondary">No students found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle text-left text-text-secondary">
                  <th className="py-3 pr-3">Name</th>
                  <th className="py-3 pr-3">University Roll</th>
                  <th className="py-3 pr-3">Phone</th>
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
                  <tr key={student.student_id} className="border-b border-border-subtle">
                    <td className="py-3 pr-3 text-text-primary">{student.name}</td>
                    <td className="py-3 pr-3 whitespace-nowrap">{student.university_roll_number || '-'}</td>
                    <td className="py-3 pr-3 whitespace-nowrap font-mono">{student.masked_phone_number || 'Not set'}</td>
                    <td className="py-3 pr-3">{student.class_roll_number || '-'}</td>
                    <td className="py-3 pr-3">{student.course}</td>
                    <td className="py-3 pr-3">{student.branch}</td>
                    <td className="py-3 pr-3">{student.year}</td>
                    <td className="py-3 pr-3">{student.section}</td>
                    <td className="py-3 pr-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(student)}
                          className="inline-flex items-center gap-1 rounded-lg border border-border-accent px-3 py-2 text-accent-primary transition hover:bg-surface-highlight"
                        >
                          <HiOutlinePencil />
                          Edit
                        </button>
                        <button
                          onClick={(event) => setPendingDelete({ student, trigger: event.currentTarget })}
                          disabled={deletingId === student.student_id}
                          className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-border-accent px-3 py-2 text-status-danger transition hover:bg-surface-danger disabled:opacity-60"
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
        {!loading && pagination.pages > 1 ? (
          <nav className="mt-5 flex items-center justify-between gap-3 border-t border-border-default pt-4" aria-label="Student pages">
            <p className="text-sm text-text-secondary">Page {pagination.page} of {pagination.pages} · {pagination.total} students</p>
            <div className="flex gap-2">
              <button type="button" className="min-h-11 border border-border-strong px-4 disabled:opacity-50" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button>
              <button type="button" className="min-h-11 border border-border-strong px-4 disabled:opacity-50" disabled={page >= pagination.pages} onClick={() => setPage((current) => current + 1)}>Next</button>
            </div>
          </nav>
        ) : null}
      </section>

      {pendingDelete ? (
        <ConfirmDialog
          title="Delete student?"
          description={`This will remove ${pendingDelete.student.name} from ${pendingDelete.student.section}.`}
          confirmLabel="Delete student"
          busy={deletingId === pendingDelete.student.student_id}
          returnFocusTo={pendingDelete.trigger}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => handleDelete(pendingDelete.student)}
        />
      ) : null}
    </div>
  )
}
