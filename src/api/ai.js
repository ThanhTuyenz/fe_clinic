import { getApiBase, parseJsonResponse } from './apiBase.js'

function authHeaders(token) {
  const t = String(token || '').trim()
  return t ? { Authorization: `Bearer ${t}` } : {}
}

export async function aiChat({ token, messages, state }) {
  const base = getApiBase()
  const res = await fetch(`${base}/api/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(token),
    },
    body: JSON.stringify({ messages, state }),
  })

  const data = await parseJsonResponse(res)
  if (!res.ok) {
    const err = new Error(data?.message || 'Không gọi được trợ lý AI.')
    err.status = res.status
    throw err
  }
  return data
}

