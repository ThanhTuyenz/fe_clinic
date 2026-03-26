import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  register as registerApi,
  verifyEmail as verifyEmailApi,
  resendOtp as resendOtpApi,
} from '../api/auth.js'
import '../styles/auth.css'

export default function Register() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)

  const [lastName, setLastName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [agree, setAgree] = useState(false)

  const [verificationToken, setVerificationToken] = useState('')
  const [emailMask, setEmailMask] = useState('')
  const [otp, setOtp] = useState('')

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)

  async function handleSubmitRegister(e) {
    e.preventDefault()
    setError('')
    if (!lastName.trim() || !firstName.trim() || !email.trim() || !phone.trim()) {
      setError('Vui lòng điền đầy đủ họ, tên, email và số điện thoại.')
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
      const data = await registerApi({
        lastName: lastName.trim(),
        firstName: firstName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
      })
      setVerificationToken(data.verificationToken)
      setEmailMask(data.emailMask || data.email)
      setOtp('')
      setStep(2)
    } catch (err) {
      setError(err.message || 'Đăng ký thất bại.')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault()
    setError('')
    if (!/^\d{6}$/.test(otp.trim())) {
      setError('Vui lòng nhập đúng mã 6 chữ số.')
      return
    }
    setLoading(true)
    try {
      const data = await verifyEmailApi({
        verificationToken,
        otp: otp.trim(),
      })
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      sessionStorage.removeItem('token')
      sessionStorage.removeItem('user')
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      navigate('/home', { replace: true })
    } catch (err) {
      setError(err.message || 'Xác thực thất bại.')
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    setError('')
    setResendLoading(true)
    try {
      const data = await resendOtpApi({ email: email.trim().toLowerCase() })
      if (data.verificationToken) {
        setVerificationToken(data.verificationToken)
      }
      if (data.emailMask) {
        setEmailMask(data.emailMask)
      }
    } catch (err) {
      setError(err.message || 'Gửi lại mã thất bại.')
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <aside className="auth-brand" aria-hidden="false">
        <div className="auth-brand-inner">
          <span className="auth-brand-badge">Tài khoản bệnh nhân</span>
          <h1>Tham gia Phòng khám ABC</h1>
          <p>
            {step === 1
              ? 'Tạo tài khoản để đặt lịch khám trực tuyến và theo dõi lịch hẹn của bạn mọi lúc.'
              : 'Nhập mã OTP đã gửi tới email để xác thực và hoàn tất đăng ký.'}
          </p>
        </div>
      </aside>

      <main className="auth-panel">
        <div className="auth-card">
          {step === 1 ? (
            <>
              <h2>Đăng ký</h2>
              <p className="auth-card-sub">Điền thông tin để tạo tài khoản mới.</p>

              {error ? (
                <p className="auth-error" role="alert">
                  {error}
                </p>
              ) : null}

              <form onSubmit={handleSubmitRegister} noValidate>
            <div className="auth-field">
              <label htmlFor="reg-last">Họ</label>
              <input
                id="reg-last"
                type="text"
                autoComplete="family-name"
                placeholder="Nguyễn"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="auth-field">
              <label htmlFor="reg-first">Tên</label>
              <input
                id="reg-first"
                type="text"
                autoComplete="given-name"
                placeholder="Văn A"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
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
                  {loading ? 'Đang xử lý…' : 'Tạo tài khoản & gửi OTP'}
                </button>
              </form>
            </>
          ) : (
            <>
              <h2>Xác thực email</h2>
              <p className="auth-card-sub">
                Mã OTP đã gửi tới <strong>{emailMask}</strong>. Nhập 6 chữ số
                để hoàn tất; sau đó bạn sẽ được đăng nhập tự động.
              </p>

              {error ? (
                <p className="auth-error" role="alert">
                  {error}
                </p>
              ) : null}

              <form onSubmit={handleVerifyOtp} noValidate>
                <div className="auth-field">
                  <label htmlFor="reg-otp">Mã OTP</label>
                  <input
                    id="reg-otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    maxLength={6}
                    value={otp}
                    onChange={(e) =>
                      setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    disabled={loading}
                  />
                </div>
                <button type="submit" className="auth-submit" disabled={loading}>
                  {loading ? 'Đang xác thực…' : 'Xác nhận & đăng nhập'}
                </button>
              </form>

              <p style={{ marginTop: '1rem', textAlign: 'center' }}>
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: resendLoading ? 'wait' : 'pointer',
                    padding: 0,
                    font: 'inherit',
                    fontWeight: 500,
                    color: 'var(--clinic-primary)',
                    textDecoration: 'underline',
                  }}
                  onClick={handleResend}
                  disabled={resendLoading || loading}
                >
                  {resendLoading ? 'Đang gửi…' : 'Gửi lại mã OTP'}
                </button>
              </p>
            </>
          )}

          <p className="auth-footer">
            <Link to="/landing">Về trang chủ</Link>
            {' · '}
            Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
          </p>
        </div>
      </main>
    </div>
  )
}
