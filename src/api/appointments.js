const base =
  (import.meta.env.VITE_API_URL && String(import.meta.env.VITE_API_URL).replace(/\/$/, '')) ||
  'http://localhost:5000'

async function parseJson(res) {
  const text = await res.text()
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return { message: text || 'Lỗi không xác định.' }
  }
}

function httpError(message, res, data) {
  const err = new Error(message || 'Yêu cầu thất bại.')
  err.status = res?.status
  err.data = data
  return err
}

export async function createAppointment({ token, doctorId, appointmentDate, startTime, note }) {
  const res = await fetch(`${base}/api/appointments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      source: 'online',
      bookingSource: 'online',
      doctorId,
      appointmentDate,
      startTime,
      note: note || '',
    }),
  })

  const data = await parseJson(res)
  if (!res.ok) {
    throw httpError(data.message || 'Đặt lịch thất bại.', res, data)
  }
  return data
}

export async function cancelAppointment({ token, appointmentId }) {
  const id = String(appointmentId || '').trim()
  const res = await fetch(`${base}/api/appointments/${encodeURIComponent(id)}/cancel`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const data = await parseJson(res)
  if (!res.ok) {
    throw httpError(data.message || 'Không hủy được lịch khám.', res, data)
  }
  return data
}

export async function listMyAppointments({ token }) {
  const res = await fetch(`${base}/api/appointments/my`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const data = await parseJson(res)
  if (!res.ok) {
    throw httpError(data.message || 'Không lấy được lịch khám.', res, data)
  }
  return data?.appointments || []
}

export async function getAvailability({ token, doctorId, date }) {
  const qs = new URLSearchParams({
    doctorId: String(doctorId || '').trim(),
    date: String(date || '').trim(),
  })

  const res = await fetch(`${base}/api/appointments/availability?${qs.toString()}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const data = await parseJson(res)
  if (!res.ok) {
    throw httpError(data.message || 'Không lấy được khung giờ.', res, data)
  }
  return data
}

