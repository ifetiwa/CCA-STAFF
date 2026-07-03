import { useEffect, useMemo, useState } from 'react'
import {
  CheckSquare, Plus, X, Calendar, Flag, User as UserIcon, Trash2, Check,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { listTasks, createTask, updateTask, deleteTask } from '../data/tasks'
import { listUsers, getUserById, loadUsers } from '../utils/userDirectory'

const STATUSES = ['Pending', 'In Progress', 'Completed', 'Blocked']
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical']

const priorityTone = (p) => ({ Low: 'info', Medium: 'primary', High: 'warning', Critical: 'danger' }[p] || 'primary')
const statusTone = (s) => ({ Pending: 'warning', 'In Progress': 'info', Completed: 'success', Blocked: 'danger' }[s] || 'primary')

const Tasks = () => {
  const { user: me, can } = useAuth()
  const toast = useToast()
  const [tasks, setTasks] = useState(() => listTasks())
  const [users, setUsers] = useState(() => listUsers())
  const [view, setView] = useState(can('assign_tasks') ? 'all' : 'mine')
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    const onTasks = () => setTasks(listTasks())
    const onUsers = () => setUsers(listUsers())
    window.addEventListener('cca:tasks-changed', onTasks)
    window.addEventListener('cca:users-changed', onUsers)
    // Refresh the user directory from the API (updates the cache + fires
    // cca:users-changed, which sets our local state via onUsers).
    loadUsers()
    return () => {
      window.removeEventListener('cca:tasks-changed', onTasks)
      window.removeEventListener('cca:users-changed', onUsers)
    }
  }, [])

  const visible = useMemo(() => {
    if (view === 'mine') return tasks.filter((t) => t.assigneeId === me?.id)
    return tasks
  }, [tasks, view, me?.id])

  const handleStatus = (t, status) => {
    updateTask(t.id, { status })
    if (status === 'Completed') toast.success('Task marked complete.')
  }

  const handleDelete = (t) => {
    if (!can('assign_tasks')) return
    if (!window.confirm(`Delete task "${t.title}"?`)) return
    deleteTask(t.id)
    toast.success('Task deleted.')
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Tasks</h1>
          <p className="page-header-sub">
            {can('assign_tasks')
              ? 'Delegate work to your team and track completion.'
              : 'Work assigned to you by your administrator.'}
          </p>
        </div>
        <div className="page-header-actions">
          {can('assign_tasks') && (
            <>
              <div className="profile-tabs" style={{ marginBottom: 0 }}>
                <button className={`profile-tab ${view === 'all' ? 'active' : ''}`} onClick={() => setView('all')}>All Tasks</button>
                <button className={`profile-tab ${view === 'mine' ? 'active' : ''}`} onClick={() => setView('mine')}>Mine</button>
              </div>
              <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                <Plus size={18} /> New Task
              </button>
            </>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-body card-body--flush">
          <table className="table table-modern">
            <thead>
              <tr>
                <th>Task</th>
                <th>Assignee</th>
                <th>Priority</th>
                <th>Due</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((t) => {
                const assignee = getUserById(t.assigneeId)
                const isMine = t.assigneeId === me?.id
                const canEditStatus = isMine || can('assign_tasks')
                return (
                  <tr key={t.id}>
                    <td>
                      <div className="cell-user-name">{t.title}</div>
                      {t.description && <div className="muted small">{t.description}</div>}
                    </td>
                    <td>
                      <div className="cell-user">
                        <span className="cell-avatar" style={{ background: '#1a3a52' }}>
                          {assignee ? (assignee.name[0] + (assignee.name.split(' ')[1]?.[0] || '')).toUpperCase() : '?'}
                        </span>
                        <div>
                          <div className="cell-user-name">{assignee?.name || 'Unassigned'}</div>
                          <div className="muted small">{assignee?.role || ''}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className={`badge badge-${priorityTone(t.priority)}`}>{t.priority}</span></td>
                    <td className="muted small">{t.dueDate || '—'}</td>
                    <td>
                      {canEditStatus ? (
                        <select
                          className="form-control"
                          value={t.status}
                          onChange={(e) => handleStatus(t, e.target.value)}
                          style={{ minWidth: 140 }}
                        >
                          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      ) : (
                        <span className={`badge badge-${statusTone(t.status)}`}>{t.status}</span>
                      )}
                    </td>
                    <td className="text-right">
                      <div className="action-group">
                        {isMine && t.status !== 'Completed' && (
                          <button className="action-btn" title="Mark complete" onClick={() => handleStatus(t, 'Completed')}>
                            <Check size={16} />
                          </button>
                        )}
                        {can('assign_tasks') && (
                          <button className="action-btn action-btn--danger" title="Delete" onClick={() => handleDelete(t)}>
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {visible.length === 0 && (
                <tr><td colSpan={6} className="empty-row">
                  {view === 'mine' ? 'You have no tasks assigned yet.' : 'No tasks created yet.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <CreateTaskModal
          users={users.filter((u) => u.active)}
          onClose={() => setShowCreate(false)}
          onCreated={() => { toast.success('Task assigned.'); setShowCreate(false) }}
          assignedBy={me.id}
        />
      )}
    </div>
  )
}

const CreateTaskModal = ({ users, onClose, onCreated, assignedBy }) => {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assigneeId, setAssigneeId] = useState(users[0]?.id || '')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState('Medium')
  const [err, setErr] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (!title.trim()) return setErr('A task title is required.')
    if (!assigneeId) return setErr('Please choose an assignee.')
    createTask({ title, description, assigneeId, dueDate, priority, assignedBy })
    onCreated()
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15, 37, 56, 0.55)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '4rem 1rem', zIndex: 1000, overflowY: 'auto',
      }}
    >
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: '100%', maxWidth: 560 }}>
        <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="card-head-title">
            <CheckSquare size={18} className="card-head-icon" />
            <h3>Assign New Task</h3>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="card-body">
          <form onSubmit={submit}>
            {err && <div className="alert alert-danger">{err}</div>}
            <div className="form-group">
              <label>Title</label>
              <input className="form-control" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to be done?" />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                className="form-control"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional detail or instructions"
              />
            </div>
            <div className="row gap-2">
              <div className="col-6">
                <div className="form-group">
                  <label><UserIcon size={14} /> Assignee</label>
                  <select className="form-control" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name} — {u.role}</option>)}
                  </select>
                </div>
              </div>
              <div className="col-3">
                <div className="form-group">
                  <label><Flag size={14} /> Priority</label>
                  <select className="form-control" value={priority} onChange={(e) => setPriority(e.target.value)}>
                    {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div className="col-3">
                <div className="form-group">
                  <label><Calendar size={14} /> Due Date</label>
                  <input className="form-control" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="d-flex gap-1" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary"><Plus size={16} /> Create Task</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Tasks
