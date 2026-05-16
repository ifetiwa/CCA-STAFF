import { useEffect, useMemo, useState } from 'react'
import {
  Users, UserPlus, Shield, KeyRound, Trash2, Pencil, X, Check, Mail, Lock,
  Building2, BadgeCheck, BadgeAlert, RefreshCw, Search,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import {
  listUsers, createUser, updateUser, deleteUser, resetPassword,
  setPermissions, applyRolePreset,
} from '../data/users'
import { PERMISSIONS, ROLE_NAMES, ROLE_PRESETS } from '../data/permissions'

const groupBy = (items, key) =>
  items.reduce((acc, it) => {
    (acc[it[key]] ||= []).push(it)
    return acc
  }, {})

const UserManagement = () => {
  const { user: me, can } = useAuth()
  const toast = useToast()
  const [users, setUsers] = useState(() => listUsers())
  const [query, setQuery] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [resetForId, setResetForId] = useState(null)

  useEffect(() => {
    const onChange = () => setUsers(listUsers())
    window.addEventListener('cca:users-changed', onChange)
    return () => window.removeEventListener('cca:users-changed', onChange)
  }, [])

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
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q) ||
      (u.department || '').toLowerCase().includes(q)
    )
  }, [users, query])

  const handleToggleActive = (u) => {
    updateUser(u.id, { active: !u.active })
    toast.success(`${u.name} is now ${!u.active ? 'active' : 'deactivated'}.`)
  }

  const handleDelete = (u) => {
    if (u.id === me.id) return toast.error('You cannot delete your own account.')
    if (u.role === 'Super Administrator') return toast.error('Super Administrator cannot be deleted.')
    if (!window.confirm(`Permanently remove ${u.name} (${u.email})?`)) return
    deleteUser(u.id)
    toast.success(`${u.name} removed.`)
  }

  const handleRoleChange = (u, role) => {
    applyRolePreset(u.id, role)
    toast.success(`${u.name} is now ${role}. Permissions reset to the role preset.`)
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
              placeholder="Search by name, email, role or department…"
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
                <th>Department</th>
                <th>Status</th>
                <th>Permissions</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="cell-user">
                      <span className="cell-avatar">{(u.name[0] + (u.name.split(' ')[1]?.[0] || '')).toUpperCase()}</span>
                      <div>
                        <div className="cell-user-name">{u.name}{u.id === me.id && <span className="muted small"> · you</span>}</div>
                        <div className="muted small">{u.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="muted small">{u.email}</td>
                  <td>
                    {u.role === 'Super Administrator' ? (
                      <span className="badge badge-warning">{u.role}</span>
                    ) : (
                      <select
                        className="form-control"
                        value={u.role}
                        onChange={(e) => handleRoleChange(u, e.target.value)}
                        style={{ minWidth: 170 }}
                      >
                        {ROLE_NAMES.filter((r) => r !== 'Super Administrator').map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="muted small">{u.department || '—'}</td>
                  <td>
                    <span className={`badge badge-${u.active ? 'success' : 'warning'}`}>
                      {u.active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="muted small">{u.permissions.length} granted</td>
                  <td className="text-right">
                    <div className="action-group">
                      <button className="action-btn" title="Edit permissions" onClick={() => setEditingId(u.id)}>
                        <Shield size={16} />
                      </button>
                      <button className="action-btn" title="Reset password" onClick={() => setResetForId(u.id)}>
                        <KeyRound size={16} />
                      </button>
                      <button
                        className="action-btn"
                        title={u.active ? 'Deactivate' : 'Activate'}
                        onClick={() => handleToggleActive(u)}
                        disabled={u.id === me.id}
                      >
                        {u.active ? <BadgeAlert size={16} /> : <BadgeCheck size={16} />}
                      </button>
                      <button
                        className="action-btn action-btn--danger"
                        title="Delete user"
                        onClick={() => handleDelete(u)}
                        disabled={u.id === me.id || u.role === 'Super Administrator'}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="empty-row">No users match your search.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={(u) => { toast.success(`${u.name} created. They can now sign in with their email and password.`); setShowCreate(false) }}
        />
      )}

      {editing && (
        <PermissionsModal
          user={editing}
          onClose={() => setEditingId(null)}
          onSaved={() => { toast.success('Permissions updated.'); setEditingId(null) }}
        />
      )}

      {resetForId && (
        <ResetPasswordModal
          user={users.find((u) => u.id === resetForId)}
          onClose={() => setResetForId(null)}
          onSaved={() => { toast.success('Password reset.'); setResetForId(null) }}
        />
      )}
    </div>
  )
}

const CreateUserModal = ({ onClose, onCreated }) => {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [department, setDepartment] = useState('')
  const [role, setRole] = useState('Staff')
  const [password, setPassword] = useState('Welcome@2026')
  const [err, setErr] = useState('')

  const submit = (e) => {
    e.preventDefault()
    setErr('')
    if (!name.trim() || !email.trim() || !password) return setErr('Name, email and password are required.')
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) return setErr('Please enter a valid email address.')
    if (password.length < 8) return setErr('Password must be at least 8 characters.')
    const u = createUser({ name, email, department, role, password, permissions: ROLE_PRESETS[role] })
    onCreated(u)
  }

  return (
    <Modal title="Create User Login" onClose={onClose}>
      <form onSubmit={submit}>
        {err && <div className="alert alert-danger">{err}</div>}
        <div className="form-group">
          <label>Full Name</label>
          <input className="form-control" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Adaeze Nwankwo" />
        </div>
        <div className="form-group">
          <label>Email</label>
          <div className="input-with-icon">
            <Mail size={16} />
            <input className="form-control" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@cca.gov.ng" />
          </div>
        </div>
        <div className="row gap-2">
          <div className="col-6">
            <div className="form-group">
              <label>Role</label>
              <select className="form-control" value={role} onChange={(e) => setRole(e.target.value)}>
                {ROLE_NAMES.filter((r) => r !== 'Super Administrator').map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div className="col-6">
            <div className="form-group">
              <label>Department</label>
              <div className="input-with-icon">
                <Building2 size={16} />
                <input className="form-control" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Registry" />
              </div>
            </div>
          </div>
        </div>
        <div className="form-group">
          <label>Initial Password</label>
          <div className="input-with-icon">
            <Lock size={16} />
            <input className="form-control" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="muted small">User can change this from Settings → Security after first sign-in.</div>
        </div>
        <div className="d-flex gap-1" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary"><UserPlus size={16} /> Create User</button>
        </div>
      </form>
    </Modal>
  )
}

const PermissionsModal = ({ user, onClose, onSaved }) => {
  const [granted, setGranted] = useState(new Set(user.permissions))
  const grouped = groupBy(PERMISSIONS, 'group')
  const isSuper = user.role === 'Super Administrator'

  const toggle = (k) => {
    if (isSuper) return
    const next = new Set(granted)
    next.has(k) ? next.delete(k) : next.add(k)
    setGranted(next)
  }

  const resetToPreset = () => {
    setGranted(new Set(ROLE_PRESETS[user.role] || []))
  }

  const save = () => {
    setPermissions(user.id, [...granted])
    onSaved()
  }

  return (
    <Modal title={`Permissions — ${user.name}`} subtitle={`${user.role} · ${user.email}`} onClose={onClose} wide>
      {isSuper && (
        <div className="alert alert-info">
          The Super Administrator always has every permission and cannot be edited.
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
        {Object.entries(grouped).map(([group, perms]) => (
          <div key={group} className="card">
            <div className="card-head"><div className="card-head-title"><h3 style={{ fontSize: '0.95rem' }}>{group}</h3></div></div>
            <div className="card-body">
              {perms.map((p) => (
                <label key={p.key} className="checkbox" style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0' }}>
                  <span>{p.label}</span>
                  <input
                    type="checkbox"
                    checked={isSuper || granted.has(p.key)}
                    onChange={() => toggle(p.key)}
                    disabled={isSuper}
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="d-flex gap-1" style={{ justifyContent: 'space-between', marginTop: '1rem' }}>
        <button type="button" className="btn btn-outline" onClick={resetToPreset} disabled={isSuper}>
          <RefreshCw size={14} /> Reset to {user.role} preset
        </button>
        <div className="d-flex gap-1">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={isSuper}>
            <Check size={14} /> Save Permissions
          </button>
        </div>
      </div>
    </Modal>
  )
}

const ResetPasswordModal = ({ user, onClose, onSaved }) => {
  const [pwd, setPwd] = useState('')
  const [err, setErr] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (pwd.length < 8) return setErr('Password must be at least 8 characters.')
    resetPassword(user.id, pwd)
    onSaved()
  }

  return (
    <Modal title={`Reset Password — ${user.name}`} subtitle={user.email} onClose={onClose}>
      <form onSubmit={submit}>
        {err && <div className="alert alert-danger">{err}</div>}
        <div className="form-group">
          <label>New Password</label>
          <div className="input-with-icon">
            <Lock size={16} />
            <input className="form-control" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="At least 8 characters" />
          </div>
        </div>
        <div className="d-flex gap-1" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary"><KeyRound size={14} /> Reset Password</button>
        </div>
      </form>
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
