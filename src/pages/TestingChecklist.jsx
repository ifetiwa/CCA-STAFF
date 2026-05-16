import { useMemo, useState } from 'react'
import { Download, ClipboardCheck, Printer, RotateCcw } from 'lucide-react'
import checklist from '../data/testing_checklist.json'

const STORAGE_KEY = 'cca.testingChecklist.state.v1'
const PDF_URL = `${window.location.protocol}//${window.location.hostname}:8000/reports/testing-checklist/export.pdf`

const loadState = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

const TestingChecklist = () => {
  const [state, setState] = useState(loadState)
  const [filter, setFilter] = useState('all')

  const persist = (next) => {
    setState(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  const setResult = (id, result) => {
    const current = state[id] || {}
    persist({ ...state, [id]: { ...current, result } })
  }

  const setNote = (id, note) => {
    const current = state[id] || {}
    persist({ ...state, [id]: { ...current, note } })
  }

  const reset = () => {
    if (confirm('Clear all Pass/Fail marks and notes for this checklist?')) {
      persist({})
    }
  }

  const stats = useMemo(() => {
    const totals = { total: 0, pass: 0, fail: 0, na: 0, pending: 0 }
    for (const section of checklist.sections) {
      for (const [id] of section.tests) {
        totals.total += 1
        const r = state[id]?.result || 'pending'
        totals[r] = (totals[r] || 0) + 1
      }
    }
    return totals
  }, [state])

  const passRate = stats.total
    ? Math.round((stats.pass / stats.total) * 100)
    : 0

  const showRow = (id) => {
    if (filter === 'all') return true
    return (state[id]?.result || 'pending') === filter
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-header-title">
          <ClipboardCheck size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />
          Pre-Handover Testing Checklist
        </h1>
        <div className="page-header-actions">
          <button className="btn btn-outline" onClick={() => window.print()}>
            <Printer size={18} /> Print
          </button>
          <a className="btn btn-primary" href={PDF_URL} target="_blank" rel="noreferrer">
            <Download size={18} /> Download PDF
          </a>
          <button className="btn btn-outline" onClick={reset}>
            <RotateCcw size={18} /> Reset
          </button>
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontSize: '0.95rem', color: '#555' }}>{checklist.subtitle}</div>
              <div className="muted" style={{ fontSize: '0.85rem' }}>
                Reference date: {checklist.reference_date} · {stats.total} test cases across {checklist.sections.length} sections
              </div>
            </div>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <Stat label="Pass" value={stats.pass} color="#27ae60" />
              <Stat label="Fail" value={stats.fail || 0} color="#e74c3c" />
              <Stat label="N/A" value={stats.na || 0} color="#7f8c8d" />
              <Stat label="Pending" value={stats.pending} color="#d4a574" />
              <Stat label="Pass rate" value={`${passRate}%`} color="#1a3a52" />
            </div>
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { key: 'all', label: 'All' },
              { key: 'pending', label: 'Pending' },
              { key: 'pass', label: 'Pass' },
              { key: 'fail', label: 'Fail' },
              { key: 'na', label: 'N/A' },
            ].map((f) => (
              <button
                key={f.key}
                className={`btn btn-sm ${filter === f.key ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {checklist.sections.map((section) => (
        <div key={section.key} className="card mb-3">
          <div className="card-header">
            <h3 style={{ margin: 0, color: '#fff' }}>{section.label}</h3>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {section.narrative && (
              <div style={{ padding: '12px 16px', background: '#fff8e9', borderBottom: '1px solid #eee', fontSize: '0.9rem', color: '#5a4a1a' }}>
                {section.narrative}
              </div>
            )}
            {section.samples && (
              <div style={{ padding: 12, overflowX: 'auto' }}>
                <table className="checklist-table" style={tableStyle}>
                  <thead>
                    <tr>
                      {section.samples.columns.map((c) => (
                        <th key={c} style={thStyle}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.samples.rows.map((row) => (
                      <tr key={row[0]}>
                        {row.map((cell, i) => (
                          <td key={i} style={tdStyle}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ overflowX: 'auto' }}>
              <table className="checklist-table" style={tableStyle}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, width: 110 }}>Test ID</th>
                    <th style={thStyle}>Description</th>
                    <th style={thStyle}>Expected Result</th>
                    <th style={{ ...thStyle, width: 200 }}>Result</th>
                    <th style={{ ...thStyle, width: 220 }}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {section.tests.filter((t) => showRow(t[0])).map(([id, desc, expected]) => {
                    const result = state[id]?.result || 'pending'
                    return (
                      <tr key={id} style={rowStyle(result)}>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>{id}</td>
                        <td style={tdStyle}>{desc}</td>
                        <td style={tdStyle}>{expected}</td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {['pass', 'fail', 'na'].map((r) => (
                              <button
                                key={r}
                                onClick={() => setResult(id, result === r ? 'pending' : r)}
                                style={pillStyle(result === r, r)}
                              >
                                {r === 'na' ? 'N/A' : r.charAt(0).toUpperCase() + r.slice(1)}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <input
                            type="text"
                            placeholder="Defect ID / measured time…"
                            value={state[id]?.note || ''}
                            onChange={(e) => setNote(id, e.target.value)}
                            style={inputStyle}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ))}

      <div className="card mb-3">
        <div className="card-header"><h3 style={{ margin: 0, color: '#fff' }}>Sign-Off</h3></div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            {['Tester / QA', 'Developer', 'HR Representative', 'Court IT Officer', 'Project Sponsor'].map((role) => (
              <div key={role} style={{ padding: 12, border: '1px dashed #cbd5d8', borderRadius: 6 }}>
                <div style={{ fontWeight: 600 }}>{role}</div>
                <div style={{ marginTop: 28, borderTop: '1px solid #888', paddingTop: 4, fontSize: '0.8rem', color: '#666' }}>
                  Name / Signature / Date
                </div>
              </div>
            ))}
          </div>
          <div className="muted" style={{ marginTop: 14, fontSize: '0.85rem' }}>
            Use the <strong>Download PDF</strong> button above to generate a branded, court-letterhead copy of this checklist for physical sign-off.
            Pass/Fail marks and notes entered here are saved locally in this browser — they are not transmitted to the server.
          </div>
        </div>
      </div>
    </div>
  )
}

const Stat = ({ label, value, color }) => (
  <div style={{ textAlign: 'center', minWidth: 60 }}>
    <div style={{ fontSize: '1.5rem', fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
    <div className="muted" style={{ fontSize: '0.75rem' }}>{label}</div>
  </div>
)

const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }
const thStyle = {
  background: '#1f4e3d',
  color: '#fff',
  textAlign: 'left',
  padding: '8px 10px',
  fontWeight: 600,
  fontSize: '0.82rem',
  borderBottom: '2px solid #163829',
}
const tdStyle = {
  padding: '8px 10px',
  borderBottom: '1px solid #eee',
  verticalAlign: 'top',
}
const inputStyle = {
  width: '100%',
  padding: '4px 6px',
  border: '1px solid #d3dadd',
  borderRadius: 4,
  fontSize: '0.85rem',
}
const rowStyle = (result) => {
  if (result === 'pass') return { background: '#eafaf1' }
  if (result === 'fail') return { background: '#fdecea' }
  if (result === 'na') return { background: '#f4f4f5' }
  return {}
}
const pillStyle = (active, kind) => {
  const colors = {
    pass: { bg: '#27ae60', fg: '#fff' },
    fail: { bg: '#e74c3c', fg: '#fff' },
    na: { bg: '#7f8c8d', fg: '#fff' },
  }
  const c = colors[kind]
  return {
    padding: '3px 10px',
    fontSize: '0.78rem',
    fontWeight: 600,
    borderRadius: 4,
    border: active ? `1px solid ${c.bg}` : '1px solid #d3dadd',
    background: active ? c.bg : '#fff',
    color: active ? c.fg : '#444',
    cursor: 'pointer',
  }
}

export default TestingChecklist
