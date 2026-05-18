import { useState, useMemo } from 'react'
import { Download, BookOpen, ChevronRight, Lightbulb, ListChecks } from 'lucide-react'
import { GUIDE_META, GUIDE_SECTIONS } from '../data/guideContent'
import { generateGuidePdf } from '../utils/guidePdf'
import { useToast } from '../context/ToastContext'

// ── HTML mockups ────────────────────────────────────────────────────────────
// Schematic, CSS-only previews that mirror the actual screen. Drawn from
// shared content so what users see on screen matches what the PDF embeds.

const Frame = ({ children, label }) => (
  <div className="guide-mockup">
    <div className="guide-mockup-label">{label}</div>
    <div className="guide-mockup-inner">{children}</div>
  </div>
)

const ShellMock = () => (
  <div className="gm-shell">
    <aside className="gm-side">
      <div className="gm-side-brand">CCA</div>
      {['Dashboard', 'All Staff', 'Add Staff', 'Reports', 'Tasks', 'Audit', 'Users', 'Guide', 'Settings'].map((s) => (
        <div key={s} className="gm-side-item">{s}</div>
      ))}
    </aside>
    <div className="gm-body">
      <div className="gm-header">
        <span className="gm-title">Dashboard</span>
        <div className="gm-search">Search…</div>
        <div className="gm-avatar">TE</div>
      </div>
      <div className="gm-content">
        <div className="gm-stats">
          {['Total Staff', 'Updated', 'Promotion', 'Retirement'].map((s, i) => (
            <div key={s} className="gm-stat">
              <span className="gm-stat-label">{s}</span>
              <span className="gm-stat-value">{['148', '81', '12', '7'][i]}</span>
            </div>
          ))}
        </div>
        <div className="gm-panel">
          <div className="gm-panel-h">Recent Staff &amp; Upcoming Events</div>
          {[0, 1, 2, 3].map((r) => <div key={r} className="gm-row" />)}
        </div>
      </div>
    </div>
  </div>
)

const LoginMock = () => (
  <div className="gm-login">
    <div className="gm-login-side">
      <div className="gm-eyebrow">CUSTOMARY COURT OF APPEAL</div>
      <div className="gm-title-lg">Staff Biodata Management</div>
      <div className="gm-muted">A secure digital register for personnel records, postings, and service history.</div>
    </div>
    <div className="gm-login-form">
      <div className="gm-form-h">Welcome back</div>
      <label>Email address</label>
      <div className="gm-input" />
      <label>Password</label>
      <div className="gm-input" />
      <div className="gm-btn-primary">Sign in</div>
    </div>
  </div>
)

const ListMock = ({ cols, rows }) => (
  <div className="gm-list">
    <div className="gm-toolbar">
      <div className="gm-input gm-grow">Search…</div>
      <div className="gm-pill">Dept</div>
      <div className="gm-pill">Unit</div>
      <div className="gm-pill">Status</div>
      <div className="gm-btn-primary gm-sm">Export</div>
    </div>
    <table className="gm-table">
      <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
      <tbody>
        {Array.from({ length: 5 }).map((_, r) => (
          <tr key={r}>{cols.map((c, i) => <td key={c + i}>{rows[r % rows.length]?.[i] || '—'}</td>)}</tr>
        ))}
      </tbody>
    </table>
  </div>
)

const StaffListMock = () => (
  <ListMock
    cols={['Name', 'Department', 'Designation', 'GL', 'Status', '']}
    rows={[
      ['Aminu Bello', 'Registry', 'Senior Reg.', 'GL 12', 'Active', '⋯'],
      ['C. Okafor', 'HR', 'HR Officer', 'GL 10', 'Active', '⋯'],
      ['I. Musa', 'Registry', 'Dept Head', 'GL 14', 'Active', '⋯'],
      ['F. Adeyemi', 'Audit', 'Auditor', 'GL 11', 'On Leave', '⋯'],
      ['T. Eze', 'Finance', 'Officer', 'GL 09', 'Active', '⋯'],
    ]}
  />
)

const FormMock = () => (
  <div className="gm-form-page">
    <div className="gm-form-h">Add New Staff</div>
    <div className="gm-tabs">
      {['Personal', 'Origin', 'Contact', 'Employment', 'Qualifications', 'Financial', 'Kin'].map((s, i) => (
        <span key={s} className={'gm-tab ' + (i === 0 ? 'active' : '')}>{s}</span>
      ))}
    </div>
    <div className="gm-grid">
      {['First Name', 'Last Name', 'Date of Birth', 'Gender', 'Email', 'Phone', 'State', 'LGA', 'Designation', 'Grade'].map((f) => (
        <div key={f} className="gm-field">
          <label>{f}</label>
          <div className="gm-input" />
        </div>
      ))}
    </div>
    <div className="gm-form-actions">
      <div className="gm-btn-primary">Save Record</div>
    </div>
  </div>
)

