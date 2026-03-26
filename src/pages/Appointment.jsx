import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listDoctors } from '../api/doctors.js'
import { createAppointment } from '../api/appointments.js'
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

function simpleSeedFromIso(iso) {
  // Stable pseudo-random seed based on YYYY-MM-DD
  const s = String(iso || '')
  let x = 0
  for (let i = 0; i < s.length; i += 1) x = (x * 31 + s.charCodeAt(i)) % 100000
  return x
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
  const [note, setNote] = useState('')
  const [bookingError, setBookingError] = useState('')
  const [bookingLoading, setBookingLoading] = useState(false)

  // Demo patient data (replace with API later).
  const [patients] = useState(() => [
    {
      id: 'p1',
      code: 'YMP262764574',
      fullName: 'Nguyễn Thanh Tuyền',
      gender: 'Nam',
      dob: '22/11/2003',
      phone: '0378315195',
    },
    {
      id: 'p2',
      code: 'YMP289104552',
      fullName: 'Trần Quang Nam',
      gender: 'Nam',
      dob: '08/04/1991',
      phone: '0912345678',
    },
  ])
  const selectedPatient = patients[0] || null
  const [editingPatient, setEditingPatient] = useState(false)
  const [patientDraft, setPatientDraft] = useState(() =>
    patients[0]
      ? { ...patients[0] }
      : { id: '', code: '', fullName: '', gender: '', dob: '', phone: '' },
  )
  
  const scheduleRef = useRef(null)
  const dateStripRef = useRef(null)

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

  const slotAvailability = useMemo(() => {
    // Demo only. Replace with API:
    // GET /api/appointments/availability?doctorId=...&date=...
    // Return list of disabled start times for selected doctor/date.
    const seed = simpleSeedFromIso(`${doctorId || 'd'}:${appointmentDate}`)
    const disabled = new Set()
    const isFullDay = seed % 7 === 0

    if (isFullDay) {
      timeSlots.forEach((s) => disabled.add(s.start))
    } else {
      const toDisable = Math.min(10, 2 + (seed % 6))
      for (let i = 0; i < toDisable; i += 1) {
        const idx = (seed + i * 3) % timeSlots.length
        disabled.add(timeSlots[idx].start)
      }
    }

    const availableCount = timeSlots.length - disabled.size
    return { disabled, isFullDay, availableCount }
  }, [doctorId, appointmentDate, timeSlots])

  const upcomingDaysWithMeta = useMemo(() => {
    return upcomingDays.map((d) => {
      const seed = simpleSeedFromIso(`${doctorId || 'd'}:${d.iso}`)
      const isFull = seed % 7 === 0
      const disabledCount = isFull ? timeSlots.length : Math.min(10, 2 + (seed % 6))
      const availableCount = Math.max(0, timeSlots.length - disabledCount)
      return { ...d, isFull, availableCount }
    })
  }, [upcomingDays, doctorId, timeSlots.length])

  // Keep selection valid when date changes or becomes unavailable
  useEffect(() => {
    if (!slotAvailability.disabled.has(startTime)) return
    const firstAvailable = timeSlots.find((s) => !slotAvailability.disabled.has(s.start))
    if (firstAvailable) setStartTime(firstAvailable.start)
  }, [appointmentDate, doctorId, slotAvailability.disabled, startTime, timeSlots])

  useEffect(() => {
    if (!selectedPatient) return
    setPatientDraft({ ...selectedPatient })
    setEditingPatient(false)
  }, [selectedPatient])

  function handleBackToStep1() {
    setBookingError('')
    setBookingLoading(false)
    setShowBookingInfo(false)
    setShowDoctorDetail(Boolean(selectedDoctor))
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0)
  }

  async function handleConfirmBooking() {
    setBookingError('')
    if (!token || !selectedDoctor || !selectedPatient) {
      setBookingError('Thiếu thông tin để đặt lịch.')
      return
    }
    setBookingLoading(true)
    try {
      await createAppointment({
        token,
        doctorId,
        appointmentDate,
        startTime,
        note,
      })
      navigate('/home', { replace: true })
    } catch (err) {
      setBookingError(err.message || 'Đặt lịch thất bại.')
    } finally {
      setBookingLoading(false)
    }
  }

  function scrollDateStrip(direction) {
    const el = dateStripRef.current
    if (!el) return
    const delta = direction === 'left' ? -260 : 260
    el.scrollBy({ left: delta, behavior: 'smooth' })
  }

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
            null
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
                        {day.isFull ? 'Đã đầy lịch' : `${day.availableCount} khung giờ`}
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
                <span>{selectedDoctor.bio}</span>
              ) : (
                <span>Thông tin giới thiệu đang được cập nhật.</span>
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
                      onClick={() => setEditingPatient((v) => !v)}
                    >
                      {editingPatient ? 'Hủy' : 'Điều chỉnh'}
                    </button>
                  </div>

                  <div className="appointment-patient-grid" role="list">
                    <div className="appointment-patient-row" role="listitem">
                      <div className="appointment-patient-key">Mã bệnh nhân</div>
                      <div className="appointment-patient-val">
                        {editingPatient ? (
                          <input
                            value={patientDraft.code}
                            onChange={(e) => setPatientDraft((d) => ({ ...d, code: e.target.value }))}
                          />
                        ) : (
                          patientDraft.code
                        )}
                      </div>
                    </div>

                    <div className="appointment-patient-row" role="listitem">
                      <div className="appointment-patient-key">Họ và tên</div>
                      <div className="appointment-patient-val">
                        {editingPatient ? (
                          <input
                            value={patientDraft.fullName}
                            onChange={(e) => setPatientDraft((d) => ({ ...d, fullName: e.target.value }))}
                          />
                        ) : (
                          patientDraft.fullName
                        )}
                      </div>
                    </div>

                    <div className="appointment-patient-row" role="listitem">
                      <div className="appointment-patient-key">Giới tính</div>
                      <div className="appointment-patient-val">
                        {editingPatient ? (
                          <select
                            value={patientDraft.gender}
                            onChange={(e) => setPatientDraft((d) => ({ ...d, gender: e.target.value }))}
                          >
                            <option value="Nam">Nam</option>
                            <option value="Nữ">Nữ</option>
                          </select>
                        ) : (
                          patientDraft.gender
                        )}
                      </div>
                    </div>

                    <div className="appointment-patient-row" role="listitem">
                      <div className="appointment-patient-key">Ngày sinh</div>
                      <div className="appointment-patient-val">
                        {editingPatient ? (
                          <input
                            value={patientDraft.dob}
                            onChange={(e) => setPatientDraft((d) => ({ ...d, dob: e.target.value }))}
                          />
                        ) : (
                          patientDraft.dob
                        )}
                      </div>
                    </div>

                    <div className="appointment-patient-row" role="listitem">
                      <div className="appointment-patient-key">Số điện thoại</div>
                      <div className="appointment-patient-val">
                        {editingPatient ? (
                          <input
                            value={patientDraft.phone}
                            onChange={(e) => setPatientDraft((d) => ({ ...d, phone: e.target.value }))}
                          />
                        ) : (
                          patientDraft.phone
                        )}
                      </div>
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

