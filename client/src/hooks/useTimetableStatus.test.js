import { describe, expect, it } from 'vitest'
import { makeEntry } from '../test/fixtures'
import { getTimetableStatus } from './useTimetableStatus'

const mondaySchedule = [
  makeEntry({ id: 3, startTime: '14:00', endTime: '15:00', subjectName: 'Final class' }),
  makeEntry({ id: 1, startTime: '09:00', endTime: '10:00', subjectName: 'First class' }),
  makeEntry({ id: 2, startTime: '11:00', endTime: '12:00', subjectName: 'Second class' }),
]

function mondayAt(hour, minute) {
  return new Date(2026, 6, 20, hour, minute)
}

describe('getTimetableStatus', () => {
  it('selects the currently active class', () => {
    const status = getTimetableStatus(mondaySchedule, mondayAt(9, 30))

    expect(status.activeEntry?.subjectName).toBe('First class')
    expect(status.priorityEntry).toBe(status.activeEntry)
    expect(status.locationStatus).toBe('Current class')
  })

  it('shows the next class before the first class starts', () => {
    const status = getTimetableStatus(mondaySchedule, mondayAt(8, 0))

    expect(status.activeEntry).toBeNull()
    expect(status.priorityEntry?.subjectName).toBe('First class')
    expect(status.locationStatus).toBe('First class today')
    expect(status.timeContext).toBe('Starts in 60 minutes')
  })

  it('shows the next class between scheduled classes', () => {
    const status = getTimetableStatus(mondaySchedule, mondayAt(10, 30))

    expect(status.priorityEntry?.subjectName).toBe('Second class')
    expect(status.locationStatus).toBe('Next class')
    expect(status.timeContext).toBe('Starts in 30 minutes')
  })

  it('reports that the day is finished after the final class', () => {
    const status = getTimetableStatus(mondaySchedule, mondayAt(15, 1))

    expect(status.priorityEntry).toBeNull()
    expect(status.finishedForToday).toBe(true)
  })

  it('sorts classes chronologically by starting time', () => {
    const status = getTimetableStatus(mondaySchedule, mondayAt(8, 0))

    expect(status.todayClasses.map((entry) => entry.startTime)).toEqual([
      '09:00',
      '11:00',
      '14:00',
    ])
  })

  it('auto-expands today when a class is active or starts within 90 minutes', () => {
    expect(getTimetableStatus(mondaySchedule, mondayAt(7, 30)).shouldAutoExpandToday).toBe(true)
    expect(getTimetableStatus(mondaySchedule, mondayAt(7, 29)).shouldAutoExpandToday).toBe(false)
    expect(getTimetableStatus(mondaySchedule, mondayAt(9, 30)).shouldAutoExpandToday).toBe(true)
  })

  it('provides readable status for every timetable entry', () => {
    const status = getTimetableStatus(mondaySchedule, mondayAt(10, 30))

    expect(status.entryStatusById.get(1)).toBe('completed')
    expect(status.entryStatusById.get(2)).toBe('next')
    expect(status.entryStatusById.get(3)).toBe('upcoming')
  })

  it('keeps cancelled classes visible without selecting them as the next destination', () => {
    const schedule = [
      makeEntry({ id: 1, startTime: '09:00', endTime: '10:00', status: 'cancelled' }),
      makeEntry({ id: 2, startTime: '11:00', endTime: '12:00', subjectName: 'Available class' }),
    ]
    const status = getTimetableStatus(schedule, mondayAt(8, 30))

    expect(status.priorityEntry?.subjectName).toBe('Available class')
    expect(status.entryStatusById.get(1)).toBe('cancelled')
  })
})
