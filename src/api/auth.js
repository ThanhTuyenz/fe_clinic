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

export async function register({ firstName, lastName, email, phone, password }) {
  const res = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ firstName, lastName, email, phone, password }),
  })
  const data = await parseJson(res)
  if (!res.ok) {
    throw new Error(data.message || 'Đăng ký thất bại.')
  }
  return data
}

export async function verifyEmail({ verificationToken, otp }) {
  const res = await fetch(`${base}/api/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ verificationToken, otp: String(otp).trim() }),
  })
  const data = await parseJson(res)
  if (!res.ok) {
    throw new Error(data.message || 'Xác thực thất bại.')
  }
  return data
}

export async function resendOtp({ email }) {
  const res = await fetch(`${base}/api/auth/resend-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  const data = await parseJson(res)
  if (!res.ok) {
    throw new Error(data.message || 'Gửi lại mã thất bại.')
  }
  return data
}

export async function login({ email, password }) {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await parseJson(res)
  if (!res.ok) {
    const err = new Error(data.message || 'Đăng nhập thất bại.')
    if (data.code) err.code = data.code
    if (data.email) err.email = data.email
    if (data.emailMask) err.emailMask = data.emailMask
    if (data.verificationToken) err.verificationToken = data.verificationToken
    throw err
  }
  return data
}

export async function getMe({ token }) {
  const res = await fetch(`${base}/api/auth/me`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  const data = await parseJson(res)
  if (!res.ok) {
    throw new Error(data.message || 'Không lấy được hồ sơ bệnh nhân.')
  }
  return data
}
