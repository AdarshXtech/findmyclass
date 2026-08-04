import { useEffect, useMemo, useRef, useState } from 'react'
import {
  HiOutlineClipboardCopy,
  HiOutlinePencil,
  HiOutlinePlus,
  HiOutlineTrash,
  HiOutlineUpload,
} from 'react-icons/hi'
import adminApi from '../admin/api'
import ConfirmDialog from '../admin/components/ConfirmDialog'
import SaveTimetableDialog from '../admin/components/SaveTimetableDialog'
import { formatTime } from '../utils/timetableTime'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const emptyRow = () => ({
  day: 'Monday',
  startTime: '09:00',
  endTime: '10:00',
  subjectName: '',
  facultyName: '',
  sessionType: 'Lecture',
  classroom: '',
})

function requestErrorMessage(error, fallback) {
  const status = error.response?.status
  if (status === 401) return 'Your admin session has expired. Sign in again.'
  if (status === 403) return 'You do not have permission to manage timetable entries.'
  if (status === 409) return 'This change conflicts with an existing timetable entry.'
  return error.response?.data?.message || fallback
}

function EntryFields({ row, onChange }) {
  const field = (name) => ({
    value: row[name] || '',
    onChange: (event) => onChange({ ...row, [name]: event.target.value, errors: [], status: undefined }),
  })
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <label className="text-sm font-bold">Day<select className="input-field mt-2" {...field('day')}>{DAYS.map((day) => <option key={day}>{day}</option>)}</select></label>
      <label className="text-sm font-bold">Start time<input type="time" className="input-field mt-2" {...field('startTime')} /></label>
      <label className="text-sm font-bold">End time<input type="time" className="input-field mt-2" {...field('endTime')} /></label>
      <label className="text-sm font-bold">Type<select className="input-field mt-2" {...field('sessionType')}><option>Lecture</option><option>Practical</option><option>Library</option><option>Break</option></select></label>
      <label className="text-sm font-bold sm:col-span-2">Subject<input className="input-field mt-2" {...field('subjectName')} /></label>
      <label className="text-sm font-bold">Teacher<input className="input-field mt-2" {...field('facultyName')} /></label>
      <label className="text-sm font-bold">Classroom<input className="input-field mt-2 uppercase" {...field('classroom')} /></label>
    </div>
  )
}

function ContextSelect({ classes, course, year, section, onCourseChange, onYearChange, onSectionChange }) {
  const courseOptions = [...new Map(classes.map((item) => {
    const value = `${item.course}::${item.branch || ''}`
    return [value, { value, label: [item.course, item.branch].filter(Boolean).join(' ') }]
  })).values()]
  const yearOptions = [...new Set(classes
    .filter((item) => `${item.course}::${item.branch || ''}` === course)
    .map((item) => Number(item.year)))]
    .sort((left, right) => left - right)
  const sectionOptions = classes.filter((item) => (
    `${item.course}::${item.branch || ''}` === course && Number(item.year) === Number(year)
  ))

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <label className="text-sm font-bold">
        Course
        <select className="input-field mt-2" value={course} onChange={(event) => onCourseChange(event.target.value)}>
          <option value="">Select a course</option>
          {courseOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
      <label className="text-sm font-bold">
        Year
        <select className="input-field mt-2" value={year} disabled={!course} onChange={(event) => onYearChange(event.target.value)}>
          <option value="">Select a year</option>
          {yearOptions.map((item) => <option key={item} value={item}>Year {item}</option>)}
        </select>
      </label>
      <label className="text-sm font-bold">
        Class / Section
        <select className="input-field mt-2" value={section} disabled={!year} onChange={(event) => onSectionChange(event.target.value)}>
          <option value="">Select a class</option>
          {sectionOptions.map((item) => <option key={item.section} value={item.section}>{item.section}</option>)}
        </select>
      </label>
    </div>
  )
}

