import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Scale, Lock, Mail, LogIn, ShieldCheck, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { authAPI } from '../utils/api'

const initialsFor = (name = '', email = '') => {
  const parts = (name || '').trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return (name[0] || email[0] || 'U').toUpperCase() + (name[1] || email[1] || '').toUpperCase()
}

const Login = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { login } = useAuth()

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
      const u = data.user || {}
      const fullName = u.full_name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username
      login(
        {
          id: u.id,
          email: u.email,
          username: u.username,
          name: fullName,
          role: u.role_display || u.role,
          role_key: u.role,
          permissions: u.permissions || {},
          initials: initialsFor(fullName, u.email),
        },
        data.token,
      )
      navigate('/')
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(detail || 'Sign-in failed. Check your credentials and try again.')
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
        <div className="login-footer muted">© 2026 Customary Court of Appeal, FCT</div>
      </div>
    </div>
  )
}

export default Login
