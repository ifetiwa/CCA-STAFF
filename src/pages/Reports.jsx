import { useEffect, useMemo, useState } from 'react'
import { Download, TrendingUp, Users, Briefcase, GraduationCap, CalendarClock, AlertTriangle, Clock, ClipboardCheck, ChevronDown, ChevronRight, FileSpreadsheet } from 'lucide-react'
import { getAllStaff, subscribeStaff, formatDate } from '../data/staff'
import { listDepartments, colorFor, subscribeDepartments } from '../data/departments'
import { downloadCsv, downloadXlsx, printElement } from '../utils/download'
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
  // Toggles the expandable list under the "Awaiting Review" tile.
  const [showAwaitingList, setShowAwaitingList] = useState(false)

  useEffect(() => subscribeStaff(setStaff), [])
  useEffect(() => subscribeDepartments(setDepartments), [])

  // Officers whose promotion review date has already passed (was "Overdue").
  // Shared by the tile count, the expandable list, and the Excel export.
  const awaitingReview = useMemo(
    () => staff
      .filter((s) => s.nextPromotionInDays !== null && s.nextPromotionInDays < 0)
      .sort((a, b) => a.nextPromotionInDays - b.nextPromotionInDays),
    [staff],
  )

  const awaitingReviewRows = () => awaitingReview.map((s) => ({
    StaffID: s.staffId, Name: s.fullName, Department: s.department,
    Designation: s.designation, GradeLevel: `GL ${s.gradeLevel}/${s.step}`,
    LastPromotion: s.lastPromotionDate, DueDate: s.nextPromotionDate,
    DaysPastDue: Math.abs(s.nextPromotionInDays),
  }))

  const exportAwaitingReviewXlsx = async () => {
    await downloadXlsx(
      awaitingReviewRows(),
      `cca-awaiting-review-${new Date().toISOString().slice(0, 10)}.xlsx`,
      'Awaiting Review',
    )
    toast.success(`${awaitingReview.length} officer(s) exported to Excel.`)
  }

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

    // Promotion windows. CCA policy: promotions are processed twice a year, in
    // June and December. Group officers whose next review falls inside the
    // next 12 months by whichever window comes next on the calendar.
    const now = new Date()
    const windowDate = (year, month) => new Date(year, month, 1)
    const nextTwoWindows = () => {
      const m = now.getMonth() // 0-indexed
      const y = now.getFullYear()
      const candidates = [
        windowDate(y, 5),      // June this year
        windowDate(y, 11),     // December this year
        windowDate(y + 1, 5),  // June next year
        windowDate(y + 1, 11), // December next year
      ].filter((d) => d >= new Date(y, m, 1))
      return candidates.slice(0, 2)
    }
    const promoWindows = nextTwoWindows().map((d) => ({
      label: d.toLocaleDateString('en-NG', { month: 'long', year: 'numeric' }),
      date: d,
      count: 0,
    }))
    staff.forEach((s) => {
      // Only *forward-looking* reviews within the next 12 months feed the
      // windows. Overdue officers (negative days) are excluded here and counted
      // separately as `overduePromotions` — otherwise the snap-to-next-window
      // logic below would dump every overdue officer into the nearest window
      // (e.g. December), which is why this total used to dwarf the dashboard's
      // "Due for Promotion" figure.
      if (s.nextPromotionInDays === null || s.nextPromotionInDays < 0 || s.nextPromotionInDays > 365) return
      const due = new Date(s.nextPromotionDate)
      if (Number.isNaN(due.getTime())) return
      // Snap each officer to the next June/December window on or after their
      // calculated due date — that's when their promotion would actually be
      // considered.
      const target = promoWindows.find((w) => w.date >= due) || promoWindows[promoWindows.length - 1]
      if (target) target.count += 1
    })
    const promosDueTotal = promoWindows.reduce((acc, w) => acc + w.count, 0)
    // Officers whose review date has already passed (not yet promoted). Shown
    // as its own figure so they are never silently folded into a window.
    const overduePromotions = staff.filter(
      (s) => s.nextPromotionInDays !== null && s.nextPromotionInDays < 0,
    ).length

    // Retirement: statutory exit within the next 12 months, and those already
    // past their retirement date and still on record.
    const retiringSoon = staff.filter(
      (s) => s.retirementInDays !== null && s.retirementInDays >= 0 && s.retirementInDays <= 365,
    ).length
    const retirementOverdue = staff.filter(
      (s) => s.retirementInDays !== null && s.retirementInDays < 0,
    ).length

    // Gender split.
    const byGender = ['Male', 'Female'].map((g) => ({
      label: g,
      count: staff.filter((s) => String(s.gender || '').toLowerCase().startsWith(g[0].toLowerCase())).length,
    }))
    byGender.push({
      label: 'Unspecified',
      count: staff.length - byGender.reduce((a, b) => a + b.count, 0),
    })

    // Averages (ignore blanks).
    const ages = staff.map((s) => s.age).filter((n) => typeof n === 'number' && n > 0)
    const services = staff.map((s) => s.yearsOfService).filter((n) => typeof n === 'number' && n >= 0)
    const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0)
    const avgAge = avg(ages)
    const avgService = avg(services)

    // Data completeness — share of the key HR fields populated across everyone.
    const KEY_FIELDS = [
      'staffId', 'fullName', 'gender', 'dateOfBirth', 'email', 'phonePrimary',
      'department', 'designation', 'gradeLevel', 'firstAppointmentDate',
      'stateOfOrigin', 'nin',
    ]
    const hasVal = (s, f) => {
      const v = s[f]
      return v !== null && v !== undefined && String(v).trim() !== ''
    }
    let filledCells = 0
    staff.forEach((s) => KEY_FIELDS.forEach((f) => { if (hasVal(s, f)) filledCells += 1 }))
    const completeness = staff.length
      ? Math.round((filledCells / (staff.length * KEY_FIELDS.length)) * 100)
      : 0
    const missingByField = KEY_FIELDS.map((f) => ({
      field: f,
      missing: staff.filter((s) => !hasVal(s, f)).length,
    })).filter((m) => m.missing > 0).sort((a, b) => b.missing - a.missing)

    return {
      total, byDept, byGrade, permanent, postgrad, newHiresYtd, departmentsWithStaff,
      promoWindows, promosDueTotal, overduePromotions,
      retiringSoon, retirementOverdue, byGender, avgAge, avgService,
      completeness, missingByField,
    }
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
      const eligible = staff.filter((s) => s.nextPromotionInDays !== null && s.nextPromotionInDays <= 365)
      const overdueCount = eligible.filter((s) => s.nextPromotionInDays < 0).length
      const dueCount = eligible.length - overdueCount
      const rows = eligible
        .sort((a, b) => a.nextPromotionInDays - b.nextPromotionInDays)
        .map((s) => ({
          StaffID: s.staffId, Name: s.fullName, Department: s.department,
          Designation: s.designation, GradeLevel: `GL ${s.gradeLevel}/${s.step}`,
          LastPromotion: s.lastPromotionDate, NextPromotion: s.nextPromotionDate,
          DaysToReview: s.nextPromotionInDays,
          Status: s.nextPromotionInDays < 0 ? 'Awaiting Review' : 'Due (next 12 months)',
        }))
      downloadCsv(rows, null, `cca-promotions-due-${new Date().toISOString().slice(0, 10)}.csv`)
      toast.success(`${dueCount} due in the next 12 months + ${overdueCount} awaiting review = ${rows.length} officer(s).`)
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
    'Awaiting Review': () => {
      const rows = awaitingReviewRows()
      downloadCsv(rows, null, `cca-awaiting-review-${new Date().toISOString().slice(0, 10)}.csv`)
      toast.success(`${rows.length} officer(s) awaiting a promotion review.`)
    },
    'Departmental Headcount': () => {
      const rows = stats.byDept.map((d) => ({
        Department: d.name, Staff: d.count, ShareOfWorkforce: `${pct(d.count)}%`,
      }))
      downloadCsv(rows, null, `cca-departmental-headcount-${new Date().toISOString().slice(0, 10)}.csv`)
      toast.success(`Headcount exported for ${rows.length} department(s).`)
    },
    'Grade Level Distribution': () => {
      const counts = {}
      staff.forEach((s) => {
        const gl = String(s.gradeLevel || '').trim() || 'Unspecified'
        counts[gl] = (counts[gl] || 0) + 1
      })
      const rows = Object.entries(counts)
        .sort((a, b) => (parseInt(b[0], 10) || -1) - (parseInt(a[0], 10) || -1))
        .map(([gl, n]) => ({ GradeLevel: gl === 'Unspecified' ? gl : `GL ${gl}`, Staff: n, Share: `${pct(n)}%` }))
      downloadCsv(rows, null, `cca-grade-distribution-${new Date().toISOString().slice(0, 10)}.csv`)
      toast.success(`Grade-level distribution exported (${rows.length} band(s)).`)
    },
    'Gender & Diversity': () => {
      const rows = stats.byGender
        .filter((g) => g.count > 0)
        .map((g) => ({ Gender: g.label, Staff: g.count, Share: `${pct(g.count)}%` }))
      downloadCsv(rows, null, `cca-gender-diversity-${new Date().toISOString().slice(0, 10)}.csv`)
      toast.success('Gender & diversity summary exported.')
    },
    'State of Origin Spread': () => {
      const counts = {}
      staff.forEach((s) => {
        const st = String(s.stateOfOrigin || '').trim() || 'Unspecified'
        counts[st] = (counts[st] || 0) + 1
      })
      const rows = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([st, n]) => ({ State: st, Staff: n, Share: `${pct(n)}%` }))
      downloadCsv(rows, null, `cca-state-of-origin-${new Date().toISOString().slice(0, 10)}.csv`)
      toast.success(`State-of-origin spread exported (${rows.length} state(s)).`)
    },
    'New Hires': () => {
      const yr = new Date().getFullYear()
      const rows = staff
        .filter((s) => parseInt(String(s.firstAppointmentDate || '').slice(0, 4), 10) === yr)
        .sort((a, b) => String(a.firstAppointmentDate).localeCompare(String(b.firstAppointmentDate)))
        .map((s) => ({
          StaffID: s.staffId, Name: s.fullName, Department: s.department,
          Designation: s.designation, GradeLevel: `GL ${s.gradeLevel}/${s.step}`,
          FirstAppointment: s.firstAppointmentDate,
        }))
      downloadCsv(rows, null, `cca-new-hires-${yr}.csv`)
      toast.success(`${rows.length} officer(s) appointed in ${yr}.`)
    },
    'Age & Service Profile': () => {
      const rows = staff
        .map((s) => ({
          StaffID: s.staffId, Name: s.fullName, Department: s.department,
          DOB: s.dateOfBirth, Age: s.age ?? '', YearsOfService: s.yearsOfService ?? '',
          FirstAppointment: s.firstAppointmentDate, Retirement: s.retirementDate,
        }))
        .sort((a, b) => (b.Age || 0) - (a.Age || 0))
      downloadCsv(rows, null, `cca-age-service-profile-${new Date().toISOString().slice(0, 10)}.csv`)
      toast.success(`Age & service profile exported (avg age ${stats.avgAge}, avg service ${stats.avgService} yrs).`)
    },
    'Data Quality — Missing Fields': () => {
      const LABELS = {
        staffId: 'Staff ID', fullName: 'Name', gender: 'Gender', dateOfBirth: 'Date of Birth',
        email: 'Email', phonePrimary: 'Phone', department: 'Department', designation: 'Designation',
        gradeLevel: 'Grade Level', firstAppointmentDate: 'First Appointment', stateOfOrigin: 'State of Origin',
        nin: 'NIN',
      }
      const need = (s) => Object.keys(LABELS).filter((f) => {
        const v = s[f]
        return v === null || v === undefined || String(v).trim() === ''
      })
      const rows = staff
        .map((s) => ({ s, miss: need(s) }))
        .filter((x) => x.miss.length)
        .sort((a, b) => b.miss.length - a.miss.length)
        .map(({ s, miss }) => ({
          StaffID: s.staffId, Name: s.fullName, Department: s.department,
          MissingCount: miss.length, MissingFields: miss.map((f) => LABELS[f]).join('; '),
        }))
      downloadCsv(rows, null, `cca-data-quality-${new Date().toISOString().slice(0, 10)}.csv`)
      toast.success(`${rows.length} record(s) have at least one missing key field.`)
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

  const summaryCards = [
    { label: 'Total Staff', value: stats.total, icon: Users, tone: 'primary',
      hint: `Across ${stats.departmentsWithStaff} department${stats.departmentsWithStaff === 1 ? '' : 's'}` },
    { label: 'Permanent Staff', value: stats.permanent, icon: Briefcase, tone: 'success',
      hint: `${pct(stats.permanent)}% of workforce` },
    { label: 'Postgraduate Degrees', value: stats.postgrad, icon: GraduationCap, tone: 'info',
      hint: `${pct(stats.postgrad)}% of workforce` },
    { label: `New Hires (${new Date().getFullYear()})`, value: stats.newHiresYtd, icon: TrendingUp, tone: 'warning',
      hint: 'Appointed this calendar year' },
    { label: 'Due for Promotion', value: stats.promosDueTotal, icon: CalendarClock, tone: 'primary',
      hint: 'Review falls in the next 12 months' },
    { label: 'Awaiting Review', value: stats.overduePromotions, icon: AlertTriangle, tone: 'danger',
      hint: 'Review date already passed' },
    { label: 'Retiring ≤ 12 months', value: stats.retiringSoon, icon: Clock, tone: 'info',
      hint: stats.retirementOverdue ? `+${stats.retirementOverdue} past retirement date` : 'Approaching statutory exit' },
    { label: 'Data Completeness', value: `${stats.completeness}%`, icon: ClipboardCheck, tone: 'success',
      hint: `${stats.missingByField.length} field(s) have gaps` },
  ]

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

      <div className="stat-grid mb-3">
        {summaryCards.map((c) => {
          const Icon = c.icon
          return (
            <div key={c.label} className={`stat-card stat-${c.tone}`}>
              <div className="stat-icon-wrap"><Icon size={22} /></div>
              <div className="stat-body">
                <div className="stat-label">{c.label}</div>
                <div className="stat-value">{c.value}</div>
                {c.hint && <div className="stat-hint">{c.hint}</div>}
              </div>
            </div>
          )
        })}
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
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarClock size={18} /> Promotion Windows
          </h3>
          <span className="muted small" style={{ color: '#e2e8f0' }}>
            Promotions happen in <strong>June</strong> and <strong>December</strong>.
          </span>
        </div>
        <div className="card-body">
          <div className="muted small mb-2">
            Officers whose next review falls in the next 12 months, snapped to the next half-yearly
            promotion exercise. These windows sum to the dashboard's <strong>Due for Promotion</strong>{' '}
            figure ({stats.promosDueTotal}). Officers <strong>awaiting review</strong> are shown separately.
          </div>
          {stats.overduePromotions > 0 && (
            <>
              <button
                type="button"
                className="report-tile mb-2"
                onClick={() => setShowAwaitingList((v) => !v)}
                aria-expanded={showAwaitingList}
                title="Click to view the officers awaiting review"
                style={{
                  alignItems: 'center', borderLeft: '4px solid #dc2626',
                  width: '100%', cursor: 'pointer', textAlign: 'left',
                  background: 'transparent', font: 'inherit',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {showAwaitingList ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  <div>
                    <strong>Awaiting Review</strong>
                    <div className="muted" style={{ fontSize: '0.9rem' }}>
                      Review date already passed — to be considered at the next exercise.{' '}
                      <span style={{ color: '#dc2626' }}>Click to view the list.</span>
                    </div>
                  </div>
                </div>
                <div style={{ color: '#dc2626', fontSize: '1.8rem', fontWeight: 700 }}>
                  {stats.overduePromotions}
                </div>
              </button>
              {showAwaitingList && (
                <div className="card mb-2" style={{ border: '1px solid #f0d0d0' }}>
                  <div
                    className="card-body"
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8 }}
                  >
                    <span className="muted small">
                      {awaitingReview.length} officer(s) awaiting a promotion review
                    </span>
                    <button className="btn btn-sm btn-outline" onClick={exportAwaitingReviewXlsx}>
                      <FileSpreadsheet size={14} /> Download Excel
                    </button>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table" style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th>Staff ID</th>
                          <th>Name</th>
                          <th>Department</th>
                          <th>Designation</th>
                          <th>Grade</th>
                          <th>Review Due</th>
                          <th style={{ textAlign: 'right' }}>Days Past Due</th>
                        </tr>
                      </thead>
                      <tbody>
                        {awaitingReview.map((s) => (
                          <tr key={s.id}>
                            <td>{s.staffId}</td>
                            <td>{s.fullName}</td>
                            <td>{s.department || '—'}</td>
                            <td>{s.designation || '—'}</td>
                            <td>GL {s.gradeLevel}/{s.step}</td>
                            <td>{formatDate(s.nextPromotionDate)}</td>
                            <td style={{ textAlign: 'right', color: '#dc2626', fontWeight: 600 }}>
                              {Math.abs(s.nextPromotionInDays)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
          {stats.promosDueTotal === 0 ? (
            <div className="muted">No officers are due for promotion in the next 12 months.</div>
          ) : (
            <div className="row gap-2">
              {stats.promoWindows.map((w) => (
                <div className="col-6" key={w.label}>
                  <div className="report-tile" style={{ alignItems: 'center' }}>
                    <div>
                      <strong>{w.label}</strong>
                      <div className="muted" style={{ fontSize: '0.9rem' }}>Promotion exercise window</div>
                    </div>
                    <div style={{ color: '#1a3a52', fontSize: '1.8rem', fontWeight: 700 }}>{w.count}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card mt-3">
        <div className="card-header"><h3 style={{ margin: 0, color: '#fff' }}>Available Reports</h3></div>
        <div className="card-body">
          <div className="row gap-2">
            {[
              { title: 'Staff Nominal Roll', desc: 'Full directory of all serving personnel with grade levels.' },
              { title: 'Promotions Due', desc: 'Officers eligible for promotion within the next 12 months (+ awaiting review).' },
              { title: 'Awaiting Review', desc: 'Officers whose promotion review date has already passed.' },
              { title: 'Retirement Forecast', desc: 'Officers approaching statutory retirement within 3 years.' },
              { title: 'Departmental Headcount', desc: 'Staff strength and workforce share per department.' },
              { title: 'Grade Level Distribution', desc: 'Number of officers on each grade level (GL 03–17).' },
              { title: 'Gender & Diversity', desc: 'Male / female split across the workforce.' },
              { title: 'State of Origin Spread', desc: 'Federal-character view of staff by state of origin.' },
              { title: 'New Hires', desc: 'Everyone appointed in the current calendar year.' },
              { title: 'Age & Service Profile', desc: 'Age, years of service and retirement date per officer.' },
              { title: 'Data Quality — Missing Fields', desc: 'Records missing key HR fields, for clean-up.' },
              { title: 'Leave & Attendance Report', desc: 'Monthly summary of staff attendance and leave usage.' },
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

export default Reports
