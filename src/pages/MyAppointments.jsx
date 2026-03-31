import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listMyAppointments } from '../api/appointments.js'
import logo from '../assets/logo.png'
import '../styles/landing.css'
import '../styles/my-appointments.css'

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

function getDoctorName(doc) {
  if (!doc) return '—'
  const first = String(doc?.firstName || '').trim()
  const last = String(doc?.lastName || '').trim()
  const full = `${first} ${last}`.trim()
  return (
    full ||
    String(doc?.displayName || doc?.fullName || '').trim() ||
    doc?.email ||
    '—'
  )
}

function statusLabel(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'confirmed') return { text: 'Đã xác nhận', tone: 'ok' }
  if (s === 'cancelled') return { text: 'Đã hủy', tone: 'bad' }
  return { text: 'Chờ xác nhận', tone: 'pending' }
}

export default function MyAppointments() {
  const navigate = useNavigate()
  const { token, user } = useMemo(() => getSession(), [])

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token || !user) {
      navigate('/login', { replace: true })
      return
    }

    let mounted = true
    setLoading(true)
    setError('')
    listMyAppointments({ token })
      .then((rows) => {
        if (!mounted) return
        setItems(rows || [])
      })
      .catch((err) => {
        if (!mounted) return
        setError(err.message || 'Không lấy được lịch khám.')
      })
      .finally(() => {
        if (!mounted) return
        setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [token, user, navigate])

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('user')
    navigate('/landing', { replace: true })
  }

  return (
    <div className="myappt-page">
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
              <span className="landing-user-wrap" tabIndex={0}>
                <span className="landing-greet">Xin chào, {user.displayName || user.fullName || user.email}</span>
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
            ) : null}
          </span>
        </nav>
      </header>

      <main className="myappt-container">
        <div className="myappt-head">
          <div>
            <h1 className="myappt-title">Lịch khám đã đặt</h1>
            <p className="myappt-sub">Theo dõi các lịch hẹn bạn đã đặt tại phòng khám.</p>
          </div>
          <Link className="myappt-cta" to="/appointments">
            + Đặt lịch mới
          </Link>
        </div>

        {error ? (
          <div className="myappt-error" role="alert">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="myappt-loading">Đang tải lịch khám…</div>
        ) : items.length ? (
          <section className="myappt-list" aria-label="Danh sách lịch khám">
            {items.map((a) => {
              const st = statusLabel(a.status)
              const doctor = a?.doctor ?? a?.doctorId ?? null
              const dept = String(
                doctor?.deptName || doctor?.dept || doctor?.departmentName || '',
              ).trim()
              const spec = String(
                doctor?.specialtyName || doctor?.specialty || doctor?.specialization || '',
              ).trim()
              return (
                <article className="myappt-card" key={a.id}>
                  <div className="myappt-card-top">
                    <div className="myappt-card-date">
                      <div className="myappt-card-date-main">{formatDateVi(a.appointmentDate) || '—'}</div>
                      <div className="myappt-card-date-sub">
                        {a.startTime ? `Giờ: ${a.startTime}` : 'Giờ: —'}
                        {a.endTime ? ` - ${a.endTime}` : ''}
                      </div>
                    </div>
                    <span className={`myappt-status myappt-status--${st.tone}`}>{st.text}</span>
                  </div>

                  <div className="myappt-card-body">
                    <div className="myappt-row">
                      <div className="myappt-k">Bác sĩ</div>
                      <div className="myappt-v">{getDoctorName(doctor)}</div>
                    </div>
                    <div className="myappt-row">
                      <div className="myappt-k">Chuyên khoa</div>
                      <div className="myappt-v">{spec || '—'}</div>
                    </div>
                    <div className="myappt-row">
                      <div className="myappt-k">Khoa</div>
                      <div className="myappt-v">{dept || '—'}</div>
                    </div>
                    {a.note ? (
                      <div className="myappt-row">
                        <div className="myappt-k">Ghi chú</div>
                        <div className="myappt-v">{a.note}</div>
                      </div>
                    ) : null}
                  </div>
                </article>
              )
            })}
          </section>
        ) : (
          <div className="myappt-empty">
            <div className="myappt-empty-title">Bạn chưa có lịch khám nào.</div>
            <div className="myappt-empty-sub">Nhấn “Đặt lịch mới” để chọn bác sĩ và khung giờ phù hợp.</div>
          </div>
        )}
      </main>
    </div>
  )
}

