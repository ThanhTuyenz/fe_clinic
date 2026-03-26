import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listDoctors } from '../api/doctors.js'
import '../styles/auth.css'
import '../styles/appointment.css'

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

function getDoctorFullName(d) {
  return d.displayName || `${d.lastName || ''} ${d.firstName || ''}`.trim() || d.email || ''
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

function parseDoctorRankPrefix(bio) {
  const s = String(bio || '').trim()
  // Example: "Phó giáo sư, Tiến sĩ, Bác sĩ ..." or "Bác sĩ Nội tổng quát — ..."
  // We try to take everything before the first "Bác sĩ".
  const idx = s.toLowerCase().indexOf('bác sĩ')
  if (idx <= 0) return ''
  return s.slice(0, idx).replace(/[,|-]+$/g, '').trim()
}

function formatDayShort(date) {
  // date: Date instance
  const weekdays = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
  const dd = date.getDate().toString().padStart(2, '0')
  const mm = (date.getMonth() + 1).toString().padStart(2, '0')
  return `${weekdays[date.getDay()]}, ${dd}-${mm}`
}

export default function Appointment() {
  const navigate = useNavigate()
  const { token, user } = useMemo(() => getSession(), [])

  const [doctors, setDoctors] = useState([])
  const [loadingDoctors, setLoadingDoctors] = useState(true)

  const [doctorId, setDoctorId] = useState('')
  const [doctorLoadError, setDoctorLoadError] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [showDoctorDetail, setShowDoctorDetail] = useState(false)
  const [showBookingInfo, setShowBookingInfo] = useState(false)

  const [appointmentDate, setAppointmentDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0, 10)
  })
  const [startTime, setStartTime] = useState('08:00')
  
  const scheduleRef = useRef(null)

  useEffect(() => {
    if (!token || !user) {
      navigate('/login', { replace: true })
      return
    }
    listDoctors()
      .then((docs) => {
        setDoctors(docs)
        setDoctorId((prev) => prev || (docs[0] ? docs[0].id : ''))
        setDoctorLoadError('')
      })
      .catch((err) => setDoctorLoadError(err.message || 'Không tải được bác sĩ.'))
      .finally(() => setLoadingDoctors(false))
  }, [token, user, navigate])

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

  const visibleDoctors = showAll ? doctors : doctors.slice(0, 4)
  const selectedDoctor = doctors.find((d) => d.id === doctorId) || null
  const selectedSpecialty = parseDoctorSpecialty(selectedDoctor?.bio || '')
  const selectedExperienceYears = selectedDoctor
    ? parseDoctorExperienceYears(selectedDoctor.bio)
    : null
  const selectedRankPrefix = parseDoctorRankPrefix(selectedDoctor?.bio || '')
  const displayDoctorTitle = selectedRankPrefix
    ? `${selectedRankPrefix}, ${selectedDoctor ? 'Bác sĩ' : ''} ${getDoctorFullName(selectedDoctor)}`
    : selectedDoctor
      ? `Bác sĩ ${getDoctorFullName(selectedDoctor)}`
      : ''

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
    // UI demo: 6 slots, map to `startTime` as HH:mm
    // Can be replaced with real API schedule later.
    const base = ['18:00', '18:20', '18:40', '19:00', '19:20', '19:40']
    return base.map((t) => {
      const [hh, mm] = t.split(':').map(Number)
      const end = new Date()
      end.setHours(hh)
      end.setMinutes(mm + 10)
      const eh = end.getHours().toString().padStart(2, '0')
      const em = end.getMinutes().toString().padStart(2, '0')
      return { start: t, label: `${t}-${eh}:${em}` }
    })
  }, [])

  return (
    <div className="appointment-page">
      <div className="appointment-container">
        {showDoctorDetail && selectedDoctor ? (
          <>
            <div className="appointment-breadcrumb">
              <Link to="/home">Trang chủ</Link> <span aria-hidden="true">/</span> Bác sĩ
            </div>

            <div className="appointment-doctor-detail-hero" role="region" aria-label="Thông tin bác sĩ">
              <div className="appointment-doctor-detail-hero-left">
                <div className="appointment-doctor-detail-avatar" aria-hidden="true">
                  {getDoctorInitials(selectedDoctor)}
                </div>
              </div>

              <div className="appointment-doctor-detail-hero-right">
                <div className="appointment-doctor-detail-hero-head">
                  <div>
                    <h2 className="appointment-doctor-detail-title">{displayDoctorTitle}</h2>
                    {selectedExperienceYears ? (
                      <div className="appointment-doctor-detail-badge">
                        <span aria-hidden="true">⏱</span> {selectedExperienceYears} năm kinh nghiệm
                      </div>
                    ) : null}
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
                    <span className="appointment-doctor-detail-meta-key">Chức vụ</span>
                    <span className="appointment-doctor-detail-meta-val">
                      {selectedRankPrefix ? selectedRankPrefix : '—'}
                    </span>
                  </div>
                  <div className="appointment-doctor-detail-meta-row">
                    <span className="appointment-doctor-detail-meta-key">Nơi công tác</span>
                    <span className="appointment-doctor-detail-meta-val">—</span>
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
            <div className="appointment-topbar">
              <h2 className="appointment-title">Thông tin đặt khám</h2>
              <button
                type="button"
                className="appointment-back-btn"
                onClick={() => {
                  setShowBookingInfo(false)
                  setShowDoctorDetail(Boolean(selectedDoctor))
                  setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0)
                }}
              >
                ← Chọn lại giờ
              </button>
            </div>
          ) : (
            <div className="appointment-topbar">
              <h2 className="appointment-title">Đặt khám bác sĩ</h2>
              <button
                type="button"
                className="appointment-all-btn"
                disabled={loadingDoctors || doctors.length <= 4}
                onClick={() => setShowAll((v) => !v)}
              >
                {showAll ? 'Thu gọn' : 'Xem tất cả'} <span aria-hidden="true">→</span>
              </button>
            </div>
          )
        )}

        {doctorLoadError ? (
          <div className="appointment-inline-error" role="alert">
            {doctorLoadError}
          </div>
        ) : null}

        {!showDoctorDetail && !showBookingInfo ? (
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
            ) : visibleDoctors.length ? (
              visibleDoctors.map((d) => {
                const specialty = parseDoctorSpecialty(d.bio)
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
                      {getDoctorInitials(d)}
                    </div>
                    <div className="appointment-doctor-name">{getDoctorRankName(d)}</div>
                    <div className="appointment-doctor-spec">{specialty || 'Chuyên khoa'}</div>

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
        ) : null}

        {showDoctorDetail && selectedDoctor && !showBookingInfo ? (
          <section className="appointment-schedule" ref={scheduleRef} aria-label="Đặt khám nhanh">
            <div className="appointment-schedule-head">
              <div className="appointment-schedule-title">Đặt khám nhanh</div>
              <div className="appointment-schedule-sub">
                {selectedSpecialty ? `Chuyên khoa: ${selectedSpecialty}` : ''}
              </div>
            </div>

            <div className="appointment-date-strip" role="tablist" aria-label="Chọn ngày">
              {upcomingDays.map((day) => {
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
                  </button>
                )
              })}
            </div>

            <div className="appointment-time-block">
              <div className="appointment-time-block-label">
                <span aria-hidden="true">🌤</span> Buổi chiều
              </div>
              <div className="appointment-time-grid">
                {timeSlots.map((slot) => {
                  const isActive = slot.start === startTime
                  return (
                    <button
                      key={slot.start}
                      type="button"
                      className={`appointment-time-slot ${isActive ? 'is-active' : ''}`}
                      onClick={() => {
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
                <span>{selectedDoctor.bio}</span>
              ) : (
                <span>Thông tin giới thiệu đang được cập nhật.</span>
              )}
            </div>
          </section>
        ) : null}

        {showBookingInfo ? (
          <section className="appointment-booking-summary" aria-label="Thông tin đặt khám">
            <div className="auth-card appointment-form-card">
              <h2>Thông tin đặt khám</h2>
              <p className="auth-card-sub">Đã chọn bác sĩ và khung giờ.</p>

              {selectedDoctor ? (
                <div className="appointment-selected-doctor" aria-label="Bác sĩ đã chọn">
                  <div className="appointment-selected-avatar" aria-hidden="true">
                    {getDoctorInitials(selectedDoctor)}
                  </div>
                  <div className="appointment-selected-meta">
                    <div className="appointment-selected-name">{getDoctorRankName(selectedDoctor)}</div>
                    <div className="appointment-selected-spec">
                      {selectedSpecialty || 'Chuyên khoa'}
                    </div>
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
                  <div className="appointment-summary-val">{startTime}</div>
                </div>
              </div>

              <p className="appointment-summary-note">
                Chức năng xác nhận đặt lịch sẽ được cập nhật ở bước tiếp theo.
              </p>

              <p className="auth-footer">
                <Link to="/home">← Quay lại</Link>
              </p>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}

