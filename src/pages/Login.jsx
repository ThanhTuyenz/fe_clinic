import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { login as loginApi } from '../api/auth.js'
import '../styles/auth.css'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [info, setInfo] = useState(location.state?.message || '')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    if (!email.trim() || !password) {
      setError('Vui lòng nhập email/số điện thoại và mật khẩu.')
      return
    }
    setLoading(true)
    try {
      const data = await loginApi({ email: email.trim(), password })
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      sessionStorage.removeItem('token')
      sessionStorage.removeItem('user')

      const userType = String(data?.user?.userType || '').toLowerCase()
      const role = String(data?.user?.role || '').toLowerCase()
      const isPatient = userType === 'patient' || role === 'patient'
      if (!isPatient) {
        throw new Error('Chỉ bệnh nhân mới được phép đăng nhập tại trang này.')
      }

      if (remember) {
        localStorage.setItem('token', data.token)
        localStorage.setItem('user', JSON.stringify(data.user))
      } else {
        sessionStorage.setItem('token', data.token)
        sessionStorage.setItem('user', JSON.stringify(data.user))
      }
      navigate('/home', { replace: true })
    } catch (err) {
      if (
        err.code === 'EMAIL_NOT_VERIFIED' &&
        err.verificationToken &&
        err.email
      ) {
        navigate('/verify-otp', {
          replace: false,
          state: {
            verificationToken: err.verificationToken,
            email: err.email,
            emailMask: err.emailMask,
            rememberFromLogin: remember,
          },
        })
        return
      }
      setError(err.message || 'Đăng nhập thất bại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <aside className="auth-brand" aria-hidden="false">
        <div className="auth-brand-inner">
          <span className="auth-brand-badge">Hệ thống quản lý</span>
          <h1>VitaCare Clinic</h1>
          <p>
            Quản lý quy trình khám chữa bệnh và đặt lịch khám — an toàn, rõ ràng,
            thuận tiện cho nhân viên và bệnh nhân.
          </p>
        </div>
      </aside>

      <main className="auth-panel">
        <div className="auth-card">
          <h2>Đăng nhập</h2>
          <p className="auth-card-sub">Nhập thông tin tài khoản của bạn.</p>

          {info ? (
            <p className="auth-error" style={{ color: 'var(--clinic-primary)', borderColor: 'rgba(13,148,136,0.35)', background: 'rgba(13,148,136,0.08)' }} role="status">
              {info}
            </p>
          ) : null}

          {error ? (
            <p className="auth-error" role="alert">
              {error}
            </p>
          ) : null}

          <form onSubmit={handleSubmit} noValidate>
            <div className="auth-field">
              <label htmlFor="login-email">Email hoặc số điện thoại</label>
              <input
                id="login-email"
                type="text"
                autoComplete="username"
                placeholder="vd: user@email.com hoặc 09xx xxx xxx"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="auth-field">
              <label htmlFor="login-password">Mật khẩu</label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="auth-row">
              <label className="auth-checkbox">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  disabled={loading}
                />
                Ghi nhớ đăng nhập
              </label>
              <Link to="#">Quên mật khẩu?</Link>
            </div>
            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? 'Đang xử lý…' : 'Đăng nhập'}
            </button>
          </form>

          <p className="auth-footer">
            <Link to="/landing">Về trang chủ</Link>
            {' · '}
            Chưa có tài khoản? <Link to="/register">Đăng ký</Link>
          </p>
        </div>
      </main>
    </div>
  )
}
