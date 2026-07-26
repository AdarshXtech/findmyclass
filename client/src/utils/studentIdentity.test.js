import { describe, expect, it } from 'vitest'
import { normalizePhoneNumber, normalizeStudentName } from './studentIdentity'

describe('student identity normalization', () => {
  it('matches names without regard to case', () => {
    expect(normalizeStudentName('adarsh tiwari')).toBe(normalizeStudentName('ADARSH TIWARI'))
  })

  it('normalizes extra whitespace in names', () => {
    expect(normalizeStudentName('  Adarsh    Tiwari  ')).toBe('ADARSH TIWARI')
  })

  it('accepts Indian phone numbers with a +91 prefix', () => {
    expect(normalizePhoneNumber('+91 9110081610')).toBe('9110081610')
  })

  it('rejects invalid phone numbers', () => {
    expect(normalizePhoneNumber('91100')).toBeNull()
    expect(normalizePhoneNumber('+92 9110081610')).toBeNull()
  })
})