export default function AdminTimetablePage() {
  const [classes, setClasses] = useState([])
  const [course, setCourse] = useState('')
  const [year, setYear] = useState('')
  const [section, setSection] = useState('')
  const [mode, setMode] = useState('manual')
  const [row, setRow] = useState(emptyRow)
  const [rows, setRows] = useState([])
  const [schedule, setSchedule] = useState([])
  const [source, setSource] = useState('text')
  const [text, setText] = useState('')
  const [image, setImage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saveDialog, setSaveDialog] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [pendingFullDelete, setPendingFullDelete] = useState(null)
  const [deleteError, setDeleteError] = useState('')
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const scheduleRequest = useRef(0)

  const context = classes.find((item) => (
    item.section === section
    && `${item.course}::${item.branch || ''}` === course
    && Number(item.year) === Number(year)
  ))
  const metadata = context ? { course: context.course, year: context.year, section } : {}

  const loadClasses = async () => {
    const response = await adminApi.get('/timetables')
    setClasses(response.data.data.classes)
  }
  const loadSchedule = async (selected = section) => {
    const requestId = ++scheduleRequest.current
    setSchedule([])
    if (!selected) {
      setScheduleLoading(false)
      return
    }
    setScheduleLoading(true)
    try {
      const response = await adminApi.get(`/timetables/${encodeURIComponent(selected)}`)
      if (requestId === scheduleRequest.current) setSchedule(response.data.data.rows)
    } finally {
      if (requestId === scheduleRequest.current) setScheduleLoading(false)
    }
  }

  useEffect(() => {
    loadClasses().catch(() => setError('Could not load timetable classes.')).finally(() => setLoading(false))
  }, [])
  useEffect(() => {
    setError('')
    loadSchedule().catch(() => setError('Could not load this timetable. Check your connection and try again.'))
  }, [section])

  useEffect(() => {
    if (!section || !row.classroom) return
    const timer = setTimeout(async () => {
      try {
        const response = await adminApi.post('/timetables/validate', {
          ...metadata,
          mode: 'replace',
          rows: [{ ...row, subjectName: row.subjectName || 'Subject', facultyName: row.facultyName || 'Teacher' }],
        })
        setRow((current) => ({ ...current, parsedLocation: response.data.data.rows[0].parsedLocation }))
      } catch (requestError) {
        const parsed = requestError.response?.data?.data?.rows?.[0]?.parsedLocation
        setRow((current) => ({ ...current, parsedLocation: parsed }))
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [section, row.classroom])

  const validate = async (candidateRows, saveMode = 'merge') => {
    try {
      const response = await adminApi.post('/timetables/validate', { ...metadata, mode: saveMode, rows: candidateRows })
      return response.data.data
    } catch (requestError) {
      if (requestError.response?.status === 422) return requestError.response.data.data
      throw requestError
    }
  }

  const addManually = async () => {
    setBusy(true)
    setError('')
    try {
      const result = await validate([row], 'merge')
      setRow(result.rows[0])
      if (!result.valid) return setError('Fix the highlighted timetable entry before saving.')
      await adminApi.post('/timetables', { ...metadata, mode: 'merge', rows: result.rows })
      setMessage('Timetable entry added successfully.')
      setRow(emptyRow())
      loadSchedule().catch(() => setError('The entry was saved, but the timetable could not be refreshed.'))
    } catch (requestError) {
      const checkedRow = requestError.response?.data?.data?.rows?.[0]
      if (checkedRow) setRow(checkedRow)
      setError(requestErrorMessage(requestError, 'Could not add the timetable entry.'))
    } finally {
      setBusy(false)
    }
  }

  const importTimetable = async () => {
    if (!section) return setError('Select the course, year and class first.')
    setBusy(true)
    setError('')
    try {
      const form = new FormData()
      form.append('course', context.course)
      form.append('year', context.year)
      form.append('section', section)
      if (source === 'image') {
        if (!image) throw new Error('Select an image first.')
        form.append('image', image)
      } else {
        if (!text.trim()) throw new Error('Paste timetable text first.')
        form.append('text', text)
      }
      const response = await adminApi.post('/timetables/import', form)
      setRows(response.data.data.rows)
      if (response.data.data.extractedText) setText(response.data.data.extractedText)
      setMessage('Preview created. Review and correct every row before saving.')
    } catch (requestError) {
      const importData = requestError.response?.data?.data
      if (importData?.rows) setRows(importData.rows)
      if (importData?.extractedText) {
        setText(importData.extractedText)
        setSource('text')
      }
      setError(requestError.response?.data?.message || requestError.message || 'Import failed.')
    } finally {
      setBusy(false)
    }
  }

  const revalidatePreview = async () => {
    setBusy(true)
    setError('')
    try {
      const result = await validate(rows, 'replace')
      setRows(result.rows)
      if (!result.valid) return setError('Fix all preview errors before saving.')
      setSaveDialog(true)
    } catch {
      setError('Could not validate the preview.')
    } finally {
      setBusy(false)
    }
  }

  const saveRows = async (saveMode) => {
    setBusy(true)
    setError('')
    try {
      await adminApi.post('/timetables', { ...metadata, mode: saveMode, rows })
      setSaveDialog(false)
      setMessage('Timetable saved. Student schedules now use the updated data.')
      setRows([])
      loadSchedule().catch(() => setError('The timetable was saved, but it could not be refreshed.'))
    } catch (requestError) {
      const checkedRows = requestError.response?.data?.data?.rows
      if (checkedRows) setRows(checkedRows)
      setError(requestErrorMessage(requestError, 'Could not save the timetable.'))
    } finally {
      setBusy(false)
    }
  }

  const editEntry = async (entry) => {
    setBusy(true)
    setError('')
    try {
      await adminApi.put(`/timetables/${entry.timetableEntryId}`, entry)
      setMessage('Timetable entry updated.')
      loadSchedule().catch(() => setError('The entry was updated, but the timetable could not be refreshed.'))
    } catch (requestError) {
      const checkedRow = requestError.response?.data?.data?.rows?.[0]
      if (checkedRow) {
        setSchedule((current) => current.map((item) => (
          item.timetableEntryId === entry.timetableEntryId ? checkedRow : item
        )))
      }
      setError(requestErrorMessage(requestError, 'Could not update this entry.'))
    } finally {
      setBusy(false)
    }
  }

  const deleteEntry = async () => {
    if (!pendingDelete || busy) return
    setBusy(true)
    setDeleteError('')
    try {
      await adminApi.delete(`/timetables/${pendingDelete.entry.timetableEntryId}`)
      const deletedId = pendingDelete.entry.timetableEntryId
      setSchedule((current) => current.filter((entry) => entry.timetableEntryId !== deletedId))
      setPendingDelete(null)
      setMessage('Timetable entry deleted successfully.')
      loadSchedule().catch(() => setError('The entry was deleted, but the timetable could not be refreshed.'))
    } catch (requestError) {
      setDeleteError(requestError.response?.status === 404
        ? 'This timetable entry no longer exists.'
        : requestErrorMessage(requestError, 'Could not delete timetable entry. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  const deleteFullTimetable = async () => {
    if (!pendingFullDelete || deleteConfirmation !== 'DELETE' || busy) return
    setBusy(true)
    setDeleteError('')
    try {
      await adminApi.delete(`/timetables/class/${encodeURIComponent(pendingFullDelete.section)}`)
      setSchedule([])
      setPendingFullDelete(null)
      setDeleteConfirmation('')
      setMessage(`Complete timetable for ${pendingFullDelete.section} deleted successfully.`)
    } catch (requestError) {
      setDeleteError(requestErrorMessage(requestError, 'Could not delete the complete timetable. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  const grouped = useMemo(() => DAYS.map((day) => {
    const entries = schedule.filter((entry) => entry.day === day)
    return {
      day,
      entries,
      classCount: entries.filter((entry) => entry.sessionType !== 'Break').length,
    }
  }), [schedule])

  if (loading) return <p className="text-text-secondary">Loading Timetable Manager...</p>

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-bold uppercase text-accent-primary">Schedule administration</p>
        <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">Timetable Manager</h1>
        <p className="mt-2 text-text-secondary">Add, edit, import, and delete class schedules.</p>
      </header>

      <section className="border border-border-default bg-surface-primary p-4 shadow-admin sm:p-6">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Timetable manager mode">
          {[
            ['manual', 'Add Manually', HiOutlinePlus],
            ['import', 'Import Timetable', HiOutlineUpload],
            ['edit', 'Edit Existing', HiOutlinePencil],
            ['delete', 'Delete Timetable', HiOutlineTrash],
          ].map(([value, label, Icon]) => (
            <button key={value} type="button" role="tab" aria-selected={mode === value} onClick={() => { setMode(value); setError(''); setMessage('') }} className={`min-h-11 border px-4 py-2 font-bold ${mode === value ? 'border-border-strong bg-accent-highlight' : 'border-border-default'}`}>
              <Icon className="mr-2 inline" />{label}
            </button>
          ))}
        </div>
        <div className="mt-6">
          <ContextSelect
            classes={classes}
            course={course}
            year={year}
            section={section}
            onCourseChange={(value) => { setCourse(value); setYear(''); setSection('') }}
            onYearChange={(value) => { setYear(value); setSection('') }}
            onSectionChange={setSection}
          />
        </div>
      </section>

      {error ? <p role="alert" className="border-l-4 border-status-danger px-4 py-2 text-status-danger">{error}</p> : null}
      {message ? <p role="status" className="border-l-4 border-status-success px-4 py-2 text-status-success">{message}</p> : null}

      {mode === 'manual' && (
        <section className="border border-border-default bg-surface-primary p-4 shadow-admin sm:p-6">
          <h2 className="font-display text-xl font-bold">New timetable entry</h2>
          <div className="mt-5"><EntryFields row={row} onChange={setRow} /></div>
          <p className={`mt-3 text-sm ${row.parsedLocation?.isValid || row.sessionType === 'Break' ? 'text-status-success' : 'text-status-danger'}`}>
            {row.sessionType === 'Break'
              ? 'Teacher and classroom are optional for a break.'
              : row.parsedLocation?.isValid
                ? `${row.classroom} detected as ${row.parsedLocation.displayLabel}`
                : row.classroom ? row.parsedLocation?.error : 'Enter a classroom to check its mapped location.'}
          </p>
          {row.errors?.length ? <ul className="mt-2 text-sm text-status-danger">{row.errors.map((item) => <li key={item}>{item}</li>)}</ul> : null}
          <button type="button" disabled={busy || !section} onClick={addManually} className="mt-5 min-h-11 bg-accent-primary px-5 py-3 font-bold text-text-on-accent disabled:opacity-60">{busy ? 'Adding...' : 'Add timetable entry'}</button>
        </section>
      )}

      {mode === 'import' && (
        <section className="border border-border-default bg-surface-primary p-4 shadow-admin sm:p-6">
          <h2 className="font-display text-xl font-bold">Extract timetable rows</h2>
          <div className="mt-4 flex gap-5">
            <label className="flex items-center gap-2"><input type="radio" checked={source === 'text'} onChange={() => setSource('text')} /> Pasted text or table</label>
            <label className="flex items-center gap-2"><input type="radio" checked={source === 'image'} onChange={() => setSource('image')} /> Image</label>
          </div>
          {source === 'text' ? (
            <label className="mt-5 block text-sm font-bold">Timetable text<textarea rows="9" className="input-field mt-2 font-mono" value={text} onChange={(event) => setText(event.target.value)} placeholder="Day | Time | Subject | Teacher | Room | Type" /></label>
          ) : (
            <label className="mt-5 block text-sm font-bold">Timetable image<input type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" className="input-field mt-2" onChange={(event) => setImage(event.target.files?.[0] || null)} /></label>
          )}
          <button type="button" disabled={busy || !section} onClick={importTimetable} className="mt-5 min-h-11 bg-accent-primary px-5 py-3 font-bold text-text-on-accent disabled:opacity-60">{busy ? 'Extracting...' : 'Create editable preview'}</button>
        </section>
      )}

      {mode === 'import' && rows.length > 0 && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><h2 className="font-display text-xl font-bold">Import preview</h2><p className="text-sm text-text-secondary">Nothing is saved until you approve it.</p></div>
            <button type="button" disabled={busy} onClick={revalidatePreview} className="min-h-11 bg-accent-primary px-5 py-3 font-bold text-text-on-accent disabled:opacity-60">Validate and save</button>
          </div>
          {rows.map((entry, index) => (
            <article key={entry.clientId || index} className={`border bg-surface-primary p-4 ${entry.status === 'error' ? 'border-status-danger' : 'border-border-default'}`}>
              <EntryFields row={entry} onChange={(next) => setRows((current) => current.map((item, itemIndex) => itemIndex === index ? next : item))} />
              <div className="mt-3 flex items-start justify-between gap-3 text-sm">
                <div><strong>{entry.status === 'error' ? 'Error' : 'Valid'}</strong><p className="text-text-secondary">{entry.parsedLocation?.displayLabel || 'Location not parsed'}</p>{entry.errors?.map((item) => <p className="text-status-danger" key={item}>{item}</p>)}</div>
                <button type="button" aria-label={`Remove preview row ${index + 1}`} onClick={() => setRows((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="flex h-11 w-11 items-center justify-center border border-border-default text-status-danger"><HiOutlineTrash /></button>
              </div>
            </article>
          ))}
        </section>
      )}

      {mode === 'edit' && (
        <section className="space-y-5">
          {!section ? <p className="text-text-secondary">Select a class to load its weekly timetable.</p> : scheduleLoading ? <p role="status" className="text-text-secondary">Loading timetable...</p> : schedule.length === 0 ? <p className="text-text-secondary">No timetable exists for {section}.</p> : grouped.map(({ day, entries, classCount }) => (
            <details key={day} open={entries.length > 0} className="border border-border-default bg-surface-primary">
              <summary className="cursor-pointer px-4 py-4 font-display text-lg font-bold">{day} <span className="text-sm text-text-secondary">({classCount})</span></summary>
              <div className="space-y-4 border-t border-border-default p-4">
                {entries.length === 0 ? <p className="text-sm text-text-secondary">No classes.</p> : entries.map((entry) => (
                  <article key={entry.timetableEntryId} className={`border border-border-default p-4 ${entry.sessionType === 'Break' ? 'bg-surface-secondary' : ''}`}>
                    <EntryFields row={entry} onChange={(next) => setSchedule((current) => current.map((item) => item.timetableEntryId === entry.timetableEntryId ? next : item))} />
                    {entry.sessionType === 'Break' ? <p className="mt-3 text-sm text-text-secondary">Breaks are not counted as classes.</p> : <p className="mt-3 text-sm text-text-secondary">{entry.parsedLocation?.displayLabel}</p>}
                    {entry.errors?.map((item) => <p className="mt-1 text-sm text-status-danger" key={item}>{item}</p>)}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" disabled={busy} onClick={() => editEntry(schedule.find((item) => item.timetableEntryId === entry.timetableEntryId))} className="min-h-11 border border-border-strong px-3 py-2 font-bold"><HiOutlinePencil className="mr-1 inline" />Save edit</button>
                      <button type="button" onClick={() => { setRow({ ...entry, timetableEntryId: null }); setMode('manual') }} className="min-h-11 border border-border-default px-3 py-2"><HiOutlineClipboardCopy className="mr-1 inline" />Duplicate</button>
                      <button type="button" onClick={(event) => { setDeleteError(''); setPendingDelete({ entry, trigger: event.currentTarget }) }} className="min-h-11 border border-border-default px-3 py-2 text-status-danger"><HiOutlineTrash className="mr-1 inline" />Delete</button>
                    </div>
                  </article>
                ))}
              </div>
            </details>
          ))}
        </section>
      )}

      {mode === 'delete' && (
        <section className="border border-border-default bg-surface-primary p-4 shadow-admin sm:p-6">
          <h2 className="font-display text-xl font-bold">Delete Timetable</h2>
          <p className="mt-2 text-text-secondary">Select a class to delete its full weekly timetable.</p>
          {!section ? (
            <p className="mt-5 text-text-secondary">Choose the course, year, and class above.</p>
          ) : scheduleLoading ? (
            <p role="status" className="mt-5 text-text-secondary">Loading timetable...</p>
          ) : (
            <div className="mt-5 border border-border-default bg-surface-secondary p-4">
              <p className="font-display text-2xl font-bold">{section}</p>
              <p className="mt-1 text-text-secondary">{schedule.length} timetable {schedule.length === 1 ? 'entry' : 'entries'} found</p>
              {schedule.length ? (
                <button
                  type="button"
                  onClick={(event) => {
                    setDeleteError('')
                    setDeleteConfirmation('')
                    setPendingFullDelete({ section, count: schedule.length, trigger: event.currentTarget })
                  }}
                  className="mt-5 min-h-11 border border-status-danger px-4 py-3 font-bold text-status-danger"
                >
                  <HiOutlineTrash className="mr-2 inline" />Delete complete timetable
                </button>
              ) : (
                <p className="mt-4 font-bold">No timetable entries found for this class.</p>
              )}
            </div>
          )}
        </section>
      )}

      {saveDialog ? <SaveTimetableDialog busy={busy} error={error} onCancel={() => setSaveDialog(false)} onSave={saveRows} /> : null}
      {pendingDelete ? (
        <ConfirmDialog
          title="Delete timetable entry?"
          description={(
            <>
              <span className="block">This will remove:</span>
              <strong className="mt-2 block text-text-primary">{pendingDelete.entry.subjectName}</strong>
              <span className="block">{pendingDelete.entry.day}, {formatTime(pendingDelete.entry.startTime)} – {formatTime(pendingDelete.entry.endTime)}</span>
              {pendingDelete.entry.classroom ? <span className="block">Room {pendingDelete.entry.classroom}</span> : null}
              <span className="mt-2 block">This action cannot be undone.</span>
            </>
          )}
          confirmLabel="Delete entry"
          busy={busy}
          error={deleteError}
          returnFocusTo={pendingDelete.trigger}
          onCancel={() => { setPendingDelete(null); setDeleteError('') }}
          onConfirm={deleteEntry}
        />
      ) : null}
      {pendingFullDelete ? (
        <ConfirmDialog
          title={`Delete full timetable for ${pendingFullDelete.section}?`}
          description={`This will permanently remove all ${pendingFullDelete.count} weekly timetable entries for this class. This action cannot be undone.`}
          confirmLabel="Delete complete timetable"
          confirmDisabled={deleteConfirmation !== 'DELETE'}
          busy={busy}
          error={deleteError}
          returnFocusTo={pendingFullDelete.trigger}
          onCancel={() => { setPendingFullDelete(null); setDeleteConfirmation(''); setDeleteError('') }}
          onConfirm={deleteFullTimetable}
        >
          <label className="block text-sm font-bold">
            Type DELETE to confirm
            <input
              className="input-field mt-2 uppercase"
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value.toUpperCase())}
              autoComplete="off"
            />
          </label>
        </ConfirmDialog>
      ) : null}
    </div>
  )
}
