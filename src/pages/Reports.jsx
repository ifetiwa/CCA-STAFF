import { useEffect, useMemo, useState } from 'react'
import { Download, TrendingUp, Users, Briefcase, GraduationCap } from 'lucide-react'
import { getAllStaff, subscribeStaff } from '../data/staff'
import { listDepartments, colorFor, subscribeDepartments } from '../data/departments'
import { downloadCsv, printElement } from '../utils/download'
import { useToast } from '../context/ToastContext'

// Group GL XX strings into the four pay bands used on the Nominal Roll.
const gradeBand = (gl) => {
  const n = parseInt(gl, 10)
  if (Number.isNaN(n)) return 'Unspecified'
  if (n >= 14) return 'GL 14–17'
  if (n >= 10) return 'GL 10–13'
  if (n >= 7)  return 'GL 07–09'
  return 'GL 03–06'
}

const POSTGRAD_HINTS = ['M.Sc', 'MSc', 'MA', 'M.A', 'LL.M', 'MBA', 'PhD', 'Ph.D', 'Doctorate', 'Masters', 'M.Phil']
const hasPostgrad = (s) =>
  Array.isArray(s.qualifications) &&
  s.qualifications.some((q) =>
    POSTGRAD_HINTS.some((h) => String(q?.qualification || '').toLowerCase().includes(h.toLowerCase())),
  )

