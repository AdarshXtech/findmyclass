import { useEffect, useMemo, useRef, useState } from 'react'
import {
  HiOutlineClipboardCopy,
  HiOutlinePencil,
  HiOutlinePlus,
  HiOutlineSwitchHorizontal,
  HiOutlineTrash,
  HiOutlineUpload,
} from 'react-icons/hi'
import adminApi from '../admin/api'
import ConfirmDialog from '../admin/components/ConfirmDialog'
import SaveTimetableDialog from '../admin/components/SaveTimetableDialog'
import { formatTime } from '../utils/timetableTime'
import { ENTRY_TYPES, isBreakEntry, requiresFaculty, requiresLocation } from '../utils/timetableEntry'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const VERIFICATION_DAYS = [...DAYS, 'Saturday']
const TIME_SLOTS = [
  ['09:00', '10:00'], ['09:00', '11:00'], ['10:00', '11:00'],
  ['11:00', '12:00'], ['11:00', '13:00'], ['12:00', '13:00'],
  ['13:00', '14:00'], ['14:00', '15:00'], ['14:00', '16:00'],
  ['15:00', '16:00'], ['16:00', '17:00'],
]
const emptyRow = () => ({
  day: 'Monday',
  startTime: '09:00',
  endTime: '10:00',
  subjectName: '',
  facultyName: '',
  sessionType: 'Lecture',
  classroom: '',
  notes: '',
})

function requestErrorMessage(error, fallback) {
  const status = error.response?.status
  if (status === 401) return 'Your admin session has expired. Sign in again.'
  if (status === 403) return 'You do not have permission to manage timetable entries.'
  if (status === 409) return error.response?.data?.message || 'This change conflicts with an existing timetable entry.'
  return error.response?.data?.message || fallback
}

function EntryFields({ row, onChange }) {
  const field = (name) => ({
    value: row[name] || '',
    onChange: (event) => onChange({ ...row, [name]: event.target.value, errors: [], status: undefined }),
  })
  const fixedSlot = TIME_SLOTS.find(([startTime, endTime]) => startTime === row.startTime && endTime === row.endTime)
  const slotValue = row.customTime || !fixedSlot ? 'custom' : `${row.startTime}|${row.endTime}`
  const noLocation = isBreakEntry(row)
  const facultyRequired = requiresFaculty(row.sessionType)
  const locationRequired = requiresLocation(row)
  const changeType = (event) => {
    const sessionType = event.target.value
    const breakEntry = isBreakEntry(sessionType)
    const replaceDefaultTitle = !row.subjectName || ['Library', 'Break', 'Lunch Break', 'Free Period'].includes(row.subjectName)
    onChange({
      ...row,
      sessionType,
      facultyName: breakEntry ? '' : row.facultyName,
      subjectName: replaceDefaultTitle ? (sessionType === 'Library' ? 'Library' : breakEntry ? sessionType : '') : row.subjectName,
      classroom: breakEntry ? '' : row.classroom,
      errors: [],
      status: undefined,
    })
  }
  const changeSlot = (event) => {
    if (event.target.value === 'custom') return onChange({ ...row, customTime: true, errors: [], status: undefined })
    const [startTime, endTime] = event.target.value.split('|')
    onChange({ ...row, startTime, endTime, customTime: false, errors: [], status: undefined })
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <label className="text-sm font-bold">Day<select className="input-field mt-2" {...field('day')}>{DAYS.map((day) => <option key={day}>{day}</option>)}</select></label>
      <label className="text-sm font-bold sm:col-span-1 xl:col-span-2">Time slot<select aria-label="Time slot" className="input-field mt-2" value={slotValue} onChange={changeSlot}>
        {TIME_SLOTS.map(([startTime, endTime]) => <option key={`${startTime}-${endTime}`} value={`${startTime}|${endTime}`}>{formatTime(startTime)} – {formatTime(endTime)}</option>)}
        <option value="custom">Custom time</option>
      </select></label>
      <label className="text-sm font-bold">Type<select className="input-field mt-2" value={row.sessionType || 'Class'} onChange={changeType}>
        {[...new Set([...ENTRY_TYPES, 'Lecture', 'Practical'])].map((type) => <option key={type}>{type}</option>)}
      </select></label>
      {slotValue === 'custom' ? (
        <>
          <label className="text-sm font-bold">Start time<input type="time" className="input-field mt-2" {...field('startTime')} /></label>
          <label className="text-sm font-bold">End time<input type="time" className="input-field mt-2" {...field('endTime')} /></label>
        </>
      ) : null}
      <label className="text-sm font-bold sm:col-span-2">{noLocation ? 'Break title' : 'Subject'}<input className="input-field mt-2" {...field('subjectName')} /></label>
      {!noLocation ? <label className="text-sm font-bold">Faculty{facultyRequired ? '' : ' (not required)'}<input disabled={row.sessionType === 'Library'} className="input-field mt-2 disabled:bg-surface-secondary disabled:text-text-secondary" {...field('facultyName')} /></label> : null}
      {!noLocation ? <label className="text-sm font-bold">Classroom{locationRequired ? '' : ' / location (not required)'}<input className="input-field mt-2 uppercase" {...field('classroom')} /></label> : null}
      {row.sessionType === 'Exam' ? <label className="flex min-h-11 items-center gap-2 text-sm font-bold"><input type="checkbox" checked={Boolean(row.external)} onChange={(event) => onChange({ ...row, external: event.target.checked, errors: [], status: undefined })} /> External exam</label> : null}
      <label className="text-sm font-bold sm:col-span-2 xl:col-span-4">Notes (not required)<textarea rows="2" className="input-field mt-2" {...field('notes')} /></label>
    </div>
  )
}

