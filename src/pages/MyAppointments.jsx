import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { cancelAppointment, listMyAppointments } from '../api/appointments.js'
import { DEFAULT_SLOT_MINUTES as SLOT_MINUTES } from '../utils/appointmentExpiry.js'
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

function buildPatientCode(userId) {
  const raw = String(userId || '').replace(/[^a-fA-F0-9]/g, '')
  const yy = String(new Date().getFullYear()).slice(-2)
  const pad = (raw + '00000000').slice(0, 8).toUpperCase()
  return `YM${yy}${pad}`
}

function getDoctorName(doc) {
  if (!doc) return '—'
  const first = String(doc?.firstName || '').trim()
  const last = String(doc?.lastName || '').trim()
  const full = `${last} ${first}`.trim()
  return (
    full ||
    String(doc?.displayName || doc?.fullName || '').trim() ||
    doc?.email ||
    '—'
  )
}

function getDoctorInitials(doc) {
  const ln = String(doc?.lastName || '').trim()
  const fn = String(doc?.firstName || '').trim()
  if (ln || fn) return `${ln ? ln[0] : ''}${fn ? fn[0] : ''}`.toUpperCase()
  const n = getDoctorName(doc)
  const w = n.trim().split(/\s+/).filter(Boolean)
  if (!w.length) return '?'
  return w
    .slice(0, 2)
    .map((x) => x[0])
    .join('')
    .toUpperCase()
}

function normalizeAvatarUrl(url) {
  const s = String(url || '').trim()
  if (!s) return ''
  if (s.includes('sf-static.upanhlaylink.com/view/')) return s.replace('/view/', '/img/')
  return s
}

function statusLabel(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'cancelled') return { text: 'Đã hủy', tone: 'bad' }
  if (s === 'confirmed') return { text: 'Đã xác nhận', tone: 'ok' }
  if (s === 'pending') return { text: 'Đã đặt lịch', tone: 'ok' }
  return { text: 'Chờ xác nhận', tone: 'pending' }
}

const CANCEL_REASON_PRESETS = [
  { id: 'busy', label: 'Bận việc đột xuất, không đến khám được' },
  { id: 'recovered', label: 'Đã khỏi bệnh / không cần khám nữa' },
  { id: 'reschedule', label: 'Muốn đổi bác sĩ hoặc thời gian khác' },
  { id: 'other', label: 'Lý do khác (ghi chú bên dưới)' },
]

function formatCancelledByLine(cancelledBy) {
  if (!cancelledBy || typeof cancelledBy !== 'object') return '—'
  const ut = String(cancelledBy.userType || '').toLowerCase()
  const role = String(cancelledBy.role || '').toLowerCase()
  if (role === 'system' || ut === 'system') return 'Hệ thống'
  const isPatient = role === 'patient' || ut === 'patient'
  const label = isPatient ? 'Bệnh nhân' : 'Phòng khám'
  const name = String(cancelledBy.displayName || '').trim() || String(cancelledBy.email || '').trim()
  return name ? `${label}: ${name}` : label
}

function formatCancelledAtVi(isoOrDate) {
  if (!isoOrDate) return '—'
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate)
  if (Number.isNaN(d.getTime())) return '—'
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(d)
  } catch {
    return d.toLocaleString('vi-VN')
  }
}

function formatUserDob(user) {
  const raw = user?.dob
  if (!raw) return '—'
  try {
    return formatDateVi(raw)
  } catch {
    return '—'
  }
}

function formatUserGender(user) {
  if (user?.gender === true) return 'Nam'
  if (user?.gender === false) return 'Nữ'
  if (typeof user?.gender === 'string') return user.gender
  return '—'
}

