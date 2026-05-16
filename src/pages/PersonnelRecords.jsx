import { useEffect, useMemo, useRef, useState } from 'react'
import { FileText, Download, Upload, Search, Filter, X, LayoutGrid, List, ChevronDown, ChevronRight } from 'lucide-react'
import { downloadCsv } from '../utils/download'
import { useToast } from '../context/ToastContext'
import { getAllStaff, subscribeStaff } from '../data/staff'
import { listDepartmentNames, subscribeDepartments, colorFor } from '../data/departments'

const DOCUMENT_TYPES = [
  'Appointment Letter',
  'Promotion Memo',
  'Training Certificate',
  'Leave Application',
  'Performance Appraisal',
  'Disciplinary Notice',
  'Confirmation Letter',
  'Transfer Memo',
  'Educational Certificate',
  'Other',
]

const SEED_RECORDS = [
  { id: 'REC-2026-0142', staffId: 1, staff: 'Chisom Adiala',  type: 'Appointment Letter',     dept: 'Litigation Department',                       date: '2026-04-12', size: '124 KB', sizeBytes: 124 * 1024 },
  { id: 'REC-2026-0141', staffId: 2, staff: 'Fatima Ibrahim', type: 'Promotion Memo',         dept: 'Administration Department',                   date: '2026-04-09', size: '88 KB',  sizeBytes: 88 * 1024 },
  { id: 'REC-2026-0140', staffId: 3, staff: 'Emeka Okonkwo',  type: 'Training Certificate',   dept: 'Litigation Department',                       date: '2026-04-02', size: '212 KB', sizeBytes: 212 * 1024 },
  { id: 'REC-2026-0139', staffId: 4, staff: 'Grace Oduwole',  type: 'Leave Application',      dept: 'Administration Department',                   date: '2026-03-28', size: '54 KB',  sizeBytes: 54 * 1024 },
  { id: 'REC-2026-0138', staffId: 5, staff: 'Ahmed Hassan',   type: 'Performance Appraisal',  dept: 'Litigation Department',                       date: '2026-03-21', size: '167 KB', sizeBytes: 167 * 1024 },
  { id: 'REC-2026-0137', staffId: 8, staff: 'Victoria Ekpo',  type: 'Disciplinary Notice',    dept: 'Litigation Department',                       date: '2026-03-18', size: '76 KB',  sizeBytes: 76 * 1024 },
  { id: 'REC-2026-0136', staffId: 6, staff: 'Zainab Ahmed',   type: 'Appointment Letter',     dept: 'Planning, Research & Statistics Department',  date: '2026-03-09', size: '118 KB', sizeBytes: 118 * 1024 },
]

