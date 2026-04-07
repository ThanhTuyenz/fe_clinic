import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  startRegister as startRegisterApi,
  verifyEmail as verifyEmailApi,
  completeRegister as completeRegisterApi,
  resendOtp as resendOtpApi,
} from '../api/auth.js'
import '../styles/auth.css'

export default function Register() {
  const navigate = useNavigate()
  // 1: nhập email -> gửi OTP, 2: xác nhận OTP, 3: tạo mật khẩu + hoàn tất
  const [step, setStep] = useState(1)

  const [lastName, setLastName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [agree, setAgree] = useState(false)

  const [verificationToken, setVerificationToken] = useState('')
  const [completeToken, setCompleteToken] = useState('')
  const [emailMask, setEmailMask] = useState('')
  const [otp, setOtp] = useState('')
  const [emailVerified, setEmailVerified] = useState(false)

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)

  function handleChangeEmail() {
    setError('')
    setOtp('')
    setVerificationToken('')
    setCompleteToken('')
    setEmailMask('')
    setEmailVerified(false)
    setStep(1)
  }

  async function handleSendOtp(e) {
    e.preventDefault()
    setError('')
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) {
      setError('Vui lòng nhập Gmail.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Email không hợp lệ.')
      return
    }
    setLoading(true)
    try {
      setEmailVerified(false)
      setCompleteToken('')
      const data = await startRegisterApi({ email: normalizedEmail })
      setVerificationToken(data.verificationToken || '')
      setEmailMask(data.emailMask || data.email || normalizedEmail)
      setOtp('')
      setStep(2)
    } catch (err) {
      setError(err?.message || 'Gửi OTP thất bại.')
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
      // Nếu backend trả token/user thì đăng nhập.
      if (data?.token && data?.user) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        sessionStorage.removeItem('token')
        sessionStorage.removeItem('user')
        localStorage.setItem('token', data.token)
        localStorage.setItem('user', JSON.stringify(data.user))
        navigate('/home', { replace: true })
        return
      }

      // Luồng mới: verify xong trả completeToken -> chuyển sang bước tạo mật khẩu
      if (data?.completeToken) {
        setCompleteToken(data.completeToken)
        if (data.emailMask) setEmailMask(data.emailMask)
        setEmailVerified(true)
        setStep(3)
        return
      }

      setEmailVerified(true)
      setStep(3)
    } catch (err) {
      setError(err.message || 'Xác thực thất bại.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCompleteRegister(e) {
    e.preventDefault()
    setError('')

    if (!emailVerified) {
      setError('Vui lòng xác thực Gmail bằng OTP trước khi tạo mật khẩu.')
      setStep(2)
      return
    }
    if (!lastName.trim() || !firstName.trim() || !phone.trim()) {
      setError('Vui lòng điền đầy đủ họ, tên và số điện thoại.')
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
      const data = await completeRegisterApi({
        completeToken,
        lastName: lastName.trim(),
        firstName: firstName.trim(),
        phone: phone.trim(),
        password,
      })

      // Nếu backend trả token/user thì đăng nhập.
      if (data?.token && data?.user) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        sessionStorage.removeItem('token')
        sessionStorage.removeItem('user')
        localStorage.setItem('token', data.token)
        localStorage.setItem('user', JSON.stringify(data.user))
        navigate('/home', { replace: true })
        return
      }

      navigate('/login', { replace: true })
    } catch (err) {
      setError(err.message || 'Đăng ký thất bại.')
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
          <h1>Tham gia VitaCare Clinic</h1>
          <p>
            {step === 1
              ? 'Nhập Gmail để nhận mã OTP xác thực.'
              : step === 2
                ? 'Nhập mã OTP đã gửi tới Gmail để xác nhận.'
                : 'Tạo mật khẩu sau khi Gmail đã được xác thực.'}
          </p>
        </div>
      </aside>

      <main className="auth-panel">
        <div className="auth-card">
          {step === 1 ? (
            <>
              <h2>Đăng ký</h2>
              <p className="auth-card-sub">Bước 1/3: Nhập Gmail để nhận OTP.</p>

              {error ? (
                <p className="auth-error" role="alert">
                  {error}
                </p>
              ) : null}

              <form onSubmit={handleSendOtp} noValidate>
                <div className="auth-field">
                  <label htmlFor="reg-email">Email</label>
                  <input
                    id="reg-email"
                    type="email"
                    autoComplete="email"
                    placeholder="vd: yourname@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <button type="submit" className="auth-submit" disabled={loading}>
                  {loading ? 'Đang gửi…' : 'Gửi OTP'}
                </button>
              </form>
            </>
          ) : step === 2 ? (
            <>
              <h2>Xác thực email</h2>
              <p className="auth-card-sub">
                Mã OTP đã gửi tới <strong>{emailMask}</strong>. Nhập 6 chữ số
                để xác nhận Gmail.
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
                  {loading ? 'Đang xác thực…' : 'Xác nhận OTP'}
                </button>
              </form>

              <p style={{ marginTop: '1rem', textAlign: 'center' }}>
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    padding: 0,
                    font: 'inherit',
                    fontWeight: 500,
                    color: 'var(--text-heading)',
                    textDecoration: 'underline',
                    opacity: loading ? 0.6 : 1,
                    marginRight: '0.75rem',
                  }}
                  onClick={handleChangeEmail}
                  disabled={loading}
                >
                  Đổi email
                </button>
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
          ) : (
            <>
              <h2>Tạo mật khẩu</h2>
              <p className="auth-card-sub">
                Bước 3/3: Gmail <strong>{emailMask || email}</strong> đã được xác
                thực. Hoàn tất thông tin để tạo tài khoản.
              </p>

              {error ? (
                <p className="auth-error" role="alert">
                  {error}
                </p>
              ) : null}

              <form onSubmit={handleCompleteRegister} noValidate>
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
