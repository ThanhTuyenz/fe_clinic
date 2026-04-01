import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
              <Link className="landing-btn landing-btn--solid" to="/appointments">
                Đặt lịch khám
              </Link>
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
                : featuredDoctors.map((d) => (
                    <article
                      className="landing-doctor-card"
                      role="listitem"
                      key={d.id || d.email || getDoctorFullName(d)}
                      tabIndex={0}
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        navigate('/appointments', { state: { doctorId: d.id } })
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          navigate('/appointments', { state: { doctorId: d.id } })
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
                      <Link
                        className="landing-doctor-action"
                        to="/appointments"
                        onClick={(e) => e.stopPropagation()}
                        state={{ doctorId: d.id }}
                      >
                        Đặt lịch khám <span aria-hidden="true">›</span>
                      </Link>
                    </article>
                  ))}
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
