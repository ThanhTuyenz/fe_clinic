import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { aiChat } from '../api/ai.js'
import logo from '../assets/logo.png'
import '../styles/landing.css'
import '../styles/ai-chat.css'

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

function getUserEmail(u) {
  return String(u?.email || u?.username || '').trim()
}

function getUserName(u) {
  const first = String(u?.firstName || '').trim()
  const last = String(u?.lastName || '').trim()
  const full = `${last} ${first}`.trim()
  if (full) return full
  return String(u?.displayName || u?.fullName || u?.name || '').trim()
}

function getUserDisplayName(u) {
  const name = getUserName(u)
  if (name) return name
  const email = getUserEmail(u)
  if (!email) return ''
  return String(email.split('@')[0] || '').trim()
}

function getUserInitials(u) {
  const base = getUserDisplayName(u) || getUserEmail(u)
  if (!base) return '?'
  const words = base
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

function asText(x) {
  return String(x == null ? '' : x)
}

const DEFAULT_DOCTOR_AVATAR =
  'https://sf-static.upanhlaylink.com/img/image_202603269925437b540c48178c53b73c88dd8146.jpg'

function getDoctorAvatarSrc(d) {
  const candidate = String(d?.avatarUrl || d?.avatar_url || '').trim()
  return candidate || DEFAULT_DOCTOR_AVATAR
}

function getDoctorIntro(d) {
  const bio = String(d?.bio || '').trim()
  if (bio) {
    const compact = bio.replace(/\s+/g, ' ').trim()
    return compact.length > 220 ? `${compact.slice(0, 217)}…` : compact
  }
  const specialty = String(d?.specialty || '').trim()
  const years = Number(d?.experienceYears)
  if (specialty && Number.isFinite(years) && years > 0) {
    return `Bác sĩ ${d?.name || ''} có hơn ${years} năm kinh nghiệm trong lĩnh vực ${specialty}.`
  }
  if (specialty) {
    return `Bác sĩ ${d?.name || ''} chuyên khám và điều trị các vấn đề thuộc chuyên khoa ${specialty}.`
  }
  return `Bác sĩ ${d?.name || ''} sẵn sàng hỗ trợ bạn đặt lịch khám tại phòng khám.`
}

function getDoctorInitials(name) {
  const words = String(name || '')
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

export default function AIChat() {
  const navigate = useNavigate()
  const { token, user } = useMemo(() => getSession(), [])
  const userName = getUserDisplayName(user)
  const userEmail = getUserEmail(user)

  const [messages, setMessages] = useState(() => [
    {
      role: 'assistant',
      content:
        'Chào bạn! Mình là trợ lý đặt lịch. Bạn cứ nói rõ nhu cầu khám, khoa muốn gặp, hoặc ngày giờ mong muốn — mình sẽ bám theo để gợi ý lịch phù hợp.',
    },
  ])
  const [draft, setDraft] = useState('')
  const [state, setState] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const scrollerRef = useRef(null)

  useEffect(() => {
    if (!token || !user) {
      navigate('/login', { replace: true })
    }
  }, [token, user, navigate])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages, busy])

  async function sendUserMessage(text, patchState = null) {
    const content = String(text || '').trim()
    if (!content) return
    setError('')
    setBusy(true)

    const nextMessages = [...messages, { role: 'user', content }]
    const nextState = patchState ? { ...state, ...patchState } : state
    setMessages(nextMessages)

    try {
      const data = await aiChat({ token, messages: nextMessages, state: nextState })
      const assistant = data?.assistant
      if (assistant?.role && assistant?.content) {
        setMessages((cur) => [...cur, assistant])
      }
      if (data?.state && typeof data.state === 'object') {
        setState(data.state)
      }
    } catch (err) {
      setError(err?.message || 'Không gửi được tin nhắn.')
    } finally {
      setBusy(false)
    }
  }

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('user')
    navigate('/landing', { replace: true })
  }

  const suggestedDoctors = Array.isArray(state?.suggestedDoctors) ? state.suggestedDoctors : []
  const draftSpecialty = asText(state?.specialty).trim()
  const draftDate = asText(state?.appointmentDate).slice(0, 10)
  const draftTime = asText(state?.startTime).slice(0, 5)

  function bookWithDoctor(doctor) {
    const id = String(doctor?.id || '').trim()
    if (!id) return
    const bookingState = {
      doctorId: id,
      appointmentDate: draftDate || undefined,
      note: asText(state?.note).trim() || undefined,
    }
    const deptId = String(doctor?.deptId || '').trim()
    if (deptId) bookingState.deptId = deptId
    navigate('/appointments', { state: bookingState })
  }

  return (
    <div className="aichat-page">
      <header className="landing-header">
        <Link className="landing-brand" to="/landing">
          <img className="landing-logo" src={logo} alt="VitaCare Clinic" />
        </Link>
        <nav className="landing-nav" aria-label="Điều hướng chính">
          <Link to="/landing#gioi-thieu">Giới thiệu</Link>
          <Link to="/landing#dich-vu">Dịch vụ</Link>
          <Link to="/appointments">Đặt khám</Link>
          <span className="landing-nav-actions">
            {user ? (
              <span className="landing-user-wrap">
                <button type="button" className="landing-user-chip" aria-haspopup="menu">
                  <span className="landing-user-avatar" aria-hidden="true">
                    {getUserInitials(user)}
                  </span>
                  <span className="landing-user-meta">
                    <span className="landing-user-name">{userName || 'Tài khoản'}</span>
                    <span className="landing-user-email">{userEmail || '—'}</span>
                  </span>
                  <span className="landing-user-caret" aria-hidden="true">
                    ▾
                  </span>
                </button>
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
            ) : null}
          </span>
        </nav>
      </header>

      <main className="aichat-container" aria-label="Trợ lý đặt lịch">
        <section className="aichat-shell">
          <div className="aichat-head">
            <div>
              <div className="aichat-title">Trợ lý tư vấn &amp; đặt lịch</div>
              <div className="aichat-sub">
                Lưu ý: Trợ lý chỉ hỗ trợ sàng lọc và đặt lịch, không thay thế bác sĩ.
              </div>
            </div>
            <Link className="aichat-link" to="/appointments">
              Đặt lịch thủ công →
            </Link>
          </div>

          <div className="aichat-body" ref={scrollerRef} role="log" aria-label="Hội thoại">
            {messages.map((m, idx) => (
              <div key={idx} className={`aichat-msg ${m.role === 'user' ? 'is-user' : 'is-assistant'}`}>
                <div className="aichat-bubble">{m.content}</div>
              </div>
            ))}
            {busy ? (
              <div className="aichat-msg is-assistant">
                <div className="aichat-bubble aichat-bubble--muted">Đang xử lý…</div>
              </div>
            ) : null}
          </div>

          <div className="aichat-side">
            <div className="aichat-card">
              <div className="aichat-card-title">Gợi ý hiện tại</div>
              <div className="aichat-kv">
                <div className="aichat-k">Chuyên khoa</div>
                <div className="aichat-v">{draftSpecialty || '—'}</div>
              </div>
              <div className="aichat-kv">
                <div className="aichat-k">Ngày</div>
                <div className="aichat-v">{draftDate || '—'}</div>
              </div>
              <div className="aichat-kv">
                <div className="aichat-k">Giờ</div>
                <div className="aichat-v">{draftTime || '—'}</div>
              </div>
            </div>

            <div className="aichat-card">
              <div className="aichat-card-title">Bác sĩ được đề xuất</div>
              {suggestedDoctors.length ? (
                <div className="aichat-doctor-list" role="list">
                  {suggestedDoctors.map((d) => (
                    <article key={d.id} className="aichat-doctor-card" role="listitem">
                      <div className="aichat-doctor-card-head">
                        <div className="aichat-doctor-avatar" aria-hidden="true">
                          <span className="aichat-doctor-avatar-fallback">{getDoctorInitials(d.name)}</span>
                          <img
                            className="aichat-doctor-avatar-img"
                            src={getDoctorAvatarSrc(d)}
                            alt=""
                            loading="lazy"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                        </div>
                        <div className="aichat-doctor-card-meta">
                          <div className="aichat-doctor-name">{d.name}</div>
                          <div className="aichat-doctor-spec">{d.specialty || 'Chuyên khoa'}</div>
                          {d.deptName ? <div className="aichat-doctor-dept">{d.deptName}</div> : null}
                        </div>
                      </div>
                      <p className="aichat-doctor-bio">{getDoctorIntro(d)}</p>
                      <button type="button" className="aichat-doctor-book" onClick={() => bookWithDoctor(d)}>
                        Đặt lịch ngay
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="aichat-muted">Chưa có gợi ý. Hãy cho biết nhu cầu khám hoặc khoa bạn muốn gặp.</div>
              )}
            </div>
          </div>

          {error ? (
            <div className="aichat-error" role="alert">
              {error}
            </div>
          ) : null}

          <form
            className="aichat-input"
            onSubmit={(e) => {
              e.preventDefault()
              const text = draft.trim()
              setDraft('')
              void sendUserMessage(text)
            }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Nhập nhu cầu khám, khoa, ngày giờ…"
              aria-label="Nhập tin nhắn"
              disabled={busy}
            />
            <button type="submit" disabled={busy || !draft.trim()}>
              Gửi
            </button>
          </form>
        </section>
      </main>
    </div>
  )
}
