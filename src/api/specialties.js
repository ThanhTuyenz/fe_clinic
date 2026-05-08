import { getApiBase, parseJsonResponse } from './apiBase.js'

export async function listSpecialties() {
  const base = getApiBase()
  const res = await fetch(`${base}/api/specialties`, { method: 'GET' })
  const data = await parseJsonResponse(res)
  if (!res.ok) {
    throw new Error(data.message || 'Không lấy được danh sách chuyên khoa.')
  }
  return data?.specialties || []
}

