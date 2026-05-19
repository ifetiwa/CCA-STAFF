import { useEffect, useMemo, useState } from 'react'
import {
  Users, UserPlus, Shield, KeyRound, Trash2, X, Check, Mail, Lock,
  Building2, BadgeCheck, BadgeAlert, RefreshCw, Search, Copy,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { userAPI } from '../utils/api'

// Backend role keys (Django TextChoices values) → user-facing labels.
const ROLES = [
  { key: 'super_admin',     label: 'Super Administrator' },
  { key: 'admin_staff',     label: 'Admin Staff' },
  { key: 'director',        label: 'Director' },
  { key: 'chief_registrar', label: 'Chief Registrar' },
  { key: 'president',       label: 'President' },
]
const ROLE_LABEL = Object.fromEntries(ROLES.map((r) => [r.key, r.label]))
const ASSIGNABLE_ROLES = ROLES.filter((r) => r.key !== 'super_admin')

// Permission keys returned by the backend serializer (resolved_permissions).
const PERMISSION_GROUPS = [
  {
    title: 'Dashboard & Reports',
    items: [
      { key: 'can_view_dashboard', label: 'View dashboard' },
      { key: 'can_view_reports',   label: 'View reports' },
      { key: 'can_view_records',   label: 'View personnel records' },
      { key: 'can_export',         label: 'Export data (CSV/PDF)' },
    ],
  },
  {
    title: 'Staff records',
    items: [
      { key: 'can_view_staff',     label: 'View staff' },
      { key: 'can_create_staff',   label: 'Create staff' },
      { key: 'can_edit_staff',     label: 'Edit staff' },
      { key: 'can_delete_staff',   label: 'Delete staff' },
    ],
  },
  {
    title: 'Administration',
    items: [
      { key: 'can_view_audit',         label: 'View audit trail' },
      { key: 'can_manage_users',       label: 'Manage users' },
      { key: 'can_manage_settings',    label: 'Manage settings' },
      { key: 'can_view_notifications', label: 'View notifications' },
    ],
  },
]

const initialsOf = (u) => {
  const name = u.full_name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username || ''
  const [a = '', b = ''] = name.split(/\s+/)
  return ((a[0] || '') + (b[0] || u.email?.[0] || 'U')).toUpperCase()
}

const UserManagement = () => {
  const { user: me, can } = useAuth()
  const toast = useToast()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [resetForId, setResetForId] = useState(null)

  const refresh = async () => {
    try {
      setLoading(true)
      const { data } = await userAPI.list({ page_size: 200 })
      setUsers(Array.isArray(data) ? data : (data?.results || []))
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not load users.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  if (!can('manage_users')) {
    return (
      <div className="card">
        <div className="card-body">
          <h3>Access Denied</h3>
          <p className="muted">Only the Super Administrator can manage users.</p>
        </div>
      </div>
    )
  }

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return users.filter((u) =>
      !q ||
      (u.full_name || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (ROLE_LABEL[u.role] || u.role || '').toLowerCase().includes(q)
    )
  }, [users, query])

  const handleToggleActive = async (u) => {
    try {
      const { data } = await userAPI.update(u.id, { is_active: !u.is_active })
      setUsers((prev) => prev.map((x) => (x.id === u.id ? data : x)))
      toast.success(`${data.full_name || data.username} is now ${data.is_active ? 'active' : 'deactivated'}.`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not update user.')
    }
  }

  const handleDelete = async (u) => {
    if (u.id === me.id) return toast.error('You cannot delete your own account.')
    if (u.role === 'super_admin') return toast.error('Super Administrator cannot be deleted.')
    if (!window.confirm(`Permanently remove ${u.full_name || u.username} (${u.email})?`)) return
    try {
      await userAPI.delete(u.id)
      setUsers((prev) => prev.filter((x) => x.id !== u.id))
      toast.success(`${u.full_name || u.username} removed.`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not delete user.')
    }
  }

  const handleRoleChange = async (u, role) => {
    try {
      const { data } = await userAPI.update(u.id, { role })
      setUsers((prev) => prev.map((x) => (x.id === u.id ? data : x)))
      toast.success(`${data.full_name || data.username} is now ${ROLE_LABEL[role] || role}.`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not change role.')
    }
  }

  const editing = editingId ? users.find((u) => u.id === editingId) : null

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header-title">User Management</h1>
          <p className="page-header-sub">Create logins, assign roles and fine-tune what each user can do.</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline" onClick={refresh} disabled={loading}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <UserPlus size={18} /> New User
          </button>
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-body">
          <div className="input-with-icon" style={{ maxWidth: 420 }}>
            <Search size={18} />
            <input
              className="form-control"
              placeholder="Search by name, email or role…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body card-body--flush">
          <table className="table table-modern">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Sign-in</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="empty-row">Loading users…</td></tr>
              ) : filtered.map((u) => {
                const isSuper = u.role === 'super_admin'
                const isMe = u.id === me.id
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="cell-user">
                        <span className="cell-avatar">{initialsOf(u)}</span>
                        <div>
                          <div className="cell-user-name">
                            {u.full_name || u.username}
                            {isMe && <span className="muted small"> · you</span>}
                          </div>
                          <div className="muted small">@{u.username}</div>
                        </div>
                      </div>
                    </td>
                    <td className="muted small">{u.email}</td>
                    <td>
                      {isSuper ? (
                        <span className="badge badge-warning">{ROLE_LABEL[u.role]}</span>
                      ) : (
                        <select
                          className="form-control"
                          value={u.role}
                          onChange={(e) => handleRoleChange(u, e.target.value)}
                          style={{ minWidth: 170 }}
                          disabled={isMe}
                        >
                          {ASSIGNABLE_ROLES.map((r) => (
                            <option key={r.key} value={r.key}>{r.label}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td>
                      <span className={`badge badge-${u.is_active ? 'success' : 'warning'}`}>
                        {u.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="muted small">
                      {u.last_login_iso ? new Date(u.last_login_iso).toLocaleString('en-NG') : '—'}
                    </td>
                    <td className="text-right">
                      <div className="action-group">
                        <button
                          className="action-btn"
                          title="Edit permissions"
                          onClick={() => setEditingId(u.id)}
                          disabled={isSuper}
                        >
                          <Shield size={16} />
                        </button>
                        <button
                          className="action-btn"
                          title="Reset password"
                          onClick={() => setResetForId(u.id)}
                        >
                          <KeyRound size={16} />
                        </button>
                        <button
                          className="action-btn"
                          title={u.is_active ? 'Deactivate' : 'Activate'}
                          onClick={() => handleToggleActive(u)}
                          disabled={isMe}
                        >
                          {u.is_active ? <BadgeAlert size={16} /> : <BadgeCheck size={16} />}
                        </button>
                        <button
                          className="action-btn action-btn--danger"
                          title="Delete user"
                          onClick={() => handleDelete(u)}
                          disabled={isMe || isSuper}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={6} className="empty-row">No users match your search.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={(u, initialPassword) => {
            setUsers((prev) => [u, ...prev])
            toast.success(`${u.full_name || u.username} created.`)
            setShowCreate(false)
            if (initialPassword) {
              // Surface the auto-generated password so the super admin can hand it off.
              window.prompt(
                `Initial password for ${u.username} — copy this now, it won't be shown again:`,
                initialPassword,
              )
            }
          }}
        />
      )}

      {editing && (
        <PermissionsModal
          user={editing}
          onClose={() => setEditingId(null)}
          onSaved={(updated) => {
            setUsers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
            toast.success('Permissions updated.')
            setEditingId(null)
          }}
        />
      )}

      {resetForId && (
        <ResetPasswordModal
          user={users.find((u) => u.id === resetForId)}
          onClose={() => setResetForId(null)}
          onReset={(newPassword) => {
            window.prompt(
              'New password — copy this now, it won\'t be shown again:',
              newPassword,
            )
            toast.success('Password reset.')
            setResetForId(null)
          }}
        />
      )}
    </div>
  )
}

const CreateUserModal = ({ onClose, onCreated }) => {
  const [username, setUsername] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('admin_staff')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [err, setErr] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    if (!username.trim() || !email.trim()) return setErr('Username and email are required.')
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) return setErr('Please enter a valid email address.')
    if (password && password.length < 10) {
      return setErr('Password must be at least 10 characters (or leave blank for an auto-generated one).')
    }
    setSubmitting(true)
    try {
      const body = {
        username: username.trim(),
        email: email.trim().toLowerCase(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        role,
        phone: phone.trim(),
      }
      if (password) body.password = password
      const { data } = await userAPI.create(body)
      onCreated(data, data.initial_password)
    } catch (e) {
      const data = e.response?.data
      const detail = data?.detail
        || (typeof data === 'object' && data ? Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' · ') : null)
        || 'Could not create user.'
      setErr(detail)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Create User Login" onClose={onClose}>
      <form onSubmit={submit}>
        {err && <div className="alert alert-danger">{err}</div>}
        <div className="row gap-2">
          <div className="col-6">
            <div className="form-group">
              <label>Username *</label>
              <input className="form-control" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. anwankwo" autoComplete="off" />
            </div>
          </div>
          <div className="col-6">
            <div className="form-group">
              <label>Email *</label>
              <div className="input-with-icon">
                <Mail size={16} />
                <input className="form-control" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@cca.gov.ng" autoComplete="off" />
              </div>
            </div>
          </div>
          <div className="col-6">
            <div className="form-group">
              <label>First Name</label>
              <input className="form-control" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
          </div>
          <div className="col-6">
            <div className="form-group">
              <label>Last Name</label>
              <input className="form-control" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div className="col-6">
            <div className="form-group">
              <label>Role</label>
              <select className="form-control" value={role} onChange={(e) => setRole(e.target.value)}>
                {ASSIGNABLE_ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
            </div>
          </div>
          <div className="col-6">
            <div className="form-group">
              <label>Phone</label>
              <input className="form-control" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+234 …" />
            </div>
          </div>
          <div className="col-12">
            <div className="form-group">
              <label>Initial Password</label>
              <div className="input-with-icon">
                <Lock size={16} />
                <input className="form-control" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Leave blank to auto-generate" autoComplete="new-password" />
              </div>
              <div className="muted small">
                Must be ≥10 chars, with one uppercase, one digit and one symbol. Auto-generated passwords meet this policy.
              </div>
            </div>
          </div>
        </div>
        <div className="d-flex gap-1" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            <UserPlus size={16} /> {submitting ? 'Creating…' : 'Create User'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

const PermissionsModal = ({ user, onClose, onSaved }) => {
  const initialOverride = user.permissions_override || {}
  const [override, setOverride] = useState(initialOverride)
  const [saving, setSaving] = useState(false)

  const isOn = (key) => {
    if (key in override) return Boolean(override[key])
    // Fall back to the resolved permission the backend computed for this user.
    return Boolean(user.permissions?.[key])
  }
  const toggle = (key) => {
    setOverride((prev) => ({ ...prev, [key]: !isOn(key) }))
  }

  const resetToRoleDefaults = () => setOverride({})

  const save = async () => {
    setSaving(true)
    try {
      const { data } = await userAPI.update(user.id, { permissions_override: override })
      onSaved(data)
    } catch (err) {
      const data = err.response?.data
      window.alert(data?.detail || JSON.stringify(data) || 'Could not save permissions.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={`Permissions — ${user.full_name || user.username}`}
      subtitle={`${ROLE_LABEL[user.role] || user.role} · ${user.email}`}
      onClose={onClose}
      wide
    >
      <p className="muted">
        Each user inherits a default permission set from their role. Toggle items here
        to override a default on a per-user basis. Reset to role defaults to clear all overrides.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
        {PERMISSION_GROUPS.map((group) => (
          <div key={group.title} className="card">
            <div className="card-head"><div className="card-head-title"><h3 style={{ fontSize: '0.95rem' }}>{group.title}</h3></div></div>
            <div className="card-body">
              {group.items.map((p) => (
                <label key={p.key} className="checkbox" style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0' }}>
                  <span>{p.label}</span>
                  <input type="checkbox" checked={isOn(p.key)} onChange={() => toggle(p.key)} />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="d-flex gap-1" style={{ justifyContent: 'space-between', marginTop: '1rem' }}>
        <button type="button" className="btn btn-outline" onClick={resetToRoleDefaults}>
          <RefreshCw size={14} /> Reset to role defaults
        </button>
        <div className="d-flex gap-1">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
            <Check size={14} /> {saving ? 'Saving…' : 'Save Permissions'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

const ResetPasswordModal = ({ user, onClose, onReset }) => {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async () => {
    setBusy(true); setErr('')
    try {
      const { data } = await userAPI.resetPassword(user.id)
      onReset(data.new_password)
    } catch (e) {
      setErr(e.response?.data?.detail || 'Could not reset password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={`Reset Password — ${user.full_name || user.username}`}
      subtitle={user.email}
      onClose={onClose}
    >
      {err && <div className="alert alert-danger">{err}</div>}
      <p className="muted">
        The user's password will be replaced with a randomly-generated 12-character
        string. They will be required to change it the next time they sign in.
        Any active sessions or API tokens belonging to this user will be invalidated.
      </p>
      <div className="d-flex gap-1" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
        <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>
          <KeyRound size={14} /> {busy ? 'Resetting…' : 'Generate New Password'}
        </button>
      </div>
    </Modal>
  )
}

const Modal = ({ title, subtitle, onClose, children, wide }) => (
  <div
    onClick={onClose}
    style={{
      position: 'fixed', inset: 0, background: 'rgba(15, 37, 56, 0.55)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '4rem 1rem', zIndex: 1000, overflowY: 'auto',
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      className="card"
      style={{ width: '100%', maxWidth: wide ? 920 : 520 }}
    >
      <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="card-head-title">
          <Users size={18} className="card-head-icon" />
          <div>
            <h3>{title}</h3>
            {subtitle && <div className="muted small">{subtitle}</div>}
          </div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
      </div>
      <div className="card-body">{children}</div>
    </div>
  </div>
)

export default UserManagement