export default function MyAppointments() {
  const navigate = useNavigate()
  const location = useLocation()
  const { token, user } = useMemo(() => getSession(), [])

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [cancelling, setCancelling] = useState(false)
  const [cancelErr, setCancelErr] = useState('')
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [cancelPresetId, setCancelPresetId] = useState('busy')
  const [cancelOtherText, setCancelOtherText] = useState('')
  const [toastVisible, setToastVisible] = useState(() => Boolean(location.state?.showSuccessToast))

  useEffect(() => {
    if (!toastVisible) return undefined
    const t = setTimeout(() => setToastVisible(false), 3200)
    return () => clearTimeout(t)
  }, [toastVisible])

  useEffect(() => {
    if (!token || !user) {
      navigate('/login', { replace: true })
      return
    }

    const highlightId = location.state?.highlightId ? String(location.state.highlightId) : ''
    let mounted = true
    setLoading(true)
    setError('')
    listMyAppointments({ token })
      .then((rows) => {
        if (!mounted) return
        const next = rows || []
        if (!mounted) return
        setItems(next)
        if (highlightId) setSelectedId(highlightId)
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
  }, [token, user, navigate, location.state?.highlightId])

  const filtered = useMemo(() => {
    const q = String(searchQuery || '')
      .trim()
      .toLowerCase()
    if (!q) return items
    return (items || []).filter((a) => {
      const doctor = getDoctorName(a?.doctor).toLowerCase()
      const ticket = String(a?.ticket || buildTicketCode(a.id, a.appointmentDate)).toLowerCase()
      const patient = String(user?.displayName || user?.fullName || user?.email || '').toLowerCase()
      return doctor.includes(q) || ticket.includes(q) || patient.includes(q)
    })
  }, [items, searchQuery, user])

  const selected = useMemo(() => {
    if (!filtered.length) return null
    const by = filtered.find((a) => String(a.id) === String(selectedId))
    return by || filtered[0]
  }, [filtered, selectedId])

  useEffect(() => {
    if (!filtered.length) return
    if (!selectedId || !filtered.some((a) => String(a.id) === String(selectedId))) {
      setSelectedId(filtered[0].id)
    }
  }, [filtered, selectedId])

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('user')
    navigate('/landing', { replace: true })
  }

  function openCancelModal() {
    if (!selected || String(selected.status).toLowerCase() === 'cancelled') return
    setCancelErr('')
    setCancelPresetId('busy')
    setCancelOtherText('')
    setCancelModalOpen(true)
  }

  function closeCancelModal() {
    if (cancelling) return
    setCancelModalOpen(false)
  }

  function resolveCancelReasonText() {
    const preset = CANCEL_REASON_PRESETS.find((p) => p.id === cancelPresetId)
    if (cancelPresetId === 'other') {
      return String(cancelOtherText || '').trim()
    }
    return preset ? preset.label : ''
  }

  async function confirmCancelAppointment() {
    if (!selected || !token) return
    if (String(selected.status).toLowerCase() === 'cancelled') return
    const reasonText = resolveCancelReasonText()
    if (!reasonText) {
      setCancelErr(
        cancelPresetId === 'other'
          ? 'Vui lòng nhập lý do hủy.'
          : 'Vui lòng chọn lý do hủy.',
      )
      return
    }
    setCancelErr('')
    setCancelling(true)
    try {
      const data = await cancelAppointment({
        token,
        appointmentId: String(selected.id),
        cancelReason: reasonText,
      })
      const ap = data?.appointment || {}
      setItems((prev) =>
        prev.map((x) =>
          String(x.id) === String(selected.id)
            ? {
                ...x,
                status: 'cancelled',
                cancelReason: ap.cancelReason ?? reasonText,
                cancelledAt: ap.cancelledAt ?? new Date().toISOString(),
                cancelledBy: ap.cancelledBy ?? {
                  role: 'patient',
                  displayName: user?.displayName || user?.fullName || user?.email || 'Bệnh nhân',
                  email: user?.email || '',
                  userType: 'patient',
                },
              }
            : x,
        ),
      )
      setCancelModalOpen(false)
    } catch (err) {
      setCancelErr(err?.message || 'Không hủy được lịch.')
    } finally {
      setCancelling(false)
    }
  }

  const detailView = useMemo(() => {
    if (!selected) return null
    const doctor = selected.doctor
    const st = statusLabel(selected.status)
    const start = String(selected.startTime || '').trim()
    const end = selected.endTime
      ? String(selected.endTime).trim()
      : addMinutesToHHmm(start, SLOT_MINUTES)
    const ticket = String(selected?.ticket || buildTicketCode(selected.id, selected.appointmentDate))
    const timeLine = `${start}-${end} (${periodLabel(start)})`
    const avatar = normalizeAvatarUrl(doctor?.avatarUrl)
    const dept = String(doctor?.deptName || '').trim()
    const addrLine = dept ? `${dept} — Phòng khám VitaCare` : 'Phòng khám VitaCare'
    const patientName = user?.displayName || user?.fullName || user?.email || '—'
    const patientCode = buildPatientCode(user?.id)
    const phone = String(user?.phone || '').trim() || '—'
    const dob = formatUserDob(user)
    const gender = formatUserGender(user)
    const address = String(user?.address || '').trim() ? String(user.address).trim() : 'Chưa cập nhật'

    return {
      st,
      start,
      end,
      ticket,
      timeLine,
      avatar,
      doctorName: getDoctorName(doctor),
      initials: getDoctorInitials(doctor),
      addrLine,
      patientName,
      patientCode,
      phone,
      dob,
      gender,
      address,
      dateVi: formatDateVi(selected.appointmentDate),
      cancelled: String(selected.status).toLowerCase() === 'cancelled',
      cancelReason: String(selected.cancelReason || '').trim(),
      cancelledByLine: formatCancelledByLine(selected.cancelledBy),
      cancelledAtVi: formatCancelledAtVi(selected.cancelledAt),
    }
  }, [selected, user])

  return (
    <div className="myappt-page">
      {toastVisible ? <div className="apdetail-toast">Đặt lịch thành công!</div> : null}
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
            <p className="myappt-sub">Chọn một lịch để xem chi tiết và quản lý.</p>
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
          <div className="myappt-split">
            <aside className="myappt-sidebar" aria-label="Danh sách lịch khám">
              <input
                type="search"
                className="myappt-search"
                placeholder="Mã giao dịch, tên dịch vụ, tên bệnh nhân,…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Tìm lịch khám"
              />
              <div className="myappt-sidebar-scroll">
                {filtered.length ? (
                  filtered.map((a) => {
                    const st = statusLabel(a.status)
                    const doctor = a?.doctor
                    const doctorName = getDoctorName(doctor)
                    const start = String(a.startTime || '').trim()
                    const end = a.endTime
                      ? String(a.endTime).trim()
                      : addMinutesToHHmm(start, SLOT_MINUTES)
                    const patientLine = user?.displayName || user?.fullName || 'Bệnh nhân'
                    const isActive = selected && String(selected.id) === String(a.id)
                    const isCancelled = String(a.status || '').toLowerCase() === 'cancelled'
                    const cancelSnippet = String(a.cancelReason || '').trim()
                    return (
                      <button
                        key={a.id}
                        type="button"
                        className={`myappt-listcard ${isActive ? 'is-active' : ''}`}
                        onClick={() => setSelectedId(a.id)}
                      >
                        <div className="myappt-listcard-body">
                          <div className="myappt-listcard-title">{doctorName}</div>
                          <div className="myappt-listcard-meta">
                            {start}-{end} · {formatDateVi(a.appointmentDate)}
                          </div>
                          {isCancelled ? (
                            <div className="myappt-listcard-cancel" title={cancelSnippet || undefined}>
                              <span className="myappt-listcard-cancel-who">{formatCancelledByLine(a.cancelledBy)}</span>
                              {cancelSnippet ? (
                                <>
                                  <span className="myappt-listcard-cancel-sep">·</span>
                                  <span className="myappt-listcard-cancel-reason">
                                    {cancelSnippet.length > 48 ? `${cancelSnippet.slice(0, 48)}…` : cancelSnippet}
                                  </span>
                                </>
                              ) : null}
                            </div>
                          ) : null}
                          <div className="myappt-listcard-patient">{patientLine}</div>
                        </div>
                        <div className="myappt-listcard-side">
                          <span className={`myappt-pill myappt-pill--${st.tone}`}>{st.text}</span>
                        </div>
                      </button>
                    )
                  })
                ) : (
                  <div className="myappt-sidebar-empty">Không có lịch phù hợp.</div>
                )}
              </div>
            </aside>

            <section className="myappt-detail" aria-label="Chi tiết lịch khám">
              {detailView && selected ? (
                <>
                  <div className="myappt-detail-top">
                    <div className="myappt-detail-status">
                      {!detailView.cancelled ? (
                        <span className="myappt-status-icon" aria-hidden="true">
                          ✓
                        </span>
                      ) : null}
                      <span className={`myappt-pill myappt-pill--${detailView.st.tone}`}>{detailView.st.text}</span>
                    </div>
                  </div>

                  <div className="myappt-detail-hero">
                    <div className="myappt-detail-hero-left">
                      <div className="myappt-d-avatar" aria-hidden="true">
                        {!detailView.avatar ? (
                          detailView.initials
                        ) : (
                          <img
                            src={detailView.avatar}
                            alt=""
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                        )}
                      </div>
                      <div>
                        <div className="myappt-d-name">{detailView.doctorName}</div>
                        <div className="myappt-d-addr">{detailView.addrLine}</div>
                      </div>
                    </div>
                    <div className="myappt-detail-qr">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(detailView.ticket)}`}
                        alt=""
                        width={140}
                        height={140}
                      />
                    </div>
                  </div>

                  <div className="myappt-block">
                    <h2 className="myappt-block-title">Thông tin đặt khám</h2>
                    <div className="myappt-kv">
                      <div className="myappt-kv-row">
                        <span>Mã phiếu khám</span>
                        <span>{detailView.ticket}</span>
                      </div>
                      <div className="myappt-kv-row">
                        <span>Ngày khám</span>
                        <span>{detailView.dateVi}</span>
                      </div>
                      <div className="myappt-kv-row">
                        <span>Giờ khám</span>
                        <span className="myappt-kv-time">{detailView.timeLine}</span>
                      </div>
                    </div>
                  </div>

                  {detailView.cancelled ? (
                    <div className="myappt-block myappt-block--cancelled">
                      <h2 className="myappt-block-title">Thông tin hủy lịch</h2>
                      <div className="myappt-kv">
                        <div className="myappt-kv-row">
                          <span>Hủy bởi</span>
                          <span>{detailView.cancelledByLine}</span>
                        </div>
                        <div className="myappt-kv-row">
                          <span>Thời điểm hủy</span>
                          <span>{detailView.cancelledAtVi}</span>
                        </div>
                        <div className="myappt-kv-row myappt-kv-row--multiline">
                          <span>Lý do hủy</span>
                          <span>{detailView.cancelReason || '—'}</span>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="myappt-block">
                    <h2 className="myappt-block-title">Thông tin bệnh nhân</h2>
                    <div className="myappt-kv">
                      <div className="myappt-kv-row">
                        <span>Mã bệnh nhân</span>
                        <span>
                          <span className="myappt-linkish">{detailView.patientCode}</span>
                        </span>
                      </div>
                      <div className="myappt-kv-row">
                        <span>Họ và tên</span>
                        <span>{detailView.patientName}</span>
                      </div>
                      <div className="myappt-kv-row">
                        <span>Ngày sinh</span>
                        <span>{detailView.dob}</span>
                      </div>
                      <div className="myappt-kv-row">
                        <span>Số điện thoại</span>
                        <span>{detailView.phone}</span>
                      </div>
                      <div className="myappt-kv-row">
                        <span>Giới tính</span>
                        <span>{detailView.gender}</span>
                      </div>
                      <div className="myappt-kv-row">
                        <span>Địa chỉ</span>
                        <span>{detailView.address}</span>
                      </div>
                    </div>
                  </div>

                  <div className="myappt-detail-actions">
                    <button
                      type="button"
                      className="myappt-btn myappt-btn--danger"
                      disabled={detailView.cancelled || cancelling}
                      onClick={openCancelModal}
                    >
                      Hủy lịch
                    </button>
                  </div>
                </>
              ) : (
                <div className="myappt-detail-empty">Chọn một lịch trong danh sách.</div>
              )}
            </section>
          </div>
        ) : (
          <div className="myappt-empty">
            <div className="myappt-empty-title">Bạn chưa có lịch khám nào.</div>
            <div className="myappt-empty-sub">Nhấn “Đặt lịch mới” để chọn bác sĩ và khung giờ phù hợp.</div>
          </div>
        )}
      </main>

      {cancelModalOpen ? (
        <div
          className="myappt-modal-backdrop"
          role="presentation"
          onClick={closeCancelModal}
          onKeyDown={(e) => e.key === 'Escape' && closeCancelModal()}
        >
          <div
            className="myappt-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="myappt-cancel-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="myappt-cancel-title" className="myappt-modal-title">
              Hủy lịch khám
            </h2>
            <p className="myappt-modal-desc">Vui lòng chọn lý do hủy để chúng tôi phục vụ bạn tốt hơn.</p>
            <div className="myappt-cancel-reasons">
              {CANCEL_REASON_PRESETS.map((p) => (
                <label key={p.id} className="myappt-radio-row">
                  <input
                    type="radio"
                    name="cancel-reason"
                    value={p.id}
                    checked={cancelPresetId === p.id}
                    onChange={() => setCancelPresetId(p.id)}
                  />
                  <span>{p.label}</span>
                </label>
              ))}
            </div>
            {cancelPresetId === 'other' ? (
              <textarea
                className="myappt-cancel-textarea"
                rows={3}
                placeholder="Nhập lý do…"
                value={cancelOtherText}
                onChange={(e) => setCancelOtherText(e.target.value)}
                maxLength={500}
              />
            ) : null}
            {cancelErr ? (
              <div className="myappt-inline-err myappt-modal-err" role="alert">
                {cancelErr}
              </div>
            ) : null}
            <div className="myappt-modal-actions">
              <button type="button" className="myappt-btn myappt-btn--ghost" disabled={cancelling} onClick={closeCancelModal}>
                Đóng
              </button>
              <button
                type="button"
                className="myappt-btn myappt-btn--danger"
                disabled={cancelling}
                onClick={confirmCancelAppointment}
              >
                {cancelling ? 'Đang hủy…' : 'Xác nhận hủy lịch'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