const humanSize = (bytes) => {
  if (!bytes) return '0 KB'
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

const newDocId = (existing) => {
  const yr = new Date().getFullYear()
  const sameYear = existing.filter((r) => r.id?.startsWith(`REC-${yr}-`))
  const next = sameYear.length + existing.length + 1
  return `REC-${yr}-${String(next).padStart(4, '0')}`
}

const PersonnelRecords = () => {
  const toast = useToast()
  const [items, setItems] = useState(SEED_RECORDS)
  const [staffList, setStaffList] = useState(() => getAllStaff())
  const [departments, setDepartments] = useState(() => listDepartmentNames())
  const [query, setQuery] = useState('')
  const [type, setType] = useState('all')
  const [deptFilter, setDeptFilter] = useState('all')
  const [view, setView] = useState('list') // 'list' | 'grouped'
  const [uploadOpen, setUploadOpen] = useState(false)

  useEffect(() => subscribeStaff(setStaffList), [])
  useEffect(() => subscribeDepartments(() => setDepartments(listDepartmentNames())), [])

  const types = useMemo(
    () => ['all', ...Array.from(new Set([...DOCUMENT_TYPES, ...items.map((r) => r.type).filter(Boolean)]))],
    [items],
  )

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return items.filter((r) => {
      const hay = `${r.staff} ${r.id} ${r.type} ${r.dept}`.toLowerCase()
      if (q && !hay.includes(q)) return false
      if (type !== 'all' && r.type !== type) return false
      if (deptFilter !== 'all' && r.dept !== deptFilter) return false
      return true
    })
  }, [items, query, type, deptFilter])

  const grouped = useMemo(() => {
    const map = new Map()
    departments.forEach((d) => map.set(d, []))
    filtered.forEach((r) => {
      const key = r.dept && r.dept !== '—' ? r.dept : 'Unassigned'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(r)
    })
    return Array.from(map.entries())
      .map(([dept, records]) => ({ dept, records }))
      .sort((a, b) => b.records.length - a.records.length)
  }, [filtered, departments])

  const stats = useMemo(() => {
    const now = new Date()
    const thisMonth = items.filter((r) => {
      const d = new Date(r.date)
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    }).length
    const unassigned = items.filter((r) => !r.staffId).length
    const totalBytes = items.reduce((s, r) => s + (r.sizeBytes || 0), 0)
    return {
      total: items.length,
      thisMonth,
      unassigned,
      storage: humanSize(totalBytes),
    }
  }, [items])

  const handleExport = () => {
    downloadCsv(
      filtered.map((r) => ({ id: r.id, staff: r.staff, type: r.type, dept: r.dept, date: r.date, size: r.size })),
      ['id', 'staff', 'type', 'dept', 'date', 'size'],
      `cca-records-${new Date().toISOString().slice(0, 10)}.csv`,
    )
    toast.success(`Exported ${filtered.length} record(s).`)
  }

  const handleDownloadDoc = (r) => toast.info(`Demo only — would download ${r.id}.`)

  const handleUploadSubmit = (payload) => {
    const added = payload.files.map((f, idx) => ({
      id: newDocId([...items, ...Array(idx).fill(null).filter(Boolean)]),
      staffId: payload.staff.id,
      staff: payload.staff.fullName,
      type: payload.type === 'Other' ? (payload.customType || 'Uploaded Document') : payload.type,
      dept: payload.staff.department || '—',
      date: new Date().toISOString().slice(0, 10),
      size: humanSize(f.size),
      sizeBytes: f.size,
      notes: payload.notes || '',
    }))
    setItems((prev) => [...added, ...prev])
    toast.success(`Uploaded ${added.length} document(s) for ${payload.staff.fullName}.`)
    setUploadOpen(false)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Personnel Records</h1>
          <p className="page-header-sub">Centralised store for personnel documents and certifications.</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline" onClick={() => setUploadOpen(true)}>
            <Upload size={18} /> Upload Document
          </button>
          <button className="btn btn-primary" onClick={handleExport}>
            <Download size={18} /> Export
          </button>
        </div>
      </div>

      <div className="row gap-3 mb-3">
        <StatTile color="#1a3a52" label="Total Documents" value={stats.total} />
        <StatTile color="#27ae60" label="Uploaded This Month" value={stats.thisMonth} />
        <StatTile color="#f39c12" label="Unassigned" value={stats.unassigned} />
        <StatTile color="#3498db" label="Storage Used" value={stats.storage} />
      </div>

      <div className="card mb-3">
        <div className="card-body">
          <div className="row gap-2">
            <div className="col-5">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Search records</label>
                <div className="input-with-icon">
                  <Search size={18} />
                  <input className="form-control" placeholder="Search by staff, document ID or type…"
                    value={query} onChange={(e) => setQuery(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="col-3">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Document Type</label>
                <select className="form-control" value={type} onChange={(e) => setType(e.target.value)}>
                  {types.map((t) => <option key={t} value={t}>{t === 'all' ? 'All Types' : t}</option>)}
                </select>
              </div>
            </div>
            <div className="col-2">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Department</label>
                <select className="form-control" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
                  <option value="all">All Departments</option>
                  {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
            <div className="col-2" style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button className="btn btn-outline" style={{ width: '100%' }}
                onClick={() => { setQuery(''); setType('all'); setDeptFilter('all') }}>
                <Filter size={18} /> Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div className="muted small">
          Showing <strong>{filtered.length}</strong> of {items.length} record(s)
        </div>
        <div className="btn-group" role="group" style={{ display: 'inline-flex', gap: 4 }}>
          <button
            className={`btn btn-sm ${view === 'list' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setView('list')}
          >
            <List size={14} /> List
          </button>
          <button
            className={`btn btn-sm ${view === 'grouped' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setView('grouped')}
          >
            <LayoutGrid size={14} /> By Department
          </button>
        </div>
      </div>

      {view === 'list' ? (
        <RecordsTable records={filtered} onDownload={handleDownloadDoc} />
      ) : (
        <GroupedView groups={grouped} onDownload={handleDownloadDoc} />
      )}

      {uploadOpen && (
        <UploadDialog
          staffList={staffList}
          onClose={() => setUploadOpen(false)}
          onSubmit={handleUploadSubmit}
        />
      )}
    </div>
  )
}

const RecordsTable = ({ records, onDownload }) => (
  <div className="card">
    <div className="card-body" style={{ padding: 0 }}>
      <table className="table">
        <thead>
          <tr>
            <th>Document ID</th>
            <th>Staff</th>
            <th>Type</th>
            <th>Department</th>
            <th>Date</th>
            <th>Size</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id}>
              <td><strong style={{ color: '#1a3a52' }}>{r.id}</strong></td>
              <td>{r.staff}</td>
              <td><span className="chip"><FileText size={14} /> {r.type}</span></td>
              <td>{r.dept}</td>
              <td>{r.date}</td>
              <td>{r.size}</td>
              <td>
                <button className="btn btn-sm btn-outline" title="Download" onClick={() => onDownload(r)}>
                  <Download size={14} />
                </button>
              </td>
            </tr>
          ))}
          {records.length === 0 && (
            <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }} className="muted">
              No records match your filters.
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
)