const ImportMock = () => (
  <div className="gm-import">
    <div className="gm-form-h">Bulk Import</div>
    <div className="gm-drop">Drop CSV / .xlsx here, or click to choose</div>
    <div className="gm-row-actions">
      <div className="gm-pill">↓ Download Template</div>
    </div>
    <div className="gm-form-h" style={{ fontSize: 13 }}>Preview</div>
    <ListMock cols={['Row', 'Name', 'Email', 'Status']} rows={[['01', 'Aminu Bello', 'a.bello@cca.gov.ng', 'OK']]} />
  </div>
)

const ProfileMock = () => (
  <div className="gm-profile">
    <div className="gm-profile-head">
      <div className="gm-profile-av">AB</div>
      <div>
        <div className="gm-form-h">Aminu Bello</div>
        <div className="gm-muted">Senior Registrar · Administration · GL 12</div>
      </div>
      <div className="gm-btn-gold">Download PDF</div>
    </div>
    <div className="gm-tabs">
      {['Overview', 'Personal', 'Employment', 'Qualifications', 'Service', 'Docs'].map((s, i) => (
        <span key={s} className={'gm-tab ' + (i === 0 ? 'active' : '')}>{s}</span>
      ))}
    </div>
    <div className="gm-card-grid">
      {['Personal', 'Origin', 'Contact', 'Employment'].map((s) => (
        <div key={s} className="gm-card">
          <div className="gm-card-h">{s}</div>
          {[0, 1, 2].map((k) => <div key={k} className="gm-line" />)}
        </div>
      ))}
    </div>
  </div>
)

const RecordsMock = () => (
  <ListMock
    cols={['Staff', 'Doc Type', 'Filename', 'Uploaded', 'By', '']}
    rows={[['Aminu Bello', 'Appointment', 'app-letter.pdf', '14 Mar 2026', 'C. Okafor', '⋯']]}
  />
)

const ReportsMock = () => (
  <div className="gm-reports">
    <aside className="gm-reports-side">
      {['Department', 'Grade', 'Gender', 'Promotions', 'Retirement', 'Age', 'States'].map((s, i) => (
        <div key={s} className={'gm-reports-item ' + (i === 0 ? 'active' : '')}>{s}</div>
      ))}
    </aside>
    <div className="gm-chart">
      <div className="gm-chart-h">Department Distribution</div>
      <div className="gm-bars">
        {[55, 80, 35, 70, 50, 60].map((h, i) => (
          <div key={i} className="gm-bar" style={{ height: h + '%', background: i % 2 ? '#1a3a52' : '#d4a574' }} />
        ))}
      </div>
    </div>
  </div>
)

const TasksMock = () => (
  <div className="gm-tasks">
    <div className="gm-tasks-head">
      <div className="gm-form-h">My Tasks</div>
      <div className="gm-btn-primary">+ New Task</div>
    </div>
    {[
      { t: 'Review promotion file — A. Bello', m: 'High · Due 25 May', c: '#d4a574' },
      { t: 'Confirm new hire records', m: 'Med · Due 30 May', c: '#1a3a52' },
      { t: 'Audit Q2 transfers', m: 'High · Due 03 Jun', c: '#6b7280' },
      { t: 'Update retirement projections', m: 'Low · Due 10 Jun', c: '#d4a574' },
      { t: 'Prepare HR memo', m: 'Med · Due 15 Jun', c: '#1a3a52' },
    ].map((row, i) => (
      <div key={i} className="gm-task">
        <span className="gm-task-bar" style={{ background: row.c }} />
        <div>
          <div className="gm-task-t">{row.t}</div>
          <div className="gm-muted">{row.m}</div>
        </div>
      </div>
    ))}
  </div>
)

const AuditMock = () => (
  <ListMock
    cols={['When', 'User', 'Action', 'Subject', 'Detail', '']}
    rows={[['14:22, 14 Mar', 'C. Okafor', 'Updated', 'Aminu Bello', '+phone, +address', '⋯']]}
  />
)

const UsersMock = () => (
  <ListMock
    cols={['Name', 'Email', 'Role', 'Dept', 'Status', 'Actions']}
    rows={[['Teeco Enterprise LTD', 'teeco@cca.gov.ng', 'Super Admin', 'Executive', 'Active', '✎ 🔑 🗑']]}
  />
)