const Reports = () => {
  const toast = useToast()
  const [staff, setStaff] = useState(() => getAllStaff())
  const [departments, setDepartments] = useState(() => listDepartments())

  useEffect(() => subscribeStaff(setStaff), [])
  useEffect(() => subscribeDepartments(setDepartments), [])

  const stats = useMemo(() => {
    const total = staff.length

    // Every department name actually used + every name in the store, merged.
    const namesInUse = new Set(staff.map((s) => s.department).filter(Boolean))
    departments.forEach((d) => namesInUse.add(d.name))

    const byDept = Array.from(namesInUse)
      .map((name) => ({
        name,
        count: staff.filter((s) => s.department === name).length,
        color: colorFor(name),
      }))
      .sort((a, b) => b.count - a.count)

    const bandOrder = ['GL 14–17', 'GL 10–13', 'GL 07–09', 'GL 03–06', 'Unspecified']
    const byGrade = bandOrder
      .map((band) => ({ grade: band, count: staff.filter((s) => gradeBand(s.gradeLevel) === band).length }))
      .filter((b) => b.count > 0 || b.grade !== 'Unspecified')

    const permanent = staff.filter((s) => s.employmentType === 'Permanent').length
    const postgrad = staff.filter(hasPostgrad).length

    const thisYear = new Date().getFullYear()
    const newHiresYtd = staff.filter((s) => {
      const yr = parseInt(String(s.firstAppointmentDate || '').slice(0, 4), 10)
      return yr === thisYear
    }).length

    const departmentsWithStaff = byDept.filter((d) => d.count > 0).length

    return { total, byDept, byGrade, permanent, postgrad, newHiresYtd, departmentsWithStaff }
  }, [staff, departments])

  const pct = (n) => (stats.total ? Math.round((n / stats.total) * 100) : 0)

  const reportCatalogue = {
    'Staff Nominal Roll': () => {
      downloadCsv(
        staff.map((s) => ({
          StaffID: s.staffId, Name: s.fullName, Department: s.department,
          Designation: s.designation, GradeLevel: `GL ${s.gradeLevel}/${s.step}`, Status: s.status,
        })),
        null,
        `cca-nominal-roll-${new Date().toISOString().slice(0, 10)}.csv`,
      )
      toast.success(`Nominal Roll exported (${staff.length} record(s)).`)
    },
    'Leave & Attendance Report': () => {
      toast.info('Leave & Attendance dataset not yet imported — report skeleton generated.')
    },
    'Promotions Due': () => {
      const rows = staff
        .filter((s) => s.nextPromotionInDays !== null && s.nextPromotionInDays <= 365)
        .map((s) => ({
          StaffID: s.staffId, Name: s.fullName, Department: s.department,
          Designation: s.designation, GradeLevel: `GL ${s.gradeLevel}/${s.step}`,
          LastPromotion: s.lastPromotionDate, NextPromotion: s.nextPromotionDate,
          DaysToReview: s.nextPromotionInDays,
        }))
      downloadCsv(rows, null, `cca-promotions-due-${new Date().toISOString().slice(0, 10)}.csv`)
      toast.success(`${rows.length} officer(s) eligible for promotion review in the next 12 months.`)
    },
    'Retirement Forecast': () => {
      const rows = staff
        .filter((s) => s.retirementInDays !== null && s.retirementInDays <= 365 * 3)
        .sort((a, b) => a.retirementInDays - b.retirementInDays)
        .map((s) => ({
          StaffID: s.staffId, Name: s.fullName, Department: s.department,
          Designation: s.designation, DOB: s.dateOfBirth,
          FirstAppointment: s.firstAppointmentDate, RetirementDate: s.retirementDate,
          DaysToRetirement: s.retirementInDays,
        }))
      downloadCsv(rows, null, `cca-retirement-forecast-${new Date().toISOString().slice(0, 10)}.csv`)
      toast.success(`${rows.length} officer(s) projected to retire within 3 years.`)
    },
  }

  const handleCsv = () => {
    downloadCsv(
      staff.map((s) => ({
        StaffID: s.staffId, Name: s.fullName, Department: s.department,
        Designation: s.designation, GradeLevel: `GL ${s.gradeLevel}/${s.step}`,
        Status: s.status, FirstAppointment: s.firstAppointmentDate,
        NextPromotion: s.nextPromotionDate, Retirement: s.retirementDate,
      })),
      null,
      `cca-staff-report-${new Date().toISOString().slice(0, 10)}.csv`,
    )
    toast.success('Staff report exported as CSV.')
  }

  const handlePdf = () => {
    toast.info('Opening print dialog — choose "Save as PDF".')
    printElement()
  }

  const maxGradeCount = Math.max(1, ...stats.byGrade.map((g) => g.count))

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Reports &amp; Analytics</h1>
          <p className="page-header-sub">Workforce distribution, milestones, and exportable reports.</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline" onClick={handleCsv}><Download size={18} /> Download CSV</button>
          <button className="btn btn-primary" onClick={handlePdf}><Download size={18} /> Generate PDF</button>
        </div>
      </div>

      <div className="row gap-3 mb-3">
        <SummaryTile
          icon={<Users size={22} />} color="#1a3a52"
          label="Total Staff" value={stats.total}
          hint={`Across ${stats.departmentsWithStaff} department${stats.departmentsWithStaff === 1 ? '' : 's'}`}
        />
        <SummaryTile
          icon={<Briefcase size={22} />} color="#27ae60"
          label="Permanent Staff" value={stats.permanent}
          hint={`${pct(stats.permanent)}% of workforce`}
        />
        <SummaryTile
          icon={<GraduationCap size={22} />} color="#3498db"
          label="Postgraduate Degrees" value={stats.postgrad}
          hint={`${pct(stats.postgrad)}% of workforce`}
        />
        <SummaryTile
          icon={<TrendingUp size={22} />} color="#d4a574"
          label={`New Hires (${new Date().getFullYear()})`} value={stats.newHiresYtd}
          hint="Appointed this calendar year"
        />
      </div>

      <div className="row gap-3">
        <div className="col-8">
          <div className="card">
            <div className="card-header"><h3 style={{ margin: 0, color: '#fff' }}>Staff Distribution by Department</h3></div>
            <div className="card-body">
              {stats.total === 0 ? (
                <div className="muted" style={{ padding: '1rem 0' }}>
                  No staff on record yet — add staff to see the distribution.
                </div>
              ) : (
                <div className="bar-chart">
                  {stats.byDept.map((d) => {
                    const p = pct(d.count)
                    return (
                      <div key={d.name} className="bar-row">
                        <div className="bar-label">{d.name}</div>
                        <div className="bar-track">
                          <div className="bar-fill" style={{ width: `${p}%`, background: d.color }} />
                        </div>
                        <div className="bar-value">{d.count} <span className="muted">({p}%)</span></div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-4">
          <div className="card">
            <div className="card-header"><h3 style={{ margin: 0, color: '#fff' }}>By Grade Level</h3></div>
            <div className="card-body">
              {stats.byGrade.length === 0 ? (
                <div className="muted">No grade-level data.</div>
              ) : (
                stats.byGrade.map((g) => (
                  <div key={g.grade} className="bar-row">
                    <div className="bar-label" style={{ width: 80 }}>{g.grade}</div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${(g.count / maxGradeCount) * 100}%`, background: '#1a3a52' }} />
                    </div>
                    <div className="bar-value">{g.count}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card mt-3">
        <div className="card-header"><h3 style={{ margin: 0, color: '#fff' }}>Available Reports</h3></div>
        <div className="card-body">
          <div className="row gap-2">
            {[
              { title: 'Staff Nominal Roll', desc: 'Full directory of all serving personnel with grade levels.' },
              { title: 'Leave & Attendance Report', desc: 'Monthly summary of staff attendance and leave usage.' },
              { title: 'Promotions Due', desc: 'Officers eligible for promotion within the next 12 months.' },
              { title: 'Retirement Forecast', desc: 'Officers approaching statutory retirement age.' },
            ].map((r) => (
              <div className="col-6" key={r.title}>
                <div className="report-tile">
                  <div>
                    <strong>{r.title}</strong>
                    <div className="muted" style={{ fontSize: '0.9rem' }}>{r.desc}</div>
                  </div>
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => (reportCatalogue[r.title] || (() => toast.info('Report not yet available.')))()}
                  >
                    <Download size={14} /> Run
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

const SummaryTile = ({ icon, color, label, value, hint }) => (
  <div className="col-3">
    <div className="card">
      <div className="card-body">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="muted" style={{ fontSize: '0.9rem' }}>{label}</div>
            <div style={{ color, fontSize: '2.2rem', fontWeight: 700, lineHeight: 1.1 }}>{value}</div>
            <div className="muted" style={{ fontSize: '0.85rem' }}>{hint}</div>
          </div>
          <div className="tile-icon" style={{ background: `${color}1f`, color }}>{icon}</div>
        </div>
      </div>
    </div>
  </div>
)

export default Reports
