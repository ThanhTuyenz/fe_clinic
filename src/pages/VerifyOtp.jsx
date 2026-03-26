import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { verifyEmail as verifyEmailApi, resendOtp as resendOtpApi } from '../api/auth.js'
import '../styles/auth.css'

export default function VerifyOtp() {
  const navigate = useNavigate()
  const location = useLocation()
  const st = location.state

  const [verificationToken, setVerificationToken] = useState(st?.verificationToken || '')
  const [email] = useState(st?.email || '')
  const [emailMask, setEmailMask] = useState(st?.emailMask || '')
  const rememberFromLogin = st?.rememberFromLogin !== false

  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)

  useEffect(() => {
    if (!st?.verificationToken || !st?.email) {
      navigate('/login', { replace: true })
    }
  }, [st, navigate])

  function persistSession(data) {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('user')
    if (rememberFromLogin) {
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
    } else {
      sessionStorage.setItem('token', data.token)
      sessionStorage.setItem('user', JSON.stringify(data.user))
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
      persistSession(data)
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
      const data = await resendOtpApi({ email })
      if (data.verificationToken) setVerificationToken(data.verificationToken)
      if (data.emailMask) setEmailMask(data.emailMask)
    } catch (err) {
      setError(err.message || 'Gửi lại mã thất bại.')
    } finally {
      setResendLoading(false)
    }
  }

  if (!st?.verificationToken) {
    return null
  }

  return (
    <div className="auth-page">
      <aside className="auth-brand" aria-hidden="false">
        <div className="auth-brand-inner">
          <span className="auth-brand-badge">Xác thực email</span>
          <h1>VitaCare Clinic</h1>
          <p>
            Bạn đăng nhập bằng tài khoản chưa xác thực email. Nhập mã OTP đã
            gửi tới hộp thư để tiếp tục.
          </p>
        </div>
      </aside>

      <main className="auth-panel">
        <div className="auth-card">
          <h2>Nhập mã OTP</h2>
          <p className="auth-card-sub">
            Mã đã gửi tới <strong>{emailMask || email}</strong>. Sau khi xác
            thực, bạn sẽ được đăng nhập.
          </p>

          {error ? (
            <p className="auth-error" role="alert">
              {error}
            </p>
          ) : null}

          <form onSubmit={handleVerifyOtp} noValidate>
            <div className="auth-field">
              <label htmlFor="verify-otp">Mã OTP</label>
              <input
                id="verify-otp"
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

          <p className="auth-footer">
            <Link to="/landing">Trang chủ</Link>
            {' · '}
            <Link to="/login">Đăng nhập</Link>
          </p>
        </div>
      </main>
    </div>
  )
}