const GroupedView = ({ groups, onDownload }) => {
  const [collapsed, setCollapsed] = useState(() => new Set())
  const toggle = (dept) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(dept)) next.delete(dept); else next.add(dept)
      return next
    })
  }
  const nonEmpty = groups.filter((g) => g.records.length > 0)
  if (nonEmpty.length === 0) {
    return (
      <div className="card"><div className="card-body">
        <div className="muted" style={{ textAlign: 'center', padding: '1.5rem' }}>
          No records match your filters.
        </div>
      </div></div>
    )
  }
  return (
    <div className="row gap-3">
      {nonEmpty.map(({ dept, records }) => {
        const isCollapsed = collapsed.has(dept)
        const color = colorFor(dept)
        return (
          <div className="col-12" key={dept}>
            <div className="card">
              <button
                type="button"
                onClick={() => toggle(dept)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '0.85rem 1.1rem', background: color, color: '#fff',
                  border: 'none', cursor: 'pointer', borderTopLeftRadius: 'inherit', borderTopRightRadius: 'inherit',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                  <strong>{dept}</strong>
                  <span style={{ opacity: 0.85, fontWeight: 400 }}>· {records.length} document{records.length === 1 ? '' : 's'}</span>
                </span>
              </button>
              {!isCollapsed && (
                <div className="card-body" style={{ padding: 0 }}>
                  <table className="table" style={{ marginBottom: 0 }}>
                    <thead>
                      <tr>
                        <th>Document ID</th>
                        <th>Staff</th>
                        <th>Type</th>
                        <th>Date</th>
                        <th>Size</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((r) => (
                        <tr key={r.id}>
                          <td><strong style={{ color: '#1a3a52' }}>{r.id}</strong></td>
                          <td>{r.staff}</td>
                          <td><span className="chip"><FileText size={14} /> {r.type}</span></td>
                          <td>{r.date}</td>
                          <td>{r.size}</td>
                          <td>
                            <button className="btn btn-sm btn-outline" title="Download" onClick={() => onDownload(r)}>
                              <Download size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

const UploadDialog = ({ staffList, onClose, onSubmit }) => {
  const fileInput = useRef(null)
  const [search, setSearch] = useState('')
  const [selectedStaff, setSelectedStaff] = useState(null)
  const [docType, setDocType] = useState('')
  const [customType, setCustomType] = useState('')
  const [notes, setNotes] = useState('')
  const [files, setFiles] = useState([])
  const [error, setError] = useState('')

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return staffList.slice(0, 8)
    return staffList.filter((s) =>
      `${s.fullName} ${s.staffId} ${s.email} ${s.department}`.toLowerCase().includes(q),
    ).slice(0, 8)
  }, [search, staffList])

  const handlePickFiles = (e) => {
    const picked = Array.from(e.target.files || [])
    setFiles(picked)
  }

  const submit = (e) => {
    e.preventDefault()
    if (!selectedStaff) return setError('Please select the staff member this document belongs to.')
    if (!docType) return setError('Please choose a document type.')
    if (docType === 'Other' && !customType.trim()) return setError('Please describe the document type.')
    if (files.length === 0) return setError('Please choose at least one file to upload.')
    setError('')
    onSubmit({ staff: selectedStaff, type: docType, customType, notes, files })
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        zIndex: 1000, padding: '4rem 1rem 1rem',
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ width: '100%', maxWidth: 640, maxHeight: 'calc(100vh - 6rem)', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: '#fff' }}>Upload Document</h3>
          <button className="btn btn-sm btn-ghost" onClick={onClose} aria-label="Close" style={{ color: '#fff' }}>
            <X size={16} />
          </button>
        </div>
        <form onSubmit={submit} className="card-body">
          <div className="form-group">
            <label>Assign to staff *</label>
            {selectedStaff ? (
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.6rem 0.8rem', border: '1px solid #d6dde4', borderRadius: 6, background: '#f8fafc',
              }}>
                <div>
                  <strong>{selectedStaff.fullName}</strong>
                  <div className="muted small">
                    {selectedStaff.staffId} · {selectedStaff.department || 'No department'} · {selectedStaff.designation || '—'}
                  </div>
                </div>
                <button type="button" className="btn btn-sm btn-outline" onClick={() => { setSelectedStaff(null); setSearch('') }}>
                  Change
                </button>
              </div>
            ) : (
              <>
                <div className="input-with-icon">
                  <Search size={18} />
                  <input
                    className="form-control"
                    placeholder="Search by name, staff ID, email or department…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    autoFocus
                  />
                </div>
                <div style={{
                  border: '1px solid #e2e8f0', borderRadius: 6, marginTop: 6,
                  maxHeight: 220, overflowY: 'auto', background: '#fff',
                }}>
                  {matches.length === 0 ? (
                    <div className="muted" style={{ padding: '0.75rem 1rem' }}>No staff match that search.</div>
                  ) : matches.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedStaff(s)}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        padding: '0.55rem 0.9rem', background: '#fff',
                        border: 'none', borderBottom: '1px solid #f1f5f9', cursor: 'pointer',
                      }}
                    >
                      <strong>{s.fullName}</strong>
                      <div className="muted small">
                        {s.staffId} · {s.department || 'No department'} · {s.designation || '—'}
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="row gap-2">
            <div className="col-6">
              <div className="form-group">
                <label>Document type *</label>
                <select className="form-control" value={docType} onChange={(e) => setDocType(e.target.value)}>
                  <option value="">—</option>
                  {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="col-6">
              <div className="form-group">
                <label>Department (auto)</label>
                <input
                  className="form-control"
                  value={selectedStaff?.department || ''}
                  readOnly
                  placeholder="Set automatically from staff"
                />
              </div>
            </div>
          </div>

          {docType === 'Other' && (
            <div className="form-group">
              <label>Describe document type *</label>
              <input className="form-control" value={customType} onChange={(e) => setCustomType(e.target.value)} />
            </div>
          )}

          <div className="form-group">
            <label>Files *</label>
            <input
              ref={fileInput}
              type="file"
              multiple
              onChange={handlePickFiles}
              className="form-control"
            />
            {files.length > 0 && (
              <div className="muted small" style={{ marginTop: 6 }}>
                {files.map((f) => `${f.name} (${humanSize(f.size)})`).join(', ')}
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Notes (optional)</label>
            <textarea
              className="form-control"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Original received from Registry on 2026-05-10"
            />
          </div>

          {error && <div className="alert alert-danger" style={{ marginBottom: '0.75rem' }}>{error}</div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">
              <Upload size={16} /> Upload
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const StatTile = ({ color, label, value }) => (
  <div className="col-3">
    <div className="card">
      <div className="card-body">
        <div className="muted" style={{ fontSize: '0.9rem' }}>{label}</div>
        <div style={{ color, fontSize: '2rem', fontWeight: 700 }}>{value}</div>
      </div>
    </div>
  </div>
)

export default PersonnelRecords
