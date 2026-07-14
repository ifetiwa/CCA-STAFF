import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Gavel, Eye, Edit, UserPlus } from 'lucide-react'
import { useStaff } from '../hooks/useStaff'
import { useAuth } from '../context/AuthContext'

// Fixed judges roll order by Staff ID; any others follow alphabetically.
const JUDGE_ORDER = ['4', '007', '09', '10']
const judgeRank = (s) => {
  const i = JUDGE_ORDER.indexOf(String(s.staffId))
  return i === -1 ? Number.POSITIVE_INFINITY : i
}

const Judges = () => {
  const navigate = useNavigate()
  const staff = useStaff()
  const { can } = useAuth()

  const judges = useMemo(() => {
    const nameKey = (s) =>
      `${s.lastName || ''} ${s.firstName || ''}`.trim().toLowerCase() || (s.fullName || '').toLowerCase()
    return staff
      .filter((s) => s.organizationalRole === 'Judge')
      .sort((a, b) => {
        const r = judgeRank(a) - judgeRank(b)
        if (r !== 0) return r
        return nameKey(a).localeCompare(nameKey(b), 'en')
      })
  }, [staff])

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Judges</h1>
          <p className="page-header-sub">
            {judges.length} judge{judges.length === 1 ? '' : 's'} of the Customary Court of Appeal.
          </p>
        </div>
        <div className="page-header-actions">
          {can('create_staff') && (
            <button className="btn btn-primary" onClick={() => navigate('/add-staff?role=Judge')}>
              <UserPlus size={18} />
              Add Judge
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-body card-body--flush">
          <div className="table-scroll">
            <table className="table table-modern">
              <thead>
                <tr>
                  <th style={{ width: 44 }}>#</th>
                  <th>Judge</th>
                  <th>Designation</th>
                  <th>Department</th>
                  <th>Duty Station</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {judges.length > 0 ? (
                  judges.map((s, i) => (
                    <tr key={s.id}>
                      <td className="muted small" style={{ fontVariantNumeric: 'tabular-nums' }}>{i + 1}</td>
                      <td>
                        <div className="cell-user">
                          {s.photoDataUrl
                            ? <img src={s.photoDataUrl} alt={s.fullName} className="cell-avatar cell-avatar-photo" />
                            : <span className="cell-avatar">{s.initials}</span>}
                          <div>
                            <div className="cell-user-name">{s.fullName}</div>
                            <div className="muted small">{s.staffId}</div>
                          </div>
                        </div>
                      </td>
                      <td>{s.designation}</td>
                      <td>{s.department ? <span className="chip">{s.department}</span> : '—'}</td>
                      <td className="muted small">{s.postingLocation || '—'}</td>
                      <td className="text-right">
                        <div className="action-group">
                          <button className="action-btn" title="View" onClick={() => navigate(`/staff/${s.id}`)}>
                            <Eye size={16} />
                          </button>
                          {can('edit_staff') && (
                            <button className="action-btn" title="Edit" onClick={() => navigate(`/staff/${s.id}/edit`)}>
                              <Edit size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="empty-row">
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '1rem' }}>
                        <Gavel size={28} className="muted" />
                        <div>No judges yet.</div>
                        <div className="muted small">
                          Add one via <strong>Add New Staff</strong> and set <strong>Organizational Role → Judge</strong>.
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Judges
