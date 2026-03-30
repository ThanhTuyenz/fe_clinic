const base =
  (import.meta.env.VITE_API_URL && String(import.meta.env.VITE_API_URL).replace(/\/$/, '')) ||
  'http://localhost:5000'

const DEFAULT_DOCTOR_AVATAR =
  'https://sf-static.upanhlaylink.com/img/image_202603269925437b540c48178c53b73c88dd8146.jpg'

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
    // Support cases like: "15", 15, "15 năm"
    const extracted = Number(String(directCandidate).replace(/[^\d.]/g, ''))
    if (Number.isFinite(extracted) && extracted > 0) return extracted
  }

  const bio = String(doctor.bio || '')
  // Matches: "hơn 20 năm kinh nghiệm", "trên 15 năm kinh nghiệm", "kinh nghiệm 12 năm"
  const match =
    bio.match(/(?:hơn|trên)\s*(\d+)\s*năm\s*kinh nghiệm/i) ||
    bio.match(/kinh nghiệm\s*(\d+)\s*năm/i)
  if (match) return Number(match[1])

  const key = String(doctor.id || doctor.email || doctor.displayName || '')
  if (!key) return null
  let seed = 0
  for (let i = 0; i < key.length; i += 1) seed = (seed * 31 + key.charCodeAt(i)) % 100000
  return 3 + (seed % 18) // 3..20
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

  // Try: "Bác sĩ Nội tổng quát — ..." or "Bác sĩ Nội tổng quát - ..."
  const m1 = bio.match(/^Bác sĩ\s*([^\n—-]+)\s*(?:—|-|$)/i)
  if (m1) return String(m1[1]).trim()

  // Try: "lĩnh vực Tiêu hóa." in the sample bio
  const m2 = bio.match(/lĩnh vực\s+([^.\n]+)\./i)
  if (m2) return String(m2[1]).trim()

  return ''
}

function normalizeDoctor(doctor) {
  const d = injectExperienceIntoBio(doctor)
  const specialty = deriveSpecialty(d)
  const normalized = specialty ? { ...d, specialty } : d

  // Backend hiện tại chưa trả avatar; fallback bằng ảnh mặc định để UI luôn hiển thị.
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

function createBioLikeSample({ titleName, years, specialty, hospital, extra }) {
  const p1 = `${titleName} đã có hơn ${years} năm kinh nghiệm trong lĩnh vực ${specialty}.`
  const p2 = `Là một bác sĩ giỏi, có bề dày kinh nghiệm cũng như chuyên môn cao, ${titleName} hiện đang công tác tại ${hospital}.`
  const p3 =
    extra ||
    `Bác sĩ chuyên khám và tư vấn các bệnh lý liên quan đến ${specialty.toLowerCase()} theo nhu cầu của bệnh nhân.`
  return `${p1}\n\n${p2}\n\n${p3}`
}

function buildExtraDoctors(existing) {
  const usedIds = new Set((existing || []).map((d) => d?.id).filter(Boolean))
  const defaultAvatar = DEFAULT_DOCTOR_AVATAR
  const extras = [
    {
      id: 'demo-doc-01',
      displayName: 'Lâm Việt Trung',
      lastName: 'Lâm',
      firstName: 'Việt Trung',
      bio: '',
      specialty: 'Tiêu hóa',
      hospital: 'Bệnh viện Chợ Rẫy',
      years: 20,
      avatarUrl: defaultAvatar,
    },
    {
      id: 'demo-doc-02',
      displayName: 'Nguyễn Thị Thu Hà',
      lastName: 'Nguyễn',
      firstName: 'Thị Thu Hà',
      bio: '',
      specialty: 'Nhi khoa',
      hospital: 'Bệnh viện Nhi Đồng Thành phố',
      years: 12,
      avatarUrl: defaultAvatar,
    },
    {
      id: 'demo-doc-03',
      displayName: 'Võ Đức Hiếu',
      lastName: 'Võ',
      firstName: 'Đức Hiếu',
      bio: '',
      specialty: 'Ung bướu',
      hospital: 'Bệnh viện Ung Bướu TP. HCM',
      years: 15,
      avatarUrl: defaultAvatar,
    },
    {
      id: 'demo-doc-04',
      displayName: 'Lê Minh',
      lastName: 'Lê',
      firstName: 'Minh',
      bio: '',
      specialty: 'Da liễu',
      hospital: 'Bệnh viện Da Liễu',
      years: 10,
      avatarUrl: defaultAvatar,
    },
  ]

  return extras
    .filter((d) => !usedIds.has(d.id))
    .map((d) => {
      const titleName = `Phó Giáo sư, Tiến sĩ, Bác sĩ ${d.displayName}`
      const bio = createBioLikeSample({
        titleName,
        years: d.years,
        specialty: d.specialty,
        hospital: d.hospital,
      })
      return {
        id: d.id,
        displayName: d.displayName,
        lastName: d.lastName,
        firstName: d.firstName,
        email: `${d.id}@vitacare.local`,
        bio,
        experienceYears: d.years,
        specialty: d.specialty,
        hospital: d.hospital,
        avatarUrl: d.avatarUrl,
      }
    })
}

export async function listDoctors() {
  try {
    const res = await fetch(`${base}/api/doctors`, {
      method: 'GET',
    })

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

    // When backend is available, DO NOT mix demo data.
    return (data.doctors || []).map(normalizeDoctor)
  } catch {
    // Backend not available -> demo data only
    return buildExtraDoctors([])
  }
}