const SettingsMock = () => (
  <div className="gm-form-page">
    <div className="gm-tabs">
      {['Profile', 'Security', 'System', 'Notifications'].map((s, i) => (
        <span key={s} className={'gm-tab ' + (i === 0 ? 'active' : '')}>{s}</span>
      ))}
    </div>
    <div className="gm-grid">
      {['Full name', 'Email', 'Phone', 'Department'].map((f) => (
        <div key={f} className="gm-field"><label>{f}</label><div className="gm-input" /></div>
      ))}
    </div>
    <div className="gm-form-actions"><div className="gm-btn-primary">Save Changes</div></div>
  </div>
)

const SecurityMock = () => (
  <div className="gm-tips">
    {[
      '🛡  Never share your password',
      '⏱  Sign out before stepping away',
      '👁  Watch for shoulder-surfing',
      '🚩  Report unknown audit entries',
      '🔐  Auto-logout after 30 minutes',
    ].map((t) => (
      <div key={t} className="gm-tip">{t}</div>
    ))}
  </div>
)

const MOCKUPS = {
  shell: ShellMock,
  login: LoginMock,
  dashboard: ShellMock,
  'staff-list': StaffListMock,
  form: FormMock,
  import: ImportMock,
  profile: ProfileMock,
  records: RecordsMock,
  reports: ReportsMock,
  tasks: TasksMock,
  audit: AuditMock,
  users: UsersMock,
  settings: SettingsMock,
  security: SecurityMock,
}

const Guide = () => {
  const toast = useToast()
  const [activeId, setActiveId] = useState(GUIDE_SECTIONS[0].id)
  const active = useMemo(() => GUIDE_SECTIONS.find((s) => s.id === activeId) || GUIDE_SECTIONS[0], [activeId])
  const Mockup = MOCKUPS[active.mockup] || ShellMock

  const handleDownload = () => {
    try {
      generateGuidePdf()
      toast.success('System Guide PDF downloaded.')
    } catch (e) {
      toast.error('Could not generate PDF: ' + (e?.message || 'unknown error'))
    }
  }

  return (
    <div className="guide">
      <div className="page-header">
        <div>
          <h1 className="page-title"><BookOpen size={22} /> {GUIDE_META.title}</h1>
          <p className="muted">{GUIDE_META.subtitle} · v{GUIDE_META.version}</p>
        </div>
        <button className="btn btn-primary" onClick={handleDownload}>
          <Download size={18} /> Download as PDF
        </button>
      </div>

      <div className="guide-layout">
        <aside className="guide-toc">
          <div className="guide-toc-label">Contents</div>
          <ol>
            {GUIDE_SECTIONS.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  className={'guide-toc-item ' + (s.id === activeId ? 'active' : '')}
                  onClick={() => setActiveId(s.id)}
                >
                  <span className="guide-toc-num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="guide-toc-title">{s.title}</span>
                  <ChevronRight size={14} />
                </button>
              </li>
            ))}
          </ol>
        </aside>

        <article className="guide-article">
          <div className="guide-eyebrow">
            SECTION {String(GUIDE_SECTIONS.findIndex((s) => s.id === activeId) + 1).padStart(2, '0')}
          </div>
          <h2>{active.title}</h2>
          <p className="guide-intro">{active.intro}</p>

          <Frame label={'Schematic preview — ' + active.mockup}>
            <Mockup />
          </Frame>

          <h3 className="guide-h3"><ListChecks size={18} /> How to do it</h3>
          <ol className="guide-steps">
            {active.steps.map((step, i) => (
              <li key={i}>
                <span className="guide-step-num">{String(i + 1).padStart(2, '0')}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>

          {active.tips && active.tips.length > 0 && (
            <div className="guide-tips">
              <h3 className="guide-h3"><Lightbulb size={18} /> Tips</h3>
              <ul>{active.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>
            </div>
          )}

          <div className="guide-nav">
            {(() => {
              const idx = GUIDE_SECTIONS.findIndex((s) => s.id === activeId)
              const prev = idx > 0 ? GUIDE_SECTIONS[idx - 1] : null
              const next = idx < GUIDE_SECTIONS.length - 1 ? GUIDE_SECTIONS[idx + 1] : null
              return (
                <>
                  <button className="btn btn-outline" disabled={!prev} onClick={() => prev && setActiveId(prev.id)}>
                    ← {prev ? prev.title : 'Start'}
                  </button>
                  <button className="btn btn-outline" disabled={!next} onClick={() => next && setActiveId(next.id)}>
                    {next ? next.title : 'End'} →
                  </button>
                </>
              )
            })()}
          </div>
        </article>
      </div>
    </div>
  )
}

export default Guide
