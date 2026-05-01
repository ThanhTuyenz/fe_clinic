/** Khớp SLOT_MINUTES trong MyAppointments.jsx */
export const DEFAULT_SLOT_MINUTES = 12

export function dateKeyFromAppointmentValue(value) {
  if (!value) return ''
  if (typeof value === 'string') {
    return value.includes('T') ? value.slice(0, 10) : value.slice(0, 10)
  }
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const pad2 = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function getSlotEndDate(row, slotMinutes = DEFAULT_SLOT_MINUTES) {
  const dk = dateKeyFromAppointmentValue(row?.appointmentDate)
  if (!dk) return null
  const en = String(row?.endTime || '').trim()
  if (en.length >= 5) {
    const t = en.slice(0, 5)
    const d = new Date(`${dk}T${t}:00`)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const st = String(row?.startTime || '00:00').slice(0, 5)
  const d = new Date(`${dk}T${st}:00`)
  if (Number.isNaN(d.getTime())) return null
  d.setMinutes(d.getMinutes() + slotMinutes)
  return d
}

export function isPendingAppointmentPastSlot(row, slotMinutes = DEFAULT_SLOT_MINUTES) {
  if (String(row?.status || '').toLowerCase() !== 'pending') return false
  const end = getSlotEndDate(row, slotMinutes)
  if (!end) return false
  return end.getTime() < Date.now()
}
