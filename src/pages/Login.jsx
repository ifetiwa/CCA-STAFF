import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Scale, Lock, Mail, LogIn, ShieldCheck, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { authenticate } from '../data/users'

const DEMO_LOGINS = [
  { role: 'Super Administrator', email: 'superadmin@cca.gov.ng', password: 'SuperAdmin@123' },
  { role: 'Administrator',       email: 'admin@cca.gov.ng',      password: 'Admin@1234567' },
  { role: 'HR Officer',          email: 'hr@cca.gov.ng',         password: 'Hr@12345678' },
  { role: 'Department Head',     email: 'head@cca.gov.ng',       password: 'Head@1234567' },
  { role: 'Auditor',             email: 'auditor@cca.gov.ng',    password: 'Audit@1234567' },
  { role: 'Staff',               email: 'staff@cca.gov.ng',      password: 'Staff@1234567' },
]

const initialsFor = (name = '', email = '') => {
  const parts = name.trim().split(/\s+/)
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

  const submit = (e) => {
    e.preventDefault()
    setError('')
    if (!email || !password) {
      setError('Please enter your email and password.')
      return
    }
    setLoading(true)
    const result = authenticate(email, password)
    if (!result.ok) {
      setError(result.reason)
      setLoading(false)
      return
    }
    const u = result.user
    login(
      {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        department: u.department,
        permissions: u.permissions,
        initials: initialsFor(u.name, u.email),
      },
      'demo-token-' + u.id + '-' + Date.now(),
    )
    setTimeout(() => navigate('/'), 100)
  }

  const fillDemo = (d) => {
    setEmail(d.email)
    setPassword(d.password)
    setError('')
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

          <div className="login-hint" style={{ marginTop: '1rem' }}>
            <div className="muted small" style={{ marginBottom: '0.5rem', fontWeight: 600 }}>
              Test accounts (click to fill):
            </div>
            <div style={{ display: 'grid', gap: '0.35rem' }}>
              {DEMO_LOGINS.map((d) => (
                <button
                  type="button"
                  key={d.email}
                  className="btn btn-outline"
                  style={{ justifyContent: 'space-between', padding: '0.5rem 0.75rem', fontSize: '0.82rem' }}
                  onClick={() => fillDemo(d)}
                >
                  <span><strong>{d.role}</strong> — {d.email}</span>
                  <span className="muted small">{d.password}</span>
                </button>
              ))}
            </div>
          </div>
        </form>
        <div className="login-footer muted">© 2026 Customary Court of Appeal, FCT</div>
      </div>
    </div>
  )
}

export default Login
