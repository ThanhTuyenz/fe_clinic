import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/auth.css'

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

export default function Home() {
  const navigate = useNavigate()
  const user = getStoredUser()

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true })
    }
  }, [user, navigate])

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('user')
    navigate('/login', { replace: true })
  }

  if (!user) {
    return null
  }

  return (
    <div className="auth-page">
      <aside className="auth-brand" aria-hidden="false">
        <div className="auth-brand-inner">
          <span className="auth-brand-badge">Phòng khám ABC</span>
          <h1>Đăng nhập thành công</h1>
          <p>Bạn có thể mở rộng trang này thành dashboard sau khi thêm chức năng.</p>
        </div>
      </aside>
      <main className="auth-panel">
        <div className="auth-card">
          <h2>Xin chào</h2>
          <p className="auth-card-sub">
            {user.displayName || user.fullName || user.email} — {user.role}
          </p>
          <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: 'var(--muted)' }}>
            {user.email}
          </p>
          <button type="button" className="auth-submit" onClick={logout}>
            Đăng xuất
          </button>
        </div>
      </main>
    </div>
  )
}
