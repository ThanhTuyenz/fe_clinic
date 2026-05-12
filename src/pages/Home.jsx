import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { getMe, updateMe } from '../api/auth.js'
import { listMyAppointments } from '../api/appointments.js'
import { listDepartments } from '../api/departments.js'
import { listDoctors } from '../api/doctors.js'
import logo from '../assets/logo.png'
import banner from '../assets/Banner.jpg'
import SpecialtyIcon from '../components/SpecialtyIcon.jsx'
import '../styles/landing.css'

function getUserName(u) {
  const first = String(u?.firstName || '').trim()
  const last = String(u?.lastName || '').trim()
  const full = `${last} ${first}`.trim()
  if (full) return full
  return String(u?.displayName || u?.fullName || u?.name || '').trim()
}

function getUserEmail(u) {
  return String(u?.email || u?.username || '').trim()
}

function getUserDisplayName(u) {
  const name = getUserName(u)
  if (name) return name
  const email = getUserEmail(u)
  if (!email) return ''
  const local = email.split('@')[0] || ''
  return local.trim()
}

function getUserInitials(u) {
  const base = getUserDisplayName(u) || getUserEmail(u)
  if (!base) return '?'
  const words = base
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!words.length) return '?'
  const letters = words
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
  return letters.toUpperCase()
}

function buildPatientCode(userId) {
  const raw = String(userId || '').replace(/[^a-fA-F0-9]/g, '')
  const yy = String(new Date().getFullYear()).slice(-2)
  const pad = (raw + '00000000').slice(0, 8).toUpperCase()
  return `YM${yy}${pad}`
}

function resolvePatientCode(u) {
  const stored = String(u?.patientCode || '').trim()
  if (stored) return stored
  return buildPatientCode(u?.id || u?._id)
}

function getTokenFromStorage() {
  return localStorage.getItem('token') || sessionStorage.getItem('token') || ''
}

