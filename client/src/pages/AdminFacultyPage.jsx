import { useEffect, useState } from 'react'
import { HiOutlinePencil, HiOutlinePlus, HiOutlineTrash, HiOutlineUserGroup } from 'react-icons/hi'
import { useNavigate } from 'react-router-dom'
import adminApi from '../admin/api'
import { clearAdminSession } from '../admin/auth'
import ConfirmDialog from '../admin/components/ConfirmDialog'

const EMPTY_FORM = { name: '', phoneNumber: '', designation: '', department: '', role: 'Faculty' }

export default function AdminFacultyPage() {
  const navigate = useNavigate()
  const [classes, setClasses] = useState([])
  const [section, setSection] = useState('')
  const [contacts, setContacts] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [pendingDelete, setPendingDelete] = useState(null)
  const [pendingReplacement, setPendingReplacement] = useState(null)

  const unauthorized = () => {
    clearAdminSession()
    navigate('/admin/login', { replace: true })
  }

  const loadContacts = async (selectedSection = section) => {
    setLoading(true)
    setError('')
    try {
      const response = await adminApi.get('/faculty', { params: selectedSection ? { section: selectedSection } : {} })
      const availableClasses = response.data.data.classes || []
      const nextSection = selectedSection || availableClasses[0]?.section || ''
      setClasses(availableClasses)
      setSection(nextSection)
      if (!selectedSection && nextSection) {
        const contactsResponse = await adminApi.get('/faculty', { params: { section: nextSection } })
        setContacts(contactsResponse.data.data.contacts || [])
      } else {
        setContacts(response.data.data.contacts || [])
      }
    } catch (requestError) {
      if ([401, 403].includes(requestError.response?.status)) return unauthorized()
      setError('Could not load faculty contacts. Try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadContacts('') }, [])

  const resetForm = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  const saveContact = async (replaceCoordinator = false) => {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const payload = { ...form, section, replaceCoordinator }
      if (editingId) await adminApi.put(`/faculty/${editingId}`, payload)
      else await adminApi.post('/faculty', payload)
      setSuccess(editingId ? 'Faculty contact updated.' : 'Faculty contact added.')
      resetForm()
      await loadContacts(section)
    } catch (requestError) {
      if ([401, 403].includes(requestError.response?.status)) return unauthorized()
      setError(requestError.response?.data?.message || 'Could not save faculty contact.')
    } finally {
      setSaving(false)
      setPendingReplacement(null)
    }
  }

  const submit = (event) => {
    event.preventDefault()
    const coordinator = contacts.find((contact) => contact.role === 'Coordinator' && contact.id !== editingId)
    if (form.role === 'Coordinator' && coordinator) {
      setPendingReplacement({ coordinator, trigger: event.nativeEvent.submitter })
      return
    }
    saveContact()
  }

  const edit = (contact) => {
    setEditingId(contact.id)
    setForm({ name: contact.name, phoneNumber: contact.phoneNumber || '', designation: contact.designation || '', department: contact.department || '', role: contact.role })
    setError('')
    setSuccess('')
  }

  const remove = async (contact) => {
    try {
      await adminApi.delete(`/faculty/${contact.id}`)
      if (editingId === contact.id) resetForm()
      setSuccess('Faculty contact removed.')
      await loadContacts(section)
    } catch (requestError) {
      if ([401, 403].includes(requestError.response?.status)) return unauthorized()
      setError(requestError.response?.data?.message || 'Could not remove faculty contact.')
    } finally {
      setPendingDelete(null)
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border-default bg-surface-primary p-6 shadow-admin">
        <p className="font-mono text-xs font-bold uppercase tracking-wide text-accent-primary">Faculty directory</p>
        <h1 className="mt-2 font-display text-3xl font-bold">Faculty Management</h1>
        <p className="mt-2 text-text-secondary">Faculty names are detected from timetables. Add contact details and assign the class coordinator here.</p>
      </section>

      <section className="rounded-lg border border-border-default bg-surface-primary p-6 shadow-admin">
        <label htmlFor="faculty-section" className="mb-2 block text-sm font-bold">Course, year and class</label>
        <select id="faculty-section" className="input-field" value={section} onChange={(event) => { resetForm(); loadContacts(event.target.value) }}>
          {classes.map((item) => <option key={item.section} value={item.section}>{item.course} · Year {item.year} · {item.section}</option>)}
        </select>
      </section>

      <section className="rounded-lg border border-border-default bg-surface-primary p-6 shadow-admin">
        <h2 className="font-display text-xl font-bold">{editingId ? 'Edit faculty contact' : 'Add coordinator or faculty'}</h2>
        <form onSubmit={submit} className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-bold">Faculty name<input className="input-field mt-2" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
          <label className="text-sm font-bold">Phone number (optional)<input type="tel" inputMode="tel" className="input-field mt-2" value={form.phoneNumber} onChange={(event) => setForm({ ...form, phoneNumber: event.target.value })} placeholder="For example, +91 98765 43210" /></label>
          <label className="text-sm font-bold">Designation (optional)<input className="input-field mt-2" value={form.designation} onChange={(event) => setForm({ ...form, designation: event.target.value })} /></label>
          <label className="text-sm font-bold">Department (optional)<input className="input-field mt-2" value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} /></label>
          <label className="text-sm font-bold">Role<select className="input-field mt-2" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}><option>Faculty</option><option>Coordinator</option></select></label>
          <div className="flex flex-wrap gap-3 md:col-span-2">
            <button type="submit" disabled={saving || !section} className="btn-primary inline-flex items-center gap-2"><HiOutlinePlus />{saving ? 'Saving...' : editingId ? 'Save changes' : 'Add faculty'}</button>
            {editingId ? <button type="button" onClick={resetForm} className="min-h-11 rounded-lg border border-border-strong px-4 font-bold">Cancel</button> : null}
          </div>
        </form>
        {error ? <p role="alert" className="mt-4 text-sm text-status-danger">{error}</p> : null}
        {success ? <p role="status" className="mt-4 text-sm text-status-success">{success}</p> : null}
      </section>

      <section className="rounded-lg border border-border-default bg-surface-primary p-6 shadow-admin">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold"><HiOutlineUserGroup /> Detected from timetable</h2>
        {loading ? <p className="mt-4 text-text-secondary">Loading faculty contacts...</p> : contacts.length ? (
          <div className="mt-4 divide-y divide-border-default">
            {contacts.map((contact) => (
              <article key={contact.id} className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0"><p className="font-bold [overflow-wrap:anywhere]">{contact.name}</p><p className="mt-1 text-sm text-text-secondary">{contact.role}{contact.designation ? ` · ${contact.designation}` : ''}{contact.department ? ` · ${contact.department}` : ''}</p><p className="mt-1 text-sm font-semibold">{contact.phoneNumber || 'Phone number not added'}</p></div>
                <div className="flex shrink-0 gap-2"><button type="button" onClick={() => edit(contact)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border-strong px-3"><HiOutlinePencil /> {contact.phoneNumber ? 'Edit contact' : 'Add phone number'}</button>{contact.phoneNumber || contact.role === 'Coordinator' ? <button type="button" onClick={(event) => setPendingDelete({ contact, trigger: event.currentTarget })} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border-accent px-3 text-status-danger"><HiOutlineTrash /> Clear contact</button> : null}</div>
              </article>
            ))}
          </div>
        ) : <p className="mt-4 text-text-secondary">No faculty names are present in this class timetable.</p>}
      </section>

      {pendingDelete ? <ConfirmDialog title="Clear faculty contact?" description={`This removes the published contact details for ${pendingDelete.contact.name}. Their timetable name remains available.`} confirmLabel="Clear contact" returnFocusTo={pendingDelete.trigger} onCancel={() => setPendingDelete(null)} onConfirm={() => remove(pendingDelete.contact)} /> : null}
      {pendingReplacement ? <ConfirmDialog title="Replace current coordinator?" description={`${pendingReplacement.coordinator.name} will remain listed as faculty, and ${form.name} will become the coordinator for ${section}.`} confirmLabel="Replace coordinator" returnFocusTo={pendingReplacement.trigger} onCancel={() => setPendingReplacement(null)} onConfirm={() => saveContact(true)} /> : null}
    </div>
  )
}
