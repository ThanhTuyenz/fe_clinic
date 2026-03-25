import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register as registerApi } from '../api/auth.js'
import '../styles/auth.css'

export default function Register() {
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [agree, setAgree] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!fullName.trim() || !email.trim() || !phone.trim()) {
      setError('Vui lòng điền đầy đủ họ tên, email và số điện thoại.')
      return
    }
    if (password.length < 6) {
      setError('Mật khẩu cần ít nhất 6 ký tự.')
      return
    }
    if (password !== confirm) {
      setError('Xác nhận mật khẩu không khớp.')
      return
    }
    if (!agree) {
      setError('Vui lòng đồng ý với điều khoản sử dụng.')
      return
    }
    setLoading(true)
    try {
      await registerApi({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
      })
      navigate('/login', {
        replace: true,
        state: { message: 'Đăng ký thành công. Vui lòng đăng nhập.' },
      })
    } catch (err) {
      setError(err.message || 'Đăng ký thất bại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <aside className="auth-brand" aria-hidden="false">
        <div className="auth-brand-inner">
          <span className="auth-brand-badge">Tài khoản bệnh nhân</span>
          <h1>Tham gia Phòng khám ABC</h1>
          <p>
            Tạo tài khoản để đặt lịch khám trực tuyến và theo dõi lịch hẹn của
            bạn mọi lúc.
          </p>
        </div>
      </aside>

      <main className="auth-panel">
        <div className="auth-card">
          <h2>Đăng ký</h2>
          <p className="auth-card-sub">Điền thông tin để tạo tài khoản mới.</p>

          {error ? (
            <p className="auth-error" role="alert">
              {error}
            </p>
          ) : null}

          <form onSubmit={handleSubmit} noValidate>
            <div className="auth-field">
              <label htmlFor="reg-name">Họ và tên</label>
              <input
                id="reg-name"
                type="text"
                autoComplete="name"
                placeholder="Nguyễn Văn A"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="auth-field">
              <label htmlFor="reg-email">Email</label>
              <input
                id="reg-email"
                type="email"
                autoComplete="email"
                placeholder="vd: user@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="auth-field">
              <label htmlFor="reg-phone">Số điện thoại</label>
              <input
                id="reg-phone"
                type="tel"
                autoComplete="tel"
                placeholder="09xx xxx xxx"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="auth-field">
              <label htmlFor="reg-password">Mật khẩu</label>
              <input
                id="reg-password"
                type="password"
                autoComplete="new-password"
                placeholder="Ít nhất 6 ký tự"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="auth-field">
              <label htmlFor="reg-confirm">Xác nhận mật khẩu</label>
              <input
                id="reg-confirm"
                type="password"
                autoComplete="new-password"
                placeholder="Nhập lại mật khẩu"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="auth-row" style={{ marginBottom: '1rem' }}>
              <label className="auth-checkbox">
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                  disabled={loading}
                />
                Tôi đồng ý với điều khoản sử dụng
              </label>
            </div>
            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? 'Đang xử lý…' : 'Tạo tài khoản'}
            </button>
          </form>

          <p className="auth-footer">
            Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
          </p>
        </div>
      </main>
    </div>
  )
}
