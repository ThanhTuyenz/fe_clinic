import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { getMe } from '../api/auth.js'
import { isMongoObjectId, listDoctors } from '../api/doctors.js'
import { createAppointment, getAvailability, listMyAppointments } from '../api/appointments.js'
import logo from '../assets/logo.png'
import '../styles/auth.css'
import '../styles/appointment.css'
import '../styles/landing.css'

function safeParse(json) {
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

function getSession() {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token')
  const userRaw = localStorage.getItem('user') || sessionStorage.getItem('user')
  const user = safeParse(userRaw || 'null')
  return { token, user }
}

function formatDateVi(isoOrDate) {
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate)
  if (Number.isNaN(d.getTime())) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = d.getFullYear()
  return `${dd}/${mm}/${yy}`
}

function buildPatientCode(userId) {
  const raw = String(userId || '').replace(/[^a-fA-F0-9]/g, '')
  const yy = String(new Date().getFullYear()).slice(-2)
  const pad = (raw + '00000000').slice(0, 8).toUpperCase()
  return `YMP${yy}${pad}`
}

function getDoctorFullName(d) {
  const first = String(d?.firstName || '').trim()
  const last = String(d?.lastName || '').trim()
  const full = `${first} ${last}`.trim()
  return full || String(d?.displayName || '').trim() || d?.email || ''
}

function parseDoctorBio(bio) {
  const s = String(bio || '').trim()
  if (!s) return { rank: '', specialty: '' }

  let primary = s
  if (s.includes('—')) primary = s.split('—')[0].trim()
  else if (s.includes('-')) primary = s.split('-')[0].trim()

  const match = primary.match(/^Bác sĩ\s*(.+)$/i)
  if (match) return { rank: 'Bác sĩ', specialty: match[1].trim() }
  return { rank: '', specialty: primary }
}

function getDoctorInitials(d) {
  const ln = String(d.lastName || '').trim()
  const fn = String(d.firstName || '').trim()

  const a = ln ? ln[0] : ''
  const b = fn ? fn[0] : ''
  if (a || b) return `${a}${b}`.toUpperCase()

  const words = String(getDoctorFullName(d))
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!words.length) return '?'

  return words
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

function getDoctorRankName(d) {
  const { rank } = parseDoctorBio(d.bio)
  const name = getDoctorFullName(d)
  return rank ? `${rank} ${name}` : name
}

function parseDoctorExperienceYears(bio) {
  const s = String(bio || '')
  const match = s.match(/kinh nghiệm\s*(\d+)\s*năm/i)
  if (match) return Number(match[1])
  return null
}

function parseDoctorSpecialty(bio) {
  return parseDoctorBio(bio).specialty || ''
}

function getDoctorSpecialtyShort(d) {
  const direct = String(d?.specialtyName || d?.specialty || '').trim()
  if (direct) return direct

  const fromBio = String(parseDoctorSpecialty(d?.bio || '') || '').trim()
  if (!fromBio) return ''
  // Guard: bio sample paragraphs can accidentally be parsed as "specialty"
  if (fromBio.length > 48) return ''
  if (/kinh nghiệm|công tác|bác sĩ/i.test(fromBio)) return ''
  return fromBio
}

function formatDayShort(date) {
  // date: Date instance
  const weekdays = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
  const dd = date.getDate().toString().padStart(2, '0')
  const mm = (date.getMonth() + 1).toString().padStart(2, '0')
  return `${weekdays[date.getDay()]}, ${dd}-${mm}`
}

function addMinutesToHHmm(hhmm, minutesToAdd) {
  const [hh, mm] = String(hhmm || '00:00')
    .split(':')
    .map((v) => Number(v))
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || !Number.isFinite(minutesToAdd)) return hhmm
  const d = new Date()
  d.setHours(hh)
  d.setMinutes(mm + minutesToAdd)
  const eh = d.getHours().toString().padStart(2, '0')
  const em = d.getMinutes().toString().padStart(2, '0')
  return `${eh}:${em}`
}

function getDoctorExperienceYears(d) {
  if (!d) return null

  // Prefer explicit fields if backend provides them
  const directCandidate =
    d.experienceYears ?? d.yearsOfExperience ?? d.years ?? d.experience ?? d.expYears ?? null

  if (directCandidate !== null && directCandidate !== undefined && directCandidate !== '') {
    // Support cases like: "15", 15, "15 năm"
    const extracted = Number(String(directCandidate).replace(/[^\d.]/g, ''))
    if (Number.isFinite(extracted) && extracted > 0) return extracted
  }

  const fromBio = parseDoctorExperienceYears(d.bio)
  if (fromBio != null) return fromBio

  // Demo fallback: deterministic 3..20 based on id/email
  const key = String(d.id || d.email || getDoctorFullName(d) || '')
  if (!key) return null
  let seed = 0
  for (let i = 0; i < key.length; i += 1) seed = (seed * 31 + key.charCodeAt(i)) % 100000
  return 3 + (seed % 18)
}

function splitBioParagraphs(bio) {
  const s = String(bio || '').trim()
  if (!s) return []
  return s
    .split(/\n\s*\n/g)
    .map((p) => p.trim())
    .filter(Boolean)
}

function normalizeAvatarUrl(url) {
  const s = String(url || '').trim()
  if (!s) return ''
  if (s.includes('sf-static.upanhlaylink.com/view/')) return s.replace('/view/', '/img/')
  return s
}

function getDoctorAvatarSrc(d) {
  const candidate =
    d?.avatarUrl ??
    d?.avatarURL ??
    d?.avatar ??
    d?.avatar_url ??
    d?.imageUrl ??
    d?.image_url ??
    d?.photoUrl ??
    d?.photo_url ??
    ''
  return normalizeAvatarUrl(candidate)
}

