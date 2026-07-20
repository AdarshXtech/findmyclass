export function normalizePhone(input) {
  if (input === undefined || input === null) {
    return ''
  }

  let cleanPhone = String(input).replace(/[^\d]/g, '')
  if (cleanPhone.length === 12 && cleanPhone.startsWith('91')) {
    cleanPhone = cleanPhone.slice(2)
  }
  return cleanPhone
}

export function isValidPhone(phone) {
  return /^\d{10}$/.test(phone)
}
