import { useState } from 'react'
import { Clock, User, FileEdit, Trash2, LogIn, ShieldCheck, Download } from 'lucide-react'
import { downloadCsv } from '../utils/download'
import { useToast } from '../context/ToastContext'

const events = [
  { id: 1, type: 'update', user: 'Adaobi N.', action: 'Updated profile for Chisom Adiala', target: 'CCA-0001', time: '2026-05-14 09:42' },
  { id: 2, type: 'create', user: 'HR System', action: 'Added new staff Grace Oduwole', target: 'CCA-0008', time: '2026-05-13 16:01' },
  { id: 3, type: 'login', user: 'Yusuf B.', action: 'Signed in from Abuja (Chrome)', target: '—', time: '2026-05-13 08:12' },
  { id: 4, type: 'update', user: 'Adaobi N.', action: 'Edited employment details for Ahmed Hassan', target: 'CCA-0005', time: '2026-05-12 14:30' },
  { id: 5, type: 'delete', user: 'Yusuf B.', action: 'Removed expired training certificate', target: 'REC-2025-0844', time: '2026-05-12 11:08' },
  { id: 6, type: 'permission', user: 'System', action: 'Granted HR role to Adaobi N.', target: 'user:14', time: '2026-05-10 17:45' },
  { id: 7, type: 'login', user: 'Adaobi N.', action: 'Signed in from Abuja (Edge)', target: '—', time: '2026-05-10 08:00' },
]

const meta = {
  update: { icon: FileEdit, color: '#3498db', label: 'Update' },
  create: { icon: User, color: '#27ae60', label: 'Create' },
  delete: { icon: Trash2, color: '#e74c3c', label: 'Delete' },
  login: { icon: LogIn, color: '#1a3a52', label: 'Sign-in' },
  permission: { icon: ShieldCheck, color: '#d4a574', label: 'Permission' },
}

const AuditTrail = () => {
  const [filter, setFilter] = useState('all')
  const toast = useToast()
  const filtered = filter === 'all' ? events : events.filter((e) => e.type === filter)

  const handleExport = () => {
    downloadCsv(filtered, ['time', 'type', 'user', 'action', 'target'], `cca-audit-${new Date().toISOString().slice(0, 10)}.csv`)
    toast.success(`Exported ${filtered.length} audit event${filtered.length === 1 ? '' : 's'}.`)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Audit Trail</h1>
          <p className="page-header-sub">Every recorded change across the staff register.</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={handleExport}><Download size={18} /> Export Log</button>
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-body" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {['all', ...Object.keys(meta)].map((k) => (
            <button
              key={k}
              className={`chip-btn ${filter === k ? 'active' : ''}`}
              onClick={() => setFilter(k)}
            >
              {k === 'all' ? 'All Events' : meta[k].label}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <ul className="audit-list">
            {filtered.map((e) => {
              const m = meta[e.type]
              const Icon = m.icon
              return (
                <li key={e.id}>
                  <div className="audit-icon" style={{ background: `${m.color}1f`, color: m.color }}>
                    <Icon size={18} />
                  </div>
                  <div className="audit-body">
                    <div className="audit-action">{e.action}</div>
                    <div className="muted audit-meta">
                      <Clock size={14} /> {e.time} · by <strong>{e.user}</strong> · target {e.target}
                    </div>
                  </div>
                  <span className="chip">{m.label}</span>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}

export default AuditTrail