export default function Appointment() {
  const navigate = useNavigate()
  const location = useLocation()
  const { token, user } = useMemo(() => getSession(), [])
  const requestedDoctorId = location.state?.doctorId
  const requestedDeptId = location.state?.deptId

  const [doctors, setDoctors] = useState([])
  const [loadingDoctors, setLoadingDoctors] = useState(true)

  const [doctorId, setDoctorId] = useState('')
  const [doctorLoadError, setDoctorLoadError] = useState('')
  const [showDoctorDetail, setShowDoctorDetail] = useState(false)
  const [showBookingInfo, setShowBookingInfo] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeDeptId, setActiveDeptId] = useState('')
  const [page, setPage] = useState(1)

  const [appointmentDate, setAppointmentDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0, 10)
  })
  const [startTime, setStartTime] = useState('08:00')
  const [note, setNote] = useState('')
  const [bookingError, setBookingError] = useState('')
  const [bookingLoading, setBookingLoading] = useState(false)

  const [patientDraft, setPatientDraft] = useState(() => ({
    id: '',
    code: '',
    fullName: '',
    gender: '',
    dob: '',
    phone: '',
    address: '',
    email: '',
    citizenId: '',
  }))
  const [patientModalOpen, setPatientModalOpen] = useState(false)
  const [patientModalDraft, setPatientModalDraft] = useState(() => ({
    fullName: '',
    phone: '',
    dob: '',
    gender: 'Nam',
    province: '',
    district: '',
    ward: '',
    addressLine: '',
    idCard: '',
    ethnicity: 'Kinh',
    occupation: '',
    insuranceNo: '',
    email: '',
  }))
  
  const scheduleRef = useRef(null)
  const dateStripRef = useRef(null)

  useEffect(() => {
    if (!token || !user) {
      navigate('/login', { replace: true })
      return
    }

    // Load patient profile from Mongo via /api/auth/me
    ;(async () => {
      try {
        const data = await getMe({ token })
        const me = data?.user
        if (!me) return

        const fullName =
          String(
            me.displayName ||
              [me.lastName, me.firstName].filter(Boolean).join(' ').trim() ||
              '',
          ).trim() || String(me.email || '').trim()

        const genderLabel =
          me.gender === true ? 'Nam' : me.gender === false ? 'Nữ' : String(me.gender || '').trim() || 'Nam'

        const dobLabel = me.dob ? formatDateVi(me.dob) : ''
        const phone = String(me.phone || '').trim()
        const address = String(me.address || '').trim()
        const code = buildPatientCode(me.id)

        setPatientDraft({
          id: String(me.id || ''),
          code,
          fullName,
          gender: genderLabel,
          dob: dobLabel,
          phone,
          address,
          email: String(me.email || '').trim(),
          citizenId: String(me.citizenId || '').trim(),
        })

        setPatientModalDraft((d) => ({
          ...d,
          fullName,
          phone,
          dob: dobLabel,
          gender: genderLabel || 'Nam',
          addressLine: address,
          idCard: String(me.citizenId || '').trim(),
          email: String(me.email || '').trim(),
        }))

        // Update stored user so other screens can show patient info consistently
        const storage = localStorage.getItem('token') ? localStorage : sessionStorage
        const existingRaw = storage.getItem('user')
        const existing = safeParse(existingRaw || 'null') || {}
        storage.setItem('user', JSON.stringify({ ...existing, ...me }))
      } catch {
        // ignore: booking can still proceed without extra patient fields
      }
    })()

    listDoctors()
      .then((docs) => {
        setDoctors(docs)
        if (requestedDeptId && docs?.some((d) => String(d?.deptID || '').trim() === String(requestedDeptId).trim())) {
          setActiveDeptId(String(requestedDeptId).trim())
        }
        const resolvedId =
          requestedDoctorId && docs?.some((d) => d?.id === requestedDoctorId)
            ? requestedDoctorId
            : docs[0]
              ? docs[0].id
              : ''
        setDoctorId(resolvedId)
        setShowDoctorDetail(Boolean(requestedDoctorId))
        setShowBookingInfo(false)
        setDoctorLoadError('')
      })
      .catch((err) => setDoctorLoadError(err.message || 'Không tải được bác sĩ.'))
      .finally(() => setLoadingDoctors(false))
  }, [token, user, navigate, requestedDoctorId, requestedDeptId])

  function handleOpenDoctorDetail(nextId) {
    setDoctorId(nextId)
    setShowDoctorDetail(true)
    setShowBookingInfo(false)
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0)
  }

  function handlePickDoctor(nextId) {
    setDoctorId(nextId)
    setShowDoctorDetail(true)
    setShowBookingInfo(false)
    setTimeout(() => {
      scheduleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
  }

  const departments = useMemo(() => {
    const map = new Map()
    for (const d of doctors || []) {
      const id = String(d?.deptID || '').trim()
      const name = String(d?.deptName || '').trim()
      if (!id || !name) continue
      const prev = map.get(id)
      map.set(id, prev ? { ...prev, count: prev.count + 1 } : { id, name, count: 1 })
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'vi'))
  }, [doctors])

  const filteredDoctors = useMemo(() => {
    const q = String(searchQuery || '').trim().toLowerCase()
    const deptId = String(activeDeptId || '').trim()
    return (doctors || []).filter((d) => {
      if (deptId && String(d?.deptID || '').trim() !== deptId) return false
      if (!q) return true
      const name = getDoctorFullName(d).toLowerCase()
      const rankName = getDoctorRankName(d).toLowerCase()
      const email = String(d?.email || '').toLowerCase()
      const spec = String(d?.specialtyName || d?.specialty || getDoctorSpecialtyShort(d) || '').toLowerCase()
      const dept = String(d?.deptName || '').toLowerCase()
      return name.includes(q) || rankName.includes(q) || email.includes(q) || spec.includes(q) || dept.includes(q)
    })
  }, [doctors, searchQuery, activeDeptId])

  const pageSize = 9
  const totalPages = Math.max(1, Math.ceil(filteredDoctors.length / pageSize))
  const clampedPage = Math.min(Math.max(1, page), totalPages)
  const pagedDoctors = useMemo(() => {
    const start = (clampedPage - 1) * pageSize
    return filteredDoctors.slice(start, start + pageSize)
  }, [filteredDoctors, clampedPage])

  const selectedDoctor =
    filteredDoctors.find((d) => d.id === doctorId) ||
    doctors.find((d) => d.id === doctorId) ||
    null
  const selectedSpecialty =
    (selectedDoctor &&
      String(selectedDoctor.specialtyName || selectedDoctor.specialty || '').trim()) ||
    getDoctorSpecialtyShort(selectedDoctor)
  const selectedExperienceYears = getDoctorExperienceYears(selectedDoctor)
  const displayDoctorTitle = selectedDoctor ? `Bác sĩ ${getDoctorFullName(selectedDoctor)}` : ''

  // Keep selected doctor valid when filters change
  useEffect(() => {
    if (showDoctorDetail || showBookingInfo) return
    if (!doctorId) return
    if (filteredDoctors.some((d) => d.id === doctorId)) return
    if (filteredDoctors[0]?.id) setDoctorId(filteredDoctors[0].id)
  }, [filteredDoctors, doctorId, showDoctorDetail, showBookingInfo])

  // Reset pagination when filters change
  useEffect(() => {
    setPage(1)
  }, [searchQuery, activeDeptId])

  const upcomingDays = useMemo(() => {
    const start = new Date()
    start.setDate(start.getDate() + 1)
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      const iso = d.toISOString().slice(0, 10)
      return { iso, label: formatDayShort(d) }
    })
  }, [])

  const timeSlots = useMemo(() => {
    // UI demo: create the same style as screenshot.
    // Can be replaced with real API schedule later (per doctor + date).
    const base = [
      '17:00',
      '17:12',
      '17:24',
      '17:36',
      '17:48',
      '18:00',
      '18:12',
      '18:24',
      '18:36',
      '18:48',
      '19:00',
      '19:12',
      '19:24',
      '19:36',
      '19:48',
      '20:00',
    ]
    return base.map((t) => {
      const end = addMinutesToHHmm(t, 12)
      return { start: t, end, label: `${t}-${end}` }
    })
  }, [])

  const [disabledStarts, setDisabledStarts] = useState(() => new Set())
  const [availabilityLoading, setAvailabilityLoading] = useState(false)
  const [availabilityError, setAvailabilityError] = useState('')
  const [availabilityByDate, setAvailabilityByDate] = useState(() => ({}))

  useEffect(() => {
    if (!token || !user) return
    if (!doctorId || !upcomingDays.length) return

    let mounted = true
    setAvailabilityLoading(true)
    setAvailabilityError('')

    // Fetch availability for all visible days so "Đã đầy lịch / còn X khung giờ"
    // is derived from real backend data (not random/demo).
    Promise.all(
      upcomingDays.map(async (d) => {
        const iso = d.iso
        try {
          const data = await getAvailability({ token, doctorId, date: iso })
          const booked = (data?.bookedStartTimes || [])
            .map((s) => String(s || '').trim())
            .filter(Boolean)
          return { iso, booked, ok: true }
        } catch (err) {
          return { iso, booked: [], ok: false, error: err?.message || 'Không tải được khung giờ.' }
        }
      }),
    )
      .then((rows) => {
        if (!mounted) return
        const next = {}
        for (const r of rows) {
          next[r.iso] = {
            booked: new Set(r.booked || []),
            ok: r.ok !== false,
            error: r.ok === false ? r.error : '',
          }
        }
        setAvailabilityByDate(next)
      })
      .catch((err) => {
        if (!mounted) return
        setAvailabilityByDate({})
        setAvailabilityError(err?.message || 'Không tải được khung giờ.')
      })
      .finally(() => {
        if (!mounted) return
        setAvailabilityLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [token, user, doctorId, upcomingDays])

  // Keep disabled slots in sync with the currently selected date (from the preloaded map).
  useEffect(() => {
    if (!appointmentDate) return
    const booked = availabilityByDate?.[appointmentDate]?.booked
    if (booked instanceof Set) {
      setDisabledStarts(new Set(booked))
    } else {
      setDisabledStarts(new Set())
    }
  }, [appointmentDate, availabilityByDate])

  const slotAvailability = useMemo(() => {
    const disabled = disabledStarts || new Set()
    const isFullDay = timeSlots.length > 0 && disabled.size >= timeSlots.length
    const availableCount = Math.max(0, timeSlots.length - disabled.size)
    return { disabled, isFullDay, availableCount, loading: availabilityLoading, error: availabilityError }
  }, [disabledStarts, timeSlots.length, availabilityLoading, availabilityError])

  const upcomingDaysWithMeta = useMemo(() => {
    return upcomingDays.map((d) => {
      const row = availabilityByDate?.[d.iso]
      const booked = row?.booked instanceof Set ? row.booked : null
      const bookedCount = booked ? booked.size : null
      const availableCount =
        bookedCount == null ? null : Math.max(0, timeSlots.length - bookedCount)
      const isFull = availableCount != null ? availableCount <= 0 : false
      return {
        ...d,
        isFull,
        availableCount,
        availabilityKnown: availableCount != null,
      }
    })
  }, [upcomingDays, availabilityByDate, timeSlots.length])

  // Keep selection valid when date changes or becomes unavailable
  useEffect(() => {
    if (!slotAvailability.disabled.has(startTime)) return
    const firstAvailable = timeSlots.find((s) => !slotAvailability.disabled.has(s.start))
    if (firstAvailable) setStartTime(firstAvailable.start)
  }, [appointmentDate, doctorId, slotAvailability.disabled, startTime, timeSlots])

  useEffect(() => {
    if (!patientModalOpen) return
    setPatientModalDraft((d) => ({
      ...d,
      fullName: patientDraft.fullName || '',
      phone: patientDraft.phone || '',
      dob: patientDraft.dob || '',
      gender: patientDraft.gender || 'Nam',
    }))
  }, [patientModalOpen, patientDraft])

  function handleBackToStep1() {
    setBookingError('')
    setBookingLoading(false)
    setShowBookingInfo(false)
    setShowDoctorDetail(Boolean(selectedDoctor))
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0)
  }

  async function handleConfirmBooking() {
    setBookingError('')
    if (!token || !selectedDoctor || !patientDraft?.fullName) {
      setBookingError('Thiếu thông tin để đặt lịch.')
      return
    }
    const doctorIdToSend = String(selectedDoctor.id ?? doctorId).trim()
    if (!isMongoObjectId(doctorIdToSend)) {
      setBookingError(
        'Bác sĩ không hợp lệ (thiếu id MongoDB). Vui lòng tải lại trang và chọn bác sĩ từ danh sách.',
      )
      return
    }
    setBookingLoading(true)
    try {
      // Front-end pre-check (backend also enforces these rules):
      // - no overlapping time slot with another appointment
      // - only one active appointment per doctor until completed/cancelled
      const ACTIVE = new Set(['pending', 'confirmed'])
      const my = await listMyAppointments({ token })
      const sameSlot = (my || []).some((a) => {
        const st = String(a?.status || '').toLowerCase()
        if (!ACTIVE.has(st)) return false
        const sameDate =
          String(a?.appointmentDate || '').slice(0, 10) === String(appointmentDate || '').trim()
        const sameStart = String(a?.startTime || '').trim() === String(startTime || '').trim()
        return sameDate && sameStart
      })
      if (sameSlot) {
        setBookingError('Bạn đã có lịch khám khác trùng khung giờ này. Vui lòng chọn giờ khác.')
        return
      }
      const sameDoctorActive = (my || []).some((a) => {
        const st = String(a?.status || '').toLowerCase()
        if (!ACTIVE.has(st)) return false
        return String(a?.doctorId || '').trim() === doctorIdToSend
      })
      if (sameDoctorActive) {
        setBookingError(
          'Bạn đã có một lịch khám đang chờ/xác nhận với bác sĩ này. Chỉ đặt lại sau khi lịch đó hoàn thành hoặc đã hủy.',
        )
        return
      }

      const data = await createAppointment({
        token,
        doctorId: doctorIdToSend,
        appointmentDate,
        startTime,
        note,
      })
      const appt = data?.appointment
      const newId = appt?.id != null ? String(appt.id) : ''
      if (!newId) {
        setBookingError('Không nhận được mã lịch khám từ máy chủ.')
        return
      }
      const addressParts = [
        patientModalDraft.addressLine,
        patientModalDraft.ward,
        patientModalDraft.district,
        patientModalDraft.province,
      ]
        .map((s) => String(s || '').trim())
        .filter(Boolean)
      navigate(`/appointments/${newId}`, {
        replace: true,
        state: {
          showSuccessToast: true,
          bookingSummary: {
            appointment: appt,
            doctor: selectedDoctor,
            patientName: patientDraft.fullName,
            specialty: selectedSpecialty || '',
            patientSnapshot: {
              fullName: patientDraft.fullName,
              dob: patientDraft.dob,
              gender: patientDraft.gender,
              address: addressParts.join(', ') || patientDraft.address || '',
            },
          },
        },
      })
    } catch (err) {
      const msg = err?.message || 'Đặt lịch thất bại.'
      setBookingError(`${msg} (doctorId=${doctorIdToSend})`)
    } finally {
      setBookingLoading(false)
    }
  }

  function closePatientModal() {
    setPatientModalOpen(false)
  }

  function savePatientModal() {
    setPatientDraft((p) => ({
      ...p,
      fullName: patientModalDraft.fullName.trim() || p.fullName,
      phone: patientModalDraft.phone.trim() || p.phone,
      dob: patientModalDraft.dob.trim() || p.dob,
      gender: patientModalDraft.gender || p.gender,
    }))
    setPatientModalOpen(false)
  }

  function scrollDateStrip(direction) {
    const el = dateStripRef.current
    if (!el) return
    const delta = direction === 'left' ? -260 : 260
    el.scrollBy({ left: delta, behavior: 'smooth' })
  }

  return (
    <div className="appointment-page">
      <header className="landing-header">
        <Link className="landing-brand" to="/landing">
          <img className="landing-logo" src={logo} alt="VitaCare Clinic" />
        </Link>
        <nav className="landing-nav" aria-label="Điều hướng chính">
          <Link to="/landing#gioi-thieu">Giới thiệu</Link>
          <Link to="/landing#dich-vu">Dịch vụ</Link>
          <Link to="/landing#gio-lam-viec">Giờ làm việc</Link>
          <Link to="/landing#lien-he">Liên hệ</Link>
          <span className="landing-nav-actions">
            {user ? (
              <>
                <span className="landing-user-wrap" tabIndex={0}>
                  <span className="landing-greet">
                    Xin chào, {user.displayName || user.fullName || user.email}
                  </span>
                  <span className="landing-user-menu" role="menu" aria-label="Menu người dùng">
                    <Link className="landing-user-menu-item" to="/my-appointments" role="menuitem">
                      Lịch khám
                    </Link>
                    <Link className="landing-user-menu-item" to="/home" role="menuitem">
                      Thông tin
                    </Link>
                    <button
                      type="button"
                      className="landing-user-menu-item landing-user-menu-logout"
                      onClick={() => {
                        localStorage.removeItem('token')
                        localStorage.removeItem('user')
                        sessionStorage.removeItem('token')
                        sessionStorage.removeItem('user')
                        navigate('/landing', { replace: true })
                      }}
                      role="menuitem"
                    >
                      Đăng xuất
                    </button>
                  </span>
                </span>
              </>
            ) : (
              <>
                <Link className="landing-btn landing-btn--ghost" to="/login">
                  Đăng nhập
                </Link>
                <Link className="landing-btn landing-btn--solid" to="/register">
                  Đăng ký
                </Link>
              </>
            )}
          </span>
        </nav>
      </header>
      <div className="appointment-container">
        {showDoctorDetail && selectedDoctor ? (
          <>
            <div className="appointment-breadcrumb">
              <Link to="/home">Trang chủ</Link> <span aria-hidden="true">/</span> Bác sĩ
            </div>

            <div className="appointment-doctor-detail-hero" role="region" aria-label="Thông tin bác sĩ">
              <div className="appointment-doctor-detail-hero-left">
                <div className="appointment-doctor-detail-avatar" aria-hidden="true">
                  <span className="appointment-avatar-fallback">{getDoctorInitials(selectedDoctor)}</span>
                  {getDoctorAvatarSrc(selectedDoctor) ? (
                    <img
                      className="appointment-avatar-img"
                      src={getDoctorAvatarSrc(selectedDoctor)}
                      alt=""
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  ) : null}
                </div>
              </div>

              <div className="appointment-doctor-detail-hero-right">
                <div className="appointment-doctor-detail-hero-head">
                  <div>
                    <h2 className="appointment-doctor-detail-title">{displayDoctorTitle}</h2>
                  </div>

                  <button type="button" className="appointment-fav-btn" aria-label="Yêu thích">
                    <span aria-hidden="true">♡</span> Yêu thích
                  </button>
                </div>

                <div className="appointment-doctor-detail-meta">
                  <div className="appointment-doctor-detail-meta-row">
                    <span className="appointment-doctor-detail-meta-key">Chuyên khoa</span>
                    <span className="appointment-doctor-detail-meta-val">{selectedSpecialty || '—'}</span>
                  </div>
                  <div className="appointment-doctor-detail-meta-row">
                    <span className="appointment-doctor-detail-meta-key">Kinh nghiệm</span>
                    <span className="appointment-doctor-detail-meta-val">
                      {selectedExperienceYears ? `${selectedExperienceYears} năm` : '—'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="appointment-detail-actions">
              <button
                type="button"
                className="appointment-back-btn"
                onClick={() => setShowDoctorDetail(false)}
              >
                ← Danh sách bác sĩ
              </button>
            </div>
          </>
        ) : (
          showBookingInfo ? (
            null
          ) : (
            <>
              <div className="appointment-topbar">
                <div className="appointment-topbar-left">
                  <div className="appointment-search" role="search">
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Tìm bác sĩ theo tên / chuyên khoa..."
                      aria-label="Tìm bác sĩ"
                    />
                    {searchQuery ? (
                      <button
                        type="button"
                        className="appointment-search-clear"
                        onClick={() => setSearchQuery('')}
                        aria-label="Xóa tìm kiếm"
                      >
                        ×
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              {activeDeptId || searchQuery ? (
                <div className="appointment-filterbar" aria-label="Bộ lọc">
                  {activeDeptId ? (
                    <button
                      type="button"
                      className="appointment-filter-chip is-active"
                      onClick={() => setActiveDeptId('')}
                      aria-label="Bỏ lọc khoa"
                    >
                      {departments.find((s) => s.id === activeDeptId)?.name || 'Khoa'} ✕
                    </button>
                  ) : null}
                  {searchQuery ? (
                    <span className="appointment-filter-hint">
                      Kết quả: <strong>{filteredDoctors.length}</strong>
                    </span>
                  ) : null}
                </div>
              ) : null}
            </>
          )
        )}

        {doctorLoadError ? (
          <div className="appointment-inline-error" role="alert">
            {doctorLoadError}
          </div>
        ) : null}

        {!showDoctorDetail && !showBookingInfo ? (
          <>
            <div className="appointment-browse" aria-label="Tìm bác sĩ và lọc theo khoa">
              <aside className="appointment-filters" aria-label="Bộ lọc theo khoa">
                <div className="appointment-specialty-head">
                  <div>
                    <h3 className="appointment-specialty-title">Đặt khám theo khoa</h3>
                    <p className="appointment-specialty-sub">Chọn khoa để lọc nhanh bác sĩ phù hợp.</p>
                  </div>
                  {activeDeptId ? (
                    <button
                      type="button"
                      className="appointment-specialty-reset"
                      onClick={() => setActiveDeptId('')}
                    >
                      Bỏ lọc
                    </button>
                  ) : null}
                </div>

                <div className="appointment-specialty-list" role="list">
                  {departments.length ? (
                    departments.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        role="listitem"
                        className={`appointment-specialty-item ${activeDeptId === s.id ? 'is-active' : ''}`}
                        onClick={() => {
                          setActiveDeptId((cur) => (cur === s.id ? '' : s.id))
                        }}
                        aria-pressed={activeDeptId === s.id}
                      >
                        <span className="appointment-specialty-item-name">{s.name}</span>
                        <span className="appointment-specialty-item-count">{s.count}</span>
                      </button>
                    ))
                  ) : (
                    <div className="appointment-specialty-empty">Chưa có dữ liệu khoa.</div>
                  )}
                </div>
              </aside>

              <main className="appointment-results" aria-label="Danh sách bác sĩ">
                <section className="appointment-doctor-strip" aria-label="Danh sách bác sĩ">
                  {loadingDoctors ? (
                    Array.from({ length: 4 }).map((_, idx) => (
                      <div
                        className="appointment-doctor-card"
                        key={`sk-${idx}`}
                        aria-hidden="true"
                        style={{ pointerEvents: 'none' }}
                      >
                        <div className="appointment-doctor-avatar" style={{ opacity: 0.6 }}>
                          ...
                        </div>
                        <div className="appointment-doctor-name" style={{ opacity: 0.6 }}>
                          Đang tải...
                        </div>
                        <div className="appointment-doctor-spec" style={{ opacity: 0.6 }}>
                          ...
                        </div>
                        <button className="appointment-book-btn" type="button" disabled style={{ opacity: 0.7 }}>
                          <span>Đặt lịch ngay</span>
                          <span className="appointment-book-arrow" aria-hidden="true">
                            ›
                          </span>
                        </button>
                      </div>
                    ))
                  ) : pagedDoctors.length ? (
                    pagedDoctors.map((d) => {
                      const specialty =
                        String(d?.specialtyName || d?.specialty || '').trim() ||
                        getDoctorSpecialtyShort(d)
                      const experienceYears = getDoctorExperienceYears(d)
                      const experienceLabel =
                        Number.isFinite(experienceYears) && experienceYears > 0
                          ? `${experienceYears} năm kinh nghiệm`
                          : '—'

                      const avatarSrc = getDoctorAvatarSrc(d)
                      return (
                        <div
                          className="appointment-doctor-card"
                          key={d.id}
                          role="button"
                          tabIndex={0}
                          aria-label={`Xem chi tiết bác sĩ ${getDoctorFullName(d)}`}
                          onClick={() => handleOpenDoctorDetail(d.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') handleOpenDoctorDetail(d.id)
                          }}
                        >
                          <div className="appointment-doctor-avatar" aria-hidden="true">
                            <span className="appointment-avatar-fallback">{getDoctorInitials(d)}</span>
                            {avatarSrc ? (
                              <img
                                className="appointment-avatar-img"
                                src={avatarSrc}
                                alt=""
                                loading="lazy"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none'
                                }}
                              />
                            ) : null}
                          </div>
                          <div className="appointment-doctor-name">{getDoctorRankName(d)}</div>
                          <div className="appointment-doctor-spec">{specialty || 'Chuyên khoa'}</div>
                          <div className="appointment-doctor-exp">{experienceLabel}</div>

                          <button
                            type="button"
                            className="appointment-book-btn"
                            onClick={(e) => {
                              // Prevent the card click from reopening detail twice.
                              e.stopPropagation()
                              handlePickDoctor(d.id)
                            }}
                          >
                            <span>Đặt lịch ngay</span>
                            <span className="appointment-book-arrow" aria-hidden="true">
                              ›
                            </span>
                          </button>
                        </div>
                      )
                    })
                  ) : (
                    <div style={{ padding: '12px 0', color: 'var(--muted)', fontWeight: 600 }}>
                      Không có bác sĩ khả dụng.
                    </div>
                  )}
                </section>

                {!loadingDoctors && filteredDoctors.length > pageSize ? (
                  <nav className="appointment-pagination" aria-label="Phân trang bác sĩ">
                    <button
                      type="button"
                      className="appointment-page-btn"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={clampedPage <= 1}
                    >
                      ← Trước
                    </button>
                    <span className="appointment-page-info">
                      Trang <strong>{clampedPage}</strong>/<strong>{totalPages}</strong>
                    </span>
                    <button
                      type="button"
                      className="appointment-page-btn"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={clampedPage >= totalPages}
                    >
                      Sau →
                    </button>
                  </nav>
                ) : null}
              </main>
            </div>
          </>
        ) : null}

        {showDoctorDetail && selectedDoctor && !showBookingInfo ? (
          <section className="appointment-schedule" ref={scheduleRef} aria-label="Đặt khám nhanh">
            <div className="appointment-schedule-head">
              <div className="appointment-schedule-title">Đặt khám nhanh</div>
              <div className="appointment-schedule-sub" />
            </div>

            <div className="appointment-step">
              <div className="appointment-step-left">
                <div className="appointment-step-badge" aria-hidden="true">
                  1
                </div>
                <div className="appointment-step-title">Ngày và giờ khám</div>
              </div>
            </div>

            <div className="appointment-date-strip-wrap" aria-label="Chọn ngày">
              <button
                type="button"
                className="appointment-strip-arrow"
                aria-label="Ngày trước"
                onClick={() => scrollDateStrip('left')}
              >
                ‹
              </button>
              <div className="appointment-date-strip" ref={dateStripRef} role="tablist" aria-label="Danh sách ngày">
                {upcomingDaysWithMeta.map((day) => {
                  const isActive = day.iso === appointmentDate
                  return (
                    <button
                      key={day.iso}
                      type="button"
                      className={`appointment-date-chip ${isActive ? 'is-active' : ''}`}
                      onClick={() => setAppointmentDate(day.iso)}
                      aria-selected={isActive}
                      role="tab"
                    >
                      <div className="appointment-date-chip-day">{day.label}</div>
                      <div className={`appointment-date-chip-sub ${day.isFull ? 'is-full' : ''}`}>
                        {!day.availabilityKnown || typeof day.availableCount !== 'number'
                          ? '—'
                          : day.isFull
                            ? 'Đã đầy lịch'
                            : `${day.availableCount} khung giờ`}
                      </div>
                    </button>
                  )
                })}
              </div>
              <button
                type="button"
                className="appointment-strip-arrow"
                aria-label="Ngày tiếp theo"
                onClick={() => scrollDateStrip('right')}
              >
                ›
              </button>
            </div>

            <div className="appointment-time-block">
              <div className="appointment-time-block-label">
                <span aria-hidden="true">🌤</span> Buổi chiều
              </div>
              <div className="appointment-time-grid">
                {timeSlots.map((slot) => {
                  const isActive = slot.start === startTime
                  const isDisabled = slotAvailability.disabled.has(slot.start)
                  return (
                    <button
                      key={slot.start}
                      type="button"
                      className={`appointment-time-slot ${isActive ? 'is-active' : ''} ${isDisabled ? 'is-disabled' : ''}`}
                      disabled={isDisabled}
                      onClick={() => {
                        if (isDisabled) return
                        setStartTime(slot.start)
                        // Sau khi chọn giờ, nhảy sang màn "Thông tin đặt khám".
                        setShowDoctorDetail(false)
                        setShowBookingInfo(true)
                        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0)
                      }}
                    >
                      {slot.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="appointment-intro-title">Giới thiệu</div>
            <div className="appointment-intro-body">
              {selectedDoctor.bio ? (
                splitBioParagraphs(selectedDoctor.bio).length ? (
                  splitBioParagraphs(selectedDoctor.bio).map((p, idx) => <p key={idx}>{p}</p>)
                ) : (
                  <p>{selectedDoctor.bio}</p>
                )
              ) : (
                <p>Thông tin giới thiệu đang được cập nhật.</p>
              )}
            </div>
          </section>
        ) : null}

        {showBookingInfo ? (
          <div className="appointment-step2-layout" aria-label="Đặt khám - bước 2">
            <div className="appointment-step2-left">
              <div className="appointment-stepper" aria-label="Các bước đặt khám">
                <button
                  type="button"
                  className="appointment-stepper-item"
                  onClick={handleBackToStep1}
                  aria-label="Bước 1: Ngày và giờ khám (thu gọn)"
                >
                  <span className="appointment-stepper-circle" aria-hidden="true">
                    1
                  </span>
                  <span className="appointment-stepper-label">Ngày và giờ khám</span>
                  <span className="appointment-stepper-chevron" aria-hidden="true">
                    ˅
                  </span>
                </button>

                <div className="appointment-stepper-item is-open" aria-current="step">
                  <span className="appointment-stepper-circle" aria-hidden="true">
                    2
                  </span>
                  <span className="appointment-stepper-label">Hồ sơ bệnh nhân</span>
                  <span className="appointment-stepper-chevron" aria-hidden="true">
                    ˄
                  </span>
                </div>
              </div>

              <section className="appointment-patient-section" aria-label="Hồ sơ bệnh nhân">
                <h2 className="appointment-patient-title">Hồ sơ bệnh nhân</h2>

                <div className="appointment-patient-card">
                  <div className="appointment-patient-card-header">
                    <div className="appointment-patient-name">{patientDraft.fullName}</div>
                    <button
                      type="button"
                      className="appointment-edit-btn"
                      onClick={() => setPatientModalOpen(true)}
                    >
                      Điều chỉnh
                    </button>
                  </div>

                  <div className="appointment-patient-grid" role="list">
                    <div className="appointment-patient-row" role="listitem">
                      <div className="appointment-patient-key">Mã bệnh nhân</div>
                      <div
                        className="appointment-patient-val appointment-patient-code"
                        title="Mã do hệ thống cấp, không thể chỉnh sửa"
                      >
                      {patientDraft.code}
                      </div>
                    </div>

                    <div className="appointment-patient-row" role="listitem">
                      <div className="appointment-patient-key">Họ và tên</div>
                      <div className="appointment-patient-val">{patientDraft.fullName}</div>
                    </div>

                    <div className="appointment-patient-row" role="listitem">
                      <div className="appointment-patient-key">Giới tính</div>
                      <div className="appointment-patient-val">{patientDraft.gender}</div>
                    </div>

                    <div className="appointment-patient-row" role="listitem">
                      <div className="appointment-patient-key">Ngày sinh</div>
                      <div className="appointment-patient-val">{patientDraft.dob}</div>
                    </div>

                    <div className="appointment-patient-row" role="listitem">
                      <div className="appointment-patient-key">Số điện thoại</div>
                      <div className="appointment-patient-val">{patientDraft.phone}</div>
                    </div>
                  </div>
                </div>

                <div className="auth-field" style={{ marginTop: '14px' }}>
                  <label htmlFor="patient-note">Thông tin bổ sung (không bắt buộc)</label>
                  <textarea
                    id="patient-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Ví dụ: đau họng 3 ngày, đã uống thuốc..."
                  />
                </div>
              </section>

              {patientModalOpen ? (
                <div
                  className="appointment-modal-overlay"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Chỉnh sửa hồ sơ"
                  onMouseDown={(e) => {
                    if (e.target === e.currentTarget) closePatientModal()
                  }}
                >
                  <div className="appointment-modal">
                    <div className="appointment-modal-head">
                      <div className="appointment-modal-title">Chỉnh sửa hồ sơ</div>
                      <button type="button" className="appointment-modal-close" onClick={closePatientModal} aria-label="Đóng">
                        ×
                      </button>
                    </div>

                    <div className="appointment-modal-grid">
                      <div className="auth-field">
                        <label htmlFor="pm-name">
                          Họ và tên <span className="appointment-required">*</span>
                        </label>
                        <input
                          id="pm-name"
                          value={patientModalDraft.fullName}
                          onChange={(e) => setPatientModalDraft((d) => ({ ...d, fullName: e.target.value }))}
                        />
                      </div>

                      <div className="auth-field">
                        <label htmlFor="pm-phone">
                          Số điện thoại <span className="appointment-required">*</span>
                        </label>
                        <input
                          id="pm-phone"
                          value={patientModalDraft.phone}
                          onChange={(e) => setPatientModalDraft((d) => ({ ...d, phone: e.target.value }))}
                        />
                      </div>

                      <div className="auth-field">
                        <label htmlFor="pm-dob">
                          Ngày sinh <span className="appointment-required">*</span>
                        </label>
                        <input
                          id="pm-dob"
                          value={patientModalDraft.dob}
                          onChange={(e) => setPatientModalDraft((d) => ({ ...d, dob: e.target.value }))}
                          placeholder="dd/mm/yyyy"
                        />
                      </div>

                      <div className="auth-field">
                        <label>
                          Giới tính <span className="appointment-required">*</span>
                        </label>
                        <div className="appointment-radio-row">
                          <label className="appointment-radio">
                            <input
                              type="radio"
                              name="pm-gender"
                              checked={patientModalDraft.gender === 'Nam'}
                              onChange={() => setPatientModalDraft((d) => ({ ...d, gender: 'Nam' }))}
                            />
                            Nam
                          </label>
                          <label className="appointment-radio">
                            <input
                              type="radio"
                              name="pm-gender"
                              checked={patientModalDraft.gender === 'Nữ'}
                              onChange={() => setPatientModalDraft((d) => ({ ...d, gender: 'Nữ' }))}
                            />
                            Nữ
                          </label>
                        </div>
                      </div>

                      <div className="auth-field">
                        <label htmlFor="pm-province">Tỉnh / Thành phố</label>
                        <select
                          id="pm-province"
                          value={patientModalDraft.province}
                          onChange={(e) => setPatientModalDraft((d) => ({ ...d, province: e.target.value }))}
                        >
                          <option value="">Chọn Tỉnh / Thành phố</option>
                          <option value="TP.HCM">TP. Hồ Chí Minh</option>
                          <option value="Hà Nội">Hà Nội</option>
                        </select>
                      </div>

                      <div className="auth-field">
                        <label htmlFor="pm-district">Quận / Huyện</label>
                        <select
                          id="pm-district"
                          value={patientModalDraft.district}
                          onChange={(e) => setPatientModalDraft((d) => ({ ...d, district: e.target.value }))}
                        >
                          <option value="">Chọn Quận / Huyện</option>
                        </select>
                      </div>

                      <div className="auth-field">
                        <label htmlFor="pm-ward">Phường / Xã</label>
                        <select
                          id="pm-ward"
                          value={patientModalDraft.ward}
                          onChange={(e) => setPatientModalDraft((d) => ({ ...d, ward: e.target.value }))}
                        >
                          <option value="">Chọn Phường / Xã</option>
                        </select>
                      </div>

                      <div className="auth-field">
                        <label htmlFor="pm-address">
                          Địa chỉ cụ thể <span className="appointment-required">*</span>
                        </label>
                        <input
                          id="pm-address"
                          value={patientModalDraft.addressLine}
                          onChange={(e) => setPatientModalDraft((d) => ({ ...d, addressLine: e.target.value }))}
                          placeholder="Số nhà, tên đường"
                        />
                      </div>

                      <div className="auth-field">
                        <label htmlFor="pm-idcard">Số CMND/CCCD</label>
                        <input
                          id="pm-idcard"
                          value={patientModalDraft.idCard}
                          onChange={(e) => setPatientModalDraft((d) => ({ ...d, idCard: e.target.value }))}
                          placeholder="Số CMND/CCCD"
                        />
                      </div>

                      <div className="auth-field">
                        <label htmlFor="pm-ethnicity">Dân tộc</label>
                        <select
                          id="pm-ethnicity"
                          value={patientModalDraft.ethnicity}
                          onChange={(e) => setPatientModalDraft((d) => ({ ...d, ethnicity: e.target.value }))}
                        >
                          <option value="Kinh">Kinh</option>
                          <option value="Tày">Tày</option>
                          <option value="Thái">Thái</option>
                        </select>
                      </div>

                      <div className="auth-field">
                        <label htmlFor="pm-occupation">Nghề nghiệp</label>
                        <input
                          id="pm-occupation"
                          value={patientModalDraft.occupation}
                          onChange={(e) => setPatientModalDraft((d) => ({ ...d, occupation: e.target.value }))}
                          placeholder="Chọn dân tộc"
                        />
                      </div>

                      <div className="auth-field">
                        <label htmlFor="pm-insurance">Mã thẻ BHYT</label>
                        <input
                          id="pm-insurance"
                          value={patientModalDraft.insuranceNo}
                          onChange={(e) => setPatientModalDraft((d) => ({ ...d, insuranceNo: e.target.value }))}
                          placeholder="Mã số trên thẻ Bảo hiểm y tế"
                        />
                      </div>

                      <div className="auth-field">
                        <label htmlFor="pm-email">Email</label>
                        <input
                          id="pm-email"
                          value={patientModalDraft.email}
                          onChange={(e) => setPatientModalDraft((d) => ({ ...d, email: e.target.value }))}
                          placeholder="Địa chỉ email của bạn"
                        />
                      </div>
                    </div>

                    <div className="appointment-modal-actions">
                      <button type="button" className="appointment-modal-save" onClick={savePatientModal}>
                        Lưu chỉnh sửa
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <aside className="appointment-step2-right" aria-label="Thông tin đặt khám">
              <div className="auth-card appointment-form-card appointment-summary-card">
                <div className="appointment-summary-card-head">
                  <h2>Thông tin đặt khám</h2>
                  <button type="button" className="appointment-back-btn" onClick={handleBackToStep1}>
                    ← Chọn lại giờ
                  </button>
                </div>

                {selectedDoctor ? (
                  <div className="appointment-selected-doctor" aria-label="Bác sĩ đã chọn">
                    <div className="appointment-selected-avatar" aria-hidden="true">
                      {getDoctorInitials(selectedDoctor)}
                    </div>
                    <div className="appointment-selected-meta">
                      <div className="appointment-selected-name">{getDoctorRankName(selectedDoctor)}</div>
                      <div className="appointment-selected-spec">{selectedSpecialty || 'Chuyên khoa'}</div>
                    </div>
                  </div>
                ) : null}

                <div className="appointment-summary-grid" role="list">
                  <div className="appointment-summary-row" role="listitem">
                    <div className="appointment-summary-key">Ngày khám</div>
                    <div className="appointment-summary-val">{appointmentDate}</div>
                  </div>
                  <div className="appointment-summary-row" role="listitem">
                    <div className="appointment-summary-key">Khung giờ</div>
                    <div className="appointment-summary-val">
                      {startTime}-{addMinutesToHHmm(startTime, 12)}
                    </div>
                  </div>
                  <div className="appointment-summary-row" role="listitem">
                    <div className="appointment-summary-key">Bệnh nhân</div>
                    <div className="appointment-summary-val">{patientDraft.fullName}</div>
                  </div>
                </div>

                {bookingError ? (
                  <p className="auth-error" role="alert" style={{ marginTop: '14px' }}>
                    {bookingError}
                  </p>
                ) : null}

                <button
                  type="button"
                  className="auth-submit"
                  onClick={handleConfirmBooking}
                  disabled={bookingLoading}
                  style={{ marginTop: '14px' }}
                >
                  {bookingLoading ? 'Đang đặt…' : 'Đặt lịch'}
                </button>

                <p className="auth-footer">
                  <Link to="/home">← Quay lại</Link>
                </p>
              </div>
            </aside>
          </div>
        ) : null}
      </div>
    </div>
  )
}

