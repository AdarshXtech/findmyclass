import { useEffect, useMemo, useState } from 'react'
import { HiOutlinePencil, HiOutlinePlus, HiOutlineTrash } from 'react-icons/hi'
import { useNavigate } from 'react-router-dom'
import adminApi from '../admin/api'
import { clearAdminSession } from '../admin/auth'
import ConfirmDialog from '../admin/components/ConfirmDialog'

const initialForm = {
  section: '',
  subject: '',
  locationType: 'room',
  floor: '',
  wing: '',
  room: '',
}

function sortClassrooms(entries) {
  return [...entries].sort((a, b) => (
    a.section.localeCompare(b.section) || a.subject.localeCompare(b.subject)
  ))
}

export default function AdminClassroomsPage() {
  const navigate = useNavigate()
  const [classrooms, setClassrooms] = useState([])
  const [subjects, setSubjects] = useState([])
  const [sections, setSections] = useState([])
  const [locationOptions, setLocationOptions] = useState([])
  const [sectionFilter, setSectionFilter] = useState('')
  const [form, setForm] = useState(initialForm)
  const [editingId, setEditingId] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const filteredLocationOptions = useMemo(() => locationOptions.filter((option) => (
    form.locationType === 'special' ? option.isSpecialLocation : !option.isSpecialLocation
  )), [form.locationType, locationOptions])

  const floorOptions = useMemo(() => {
    const floors = new Map()
    for (const option of filteredLocationOptions) floors.set(option.floor, option.floorLabel)
    return [...floors].map(([value, label]) => ({ value, label }))
  }, [filteredLocationOptions])

  const wingOptions = useMemo(() => [...new Set(
    filteredLocationOptions
      .filter((option) => option.floor === form.floor)
      .map((option) => option.wing)
      .filter(Boolean)
  )], [filteredLocationOptions, form.floor])

  const roomOptions = useMemo(() => filteredLocationOptions.filter((option) => (
    option.floor === form.floor
      && (option.wing || '') === form.wing
  )), [filteredLocationOptions, form.floor, form.wing])

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
      const [classroomsRes, subjectsRes, sectionsRes, locationsRes] = await Promise.all([
        adminApi.get('/classrooms', { params: { section: sectionFilter || undefined } }),
        adminApi.get('/subjects'),
        adminApi.get('/sections'),
        adminApi.get('/classroom-options'),
      ])
      setClassrooms(classroomsRes.data.data || [])
      setSubjects(subjectsRes.data.data || [])
      setSections(sectionsRes.data.data || [])
      setLocationOptions(locationsRes.data.data || [])
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
      room: form.room.trim(),
    }

    if (!payload.section || !payload.subject || !payload.room) {
      setError('Section, subject, and classroom number are required.')
      return
    }

    setSaving(true)
    const previousClassrooms = classrooms
    const submittedForm = form
    const submittedEditingId = editingId
    const optimisticId = editingId || `optimistic-${Date.now()}`
    const existingClassroom = classrooms.find((classroom) => classroom.classroom_id === editingId)
    const optimisticClassroom = {
      classroom_id: optimisticId,
      floor: existingClassroom?.floor || '',
      wing: existingClassroom?.wing || '',
      ...payload,
    }
    const matchesCurrentView = (classroom) => !sectionFilter || classroom.section === sectionFilter
    setClassrooms((current) => {
      const withoutCurrent = current.filter((classroom) => classroom.classroom_id !== editingId)
      return matchesCurrentView(optimisticClassroom)
        ? sortClassrooms([...withoutCurrent, optimisticClassroom])
        : withoutCurrent
    })
    resetForm()

    try {
      let response
      if (editingId) {
        response = await adminApi.put(`/classrooms/${editingId}`, payload)
        setSuccess('Classroom assignment updated successfully.')
      } else {
        response = await adminApi.post('/classrooms', payload)
        setSuccess('Classroom assignment added successfully.')
      }

      const savedClassroom = response.data.data
      setClassrooms((current) => {
        const withoutOptimistic = current.filter((classroom) => (
          classroom.classroom_id !== optimisticId && classroom.classroom_id !== submittedEditingId
        ))
        return matchesCurrentView(savedClassroom)
          ? sortClassrooms([...withoutOptimistic, savedClassroom])
          : withoutOptimistic
      })
    } catch (err) {
      setClassrooms(previousClassrooms)
      setEditingId(submittedEditingId)
      setForm(submittedForm)
      if (err.response?.status === 401 || err.response?.status === 403) {
        handleUnauthorized()
        return
      }
      setError(`${err.response?.data?.message || 'Failed to save classroom assignment.'} Changes were rolled back.`)
      setSuccess('')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (classroom) => {
    const isSpecialLocation = Boolean(classroom.isSpecialLocation)
    setEditingId(classroom.classroom_id)
    setForm({
      section: classroom.section || '',
      subject: classroom.subject || '',
      locationType: isSpecialLocation ? 'special' : 'room',
      floor: classroom.floorCode || '',
      wing: classroom.wing || '',
      room: classroom.room || classroom.locationName || '',
    })
    setError('')
    setSuccess('')
  }

  const handleDelete = async (classroom) => {
    setDeletingId(classroom.classroom_id)
    setError('')
    setSuccess('')
    const previousClassrooms = classrooms
    const wasEditing = editingId === classroom.classroom_id
    setClassrooms((current) => current.filter((entry) => entry.classroom_id !== classroom.classroom_id))
    if (wasEditing) resetForm()

    try {
      await adminApi.delete(`/classrooms/${classroom.classroom_id}`)
      setSuccess('Classroom assignment deleted successfully.')
    } catch (err) {
      setClassrooms(previousClassrooms)
      if (wasEditing) handleEdit(classroom)
      if (err.response?.status === 401 || err.response?.status === 403) {
        handleUnauthorized()
        return
      }
      setError(`${err.response?.data?.message || 'Failed to delete classroom assignment.'} The assignment was restored.`)
      setSuccess('')
    } finally {
      setDeletingId(null)
      setPendingDelete(null)
    }
  }

  const handleLocationTypeChange = (locationType) => {
    setForm((current) => ({
      ...current,
      locationType,
      floor: '',
      wing: '',
      room: '',
    }))
  }

  const handleFloorChange = (floor) => {
    const matchingOptions = filteredLocationOptions.filter((option) => option.floor === floor)
    const wings = [...new Set(matchingOptions.map((option) => option.wing).filter(Boolean))]
    setForm((current) => ({
      ...current,
      floor,
      wing: wings.length === 1 ? wings[0] : '',
      room: '',
    }))
  }

  const handleWingChange = (wing) => {
    setForm((current) => ({ ...current, wing, room: '' }))
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border-default bg-surface-primary p-6 shadow-admin">
        <h1 className="mb-1 text-2xl font-bold text-text-primary">Classrooms Management</h1>
        <p className="text-text-secondary">Maintain section-wise subject classroom assignments.</p>
      </section>

      <section className="rounded-2xl border border-border-default bg-surface-primary p-6 shadow-admin">
        <h2 className="mb-4 text-lg font-semibold text-text-primary">{editingId ? 'Edit Assignment' : 'Add Assignment'}</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="classroom-section" className="mb-2 block text-sm font-bold text-text-secondary">Section</label>
            <input
              id="classroom-section"
              className="input-field"
              placeholder="For example, CSAI2B"
              value={form.section}
              onChange={(e) => setForm({ ...form, section: e.target.value.toUpperCase() })}
              list="sections-list"
              required
            />
          </div>
          <datalist id="sections-list">
            {sections.map((section) => (
              <option key={section} value={section} />
            ))}
          </datalist>

          <div>
            <label htmlFor="classroom-subject" className="mb-2 block text-sm font-bold text-text-secondary">Subject</label>
            <input
              id="classroom-subject"
              className="input-field"
              placeholder="For example, Digital Logic Design"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              list="subjects-list"
              required
            />
          </div>
          <datalist id="subjects-list">
            {subjects.map((subject) => (
              <option key={subject.subject_id} value={subject.subject_name} />
            ))}
          </datalist>

          <div>
            <label htmlFor="classroom-location-type" className="mb-2 block text-sm font-bold text-text-secondary">Location type</label>
            <select
              id="classroom-location-type"
              className="input-field"
              value={form.locationType}
              onChange={(event) => handleLocationTypeChange(event.target.value)}
            >
              <option value="room">Classroom</option>
              <option value="special">Special location</option>
            </select>
          </div>

          <div>
            <label htmlFor="classroom-floor" className="mb-2 block text-sm font-bold text-text-secondary">Floor</label>
            <select
              id="classroom-floor"
              className="input-field"
              value={form.floor}
              onChange={(event) => handleFloorChange(event.target.value)}
              required
            >
              <option value="">Select floor</option>
              {floorOptions.map((floor) => (
                <option key={floor.value} value={floor.value}>{floor.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="classroom-wing" className="mb-2 block text-sm font-bold text-text-secondary">Wing</label>
            <select
              id="classroom-wing"
              className="input-field"
              value={form.wing}
              onChange={(event) => handleWingChange(event.target.value)}
              disabled={!form.floor || wingOptions.length <= 1}
              required={wingOptions.length > 0}
            >
              <option value="">{form.floor && wingOptions.length === 0 ? 'No wing' : 'Select wing'}</option>
              {wingOptions.map((wing) => (
                <option key={wing} value={wing}>Wing {wing}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="classroom-number" className="mb-2 block text-sm font-bold text-text-secondary">
              {form.locationType === 'special' ? 'Special location' : 'Room'}
            </label>
            <select
              id="classroom-number"
              className="input-field"
              value={form.room}
              onChange={(event) => setForm({ ...form, room: event.target.value })}
              disabled={!form.floor || (wingOptions.length > 1 && !form.wing)}
              required
            >
              <option value="">Select {form.locationType === 'special' ? 'location' : 'room'}</option>
              {roomOptions.map((option) => {
                const value = option.room || option.locationName
                return <option key={value} value={value}>{option.shortLabel}</option>
              })}
            </select>
          </div>

          <div className="md:col-span-2 flex flex-wrap gap-3">
            <button type="submit" disabled={saving} className="btn-primary inline-flex items-center gap-2">
              <HiOutlinePlus />
              {saving ? 'Saving...' : editingId ? 'Update Assignment' : 'Add Assignment'}
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
        <div className="mb-4">
          <label htmlFor="classroom-section-filter" className="mb-2 block text-sm font-bold text-text-secondary">Filter by section</label>
          <select
            id="classroom-section-filter"
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
          <p className="text-text-secondary">Loading classroom assignments...</p>
        ) : classrooms.length === 0 ? (
          <p className="text-text-secondary">No classroom assignments found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle text-left text-text-secondary">
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
                  <tr key={classroom.classroom_id} className="border-b border-border-subtle">
                    <td className="py-3 pr-3 text-text-primary">{classroom.section}</td>
                    <td className="py-3 pr-3">{classroom.subject}</td>
                    <td className="py-3 pr-3">{classroom.floor}</td>
                    <td className="py-3 pr-3">{classroom.wing ? `Wing ${classroom.wing}` : 'No wing'}</td>
                    <td className="py-3 pr-3">{classroom.locationName || classroom.room}</td>
                    <td className="py-3 pr-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(classroom)}
                          className="inline-flex items-center gap-1 rounded-lg border border-border-accent px-3 py-2 text-accent-primary transition hover:bg-surface-highlight"
                        >
                          <HiOutlinePencil />
                          Edit
                        </button>
                        <button
                          onClick={(event) => setPendingDelete({ classroom, trigger: event.currentTarget })}
                          disabled={deletingId === classroom.classroom_id}
                          className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-border-accent px-3 py-2 text-status-danger transition hover:bg-surface-danger disabled:opacity-60"
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

      {pendingDelete ? (
        <ConfirmDialog
          title="Delete classroom assignment?"
          description={`This will remove ${pendingDelete.classroom.subject} from ${pendingDelete.classroom.section}.`}
          confirmLabel="Delete assignment"
          busy={deletingId === pendingDelete.classroom.classroom_id}
          returnFocusTo={pendingDelete.trigger}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => handleDelete(pendingDelete.classroom)}
        />
      ) : null}
    </div>
  )
}
