import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Gavel, Eye, Edit, UserPlus, ChevronUp, ChevronDown } from 'lucide-react'
import { useStaff } from '../hooks/useStaff'
import { useAuth } from '../context/AuthContext'
import { updateStaffFields } from '../data/staff'
import { useToast } from '../context/ToastContext'

// Seed order (Staff ID) used only until an explicit judge_order has been set.
const JUDGE_ORDER = ['4', '007', '09', '10']
const judgeRank = (s) => {
  const i = JUDGE_ORDER.indexOf(String(s.staffId))
  return i === -1 ? Number.POSITIVE_INFINITY : i
}

const Judges = () => {
  const navigate = useNavigate()
  const staff = useStaff()
  const { can } = useAuth()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  // Only Super Admin / Admin (edit_staff) can rearrange the roll.
  const canArrange = can('edit_staff')

  const judges = useMemo(() => {
    const nameKey = (s) =>
      `${s.lastName || ''} ${s.firstName || ''}`.trim().toLowerCase() || (s.fullName || '').toLowerCase()
    return staff
      .filter((s) => s.organizationalRole === 'Judge')
      .sort((a, b) => {
        const oa = typeof a.judgeOrder === 'number' ? a.judgeOrder : Number.POSITIVE_INFINITY
        const ob = typeof b.judgeOrder === 'number' ? b.judgeOrder : Number.POSITIVE_INFINITY
        if (oa !== ob) return oa - ob
        const r = judgeRank(a) - judgeRank(b)
        if (r !== 0) return r
        return nameKey(a).localeCompare(nameKey(b), 'en')
      })
  }, [staff])

  // Move a judge up/down and persist the new order (judge_order = position).
  const move = async (index, dir) => {
    const target = index + dir
    if (busy || target < 0 || target >= judges.length) return
    const arr = [...judges]
    const tmp = arr[index]
    arr[index] = arr[target]
    arr[target] = tmp
    setBusy(true)
    try {
      for (let i = 0; i < arr.length; i += 1) {
        if (arr[i].judgeOrder !== i + 1) {
          await updateStaffFields(arr[i].id, { judge_order: i + 1 })
        }
      }
    } catch (err) {
      toast.error('Could not save the new order. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Judges</h1>
          <p className="page-header-sub">
            {judges.length} judge{judges.length === 1 ? '' : 's'} of the Customary Court of Appeal.
            {canArrange && judges.length > 1 && ' Use the arrows to arrange the order.'}
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
                  {canArrange && <th style={{ width: 72 }}>Order</th>}
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
                      {canArrange && (
                        <td>
                          <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
                            <button
                              className="action-btn"
                              title="Move up"
                              disabled={busy || i === 0}
                              onClick={() => move(i, -1)}
                            >
                              <ChevronUp size={16} />
                            </button>
                            <button
                              className="action-btn"
                              title="Move down"
                              disabled={busy || i === judges.length - 1}
                              onClick={() => move(i, 1)}
                            >
                              <ChevronDown size={16} />
                            </button>
                          </div>
                        </td>
                      )}
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
                    <td colSpan={canArrange ? 7 : 6} className="empty-row">
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
