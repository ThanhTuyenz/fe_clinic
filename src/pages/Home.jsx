import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { updateMe } from '../api/auth.js'
import { listDoctors } from '../api/doctors.js'
import logo from '../assets/logo.png'
import banner from '../assets/Banner.jpg'
import '../styles/landing.css'

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

export default function Landing() {
  const navigate = useNavigate()

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

  const [doctors, setDoctors] = useState([])
  const [loadingDoctors, setLoadingDoctors] = useState(true)
  const [doctorError, setDoctorError] = useState('')
  const [doctorQuery, setDoctorQuery] = useState('')

  const [patientInfoModalOpen, setPatientInfoModalOpen] = useState(false)
  const [patientInfoError, setPatientInfoError] = useState('')
  const [patientInfoDraft, setPatientInfoDraft] = useState(() => ({
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

  function openPatientInfoModal(nextState) {
    setPatientInfoError('')
    setPendingBookingState(nextState || null)
    const u = getStoredUser() || {}
    setPatientInfoDraft({
      dob: String(u?.dob || '').slice(0, 10),
      ethnicity: String(u?.ethnicity || '').trim() || 'Kinh',
      gender: normalizeGenderLabel(u?.gender),
      citizenId: String(u?.citizenId || u?.cccd || u?.idCard || '').trim(),
      addressLine: String(u?.address || u?.addressLine || '').trim(),
    })
    setPatientInfoModalOpen(true)
  }

  function closePatientInfoModal() {
    setPatientInfoModalOpen(false)
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
    const dob = String(patientInfoDraft.dob || '').trim()
    const ethnicity = String(patientInfoDraft.ethnicity || '').trim()
    const gender = String(patientInfoDraft.gender || '').trim()
    const citizenId = String(patientInfoDraft.citizenId || '').trim()
    const addressLine = String(patientInfoDraft.addressLine || '').trim()

    if (!dob || !ethnicity || !gender || !citizenId || !addressLine) {
      setPatientInfoError('Vui lòng nhập đầy đủ: ngày sinh, dân tộc, giới tính, số CCCD, địa chỉ cụ thể.')
      return
    }

    const storage = getStorageForUser()
    const token = storage.getItem('token')
    if (!token) {
      setPatientInfoError('Bạn cần đăng nhập lại để cập nhật hồ sơ.')
      return
    }

    const genderToSend = gender === 'Nam' ? true : gender === 'Nữ' ? false : gender
    try {
      const data = await updateMe({
        token,
        payload: {
          dob,
          ethnicity,
          citizenId,
          address: addressLine,
          gender: genderToSend,
        },
      })
      const updatedUser = data?.user || data?.data?.user || null
      if (!updatedUser) {
        throw new Error('Máy chủ không trả về dữ liệu hồ sơ sau khi cập nhật.')
      }
      storage.setItem('user', JSON.stringify(updatedUser))
      setPatientInfoModalOpen(false)
      const state = pendingBookingState || {}
      setPendingBookingState(null)
      navigate('/appointments', { state })
    } catch (err) {
      setPatientInfoError(err?.message || 'Không lưu được hồ sơ lên máy chủ.')
    }
  }

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

  const featuredDoctors = useMemo(() => doctors.slice(0, 10), [doctors])

  const normalizedDoctorQuery = useMemo(() => String(doctorQuery || '').trim().toLowerCase(), [doctorQuery])

  const visibleDoctors = useMemo(() => {
    if (!normalizedDoctorQuery) return featuredDoctors
    const q = normalizedDoctorQuery
    return featuredDoctors.filter((d) => {
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
  }, [featuredDoctors, normalizedDoctorQuery])

  const featuredDepartments = useMemo(() => {
    const map = new Map()
    for (const d of doctors || []) {
      const id = String(d?.deptID || '').trim()
      const name = String(d?.deptName || '').trim()
      if (!id || !name) continue
      const prev = map.get(id)
      map.set(id, prev ? { ...prev, count: prev.count + 1 } : { id, name, count: 1 })
    }
    return Array.from(map.values())
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'vi'))
      .slice(0, 10)
  }, [doctors])

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
              <button
                type="button"
                className="landing-btn landing-btn--solid"
                onClick={() => handleBookClick({})}
              >
                Đặt lịch khám
              </button>
            ) : (
              <>
                <Link className="landing-btn landing-btn--solid" to="/register">
                  Tạo tài khoản bệnh nhân
                </Link>
                <Link className="landing-btn landing-btn--ghost" to="/login">
                  Đã có tài khoản
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
              <h2 id="sec-booking">Đặt lịch khám trực tuyến</h2>
              <p className="landing-booking-sub">Tìm bác sĩ chính xác - Đặt lịch khám dễ dàng</p>
            </div>
            <Link className="landing-more" to="/appointments">
              Xem thêm <span aria-hidden="true">›</span>
            </Link>
          </div>

          <div className="landing-doctor-strip" role="list" aria-label="Đặt khám bác sĩ">
            {loadingDoctors
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
                      Đặt lịch khám <span aria-hidden="true">›</span>
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
                    visibleDoctors.map((d) => (
                      <article
                        className="landing-doctor-card"
                        role="listitem"
                        key={d.id || d.email || getDoctorFullName(d)}
                        tabIndex={0}
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                          handleBookClick({ doctorId: d.id })
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            handleBookClick({ doctorId: d.id })
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
                            handleBookClick({ doctorId: d.id })
                          }}
                        >
                          Đặt lịch khám <span aria-hidden="true">›</span>
                        </button>
                      </article>
                    ))
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
              <h2 id="sec-specialties">Khám theo chuyên khoa</h2>
              <p className="landing-booking-sub">Chọn chuyên khoa để lọc nhanh danh sách bác sĩ phù hợp.</p>
            </div>
            <Link className="landing-more" to="/appointments">
              Xem tất cả <span aria-hidden="true">›</span>
            </Link>
          </div>

          <div className="landing-specialty-grid" role="list" aria-label="Danh sách chuyên khoa">
            {featuredDepartments.length ? (
              featuredDepartments.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="landing-specialty-card"
                  role="listitem"
                  onClick={() => navigate('/appointments', { state: { deptId: s.id } })}
                >
                  <span className="landing-specialty-icon" aria-hidden="true">
                    +
                  </span>
                  <span className="landing-specialty-meta">
                    <span className="landing-specialty-name">{s.name}</span>
                    <span className="landing-specialty-count">{s.count} bác sĩ</span>
                  </span>
                  <span className="landing-specialty-cta" aria-hidden="true">
                    Chọn <span aria-hidden="true">›</span>
                  </span>
                </button>
              ))
            ) : (
              <div style={{ padding: '10px 0', color: 'var(--muted)', fontWeight: 800 }}>
                Chưa có dữ liệu chuyên khoa.
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
          aria-label="Bổ sung hồ sơ bệnh nhân"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closePatientInfoModal()
          }}
        >
          <div className="landing-modal">
            <div className="landing-modal-head">
              <div className="landing-modal-title">Bổ sung hồ sơ bệnh nhân</div>
              <button type="button" className="landing-modal-close" onClick={closePatientInfoModal} aria-label="Đóng">
                ×
              </button>
            </div>

            <p className="landing-modal-sub">
              Để tiếp tục đặt lịch khám, vui lòng nhập thêm thông tin bắt buộc.
            </p>

            {patientInfoError ? (
              <div className="landing-modal-error" role="alert">
                {patientInfoError}
              </div>
            ) : null}

            <div className="landing-modal-grid">
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

            <div className="landing-modal-actions">
              <button type="button" className="landing-modal-save" onClick={savePatientInfo}>
                Lưu &amp; tiếp tục
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