function LocationPreview({ location }) {
  if (!location) return <p className="text-text-secondary">Location not parsed</p>

  const title = location.fullLocationName || location.locationName
  const details = title
    ? [location.floorLabel, location.wing ? `Wing ${location.wing}` : null, location.room ? `Room ${location.room}` : null]
      .filter(Boolean)
      .join(' · ')
    : location.displayLabel

  return (
    <div className="min-w-0">
      {title ? <strong className="block text-text-primary [overflow-wrap:anywhere]">{title}</strong> : null}
      <p className="text-text-secondary [overflow-wrap:anywhere]">{details}</p>
      {location.subLocations?.length ? (
        <ul className="mt-2 list-inside list-disc text-text-secondary">
          {location.subLocations.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : null}
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

function addMinutes(time, amount) {
  const [hour, minute] = time.split(':').map(Number)
  const total = hour * 60 + minute + amount
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function VerificationRows({ rows, setRows }) {
  const update = (index, next) => setRows((current) => current.map((item, itemIndex) => itemIndex === index ? next : item))
  const remove = (index) => setRows((current) => current.filter((_, itemIndex) => itemIndex !== index))
  const duplicate = (index) => setRows((current) => {
    const copy = { ...current[index], clientId: `${current[index].clientId || 'row'}-copy-${Date.now()}` }
    return [...current.slice(0, index + 1), copy, ...current.slice(index + 1)]
  })

  return (
    <div className="space-y-4">
      {VERIFICATION_DAYS.map((day) => {
        const dayRows = rows.map((entry, index) => ({ entry, index })).filter(({ entry }) => entry.day === day)
        const breaks = dayRows.filter(({ entry }) => isBreakEntry(entry)).length
        const conflicts = dayRows.filter(({ entry }) => entry.reviewStatus === 'Conflict').length
        const needsReview = dayRows.filter(({ entry }) => entry.status === 'error').length
        return (
          <details key={day} open={dayRows.length > 0} className="border border-border-default bg-surface-primary">
            <summary className="cursor-pointer px-4 py-4 font-display text-lg font-bold">
              {day} <span className="ml-2 text-sm font-normal text-text-secondary">{dayRows.length - breaks} classes · {breaks} breaks · {conflicts || needsReview} needs review</span>
            </summary>
            <div className="space-y-4 border-t border-border-default p-4">
              {dayRows.length ? dayRows.map(({ entry, index }) => (
                <article key={entry.clientId || index} className={`border p-4 ${entry.status === 'error' ? 'border-status-danger' : 'border-border-default'}`}>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <strong>{formatTime(entry.startTime)} – {formatTime(entry.endTime)}</strong>
                    <span className={`border px-2 py-1 text-xs font-bold uppercase ${entry.status === 'error' ? 'border-status-danger text-status-danger' : 'border-status-success text-status-success'}`}>{entry.reviewStatus || (entry.status === 'error' ? 'Needs Review' : 'Valid')}</span>
                  </div>
                  <EntryFields row={entry} onChange={(next) => update(index, next)} />
                  {!isBreakEntry(entry) && entry.parsedLocation ? <div className="mt-3 text-sm"><LocationPreview location={entry.parsedLocation} /></div> : null}
                  {entry.errors?.map((item) => <p className="mt-1 text-sm text-status-danger" key={item}>{item}</p>)}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" onClick={() => duplicate(index)} className="min-h-11 border border-border-default px-3 py-2"><HiOutlineClipboardCopy className="mr-1 inline" />Duplicate row</button>
                    <button type="button" onClick={() => remove(index)} className="min-h-11 border border-border-default px-3 py-2 text-status-danger"><HiOutlineTrash className="mr-1 inline" />Delete row</button>
                  </div>
                </article>
              )) : <p className="text-sm text-text-secondary">No entries detected for {day}.</p>}
            </div>
          </details>
        )
      })}
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
  const [detectedFaculty, setDetectedFaculty] = useState([])
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
  const [shiftDay, setShiftDay] = useState('Monday')
  const [shiftAfter, setShiftAfter] = useState('00:00')
  const [shiftDirection, setShiftDirection] = useState('later')
  const [shiftAmount, setShiftAmount] = useState('15')
  const [shiftCustomAmount, setShiftCustomAmount] = useState('20')
  const [shiftSelection, setShiftSelection] = useState([])
  const [shiftPreview, setShiftPreview] = useState([])
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
          rows: [{ ...row, subjectName: row.subjectName || 'Subject', facultyName: row.facultyName || 'Faculty' }],
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
      setDetectedFaculty(response.data.data.detectedFaculty || [])
      if (response.data.data.extractedText) setText(response.data.data.extractedText)
      setMessage('Preview created. Review and correct every row before saving.')
      setMode('verification')
    } catch (requestError) {
      const importData = requestError.response?.data?.data
      if (importData?.rows) {
        setRows(importData.rows)
        setMode('verification')
      }
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

  const shiftPayload = (confirm = false) => ({
    ...metadata,
    day: shiftDay,
    afterTime: shiftAfter,
    direction: shiftDirection,
    minutes: Number(shiftAmount === 'custom' ? shiftCustomAmount : shiftAmount),
    entryIds: shiftSelection,
    confirm,
  })

  const previewShift = async () => {
    setBusy(true)
    setError('')
    try {
      const response = await adminApi.post('/timetables/shift', shiftPayload(false))
      setShiftPreview(response.data.data.rows)
      setMessage('Shift preview ready. Review the new times before saving.')
    } catch (requestError) {
      setShiftPreview(requestError.response?.data?.data?.rows || [])
      setError(requestErrorMessage(requestError, 'Could not preview the timetable shift.'))
    } finally {
      setBusy(false)
    }
  }

  const saveShift = async () => {
    setBusy(true)
    setError('')
    try {
      await adminApi.post('/timetables/shift', shiftPayload(true))
      setShiftPreview([])
      setShiftSelection([])
      setMessage('Timetable times shifted successfully.')
      await loadSchedule()
    } catch (requestError) {
      setError(requestErrorMessage(requestError, 'Could not save the timetable shift.'))
    } finally {
      setBusy(false)
    }
  }

  const prepareInsert = (day, startTime, endTime) => {
    setRow({ ...emptyRow(), day, startTime, endTime, customTime: true })
    setMode('manual')
    setMessage(`Adding an entry in the available ${formatTime(startTime)} – ${formatTime(endTime)} slot.`)
    window.scrollTo({ top: 0 })
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
      classCount: entries.filter((entry) => !isBreakEntry(entry)).length,
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
            ['shift', 'Shift Classes', HiOutlineSwitchHorizontal],
            ['verification', 'Verification', HiOutlineClipboardCopy],
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
          <div className={`mt-3 text-sm ${row.parsedLocation?.isValid || isBreakEntry(row) || !requiresLocation(row) ? 'text-status-success' : 'text-status-danger'}`}>
            {isBreakEntry(row)
              ? <p>Faculty and classroom are not required for this entry.</p>
              : row.sessionType === 'Library' && !row.classroom
                ? <p>Faculty is optional. Central Library is assigned automatically.</p>
              : row.parsedLocation?.isValid
                ? <LocationPreview location={row.parsedLocation} />
                : requiresLocation(row)
                  ? <p>{row.classroom ? row.parsedLocation?.error : 'Enter a classroom to check its mapped location.'}</p>
                  : <p>A location is optional for this entry.</p>}
          </div>
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
            <label className="mt-5 block text-sm font-bold">Timetable text<textarea rows="9" className="input-field mt-2 font-mono" value={text} onChange={(event) => setText(event.target.value)} placeholder="Day | Time | Subject | Faculty | Room | Type" /></label>
          ) : (
            <label className="mt-5 block text-sm font-bold">Timetable image<input type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" className="input-field mt-2" onChange={(event) => setImage(event.target.files?.[0] || null)} /></label>
          )}
          <button type="button" disabled={busy || !section} onClick={importTimetable} className="mt-5 min-h-11 bg-accent-primary px-5 py-3 font-bold text-text-on-accent disabled:opacity-60">{busy ? 'Extracting...' : 'Create editable preview'}</button>
        </section>
      )}

      {mode === 'verification' && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><h2 className="font-display text-xl font-bold">Import preview</h2><p className="text-sm text-text-secondary">Verification is grouped by day. Nothing is saved until every row is valid and you approve it.</p></div>
            <button type="button" disabled={busy || !rows.length} onClick={revalidatePreview} className="min-h-11 bg-accent-primary px-5 py-3 font-bold text-text-on-accent disabled:opacity-60">{busy ? 'Validating...' : 'Validate and save'}</button>
          </div>
          {detectedFaculty.length ? (
            <section className="border border-border-default bg-surface-primary p-4" aria-labelledby="detected-faculty-heading">
              <h3 id="detected-faculty-heading" className="font-display text-lg font-bold">Detected Faculty</h3>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {detectedFaculty.map((faculty) => (
                  <li key={faculty.name} className="text-sm">
                    <span className={faculty.matched ? 'text-status-success' : 'text-accent-primary'} aria-hidden="true">{faculty.matched ? '✓' : '!'}</span>{' '}
                    <strong>{faculty.name}</strong> · {faculty.contactAvailable ? 'contact available' : faculty.matched ? 'contact not added' : 'new timetable name'}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-text-secondary">Missing faculty phone numbers do not block timetable saving.</p>
            </section>
          ) : null}
          {rows.length ? <VerificationRows rows={rows} setRows={setRows} /> : <p className="border border-border-default bg-surface-primary p-5 text-text-secondary">Import a timetable to create a verification preview.</p>}
        </section>
      )}

      {mode === 'shift' && (
        <section className="space-y-5 border border-border-default bg-surface-primary p-4 shadow-admin sm:p-6">
          <div>
            <h2 className="font-display text-xl font-bold">Shift Classes</h2>
            <p className="mt-1 text-text-secondary">Choose entries, preview their new times, then confirm. Leave every checkbox clear to shift all matching entries after the selected time.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm font-bold">Day<select className="input-field mt-2" value={shiftDay} onChange={(event) => { setShiftDay(event.target.value); setShiftSelection([]); setShiftPreview([]) }}>{DAYS.map((day) => <option key={day}>{day}</option>)}</select></label>
            <label className="text-sm font-bold">Starting at or after<input type="time" className="input-field mt-2" value={shiftAfter} onChange={(event) => { setShiftAfter(event.target.value); setShiftPreview([]) }} /></label>
            <label className="text-sm font-bold">Direction<select className="input-field mt-2" value={shiftDirection} onChange={(event) => { setShiftDirection(event.target.value); setShiftPreview([]) }}><option value="later">Move later</option><option value="earlier">Move earlier</option></select></label>
            <label className="text-sm font-bold">Shift amount<select className="input-field mt-2" value={shiftAmount} onChange={(event) => { setShiftAmount(event.target.value); setShiftPreview([]) }}><option value="5">5 minutes</option><option value="10">10 minutes</option><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="custom">Custom minutes</option></select></label>
            {shiftAmount === 'custom' ? <label className="text-sm font-bold">Custom minutes<input type="number" min="1" max="240" className="input-field mt-2" value={shiftCustomAmount} onChange={(event) => { setShiftCustomAmount(event.target.value); setShiftPreview([]) }} /></label> : null}
          </div>
          <fieldset className="border border-border-default p-4">
            <legend className="px-2 font-bold">Entries to shift</legend>
            <div className="grid gap-2">
              {schedule.filter((entry) => entry.day === shiftDay && entry.startTime >= shiftAfter).map((entry) => (
                <label key={entry.timetableEntryId} className="flex min-h-11 items-center gap-3 border-b border-border-default py-2 last:border-0">
                  <input type="checkbox" checked={shiftSelection.includes(entry.timetableEntryId)} onChange={(event) => setShiftSelection((current) => event.target.checked ? [...current, entry.timetableEntryId] : current.filter((id) => id !== entry.timetableEntryId))} />
                  <span><strong>{formatTime(entry.startTime)} – {formatTime(entry.endTime)}</strong> · {entry.subjectName}</span>
                </label>
              ))}
              {!section ? <p className="text-text-secondary">Select a class above.</p> : scheduleLoading ? <p className="text-text-secondary">Loading timetable...</p> : !schedule.some((entry) => entry.day === shiftDay && entry.startTime >= shiftAfter) ? <p className="text-text-secondary">No matching entries for this day and time.</p> : null}
            </div>
          </fieldset>
          <button type="button" disabled={busy || !section} onClick={previewShift} className="min-h-11 bg-accent-primary px-5 py-3 font-bold text-text-on-accent disabled:opacity-60">{busy ? 'Checking shift...' : 'Preview shifted timetable'}</button>
          {shiftPreview.length ? (
            <div className="border-t border-border-default pt-5">
              <h3 className="font-display text-lg font-bold">Shift preview</h3>
              <div className="mt-3 space-y-2">
                {shiftPreview.map((entry) => <div key={entry.timetableEntryId || entry.clientId} className={`border p-3 ${entry.status === 'error' ? 'border-status-danger' : 'border-border-default'}`}><strong>{formatTime(entry.startTime)} – {formatTime(entry.endTime)}</strong> · {entry.subjectName}{entry.errors?.map((item) => <p key={item} className="mt-1 text-sm text-status-danger">{item}</p>)}</div>)}
              </div>
              <button type="button" disabled={busy || shiftPreview.some((entry) => entry.status === 'error')} onClick={saveShift} className="mt-4 min-h-11 bg-accent-primary px-5 py-3 font-bold text-text-on-accent disabled:opacity-60">{busy ? 'Saving shift...' : 'Confirm and save shift'}</button>
            </div>
          ) : null}
        </section>
      )}

      {mode === 'edit' && (
        <section className="space-y-5">
          {!section ? <p className="text-text-secondary">Select a class to load its weekly timetable.</p> : scheduleLoading ? <p role="status" className="text-text-secondary">Loading timetable...</p> : schedule.length === 0 ? <p className="text-text-secondary">No timetable exists for {section}.</p> : grouped.map(({ day, entries, classCount }) => (
            <details key={day} open={entries.length > 0} className="border border-border-default bg-surface-primary">
              <summary className="cursor-pointer px-4 py-4 font-display text-lg font-bold">{day} <span className="text-sm text-text-secondary">({classCount})</span></summary>
              <div className="space-y-4 border-t border-border-default p-4">
                {entries.length === 0 ? <p className="text-sm text-text-secondary">No classes.</p> : entries.map((entry, index) => (
                  <div key={entry.timetableEntryId} className="space-y-3">
                  <article className={`border border-border-default p-4 ${isBreakEntry(entry) ? 'bg-surface-secondary' : ''}`}>
                    <EntryFields row={entry} onChange={(next) => setSchedule((current) => current.map((item) => item.timetableEntryId === entry.timetableEntryId ? next : item))} />
                    {isBreakEntry(entry) ? <p className="mt-3 text-sm text-text-secondary">No faculty or room is required. Breaks are not counted as classes.</p> : entry.parsedLocation ? <div className="mt-3 text-sm"><LocationPreview location={entry.parsedLocation} /></div> : null}
                    {entry.errors?.map((item) => <p className="mt-1 text-sm text-status-danger" key={item}>{item}</p>)}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" disabled={busy} onClick={() => editEntry(schedule.find((item) => item.timetableEntryId === entry.timetableEntryId))} className="min-h-11 border border-border-strong px-3 py-2 font-bold"><HiOutlinePencil className="mr-1 inline" />Save edit</button>
                      <button type="button" onClick={() => { setRow({ ...entry, timetableEntryId: null }); setMode('manual') }} className="min-h-11 border border-border-default px-3 py-2"><HiOutlineClipboardCopy className="mr-1 inline" />Duplicate</button>
                      <button type="button" onClick={(event) => { setDeleteError(''); setPendingDelete({ entry, trigger: event.currentTarget }) }} className="min-h-11 border border-border-default px-3 py-2 text-status-danger"><HiOutlineTrash className="mr-1 inline" />Delete</button>
                    </div>
                  </article>
                  <button
                    type="button"
                    onClick={() => prepareInsert(day, entry.endTime, entries[index + 1]?.startTime || addMinutes(entry.endTime, 60))}
                    className="min-h-11 w-full border border-dashed border-border-strong px-4 py-2 font-bold text-accent-primary"
                  >
                    <HiOutlinePlus className="mr-1 inline" />{entries[index + 1] ? 'Add class here' : 'Add class after this'}
                  </button>
                  </div>
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
