import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { listMyAppointments } from '../api/appointments.js'
import logo from '../assets/logo.png'
import '../styles/landing.css'
import '../styles/appointment-detail.css'

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

function formatDateVi(isoOrDate) {
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate)
  if (Number.isNaN(d.getTime())) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = d.getFullYear()
  return `${dd}/${mm}/${yy}`
}

function formatIsoDateOnly(isoOrDate) {
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

function getDoctorFullNameFromDoc(doc) {
  if (!doc) return ''
  const first = String(doc.firstName || '').trim()
  const last = String(doc.lastName || '').trim()
  const full = `${first} ${last}`.trim()
  return full || String(doc.displayName || '').trim() || doc.email || ''
}

function getDoctorInitialsFromDoc(doc) {
  const ln = String(doc?.lastName || '').trim()
  const fn = String(doc?.firstName || '').trim()
  const a = ln ? ln[0] : ''
  const b = fn ? fn[0] : ''
  if (a || b) return `${a}${b}`.toUpperCase()
  const name = getDoctorFullNameFromDoc(doc)
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return '?'
  return words
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

function normalizeAvatarUrl(url) {
  const s = String(url || '').trim()
  if (!s) return ''
  if (s.includes('sf-static.upanhlaylink.com/view/')) return s.replace('/view/', '/img/')
  return s
}

function buildTicketCode(appointmentId, appointmentDate) {
  const id = String(appointmentId).replace(/[^a-fA-F0-9]/g, '')
  const d = new Date(appointmentDate)
  if (Number.isNaN(d.getTime())) return `YMA${id.slice(-10).toUpperCase()}`
  const yy = String(d.getFullYear()).slice(-2)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const suffix = (id.slice(-6) || '000000').toUpperCase()
  return `YMA${yy}${mm}${dd}${suffix}`
}

function queueNumberFromId(id) {
  const s = String(id).replace(/[^a-fA-F0-9]/g, '')
  let n = 0
  for (let i = 0; i < s.length; i += 1) n = (n * 31 + s.charCodeAt(i)) % 10000
  return Math.max(1, (n % 99) + 1)
}

function periodLabel(startTime) {
  const [h] = String(startTime || '12:00')
    .split(':')
    .map((v) => Number(v))
  if (!Number.isFinite(h)) return ''
  if (h < 12) return 'Buổi sáng'
  if (h < 18) return 'Buổi chiều'
  return 'Buổi tối'
}

const SLOT_MINUTES = 12

export default function AppointmentDetail() {
  const navigate = useNavigate()
  const { appointmentId } = useParams()
  const location = useLocation()
  const { token, user } = useMemo(() => getSession(), [])

  const id = String(appointmentId || '').trim()
  const bookingSummary = location.state?.bookingSummary

  const [toastVisible, setToastVisible] = useState(() => Boolean(location.state?.showSuccessToast))
  const [apiResult, setApiResult] = useState(null)

  useEffect(() => {
    if (!toastVisible) return undefined
    const t = setTimeout(() => setToastVisible(false), 3200)
    return () => clearTimeout(t)
  }, [toastVisible])

  useEffect(() => {
    if (!token || !user) {
      navigate('/login', { replace: true })
    }
  }, [token, user, navigate])

  const resolvedFromBooking = useMemo(() => {
    if (!id || !bookingSummary?.appointment) return null
    if (String(bookingSummary.appointment.id ?? bookingSummary.appointment._id) !== id) return null
    if (!user) return null
    return {
      fromBooking: true,
      appointment: bookingSummary.appointment,
      doctor: bookingSummary.doctor,
      patientName: bookingSummary.patientName || user.displayName || user.fullName || '—',
      specialty: bookingSummary.specialty || '',
      patientSnapshot: bookingSummary.patientSnapshot || null,
    }
  }, [id, bookingSummary, user])

  useEffect(() => {
    if (!token || !user || !id) return
    if (resolvedFromBooking) return

    let cancelled = false
    const requestId = id

    ;(async () => {
      try {
        const rows = await listMyAppointments({ token })
        if (cancelled) return
        const found = (rows || []).find((a) => String(a?.id ?? a?._id) === requestId)
        if (!found) {
          setApiResult({ requestId, ok: false, error: 'Không tìm thấy lịch khám.' })
          return
        }
        setApiResult({
          requestId,
          ok: true,
          data: {
            fromBooking: false,
            appointment: found,
            doctor: found.doctor,
            patientName: user.displayName || user.fullName || '—',
            specialty: '',
            patientSnapshot: null,
          },
        })
      } catch (err) {
        if (!cancelled) {
          setApiResult({
            requestId,
            ok: false,
            error: err.message || 'Không tải được chi tiết.',
          })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [token, user, id, resolvedFromBooking])

  const apiForCurrent =
    apiResult && apiResult.requestId === id ? apiResult : null

  const resolved = resolvedFromBooking ?? (apiForCurrent?.ok ? apiForCurrent.data : null)
  const error =
    resolvedFromBooking || !apiForCurrent ? '' : apiForCurrent.ok ? '' : apiForCurrent.error
  const needFetch = Boolean(id && token && user && !resolvedFromBooking)
  const loading =
    needFetch && (apiResult === null || apiResult.requestId !== id)

  const view = useMemo(() => {
    if (!resolved?.appointment) return null
    const a = resolved.appointment
    const apptId = a.id ?? a._id
    const dateRaw = a.appointmentDate
    const start = String(a.startTime || '').trim()
    const end = a.endTime ? String(a.endTime).trim() : addMinutesToHHmm(start, SLOT_MINUTES)
    const ticket = buildTicketCode(apptId, dateRaw)
    const stt = queueNumberFromId(apptId)
    const doc = resolved.doctor
    const doctorName = doc
      ? getDoctorFullNameFromDoc(doc) || doc.displayName || '—'
      : '—'
    const avatar = normalizeAvatarUrl(doc?.avatarUrl)
    const timeLine = `${start}-${end} (${periodLabel(start)})`
    const snap = resolved.patientSnapshot
    const patientDisplayName = snap?.fullName || resolved.patientName
    const patientDob = snap?.dob || '—'
    const patientGender = snap?.gender || '—'
    const patientAddress = snap?.address?.trim() ? snap.address.trim() : ''

    return {
      ticket,
      stt,
      dateVi: formatDateVi(dateRaw),
      dateIso: formatIsoDateOnly(dateRaw),
      timeLine,
      doctorName,
      avatar,
      initials: getDoctorInitialsFromDoc(doc),
      patientName: patientDisplayName,
      patientDob,
      patientGender,
      patientAddress,
    }
  }, [resolved])

  function handleSaveTicket() {
    window.print()
  }

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('user')
    navigate('/landing', { replace: true })
  }

  if (!id) {
    return (
      <div className="apdetail-page">
        <header className="landing-header">
          <Link className="landing-brand" to="/landing">
            <img className="landing-logo" src={logo} alt="VitaCare Clinic" />
          </Link>
        </header>
        <div className="apdetail-container">
          <div className="apdetail-error">
            <p>Không có mã lịch khám.</p>
            <p>
              <Link to="/my-appointments">Xem lịch khám của tôi</Link>
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="apdetail-page">
      {toastVisible ? <div className="apdetail-toast">Đặt lịch thành công!</div> : null}

      <header className="landing-header">
        <Link className="landing-brand" to="/landing">
          <img className="landing-logo" src={logo} alt="VitaCare Clinic" />
        </Link>
        <nav className="landing-nav" aria-label="Điều hướng chính">
          <Link to="/landing#gioi-thieu">Giới thiệu</Link>
          <Link to="/landing#dich-vu">Dịch vụ</Link>
          <Link to="/appointments">Đặt khám</Link>
          <span className="landing-nav-actions">
            {user ? (
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
                    onClick={logout}
                    role="menuitem"
                  >
                    Đăng xuất
                  </button>
                </span>
              </span>
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

      <div className="apdetail-container">
        {loading ? (
          <p className="apdetail-error">Đang tải…</p>
        ) : error && !loading ? (
          <div className="apdetail-error">
            <p>{error}</p>
            <p>
              <Link to="/my-appointments">Xem lịch khám của tôi</Link>
            </p>
          </div>
        ) : view ? (
          <>
            <div className="apdetail-success-head">
              <div className="apdetail-success-icon" aria-hidden="true">
                ✓
              </div>
              <h1 className="apdetail-success-title">Đặt lịch thành công!</h1>
            </div>

            <div className="apdetail-card apdetail-slip" id="phieu-kham">
              <div className="apdetail-stt-qr">
                <div className="apdetail-stt-block">
                  <div className="apdetail-label">STT</div>
                  <div className="apdetail-stt-num">{view.stt}</div>
                </div>
                <div className="apdetail-qr">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=128x128&data=${encodeURIComponent(view.ticket)}`}
                    alt=""
                    width={128}
                    height={128}
                  />
                </div>
              </div>
              <div className="apdetail-doctor-row">
                <div className="apdetail-doctor-avatar" aria-hidden="true">
                  {!view.avatar ? (
                    view.initials
                  ) : (
                    <img src={view.avatar} alt="" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                  )}
                </div>
                <div>
                  <div className="apdetail-doctor-name">{view.doctorName}</div>
                  <div className="apdetail-doctor-addr">Phòng khám VitaCare</div>
                </div>
              </div>
            </div>

            <div className="apdetail-card">
              <h2 className="apdetail-section-title">Thông tin đặt lịch</h2>
              <div className="apdetail-rows">
                <div className="apdetail-row">
                  <span className="apdetail-row-key">Mã phiếu khám</span>
                  <span className="apdetail-row-val">{view.ticket}</span>
                </div>
                <div className="apdetail-row">
                  <span className="apdetail-row-key">STT</span>
                  <span className="apdetail-row-val">{view.stt}</span>
                </div>
                <div className="apdetail-row">
                  <span className="apdetail-row-key">Ngày</span>
                  <span className="apdetail-row-val">{view.dateVi}</span>
                </div>
                <div className="apdetail-row">
                  <span className="apdetail-row-key">Giờ khám</span>
                  <span className="apdetail-row-val apdetail-row-val--time">{view.timeLine}</span>
                </div>
              </div>
            </div>

            <div className="apdetail-card">
              <h2 className="apdetail-section-title">Thông tin bệnh nhân</h2>
              <div className="apdetail-rows">
                <div className="apdetail-row">
                  <span className="apdetail-row-key">Bệnh nhân</span>
                  <span className="apdetail-row-val">{view.patientName}</span>
                </div>
                <div className="apdetail-row">
                  <span className="apdetail-row-key">Ngày sinh</span>
                  <span className="apdetail-row-val">{view.patientDob}</span>
                </div>
                <div className="apdetail-row">
                  <span className="apdetail-row-key">Giới tính</span>
                  <span className="apdetail-row-val">{view.patientGender}</span>
                </div>
                <div className="apdetail-row">
                  <span className="apdetail-row-key">Địa chỉ</span>
                  <span className="apdetail-row-val">{view.patientAddress || '—'}</span>
                </div>
              </div>
              <div className="apdetail-patient-actions">
                <button
                  type="button"
                  className="apdetail-btn apdetail-btn--teal-outline"
                  onClick={() => navigate('/my-appointments')}
                >
                  Xem tất cả lịch khám
                </button>
                <button type="button" className="apdetail-btn apdetail-btn--primary" onClick={handleSaveTicket}>
                  Lưu lại phiếu
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
