/** Base URL của be_clinic — ưu tiên `VITE_API_URL`, mặc định dev :5000 */
export function getApiBase() {
  const raw = import.meta.env.VITE_API_URL
  return (raw && String(raw).replace(/\/$/, '')) || 'http://localhost:5000'
}

export async function parseJsonResponse(res) {
  const text = await res.text()
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return { message: text || 'Lỗi không xác định.' }
  }
}