function getDoctorFullName(d) {
  const first = String(d?.firstName || '').trim()
  const last = String(d?.lastName || '').trim()
  const full = `${last} ${first}`.trim()
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

function getDoctorRankName(d) {
  const { rank } = parseDoctorBio(d?.bio)
  const name = getDoctorFullName(d)
  return rank ? `${rank} ${name}` : name
}

function getDoctorInitials(d) {
  const ln = String(d?.lastName || '').trim()
  const fn = String(d?.firstName || '').trim()

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

function parseDoctorSpecialty(bio) {
  return parseDoctorBio(bio).specialty || ''
}

function isDepartmentCodeLike(name) {
  const s = String(name || '').trim()
  if (!s) return false
  // Common patterns returned by backend seeds: SPEC-001, DEPT_01, etc.
  return /^(spec|dept)[-_]?\d+$/i.test(s)
}

function getDoctorCardSpecialty(d) {
  const s = String(d?.specialtyName || d?.specialty || '').trim() || parseDoctorSpecialty(d?.bio) || ''
  if (!s) return 'Chuyên khoa'
  if (s.length > 40 || /kinh nghiệm/i.test(s)) return 'Chuyên khoa'
  return s
}

function getDoctorCardExperience(d) {
  const years = Number(d?.experienceYears ?? d?.yearsOfExperience ?? d?.experience ?? d?.expYears)
  if (Number.isFinite(years) && years > 0) return `${years} năm kinh nghiệm`
  return '—'
}

function normalizeAvatarUrl(url) {
  const s = String(url || '').trim()
  if (!s) return ''
  // upanhlaylink often provides /view/ page; /img/ is the direct file path
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

function getDoctorId(d) {
  return String(d?.id ?? d?._id ?? d?.doctorId ?? '').trim()
}

function isAppointmentExamined(status) {
  const s = String(status || '').toLowerCase()
  return s === 'examined' || s === 'completed' || s === 'done'
}

function getAppointmentDoctorId(appointment) {
  const doc = appointment?.doctor
  const rawDoctorId =
    doc?.id ??
    doc?.doctorId ??
    doc?._id ??
    appointment?.doctorId ??
    appointment?.doctorID ??
    ''
  return String(rawDoctorId || '').trim()
}

function addDaysToIsoDate(isoDate, days) {
  const base = String(isoDate || '').trim().slice(0, 10)
  if (!base) return ''
  const d = new Date(`${base}T12:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function suggestFollowUpDateIso(appointmentDate) {
  const today = new Date().toISOString().slice(0, 10)
  const base = String(appointmentDate || '').trim().slice(0, 10) || today
  const suggested = addDaysToIsoDate(base, 14)
  if (!suggested) return today
  return suggested < today ? today : suggested
}

function appointmentStartDate(appointment) {
  const dateIso = String(appointment?.appointmentDate || '').slice(0, 10)
  const start = String(appointment?.startTime || '').trim()
  if (dateIso && start) {
    const dt = new Date(`${dateIso}T${start}:00`)
    if (!Number.isNaN(dt.getTime())) return dt
  }
  const fallback = new Date(appointment?.appointmentDate)
  return fallback
}

export default function Landing() {
  const navigate = useNavigate()
  const location = useLocation()

  function getStoredUser() {
    try {
      const s = sessionStorage.getItem('user')
      if (s) return JSON.parse(s)
    } catch {
      /* ignore */
    }
    try {
      const l = localStorage.getItem('user')
      if (l) return JSON.parse(l)
    } catch {
      /* ignore */
    }
    return null
  }

  const user = getStoredUser()
  const userName = getUserDisplayName(user)
  const userEmail = getUserEmail(user)
  const userIdentityKey = String(user?.id ?? user?._id ?? userEmail ?? '').trim()
  const profilePatientCode = resolvePatientCode(user)

  const [doctors, setDoctors] = useState([])
  const [loadingDoctors, setLoadingDoctors] = useState(true)
  const [doctorError, setDoctorError] = useState('')
  const [doctorQuery, setDoctorQuery] = useState('')
  const [departments, setDepartments] = useState([])
  const [loadingDepartments, setLoadingDepartments] = useState(true)
  const [departmentError, setDepartmentError] = useState('')

  const [visitAppointments, setVisitAppointments] = useState([])
  const doctorStripRef = useRef(null)

  const [patientInfoModalOpen, setPatientInfoModalOpen] = useState(false)
  const [patientInfoModalMode, setPatientInfoModalMode] = useState('booking')
  const [patientInfoSaving, setPatientInfoSaving] = useState(false)
  const [patientInfoError, setPatientInfoError] = useState('')
  const [patientInfoDraft, setPatientInfoDraft] = useState(() => ({
    firstName: '',
    lastName: '',
    phone: '',
    dob: '',
    ethnicity: 'Kinh',
    gender: 'Nam',
    citizenId: '',
    addressLine: '',
  }))
  const [pendingBookingState, setPendingBookingState] = useState(null)

  function getStorageForUser() {
    return localStorage.getItem('token') ? localStorage : sessionStorage
  }

  function normalizeGenderLabel(value) {
    const s = String(value || '').trim().toLowerCase()
    if (!s) return 'Nam'
    if (s === 'true' || s === 'nam' || s === 'male' || s === 'm') return 'Nam'
    if (s === 'false' || s === 'nữ' || s === 'nu' || s === 'female' || s === 'f') return 'Nữ'
    return 'Khác'
  }

  function applyPatientInfoDraft(u) {
    setPatientInfoDraft({
      firstName: String(u?.firstName || '').trim(),
      lastName: String(u?.lastName || '').trim(),
      phone: String(u?.phone || '').trim(),
      dob: String(u?.dob || '').slice(0, 10),
      ethnicity: String(u?.ethnicity || '').trim() || 'Kinh',
      gender: normalizeGenderLabel(u?.gender),
      citizenId: String(u?.citizenId || u?.cccd || u?.idCard || '').trim(),
      addressLine: String(u?.address || u?.addressLine || '').trim(),
    })
  }

  function openPatientInfoModal(nextState, mode = 'booking') {
    setPatientInfoError('')
    setPatientInfoModalMode(mode)
    setPendingBookingState(nextState || null)
    applyPatientInfoDraft(getStoredUser() || {})
    setPatientInfoModalOpen(true)
  }

  async function openProfileInfoModal() {
    if (!getStoredUser()) {
      navigate('/login', { replace: false, state: { message: 'Vui lòng đăng nhập để xem thông tin cá nhân.' } })
      return
    }

    openPatientInfoModal(null, 'profile')

    const token = getTokenFromStorage()
    if (!token) return

    try {
      const data = await getMe({ token })
      const me = data?.user || null
      if (!me) return
      const storage = getStorageForUser()
      storage.setItem('user', JSON.stringify(me))
      applyPatientInfoDraft(me)
    } catch {
      /* giữ bản nháp từ bộ nhớ cục bộ */
    }
  }

  function closePatientInfoModal() {
    setPatientInfoModalOpen(false)
    setPatientInfoModalMode('booking')
    setPatientInfoSaving(false)
    setPatientInfoError('')
    setPendingBookingState(null)
  }

  function isPatientInfoComplete(u) {
    const dob = String(u?.dob || '').trim()
    const ethnicity = String(u?.ethnicity || '').trim()
    const citizenId = String(u?.citizenId || '').trim()
    const address = String(u?.address || '').trim()
    const gender = String(u?.gender ?? '').trim()
    return Boolean(dob && ethnicity && gender && citizenId && address)
  }

  function buildDoctorBookingState(d, examinedDoctorDates) {
    const doctorId = getDoctorId(d)
    const state = doctorId ? { doctorId } : {}
    const lastExaminedDate = doctorId ? examinedDoctorDates.get(doctorId) : ''
    if (!lastExaminedDate) return state
    return {
      ...state,
      appointmentDate: suggestFollowUpDateIso(lastExaminedDate),
      note: 'Tái khám',
    }
  }

  function getDoctorBookingLabel(d, examinedDoctorDates) {
    const doctorId = getDoctorId(d)
    return doctorId && examinedDoctorDates.has(doctorId) ? 'Đặt lịch tái khám' : 'Đặt lịch khám'
  }

  function handleBookClick(state = {}) {
    if (!user) {
      navigate('/login', { replace: false, state: { message: 'Vui lòng đăng nhập để đặt lịch khám.' } })
      return
    }
    if (!isPatientInfoComplete(user)) {
      openPatientInfoModal(state)
      return
    }
    navigate('/appointments', { state })
  }

  async function savePatientInfo() {
    setPatientInfoError('')
    const firstName = String(patientInfoDraft.firstName || '').trim()
    const lastName = String(patientInfoDraft.lastName || '').trim()
    const phone = String(patientInfoDraft.phone || '').trim()
    const dob = String(patientInfoDraft.dob || '').trim()
    const ethnicity = String(patientInfoDraft.ethnicity || '').trim()
    const gender = String(patientInfoDraft.gender || '').trim()
    const citizenId = String(patientInfoDraft.citizenId || '').trim()
    const addressLine = String(patientInfoDraft.addressLine || '').trim()

    if (!dob || !ethnicity || !gender || !citizenId || !addressLine) {
      setPatientInfoError('Vui lòng nhập đầy đủ: ngày sinh, dân tộc, giới tính, số CCCD, địa chỉ cụ thể.')
      return
    }

    if (patientInfoModalMode === 'profile' && (!firstName || !lastName || !phone)) {
      setPatientInfoError('Vui lòng nhập đầy đủ họ, tên và số điện thoại.')
      return
    }

    const storage = getStorageForUser()
    const token = storage.getItem('token')
    if (!token) {
      setPatientInfoError('Bạn cần đăng nhập lại để cập nhật hồ sơ.')
      return
    }

    const genderToSend = gender === 'Nam' ? true : gender === 'Nữ' ? false : gender
    const payload = {
      dob,
      ethnicity,
      citizenId,
      address: addressLine,
      gender: genderToSend,
    }
    if (patientInfoModalMode === 'profile') {
      payload.firstName = firstName
      payload.lastName = lastName
      payload.phone = phone
    }

    setPatientInfoSaving(true)
    try {
      const data = await updateMe({
        token,
        payload,
      })
      const updatedUser = data?.user || data?.data?.user || null
      if (!updatedUser) {
        throw new Error('Máy chủ không trả về dữ liệu hồ sơ sau khi cập nhật.')
      }
      storage.setItem('user', JSON.stringify(updatedUser))
      if (patientInfoModalMode === 'profile') {
        applyPatientInfoDraft(updatedUser)
        setPatientInfoModalOpen(false)
        setPatientInfoModalMode('booking')
        setPendingBookingState(null)
        return
      }
      setPatientInfoModalOpen(false)
      const state = pendingBookingState || {}
      setPendingBookingState(null)
      navigate('/appointments', { state })
    } catch (err) {
      setPatientInfoError(err?.message || 'Không lưu được hồ sơ lên máy chủ.')
    } finally {
      setPatientInfoSaving(false)
    }
  }

  useEffect(() => {
    if (!location.state?.openPatientInfo) return
    if (!getStoredUser()) return
    openProfileInfoModal()
    navigate(location.pathname, { replace: true, state: {} })
  }, [location.pathname, location.state?.openPatientInfo, navigate])

  useEffect(() => {
    let mounted = true
    /* eslint-disable react-hooks/set-state-in-effect -- reset UI before async listDoctors */
    setLoadingDoctors(true)
    setDoctorError('')
    /* eslint-enable react-hooks/set-state-in-effect */
    listDoctors()
      .then((docs) => {
        if (!mounted) return
        setDoctors(docs || [])
      })
      .catch((err) => {
        if (!mounted) return
        setDoctorError(err.message || 'Không lấy được danh sách bác sĩ.')
      })
      .finally(() => {
        if (!mounted) return
        setLoadingDoctors(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let mounted = true
    /* eslint-disable react-hooks/set-state-in-effect -- reset UI before async listDepartments */
    setLoadingDepartments(true)
    setDepartmentError('')
    /* eslint-enable react-hooks/set-state-in-effect */
    listDepartments()
      .then((rows) => {
        if (!mounted) return
        setDepartments(rows || [])
      })
      .catch((err) => {
        if (!mounted) return
        setDepartmentError(err.message || 'Không lấy được danh sách khoa.')
      })
      .finally(() => {
        if (!mounted) return
        setLoadingDepartments(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  const featuredDoctors = useMemo(() => doctors.slice(0, 10), [doctors])

  useEffect(() => {
    if (!userIdentityKey) {
      setVisitAppointments([])
      return undefined
    }

    const token = getTokenFromStorage()
    if (!token) {
      setVisitAppointments([])
      return undefined
    }

    let cancelled = false

    listMyAppointments({ token })
      .then((rows) => {
        if (!cancelled) setVisitAppointments(rows || [])
      })
      .catch(() => {
        if (!cancelled) setVisitAppointments([])
      })

    return () => {
      cancelled = true
    }
  }, [userIdentityKey])

  const visitInsights = useMemo(() => {
    const doctorById = new Map()
    const doctorByEmail = new Map()
    for (const d of doctors) {
      const id = getDoctorId(d)
      if (id) doctorById.set(id, d)
      const email = String(d?.email || '').trim().toLowerCase()
      if (email) doctorByEmail.set(email, d)
    }

    function resolveAppointmentDoctor(appointment) {
      const doc = appointment?.doctor
      const directId = getDoctorId(doc) || getAppointmentDoctorId(appointment)
      if (directId && doctorById.has(directId)) return doctorById.get(directId)
      const email = String(doc?.email || appointment?.doctorEmail || '').trim().toLowerCase()
      if (email && doctorByEmail.has(email)) return doctorByEmail.get(email)
      if (doc && (getDoctorId(doc) || getDoctorFullName(doc))) return doc
      if (directId) return doctorById.get(directId) || null
      return null
    }

    const activeRows = (visitAppointments || []).filter(
      (a) => String(a?.status || '').toLowerCase() !== 'cancelled',
    )
    const now = Date.now()
    const upcoming = activeRows
      .map((a) => ({ a, dt: appointmentStartDate(a) }))
      .filter((x) => x.dt instanceof Date && !Number.isNaN(x.dt.getTime()) && x.dt.getTime() >= now)
      .sort((x, y) => x.dt.getTime() - y.dt.getTime())

    const nearestApptDoctor = resolveAppointmentDoctor(upcoming[0]?.a || null)

    const examinedDoctorDates = new Map()
    for (const a of activeRows) {
      if (!isAppointmentExamined(a?.status)) continue
      const doc = resolveAppointmentDoctor(a)
      const doctorId = doc ? getDoctorId(doc) : getAppointmentDoctorId(a)
      if (!doctorId) continue
      const dateIso = String(a?.appointmentDate || '').slice(0, 10)
      if (!dateIso) continue
      const prev = examinedDoctorDates.get(doctorId)
      if (!prev || dateIso > prev) examinedDoctorDates.set(doctorId, dateIso)
    }

    return { nearestApptDoctor, examinedDoctorDates }
  }, [visitAppointments, doctors])

  const loadingDoctorStrip = loadingDoctors

  const normalizedDoctorQuery = useMemo(() => String(doctorQuery || '').trim().toLowerCase(), [doctorQuery])

  const visibleDoctors = useMemo(() => {
    const { nearestApptDoctor, examinedDoctorDates } = visitInsights
    const doctorById = new Map()
    for (const d of doctors) {
      const id = getDoctorId(d)
      if (id) doctorById.set(id, d)
    }

    const recommended = []
    const seenIds = new Set()
    const pushDoctor = (doc) => {
      if (!doc) return
      const full = doctorById.get(getDoctorId(doc)) || doc
      const id = getDoctorId(full)
      if (!id || seenIds.has(id)) return
      seenIds.add(id)
      recommended.push(full)
    }

    pushDoctor(nearestApptDoctor)

    const examinedEntries = [...examinedDoctorDates.entries()].sort((a, b) => b[1].localeCompare(a[1]))
    for (const [doctorId] of examinedEntries) {
      pushDoctor(doctorById.get(doctorId))
    }

    const restPool = normalizedDoctorQuery ? doctors : featuredDoctors
    const rest = restPool.filter((d) => !seenIds.has(getDoctorId(d)))
    const baseList = [...recommended, ...rest].slice(0, 10)

    if (!normalizedDoctorQuery) return baseList
    const q = normalizedDoctorQuery
    return baseList.filter((d) => {
      const name = String(getDoctorFullName(d) || '').toLowerCase()
      const rankName = String(getDoctorRankName(d) || '').toLowerCase()
      const specialty = String(getDoctorCardSpecialty(d) || '').toLowerCase()
      const dept = String(d?.deptName || '').toLowerCase()
      const email = String(d?.email || '').toLowerCase()
      return (
        name.includes(q) ||
        rankName.includes(q) ||
        specialty.includes(q) ||
        dept.includes(q) ||
        email.includes(q)
      )
    })
  }, [visitInsights, doctors, featuredDoctors, normalizedDoctorQuery])

  const visibleDoctorKeys = useMemo(
    () =>
      visibleDoctors
        .map((d) => getDoctorId(d) || String(d?.email || getDoctorFullName(d) || '').trim())
        .join('|'),
    [visibleDoctors],
  )

  useLayoutEffect(() => {
    const el = doctorStripRef.current
    if (!el) return
    el.scrollLeft = 0
  }, [visibleDoctorKeys, loadingDoctorStrip, normalizedDoctorQuery])

  const featuredDepartments = useMemo(
    () =>
      (departments || [])
        .map((row) => ({
          id: String(row?.deptID || row?.deptId || row?.id || '').trim(),
          name: String(row?.deptName || row?.name || '').trim(),
        }))
        .filter((row) => row.id && row.name)
        .slice(0, 14),
    [departments],
  )

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('user')
    navigate('/landing', { replace: true })
  }

  return (
    <div className="landing">
      <header className="landing-header">
        <Link className="landing-brand" to="/landing">
          <img className="landing-logo" src={logo} alt="VitaCare Clinic" />
        </Link>
        <nav className="landing-nav" aria-label="Điều hướng chính">
          <a href="#gioi-thieu">Giới thiệu</a>
          <a href="#dich-vu">Dịch vụ</a>
          <a href="#gio-lam-viec">Giờ làm việc</a>
          <a href="#lien-he">Liên hệ</a>
          <span className="landing-nav-actions">
            {user ? (
              <>
                <span className="landing-user-wrap">
                  <button type="button" className="landing-user-chip" aria-haspopup="menu">
                    <span className="landing-user-avatar" aria-hidden="true">
                      {getUserInitials(user)}
                    </span>
                    <span className="landing-user-meta">
                      <span className="landing-user-name">{userName || 'Tài khoản'}</span>
                      <span className="landing-user-email">{userEmail || '—'}</span>
                    </span>
                    <span className="landing-user-caret" aria-hidden="true">
                      ▾
                    </span>
                  </button>
                  <span className="landing-user-menu" role="menu" aria-label="Menu người dùng">
                    <Link className="landing-user-menu-item" to="/my-appointments" role="menuitem">
                      Lịch khám
                    </Link>
                    <Link className="landing-user-menu-item" to="/ai" role="menuitem">
                      Trợ lý đặt lịch
                    </Link>
                    <button
                      type="button"
                      className="landing-user-menu-item"
                      onClick={openProfileInfoModal}
                      role="menuitem"
                    >
                      Thông tin
                    </button>
                    <button
                      type="button"
                      className="landing-user-menu-item landing-user-menu-logout"
                      onClick={logout}
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

      <main className="landing-main">
        {user ? (
          <section className="landing-welcome" aria-label="Lời chào">
            <div className="landing-welcome-text">
              Xin chào, <span className="landing-welcome-email">{userName || userEmail}</span>
            </div>
          </section>
        ) : null}
        <section
          className="landing-hero"
          aria-labelledby="landing-title"
          style={{ backgroundImage: `url(${banner})` }}
        >
          <h1 id="landing-title">Chăm sóc sức khỏe tận tâm, đặt lịch thuận tiện</h1>
          <p>
            VitaCare Clinic hỗ trợ quy trình khám chữa bệnh minh bạch và đặt lịch
            khám trực tuyến.
          </p>
          <div className="landing-hero-cta">
            {user ? (
              <>
                <button
                  type="button"
                  className="landing-btn landing-btn--solid"
                  onClick={() => handleBookClick({})}
                >
                  Đặt lịch khám
                </button>
                <Link className="landing-btn landing-btn--ghost" to="/ai">
                  Trợ lý đặt lịch
                </Link>
              </>
            ) : (
              <>
                <Link className="landing-btn landing-btn--solid" to="/register">
                  Tạo tài khoản bệnh nhân
                </Link>
                <Link className="landing-btn landing-btn--ghost" to="/login">
                  Đã có tài khoản
                </Link>
                <Link className="landing-btn landing-btn--ghost" to="/ai">
                  Trợ lý đặt lịch
                </Link>
              </>
            )}
          </div>
        </section>

        <section className="landing-booking" aria-labelledby="sec-booking">
          <div className="landing-search" role="search" aria-label="Tìm bác sĩ">
            <span className="landing-search-icon" aria-hidden="true">
              ⌕
            </span>
            <input
              className="landing-search-input"
              type="search"
              value={doctorQuery}
              onChange={(e) => setDoctorQuery(e.target.value)}
              placeholder="Tìm theo tên bác sĩ, chuyên khoa, khoa..."
              aria-label="Tìm bác sĩ theo tên, chuyên khoa, khoa"
              autoComplete="off"
            />
            {doctorQuery ? (
              <button
                type="button"
                className="landing-search-clear"
                onClick={() => setDoctorQuery('')}
                aria-label="Xóa tìm kiếm"
              >
                ×
              </button>
            ) : null}
          </div>

          <div className="landing-booking-head">
            <div>
              <h2 className="landing-booking-title" id="sec-booking">
                Đặt lịch khám trực tuyến
              </h2>
              <p className="landing-booking-sub">Tìm bác sĩ chính xác - Đặt lịch khám dễ dàng</p>
            </div>
            <Link className="landing-more" to="/appointments">
              Xem thêm <span aria-hidden="true">›</span>
            </Link>
          </div>

          <div className="landing-doctor-strip" ref={doctorStripRef} role="list" aria-label="Đặt khám bác sĩ">
            {loadingDoctorStrip
              ? Array.from({ length: 5 }).map((_, idx) => (
                  <article className="landing-doctor-card is-skeleton" role="listitem" key={`sk-${idx}`}>
                    <div className="landing-doctor-avatar" aria-hidden="true" style={{ opacity: 0.55 }}>
                      ...
                    </div>
                    <div className="landing-doctor-name" style={{ opacity: 0.55 }}>
                      Đang tải...
                    </div>
                    <div className="landing-doctor-meta" style={{ opacity: 0.55 }}>
                      <div className="landing-doctor-spec">...</div>
                      <div className="landing-doctor-hospital">...</div>
                    </div>
                    <span className="landing-doctor-action" aria-hidden="true" style={{ opacity: 0.55 }}>
                      Đặt lịch khám <span className="landing-doctor-action-arrow" aria-hidden="true">›</span>
                    </span>
                  </article>
                ))
              : doctorError
                ? (
                    <div style={{ padding: '10px 0', color: 'var(--muted)', fontWeight: 800 }}>
                      {doctorError}
                    </div>
                  )
                : visibleDoctors.length ? (
                    visibleDoctors.map((d) => {
                      const bookingState = buildDoctorBookingState(d, visitInsights.examinedDoctorDates)
                      const bookingLabel = getDoctorBookingLabel(d, visitInsights.examinedDoctorDates)
                      return (
                      <article
                        className="landing-doctor-card"
                        role="listitem"
                        key={d.id || d.email || getDoctorFullName(d)}
                        tabIndex={0}
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                          handleBookClick(bookingState)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            handleBookClick(bookingState)
                          }
                        }}
                      >
                        <div className="landing-doctor-avatar" aria-hidden="true">
                          <span className="landing-avatar-fallback">{getDoctorInitials(d)}</span>
                          {getDoctorAvatarSrc(d) ? (
                            <img
                              className="landing-avatar-img"
                              src={getDoctorAvatarSrc(d)}
                              alt=""
                              loading="lazy"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none'
                              }}
                            />
                          ) : null}
                        </div>
                        <div className="landing-doctor-name">{getDoctorRankName(d)}</div>
                        <div className="landing-doctor-meta">
                          <div className="landing-doctor-spec">{getDoctorCardSpecialty(d)}</div>
                          <div className="landing-doctor-hospital">{getDoctorCardExperience(d)}</div>
                        </div>
                        <button
                          type="button"
                          className="landing-doctor-action"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleBookClick(bookingState)
                          }}
                        >
                          {bookingLabel} <span className="landing-doctor-action-arrow" aria-hidden="true">›</span>
                        </button>
                      </article>
                      )
                    })
                  ) : (
                    <div style={{ padding: '10px 0', color: 'var(--muted)', fontWeight: 800 }}>
                      Không tìm thấy bác sĩ phù hợp.
                    </div>
                  )}
          </div>
        </section>

        <section className="landing-section landing-specialties" aria-labelledby="sec-specialties">
          <div className="landing-booking-head landing-specialties-head">
            <div>
              <h2 className="landing-booking-title" id="sec-specialties">
                Đặt khám theo khoa
              </h2>
              <p className="landing-booking-sub">Chọn khoa để lọc nhanh danh sách bác sĩ phù hợp.</p>
            </div>
            <Link className="landing-more" to="/appointments">
              Xem tất cả <span aria-hidden="true">›</span>
            </Link>
          </div>

          <div className="landing-specialty-grid" role="list" aria-label="Danh sách khoa">
            {loadingDepartments ? (
              <div style={{ padding: '10px 0', color: 'var(--muted)', fontWeight: 800 }}>
                Đang tải danh sách khoa…
              </div>
            ) : departmentError ? (
              <div style={{ padding: '10px 0', color: 'var(--muted)', fontWeight: 800 }}>
                {departmentError}
              </div>
            ) : featuredDepartments.length ? (
              featuredDepartments.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="landing-specialty-card"
                  role="listitem"
                  onClick={() => handleBookClick({ deptId: s.id })}
                >
                  <SpecialtyIcon name={s.name} className="landing-specialty-icon" />
                  <span className="landing-specialty-name">{s.name}</span>
                </button>
              ))
            ) : (
              <div style={{ padding: '10px 0', color: 'var(--muted)', fontWeight: 800 }}>
                Chưa có dữ liệu khoa.
              </div>
            )}
          </div>
        </section>

        <section
          id="gioi-thieu"
          className="landing-section"
          aria-labelledby="sec-about"
        >
          <div className="landing-expert">
            <div className="landing-expert-head">
              <h2 id="sec-about">Chuyên gia đầu ngành - bác sĩ giỏi - chuyên viên giàu kinh nghiệm</h2>
            </div>
            <p className="landing-expert-sub">
              Quy tụ đội ngũ chuyên gia đầu ngành, bác sĩ chuyên môn cao, giàu kinh nghiệm.
            </p>

            <div className="landing-expert-grid" role="list" aria-label="Thống kê đội ngũ">
              {[
                { value: '24', label: 'GIÁO SƯ - P. GIÁO SƯ' },
                { value: '171', label: 'TIẾN SĨ - BÁC SĨ CKII' },
                { value: '490', label: 'THẠC SĨ - BÁC SĨ CKI' },
                { value: '786', label: 'BÁC SĨ' },
              ].map((s) => (
                <div className="landing-expert-card" role="listitem" key={s.label}>
                  <div className="landing-expert-num">{s.value}</div>
                  <div className="landing-expert-label">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="landing-expert-cta">
              <Link className="landing-expert-btn" to="/appointments">
                XEM CÁC CHUYÊN GIA
              </Link>
            </div>
          </div>
        </section>

        <section
          id="dich-vu"
          className="landing-section"
          aria-labelledby="sec-services"
        >
          <h2 id="sec-services">Dịch vụ nổi bật</h2>
          <div className="landing-cards">
            <article className="landing-card">
              <h3>Khám tổng quát</h3>
              <p>
                Thăm khám, tư vấn triệu chứng và chỉ định cơ bản theo nhu cầu.
              </p>
            </article>
            <article className="landing-card">
              <h3>Đặt lịch khám</h3>
              <p>
                Chọn khung giờ phù hợp qua ứng dụng sau khi đăng nhập (sẽ triển
                khai đầy đủ trong khóa luận).
              </p>
            </article>
            <article className="landing-card">
              <h3>Theo dõi lịch hẹn</h3>
              <p>
                Quản lý lịch khám và thông tin liên quan tại một nơi sau khi có
                tài khoản.
              </p>
            </article>
          </div>
        </section>

        <section
          id="gio-lam-viec"
          className="landing-section"
          aria-labelledby="sec-hours"
        >
          <h2 id="sec-hours">Giờ làm việc</h2>
          <div className="landing-info-grid">
            <div className="landing-card">
              <dl className="landing-dl">
                <dt>Thứ Hai — Thứ Sáu</dt>
                <dd>7:30 — 11:30 · 13:30 — 17:00</dd>
              </dl>
            </div>
            <div className="landing-card">
              <dl className="landing-dl">
                <dt>Thứ Bảy</dt>
                <dd>7:30 — 11:30</dd>
                <dt style={{ marginTop: '0.75rem' }}>Chủ nhật &amp; lễ</dt>
                <dd>Nghỉ (trừ trường hợp có thông báo)</dd>
              </dl>
            </div>
          </div>
        </section>

        <section
          id="lien-he"
          className="landing-section"
          aria-labelledby="sec-contact"
        >
          <h2 id="sec-contact">Liên hệ</h2>
          <div className="landing-info-grid">
            <div className="landing-card">
              <dl className="landing-dl">
                <dt>Địa chỉ</dt>
                <dd>123 Đường ABC, Quận XYZ, TP. Hồ Chí Minh</dd>
              </dl>
            </div>
            <div className="landing-card">
              <dl className="landing-dl">
                <dt>Điện thoại</dt>
                <dd>
                  <a href="tel:02812345678">028 1234 5678</a>
                </dd>
                <dt style={{ marginTop: '0.75rem' }}>Email</dt>
                <dd>
                  <a href="mailto:contact@phongkhamabc.vn">
                    contact@phongkhamabc.vn
                  </a>
                </dd>
              </dl>
            </div>
          </div>
        </section>
      </main>

      {patientInfoModalOpen ? (
        <div
          className="landing-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={patientInfoModalMode === 'profile' ? 'Thông tin cá nhân' : 'Bổ sung hồ sơ bệnh nhân'}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closePatientInfoModal()
          }}
        >
          <div className={`landing-modal${patientInfoModalMode === 'profile' ? ' landing-modal--profile' : ''}`}>
            <div className="landing-modal-head">
              <div className="landing-modal-title">
                {patientInfoModalMode === 'profile' ? 'Thông tin cá nhân' : 'Bổ sung hồ sơ bệnh nhân'}
              </div>
              <button type="button" className="landing-modal-close" onClick={closePatientInfoModal} aria-label="Đóng">
                ×
              </button>
            </div>

            <p className="landing-modal-sub">
              {patientInfoModalMode === 'profile'
                ? 'Cập nhật hồ sơ bệnh nhân và dùng mã QR khi đến quầy tiếp đón.'
                : 'Để tiếp tục đặt lịch khám, vui lòng nhập thêm thông tin bắt buộc.'}
            </p>

            {patientInfoError ? (
              <div className="landing-modal-error" role="alert">
                {patientInfoError}
              </div>
            ) : null}

            <div
              className={
                patientInfoModalMode === 'profile'
                  ? 'landing-modal-profile-layout'
                  : 'landing-modal-grid'
              }
            >
              <div className="landing-modal-grid">
                {patientInfoModalMode === 'profile' ? (
                  <>
                    <div className="landing-modal-field">
                      <label htmlFor="pi-last-name">Họ *</label>
                      <input
                        id="pi-last-name"
                        value={patientInfoDraft.lastName}
                        onChange={(e) => setPatientInfoDraft((d) => ({ ...d, lastName: e.target.value }))}
                        autoComplete="family-name"
                      />
                    </div>

                    <div className="landing-modal-field">
                      <label htmlFor="pi-first-name">Tên *</label>
                      <input
                        id="pi-first-name"
                        value={patientInfoDraft.firstName}
                        onChange={(e) => setPatientInfoDraft((d) => ({ ...d, firstName: e.target.value }))}
                        autoComplete="given-name"
                      />
                    </div>

                    <div className="landing-modal-field landing-modal-field--full">
                      <label htmlFor="pi-phone">Số điện thoại *</label>
                      <input
                        id="pi-phone"
                        type="tel"
                        inputMode="tel"
                        value={patientInfoDraft.phone}
                        onChange={(e) => setPatientInfoDraft((d) => ({ ...d, phone: e.target.value }))}
                        autoComplete="tel"
                      />
                    </div>

                    <div className="landing-modal-field landing-modal-field--full">
                      <label htmlFor="pi-email">Email</label>
                      <input id="pi-email" value={userEmail || '—'} readOnly />
                    </div>
                  </>
                ) : null}

                <div className="landing-modal-field">
                  <label htmlFor="pi-dob">Ngày sinh *</label>
                  <input
                    id="pi-dob"
                    type="date"
                    value={patientInfoDraft.dob}
                    onChange={(e) => setPatientInfoDraft((d) => ({ ...d, dob: e.target.value }))}
                  />
                </div>

                <div className="landing-modal-field">
                  <label htmlFor="pi-ethnicity">Dân tộc *</label>
                  <input
                    id="pi-ethnicity"
                    value={patientInfoDraft.ethnicity}
                    onChange={(e) => setPatientInfoDraft((d) => ({ ...d, ethnicity: e.target.value }))}
                    placeholder="vd: Kinh"
                  />
                </div>

                <div className="landing-modal-field">
                  <label htmlFor="pi-gender">Giới tính *</label>
                  <select
                    id="pi-gender"
                    value={patientInfoDraft.gender}
                    onChange={(e) => setPatientInfoDraft((d) => ({ ...d, gender: e.target.value }))}
                  >
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>

                <div className="landing-modal-field">
                  <label htmlFor="pi-cccd">Số CCCD *</label>
                  <input
                    id="pi-cccd"
                    inputMode="numeric"
                    value={patientInfoDraft.citizenId}
                    onChange={(e) => setPatientInfoDraft((d) => ({ ...d, citizenId: e.target.value }))}
                    placeholder="12 số"
                  />
                </div>

                <div className="landing-modal-field landing-modal-field--full">
                  <label htmlFor="pi-address">Địa chỉ cụ thể *</label>
                  <input
                    id="pi-address"
                    value={patientInfoDraft.addressLine}
                    onChange={(e) => setPatientInfoDraft((d) => ({ ...d, addressLine: e.target.value }))}
                    placeholder="Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành"
                  />
                </div>
              </div>

              {patientInfoModalMode === 'profile' ? (
                <aside className="landing-modal-qr" aria-label="Mã QR bệnh nhân">
                  <div className="landing-modal-qr-label">Mã bệnh nhân</div>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(profilePatientCode)}`}
                    width="160"
                    height="160"
                    alt={`Mã QR bệnh nhân ${profilePatientCode}`}
                  />
                  <code>{profilePatientCode}</code>
                </aside>
              ) : null}
            </div>

            <div className="landing-modal-actions">
              <button
                type="button"
                className="landing-modal-save"
                onClick={savePatientInfo}
                disabled={patientInfoSaving}
              >
                {patientInfoSaving
                  ? 'Đang lưu...'
                  : patientInfoModalMode === 'profile'
                    ? 'Lưu thông tin'
                    : 'Lưu & tiếp tục'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <footer className="landing-footer">
        <p>
          © {new Date().getFullYear()} VitaCare Clinic — Trang giới thiệu công
          khai.{' '}
          {user ? (
            <>
              <Link to="/appointments">Đặt lịch</Link>
            </>
          ) : (
            <>
              <Link to="/login">Đăng nhập</Link>
              {' · '}
              <Link to="/register">Đăng ký</Link>
            </>
          )}
        </p>
      </footer>
    </div>
  )
}
