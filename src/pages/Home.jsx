import { Link, useNavigate } from 'react-router-dom'
import '../styles/landing.css'

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
          Phòng khám ABC
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
                    <Link className="landing-user-menu-item" to="/appointments" role="menuitem">
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
        <section className="landing-hero" aria-labelledby="landing-title">
          <h1 id="landing-title">Chăm sóc sức khỏe tận tâm, đặt lịch thuận tiện</h1>
          <p>
            Phòng khám ABC hỗ trợ quy trình khám chữa bệnh minh bạch và đặt lịch
            khám trực tuyến — bạn có thể xem thông tin phòng khám tại đây mà
            không cần đăng nhập.
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

        <section
          id="gioi-thieu"
          className="landing-section"
          aria-labelledby="sec-about"
        >
          <h2 id="sec-about">Giới thiệu</h2>
          <p>
            Phòng khám ABC phục vụ người dân với đội ngũ bác sĩ và nhân viên
            chuyên nghiệp, trang thiết bị phù hợp khám ngoại trú và tư vấn sức
            khỏe. Hệ thống quản lý giúp theo dõi lịch hẹn, hồ sơ và quy trình
            khám rõ ràng cho cả bệnh nhân và nhân viên.
          </p>
          <p>
            Bạn có thể đăng ký tài khoản để đặt lịch khám và nhận thông báo;
            trang này chỉ mang tính giới thiệu — không yêu cầu đăng nhập.
          </p>
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
          <p>
            Thông tin dưới đây là ví dụ cho demo — bạn có thể thay bằng địa chỉ,
            số điện thoại và email thật của phòng khám trong báo cáo.
          </p>
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
          © {new Date().getFullYear()} Phòng khám ABC — Trang giới thiệu công
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
