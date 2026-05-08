import { getApiBase, parseJsonResponse } from './apiBase.js'

export async function listDepartments() {
  const base = getApiBase()
  const res = await fetch(`${base}/api/departments`, { method: 'GET' })
  const data = await parseJsonResponse(res)
  if (!res.ok) {
    throw new Error(data.message || 'Không lấy được danh sách khoa.')
  }
  return data?.departments || []
}

