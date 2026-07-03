import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Scale, Lock, Mail, LogIn, ShieldCheck, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { authAPI, getApiBaseUrl, setApiBaseUrl } from '../utils/api'
import { normalizeUser } from '../utils/authUser'
import { cacheCredential, verifyOffline } from '../utils/offlineAuth'

const Login = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showServer, setShowServer] = useState(false)
  const [serverUrl, setServerUrl] = useState(getApiBaseUrl())
  const navigate = useNavigate()
  const { login } = useAuth()

  const saveServer = () => {
    const applied = setApiBaseUrl(serverUrl)
    setServerUrl(applied)
    setShowServer(false)
    setError('')
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!email || !password) {
      setError('Please enter your email and password.')
      return
    }
    setLoading(true)
    try {
      const { data } = await authAPI.login(email, password)
      const u = normalizeUser(data.user || {})
      // Cache the credential so this device can sign in offline next time.
      await cacheCredential(email, password, u, data.token)
      login(u, data.token)
      navigate('/')
    } catch (err) {
      // No response at all means the server is unreachable (offline / cold
      // start exhausted retries). Fall back to the offline credential cache.
      if (!err.response) {
        const res = await verifyOffline(email, password)
        if (res.ok) {
          login(res.user, res.token)
          navigate('/')
          return
        }
        setError(res.reason || 'You appear to be offline. Please try again when connected.')
      } else {
        const detail = err.response?.data?.detail
        setError(detail || 'Sign-in failed. Check your credentials and try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-shell">
      <div className="login-side">
        <div className="login-side-inner">
          <div className="login-emblem">
            <Scale size={36} />
          </div>
          <h1>Customary Court of Appeal</h1>
          <p className="login-side-sub">Federal Capital Territory, Abuja</p>
          <div className="login-divider" />
          <h2>Staff Biodata Management System</h2>
          <p className="login-side-blurb">
            A secure digital register for managing personnel records, postings, and service history across the CCA.
          </p>
          <ul className="login-features">
            <li>Centralised personnel records</li>
            <li>Audit trail of every change</li>
            <li>Role-based access for HR &amp; administration</li>
          </ul>
          <div className="login-trust">
            <ShieldCheck size={16} />
            <span>Encrypted · Audited · Government-grade</span>
          </div>
        </div>
      </div>

      <div className="login-form-side">
        <form className="login-card" onSubmit={submit}>
          <div className="login-card-head">
            <h2>Welcome back</h2>
            <p className="muted">Use your CCA staff credentials to continue.</p>
          </div>

          {error && <div className="alert alert-danger">{error}</div>}

          <div className="form-group">
            <label>Email address</label>
            <div className="input-with-icon">
              <Mail size={18} />
              <input
                type="email"
                className="form-control"
                placeholder="name@cca.gov.ng"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Password</label>
            <div className="input-with-icon">
              <Lock size={18} />
              <input
                type={showPwd ? 'text' : 'password'}
                className="form-control"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 0, cursor: 'pointer', color: '#6b7280' }}
                aria-label={showPwd ? 'Hide password' : 'Show password'}
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="login-row">
            <label className="checkbox">
              <input type="checkbox" defaultChecked /> Remember me
            </label>
            <a href="#forgot" onClick={(e) => e.preventDefault()}>Forgot password?</a>
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? <span className="loading" /> : <LogIn size={18} />}
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="login-footer muted">
          <div>© 2026 Customary Court of Appeal, FCT</div>
          <button
            type="button"
            onClick={() => setShowServer((v) => !v)}
            style={{ background: 'none', border: 0, color: '#6b7280', cursor: 'pointer', fontSize: '0.8rem', marginTop: 6 }}
          >
            {showServer ? 'Hide server settings' : 'Server settings'}
          </button>
          {showServer && (
            <div className="form-group" style={{ marginTop: 8, textAlign: 'left' }}>
              <label style={{ fontSize: '0.8rem' }}>Backend server URL</label>
              <input
                type="url"
                className="form-control"
                placeholder="https://your-server/api"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
              />
              <button type="button" className="btn btn-secondary btn-block" style={{ marginTop: 6 }} onClick={saveServer}>
                Save server URL
              </button>
              <p className="muted small" style={{ marginTop: 4 }}>
                Point this desktop app at your organisation's server. Include the trailing <code>/api</code>.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Login
