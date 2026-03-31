const base =
  (import.meta.env.VITE_API_URL && String(import.meta.env.VITE_API_URL).replace(/\/$/, '')) ||
  'http://localhost:5000'

const DEFAULT_DOCTOR_AVATAR =
  'https://sf-static.upanhlaylink.com/img/image_202603269925437b540c48178c53b73c88dd8146.jpg'

/** MongoDB ObjectId string: 24 ký tự hex (bác sĩ lưu trong collection `users`). */
export function isMongoObjectId(id) {
  return typeof id === 'string' && /^[a-fA-F0-9]{24}$/.test(id)
}

function deriveExperienceYears(doctor) {
  if (!doctor) return null
  const directCandidate =
    doctor.experienceYears ??
    doctor.yearsOfExperience ??
    doctor.years ??
    doctor.experience ??
    doctor.expYears ??
    null

  if (directCandidate !== null && directCandidate !== undefined && directCandidate !== '') {
    const extracted = Number(String(directCandidate).replace(/[^\d.]/g, ''))
    if (Number.isFinite(extracted) && extracted > 0) return extracted
  }

  const bio = String(doctor.bio || '')
  const match =
    bio.match(/(?:hơn|trên)\s*(\d+)\s*năm\s*kinh nghiệm/i) ||
    bio.match(/kinh nghiệm\s*(\d+)\s*năm/i)
  if (match) return Number(match[1])

  const key = String(doctor.id || doctor.email || doctor.displayName || '')
  if (!key) return null
  let seed = 0
  for (let i = 0; i < key.length; i += 1) seed = (seed * 31 + key.charCodeAt(i)) % 100000
  return 3 + (seed % 18)
}

function injectExperienceIntoBio(doctor) {
  const years = deriveExperienceYears(doctor)
  if (!years) return doctor

  const bioRaw = String(doctor.bio || '').trim()
  const hasExp = /(?:hơn|trên)\s*\d+\s*năm\s*kinh nghiệm|kinh nghiệm\s*\d+\s*năm/i.test(bioRaw)
  const bioNext = hasExp ? bioRaw : `${bioRaw ? `${bioRaw}\n\n` : ''}Bác sĩ có hơn ${years} năm kinh nghiệm trong lĩnh vực chuyên môn.`

  return { ...doctor, experienceYears: years, bio: bioNext }
}

function deriveSpecialty(doctor) {
  if (!doctor) return ''
  if (doctor.specialtyName) return String(doctor.specialtyName).trim()
  if (doctor.specialty) return String(doctor.specialty).trim()
  const bio = String(doctor.bio || '').trim()
  if (!bio) return ''

  const m1 = bio.match(/^Bác sĩ\s*([^\n—-]+)\s*(?:—|-|$)/i)
  if (m1) return String(m1[1]).trim()

  const m2 = bio.match(/lĩnh vực\s+([^.\n]+)\./i)
  if (m2) return String(m2[1]).trim()

  return ''
}

function normalizeDoctor(doctor) {
  const d = injectExperienceIntoBio(doctor)
  const specialty = deriveSpecialty(d)
  const normalized = specialty ? { ...d, specialty } : d

  const hasAvatar =
    normalized.avatarUrl ||
    normalized.avatarURL ||
    normalized.avatar ||
    normalized.avatar_url ||
    normalized.imageUrl ||
    normalized.image_url ||
    normalized.photoUrl ||
    normalized.photo_url

  if (!hasAvatar) {
    return { ...normalized, avatarUrl: DEFAULT_DOCTOR_AVATAR }
  }
  return normalized
}

/**
 * Danh sách bác sĩ từ API `/api/doctors` (thực tế là user có `userType: doctor` trong Mongo).
 * Chỉ trả các bản ghi có `id` là ObjectId hợp lệ để đặt lịch không gửi nhầm id demo.
 */
export async function listDoctors() {
  let res
  try {
    res = await fetch(`${base}/api/doctors`, { method: 'GET' })
  } catch {
    throw new Error(
      'Không kết nối được máy chủ. Hãy chạy backend (ví dụ port 5000) và kiểm tra biến VITE_API_URL.',
    )
  }

  const text = await res.text()
  let data = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { message: text || 'Lỗi không xác định.' }
  }

  if (!res.ok) {
    throw new Error(data.message || 'Không lấy được danh sách bác sĩ.')
  }

  const raw = (data.doctors || []).map(normalizeDoctor)
  const filtered = raw.filter((d) => isMongoObjectId(d?.id))
  if (raw.length > 0 && filtered.length === 0) {
    throw new Error(
      'Danh sách bác sĩ từ máy chủ không có id hợp lệ. Kiểm tra API /api/doctors có trả id là _id MongoDB (24 ký tự hex).',
    )
  }
  return filtered
}
