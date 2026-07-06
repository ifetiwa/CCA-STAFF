import { useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { useNavigate } from 'react-router-dom'
import {
  Upload, Download, ArrowRight, ArrowLeft, CheckCircle2, AlertTriangle,
  FileSpreadsheet, X, Loader,
} from 'lucide-react'
import { bulkCreateStaffFromForms } from '../data/staff'
import { addDepartment, addUnit } from '../data/departments'
import { addAgency } from '../data/agencies'
import { useToast } from '../context/ToastContext'

// How many rows to process per batch during import. Keeps the UI responsive
// (progress bar updates, no long main-thread freeze) on large spreadsheets.
const IMPORT_BATCH_SIZE = 50

// Fields that can be set when importing a staff row. The label is what's shown
// in the mapping dropdown; the `key` is the property on the staff record.
// NOTE: No field is marked `required` — bulk import accepts partial rows and
// fills in what it can. Missing departments/units/agencies are auto-created.
const IMPORT_FIELDS = [
  { key: 'staffId',               label: 'Staff ID',                 group: 'Identity' },
  { key: 'fileNumber',            label: 'File Number',              group: 'Identity' },
  { key: 'nhisNumber',            label: 'NHIS Number',              group: 'Identity' },
  { key: 'nhfNumber',             label: 'National Housing Number',  group: 'Identity' },
  { key: 'yearOfCallToBar',       label: 'Year of Call to Bar',      group: 'Identity', type: 'number' },
  { key: 'status',                label: 'Status',                   group: 'Employment' },
  { key: 'title',                 label: 'Title',                    group: 'Identity' },
  { key: 'firstName',             label: 'First Name',               group: 'Identity' },
  { key: 'middleName',            label: 'Middle Name',              group: 'Identity' },
  { key: 'lastName',              label: 'Last Name',                group: 'Identity' },
  { key: 'gender',                label: 'Gender',                   group: 'Identity' },
  { key: 'dateOfBirth',           label: 'Date of Birth',            group: 'Identity', type: 'date' },
  { key: 'placeOfBirth',          label: 'Place of Birth',           group: 'Identity' },
  { key: 'nationality',           label: 'Nationality',              group: 'Identity' },
  { key: 'stateOfOrigin',         label: 'State of Origin',          group: 'Identity' },
  { key: 'lga',                   label: 'LGA',                      group: 'Identity' },
  { key: 'senatorialDistrict',    label: 'Senatorial District',      group: 'Identity' },
  { key: 'geopoliticalZone',      label: 'Geopolitical Zone',        group: 'Identity' },
  { key: 'tribe',                 label: 'Tribe',                    group: 'Identity' },
  { key: 'religion',              label: 'Religion',                 group: 'Identity' },
  { key: 'languages',             label: 'Languages',                group: 'Identity' },
  { key: 'bloodGroup',            label: 'Blood Group',              group: 'Identity' },
  { key: 'genotype',              label: 'Genotype',                 group: 'Identity' },
  { key: 'disability',            label: 'Disability',               group: 'Identity' },
  { key: 'maritalStatus',         label: 'Marital Status',           group: 'Identity' },
  { key: 'spouseName',            label: 'Spouse Name',              group: 'Identity' },
  { key: 'numberOfChildren',      label: 'Number of Children',       group: 'Identity', type: 'number' },
  { key: 'nin',                   label: 'NIN',                      group: 'Identity' },

  { key: 'email',                 label: 'Email',                    group: 'Contact' },
  { key: 'phonePrimary',          label: 'Phone (primary)',          group: 'Contact' },
  { key: 'phoneAlt',              label: 'Phone (alternative)',      group: 'Contact' },
  { key: 'residentialAddress',    label: 'Residential Address',      group: 'Contact' },
  { key: 'permanentAddress',      label: 'Permanent Address',        group: 'Contact' },
  { key: 'state',                 label: 'State (residence)',        group: 'Contact' },
  { key: 'city',                  label: 'City',                     group: 'Contact' },

  { key: 'agency',                label: 'Agency',                   group: 'Employment' },
  { key: 'cadre',                 label: 'Cadre',                    group: 'Employment' },
  { key: 'department',            label: 'Department',               group: 'Employment' },
  { key: 'unit',                  label: 'Unit',                     group: 'Employment' },
  { key: 'designation',           label: 'Designation',              group: 'Employment' },
  { key: 'postingLocation',       label: 'Posting Location',         group: 'Employment' },
  { key: 'gradeLevel',            label: 'Grade Level',              group: 'Employment' },
  { key: 'step',                  label: 'Step',                     group: 'Employment' },
  { key: 'incrementMonth',        label: 'Increment Month',          group: 'Employment' },
  { key: 'employmentType',        label: 'Employment Type',          group: 'Employment' },
  { key: 'firstAppointmentDate',  label: 'First Appointment Date',   group: 'Employment', type: 'date' },
  { key: 'confirmationDate',      label: 'Confirmation Date',        group: 'Employment', type: 'date' },
  { key: 'presentAppointmentDate',label: 'Present Appointment Date', group: 'Employment', type: 'date' },
  { key: 'lastPromotionDate',     label: 'Last Promotion Date',      group: 'Employment', type: 'date' },

  { key: 'qualifications',        label: 'Qualifications',           group: 'Education' },

  { key: 'bankName',              label: 'Bank Name',                group: 'Financial' },
  { key: 'accountNumber',         label: 'Account Number',           group: 'Financial' },
  { key: 'pfa',                   label: 'PFA',                      group: 'Financial' },
  { key: 'rsaPin',                label: 'RSA PIN',                  group: 'Financial' },
  { key: 'tin',                   label: 'TIN',                      group: 'Financial' },

  { key: 'nok.name',              label: 'Next of Kin (Primary) — Name',         group: 'Next of Kin' },
  { key: 'nok.relationship',      label: 'Next of Kin (Primary) — Relationship', group: 'Next of Kin' },
  { key: 'nok.phone',             label: 'Next of Kin (Primary) — Phone',        group: 'Next of Kin' },
  { key: 'nok.email',             label: 'Next of Kin (Primary) — Email',        group: 'Next of Kin' },
  { key: 'nok.address',           label: 'Next of Kin (Primary) — Address',      group: 'Next of Kin' },
  { key: 'nok2.name',             label: 'Next of Kin (Secondary) — Name',         group: 'Next of Kin' },
  { key: 'nok2.relationship',     label: 'Next of Kin (Secondary) — Relationship', group: 'Next of Kin' },
  { key: 'nok2.phone',            label: 'Next of Kin (Secondary) — Phone',        group: 'Next of Kin' },
  { key: 'nok2.email',            label: 'Next of Kin (Secondary) — Email',        group: 'Next of Kin' },
  { key: 'nok2.address',          label: 'Next of Kin (Secondary) — Address',      group: 'Next of Kin' },
  { key: 'nok3.name',             label: 'Next of Kin (Tertiary) — Name',         group: 'Next of Kin' },
  { key: 'nok3.relationship',     label: 'Next of Kin (Tertiary) — Relationship', group: 'Next of Kin' },
  { key: 'nok3.phone',            label: 'Next of Kin (Tertiary) — Phone',        group: 'Next of Kin' },
  { key: 'nok3.email',            label: 'Next of Kin (Tertiary) — Email',        group: 'Next of Kin' },
  { key: 'nok3.address',          label: 'Next of Kin (Tertiary) — Address',      group: 'Next of Kin' },
]

const FIELDS_BY_KEY = Object.fromEntries(IMPORT_FIELDS.map((f) => [f.key, f]))

// Strip everything but letters and digits so "Date of Birth" and "date_of_birth"
// and "DOB" can all match.
const normalise = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

const HEADER_SYNONYMS = {
  staffId: ['staffid', 'staffno', 'staffnumber', 'employeeid', 'employeeno', 'cca'],
  fileNumber: ['fileno', 'filenumber', 'file'],
  nhisNumber: ['nhis', 'nhisno', 'nhisnumber', 'ippis', 'ippisno', 'ippisnumber'],
  nhfNumber: ['nhf', 'nhfno', 'nhfnumber', 'nationalhousing', 'nationalhousingnumber', 'nhfpin', 'housing'],
  yearOfCallToBar: ['yearofcalltobar', 'yearofcall', 'calltobar', 'callyear'],
  status: ['status', 'staffstatus', 'employmentstatus'],
  firstName: ['firstname', 'givenname', 'forename'],
  middleName: ['middlename', 'othername', 'othernames'],
  lastName: ['lastname', 'surname', 'familyname'],
  dateOfBirth: ['dateofbirth', 'dob', 'birthdate', 'birthday'],
  placeOfBirth: ['placeofbirth', 'pob'],
  stateOfOrigin: ['stateoforigin', 'origin', 'state'],
  geopoliticalZone: ['geopoliticalzone', 'zone'],
  numberOfChildren: ['numberofchildren', 'children', 'nochildren'],
  phonePrimary: ['phone', 'phoneprimary', 'mobile', 'mobileno', 'phonenumber', 'gsm'],
  phoneAlt: ['phonealt', 'altphone', 'alternativephone', 'phone2'],
  residentialAddress: ['residentialaddress', 'address', 'residence'],
  permanentAddress: ['permanentaddress', 'homeaddress'],
  agency: ['agency', 'parentagency', 'mda', 'organisation', 'organization', 'establishment'],
  department: ['department', 'dept', 'division'],
  unit: ['unit', 'subunit', 'team', 'section'],
  designation: ['designation', 'role', 'jobtitle', 'position'],
  gradeLevel: ['gradelevel', 'grade', 'gl'],
  incrementMonth: ['incrementmonth', 'increamentalmonth', 'incrementalmonth', 'stepincrementmonth', 'incrementperiod'],
  qualifications: ['qualifications', 'qualification', 'education', 'educationalqualification', 'certificates', 'certifications', 'academicqualifications'],
  employmentType: ['employmenttype', 'employment', 'jobtype'],
  firstAppointmentDate: ['firstappointmentdate', 'dateofappointment', 'appointmentdate', 'doa'],
  lastPromotionDate: ['lastpromotiondate', 'lastpromotion', 'promotiondate'],
  accountNumber: ['accountnumber', 'accountno', 'acctno'],
  bankName: ['bankname', 'bank'],
  rsaPin: ['rsapin', 'rsa'],
  'nok.name': ['nokname', 'nextofkinname', 'nextofkin', 'kinname', 'nok1name', 'nextofkin1name'],
  'nok.relationship': ['nokrelationship', 'kinrelationship', 'nextofkinrelationship', 'nok1relationship'],
  'nok.phone': ['nokphone', 'kinphone', 'nok1phone'],
  'nok.email': ['nokemail', 'kinemail', 'nok1email'],
  'nok.address': ['nokaddress', 'kinaddress', 'nok1address'],
  'nok2.name': ['nok2name', 'nextofkin2name', 'secondarynokname', 'secondarynextofkin'],
  'nok2.relationship': ['nok2relationship', 'nextofkin2relationship', 'secondarynokrelationship'],
  'nok2.phone': ['nok2phone', 'nextofkin2phone', 'secondarynokphone'],
  'nok2.email': ['nok2email', 'nextofkin2email', 'secondarynokemail'],
  'nok2.address': ['nok2address', 'nextofkin2address', 'secondarynokaddress'],
  'nok3.name': ['nok3name', 'nextofkin3name', 'tertiarynokname', 'tertiarynextofkin'],
  'nok3.relationship': ['nok3relationship', 'nextofkin3relationship', 'tertiarynokrelationship'],
  'nok3.phone': ['nok3phone', 'nextofkin3phone', 'tertiarynokphone'],
  'nok3.email': ['nok3email', 'nextofkin3email', 'tertiarynokemail'],
  'nok3.address': ['nok3address', 'nextofkin3address', 'tertiarynokaddress'],
}

const autoMapHeader = (header) => {
  const n = normalise(header)
  if (!n) return ''
  // Synonym match
  for (const [key, list] of Object.entries(HEADER_SYNONYMS)) {
    if (list.includes(n)) return key
  }
  // Exact label / key match
  for (const f of IMPORT_FIELDS) {
    if (normalise(f.key) === n || normalise(f.label) === n) return f.key
  }
  return ''
}

const MONTH_INDEX = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

// Expand a 2- or 4-digit year. Two-digit years use a pivot: 00–30 → 2000s,
// 31–99 → 1900s. This suits a staff roll where birthdays run 1931–2030 and
// avoids turning "64" (1964) into 2064.
const expandYear = (y) => {
  if (y.length === 4) return Number(y)
  const n = Number(y)
  return n <= 30 ? 2000 + n : 1900 + n
}

// Convert an Excel-style date number, ISO string, dd/mm/yyyy or a
// "26-Apr-77" / "9 Aug 1991" style date into ISO (YYYY-MM-DD).
const toIsoDate = (val) => {
  if (val == null || val === '') return ''
  if (typeof val === 'number') {
    const parsed = XLSX.SSF.parse_date_code(val)
    if (parsed) {
      const mm = String(parsed.m).padStart(2, '0')
      const dd = String(parsed.d).padStart(2, '0')
      return `${parsed.y}-${mm}-${dd}`
    }
  }
  const s = String(val).trim()
  // dd-Mon-yy / dd Mon yyyy (e.g. 26-Apr-77, 9 Aug 1991)
  const dMonY = s.match(/^(\d{1,2})[\s\-/.]+([A-Za-z]{3,9})[\s\-/.]+(\d{2,4})$/)
  if (dMonY) {
    const [, d, mName, y] = dMonY
    const m = MONTH_INDEX[mName.slice(0, 3).toLowerCase()]
    if (m) {
      return `${expandYear(y)}-${String(m).padStart(2, '0')}-${d.padStart(2, '0')}`
    }
  }
  // dd/mm/yyyy or dd-mm-yyyy
  const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/)
  if (dmy) {
    const [, d, m, y] = dmy
    const yyyy = y.length === 2 ? `20${y}` : y
    return `${yyyy}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  // Already iso
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const d = new Date(s)
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return s
}

const coerce = (value, field) => {
  if (!field) return value
  if (field.type === 'number') {
    if (value === '' || value == null) return null
    const n = Number(String(value).replace(/[^\d.-]/g, ''))
    return Number.isNaN(n) ? null : n
  }
  if (field.type === 'date') return toIsoDate(value)
  return value == null ? '' : String(value).trim()
}

// Turn a free-text qualifications cell into the array shape the rest of the
// app expects ([{ school, qualification, year, grade }]). Multiple entries can
// be separated by a newline, semicolon or pipe. A single entry is stored under
// `qualification`; school/year/grade are left blank for the user to fill in.
const parseQualifications = (val) => {
  const s = String(val == null ? '' : val).trim()
  if (!s) return []
  return s
    .split(/\s*[\n;|]\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const year = (part.match(/\b(19|20)\d{2}\b/) || [])[0] || ''
      return { school: '', qualification: part, year, grade: '' }
    })
}

const buildRecord = (rawRow, mapping) => {
  const out = {}
  const noks = [{}, {}, {}] // primary, secondary, tertiary
  for (const [header, key] of Object.entries(mapping)) {
    if (!key) continue
    const field = FIELDS_BY_KEY[key]
    if (key === 'qualifications') {
      out.qualifications = parseQualifications(rawRow[header])
      continue
    }
    const value = coerce(rawRow[header], field)
    if (key.startsWith('nok.')) {
      noks[0][key.slice(4)] = value
    } else if (key.startsWith('nok2.')) {
      noks[1][key.slice(5)] = value
    } else if (key.startsWith('nok3.')) {
      noks[2][key.slice(5)] = value
    } else {
      out[key] = value
    }
  }
  // Only persist NOK slots that actually had data in the spreadsheet, and drop
  // trailing empty slots so the record doesn't carry blank Secondary/Tertiary.
  const filledNoks = noks
    .map((n) => Object.keys(n).length ? n : null)
    .filter(Boolean)
  while (filledNoks.length && !Object.values(filledNoks[filledNoks.length - 1]).some((v) => String(v || '').trim())) {
    filledNoks.pop()
  }
  if (filledNoks.length) {
    out.nextOfKins = filledNoks
    out.nextOfKin = filledNoks[0] // legacy mirror
  }
  return out
}

// No field is required for bulk import. We only surface *format* problems on
// values that were actually supplied (so obviously-broken data still gets
// flagged), and even those are warnings — every row is importable. Unknown
// departments, units and agencies are created automatically at import time,
// so they are never treated as errors here.
const validateRecord = (record) => {
  const warnings = []
  if (record.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email)) warnings.push('Email format looks off')
  if (record.nin && !/^\d{11}$/.test(String(record.nin))) warnings.push('NIN should be 11 digits')
  if (record.dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(record.dateOfBirth)) warnings.push('Date of Birth not in YYYY-MM-DD')
  if (record.firstAppointmentDate && !/^\d{4}-\d{2}-\d{2}$/.test(record.firstAppointmentDate)) {
    warnings.push('First Appointment Date not in YYYY-MM-DD')
  }
  return warnings
}

const downloadTemplate = () => {
  const headers = IMPORT_FIELDS.map((f) => f.label)
  const sample = {
    'First Name': 'Chisom', 'Last Name': 'Adiala', 'Gender': 'Female',
    'Date of Birth': '1989-07-21', 'State of Origin': 'Anambra',
    'Email': 'chisom@example.com', 'Phone (primary)': '08012345678',
    'Agency': 'Customary Court of Appeal',
    'Department': 'Litigation Department', 'Unit': 'Stenography Unit',
    'Designation': 'Legal Officer',
    'Grade Level': '12', 'Step': '4', 'Increment Month': 'January',
    'First Appointment Date': '2020-03-15',
    'Qualifications': 'LL.B, University of Nigeria (2010); B.L, Nigerian Law School (2011)',
  }
  const row = Object.fromEntries(headers.map((h) => [h, sample[h] || '']))
  const ws = XLSX.utils.json_to_sheet([row], { header: headers })
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Staff')
  XLSX.writeFile(wb, 'cca-staff-import-template.xlsx')
}

const BulkImport = () => {
  const toast = useToast()
  const navigate = useNavigate()
  const fileInput = useRef(null)

  const [step, setStep] = useState(1)
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState([])    // array of objects keyed by header
  const [headers, setHeaders] = useState([])
  const [mapping, setMapping] = useState({}) // header -> field key or ''
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [parseError, setParseError] = useState('')
  const [importedCount, setImportedCount] = useState(0)
  const [failedRows, setFailedRows] = useState([])

  const handleFile = async (file) => {
    setParseError('')
    setFileName(file.name)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      if (!sheet) throw new Error('No sheets found in the file.')
      const json = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: true })
      if (json.length === 0) throw new Error('The first sheet has no data rows.')
      const hdrs = Object.keys(json[0])
      const initial = Object.fromEntries(hdrs.map((h) => [h, autoMapHeader(h)]))
      setHeaders(hdrs)
      setRows(json)
      setMapping(initial)
      setStep(2)
    } catch (err) {
      setParseError(err.message || 'Could not parse the file.')
    }
  }

  const onFilePicked = (e) => {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
    e.target.value = ''
  }

  const validatedRows = useMemo(() => {
    if (step < 3) return []
    return rows.map((raw, idx) => {
      const record = buildRecord(raw, mapping)
      const warnings = validateRecord(record)
      return { idx, raw, record, warnings }
    })
  }, [step, rows, mapping])

  // Every row is importable now — warnings are advisory only.
  const importableCount = validatedRows.length
  const warningCount = validatedRows.filter((r) => r.warnings.length > 0).length

  // Make sure any department / unit / agency the spreadsheet mentions exists in
  // the local stores before (or as) we import, so nothing is silently dropped
  // and the new values show up in Settings and the filters immediately.
  const ensureLookups = (records) => {
    const depts = new Set()
    const unitsByDept = new Map()
    const agencies = new Set()
    records.forEach((r) => {
      const dept = String(r.department || '').trim()
      const unit = String(r.unit || '').trim()
      const agency = String(r.agency || '').trim()
      if (dept) {
        depts.add(dept)
        if (unit) {
          if (!unitsByDept.has(dept)) unitsByDept.set(dept, new Set())
          unitsByDept.get(dept).add(unit)
        }
      }
      if (agency) agencies.add(agency)
    })
    depts.forEach((name) => addDepartment({ name }))          // no-op if it exists
    unitsByDept.forEach((units, dept) => units.forEach((u) => addUnit(dept, u)))
    agencies.forEach((name) => addAgency(name))
  }

  const doImport = async () => {
    setImporting(true)
    const toImport = validatedRows.map((r) => r.record)
    setProgress({ done: 0, total: toImport.length })

    // Auto-create referenced departments / units / agencies locally so they
    // show in Settings and the filters (departments/designations are also
    // auto-created server-side while saving each record).
    ensureLookups(toImport)

    // Save to the server in batches so records appear on every device.
    const { created, failed } = await bulkCreateStaffFromForms(toImport, {
      batchSize: IMPORT_BATCH_SIZE,
      onProgress: (done, total) => setProgress({ done, total }),
    })

    setImportedCount(created)
    setFailedRows(failed)
    setImporting(false)
    if (failed.length) {
      toast.error(`Imported ${created}; ${failed.length} row(s) could not be saved.`)
    } else {
      toast.success(`Imported ${created} staff record(s).`)
    }
    setStep(4)
  }

  const reset = () => {
    setStep(1); setFileName(''); setRows([]); setHeaders([]); setMapping({}); setParseError('')
    setProgress({ done: 0, total: 0 }); setImportedCount(0); setFailedRows([])
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Bulk Import Staff</h1>
          <p className="page-header-sub">
            Import many staff members at once from a CSV or Excel file. Map your columns to the
            system fields, preview, then import.
          </p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline" onClick={downloadTemplate}>
            <Download size={18} /> Download Template
          </button>
        </div>
      </div>

      <Stepper step={step} />

      {step === 1 && (
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
            <FileSpreadsheet size={48} style={{ color: '#1a3a52', marginBottom: '0.75rem' }} />
            <h3 style={{ marginBottom: '0.5rem' }}>Choose a CSV or Excel file</h3>
            <p className="muted" style={{ marginBottom: '1.5rem' }}>
              Supported formats: .csv, .xlsx, .xls. The first sheet's first row should be column headers.
            </p>
            <button className="btn btn-primary" onClick={() => fileInput.current?.click()}>
              <Upload size={18} /> Choose File
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={onFilePicked}
              style={{ display: 'none' }}
            />
            {parseError && (
              <div className="alert alert-danger" style={{ marginTop: '1.25rem', textAlign: 'left' }}>
                {parseError}
              </div>
            )}
          </div>
        </div>
      )}

      {step === 2 && (
        <MappingStep
          fileName={fileName}
          headers={headers}
          rows={rows}
          mapping={mapping}
          setMapping={setMapping}
          onBack={reset}
          onNext={() => setStep(3)}
        />
      )}

      {step === 3 && (
        <PreviewStep
          validatedRows={validatedRows}
          importableCount={importableCount}
          warningCount={warningCount}
          importing={importing}
          progress={progress}
          onBack={() => setStep(2)}
          onConfirm={doImport}
        />
      )}

      {step === 4 && (
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
            <CheckCircle2 size={48} style={{ color: '#27ae60', marginBottom: '0.75rem' }} />
            <h3 style={{ marginBottom: '0.5rem' }}>Import complete</h3>
            <p className="muted" style={{ marginBottom: '1.25rem' }}>
              {importedCount} record(s) saved to the server. Any new departments, units and agencies were created automatically.
            </p>
            {failedRows.length > 0 && (
              <div className="alert alert-warning" style={{ textAlign: 'left', margin: '0 auto 1.25rem', maxWidth: 640 }}>
                <strong>{failedRows.length} row(s) could not be saved:</strong>
                <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem', maxHeight: 180, overflowY: 'auto' }}>
                  {failedRows.slice(0, 50).map((f) => (
                    <li key={f.index} className="small">Row {f.index + 2} — {f.name}: {f.reason}</li>
                  ))}
                </ul>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
              <button className="btn btn-outline" onClick={reset}>Import Another File</button>
              <button className="btn btn-primary" onClick={() => navigate('/staff')}>Go to Staff Directory</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const Stepper = ({ step }) => {
  const steps = ['Upload File', 'Map Columns', 'Preview & Validate', 'Done']
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '0.75rem 1rem', marginBottom: '1rem',
      background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0',
    }}>
      {steps.map((label, idx) => {
        const n = idx + 1
        const active = step === n
        const done = step > n
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%',
              background: done ? '#27ae60' : active ? '#1a3a52' : '#cbd5e1',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 600, fontSize: 13,
            }}>{done ? '✓' : n}</div>
            <span style={{
              fontWeight: active ? 600 : 400,
              color: active ? '#1a3a52' : done ? '#475569' : '#94a3b8',
            }}>{label}</span>
            {n < steps.length && <ArrowRight size={14} style={{ color: '#cbd5e1', margin: '0 0.25rem' }} />}
          </div>
        )
      })}
    </div>
  )
}

const MappingStep = ({ fileName, headers, rows, mapping, setMapping, onBack, onNext }) => {
  const sample = (header) => {
    for (const row of rows) {
      const v = row[header]
      if (v != null && v !== '') return String(v)
    }
    return ''
  }

  const setOne = (header, key) => setMapping((prev) => ({ ...prev, [header]: key }))

  const usedKeys = new Set(Object.values(mapping).filter(Boolean))

  return (
    <>
      <div className="card mb-3">
        <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong>{fileName}</strong>
            <div className="muted small">{rows.length} row(s) detected · {headers.length} column(s)</div>
          </div>
          <button className="btn btn-sm btn-outline" onClick={onBack}><X size={14} /> Use another file</button>
        </div>
      </div>

      <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
        <AlertTriangle size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
        No column is mandatory — map what you have and skip the rest. New departments, units
        and agencies found in your file are created automatically on import.
      </div>

      <div className="card">
        <div className="card-header"><h3 style={{ margin: 0, color: '#fff' }}>Map columns</h3></div>
        <div className="card-body" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '30%' }}>Your column</th>
                <th style={{ width: '30%' }}>Sample value</th>
                <th>Map to system field</th>
              </tr>
            </thead>
            <tbody>
              {headers.map((h) => (
                <tr key={h}>
                  <td><strong>{h}</strong></td>
                  <td className="muted">{sample(h) || <em>(empty)</em>}</td>
                  <td>
                    <select
                      className="form-control"
                      value={mapping[h] || ''}
                      onChange={(e) => setOne(h, e.target.value)}
                    >
                      <option value="">— Skip this column —</option>
                      {Object.entries(
                        IMPORT_FIELDS.reduce((acc, f) => {
                          acc[f.group] = acc[f.group] || []
                          acc[f.group].push(f)
                          return acc
                        }, {}),
                      ).map(([group, items]) => (
                        <optgroup key={group} label={group}>
                          {items.map((f) => {
                            const taken = usedKeys.has(f.key) && mapping[h] !== f.key
                            return (
                              <option key={f.key} value={f.key} disabled={taken}>
                                {f.label}{taken ? ' (already mapped)' : ''}
                              </option>
                            )
                          })}
                        </optgroup>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
        <button className="btn btn-outline" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <button
          className="btn btn-primary"
          onClick={onNext}
        >
          Continue to preview <ArrowRight size={16} />
        </button>
      </div>
    </>
  )
}

const PreviewStep = ({ validatedRows, importableCount, warningCount, importing, progress, onBack, onConfirm }) => {
  const [showOnly, setShowOnly] = useState('all') // 'all' | 'clean' | 'warnings'
  const list = validatedRows.filter((r) => {
    if (showOnly === 'clean') return r.warnings.length === 0
    if (showOnly === 'warnings') return r.warnings.length > 0
    return true
  })
  const visible = list.slice(0, 50)
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <>
      <div className="row gap-3 mb-3">
        <StatTile color="#1a3a52" label="Total Rows" value={validatedRows.length} />
        <StatTile color="#27ae60" label="Ready to Import" value={importableCount} />
        <StatTile color="#f39c12" label="With Warnings" value={warningCount} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div className="btn-group" style={{ display: 'inline-flex', gap: 4 }}>
          {['all', 'clean', 'warnings'].map((key) => (
            <button
              key={key}
              className={`btn btn-sm ${showOnly === key ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setShowOnly(key)}
            >
              {key === 'all' ? 'All' : key === 'clean' ? 'Clean' : 'Warnings'}
            </button>
          ))}
        </div>
        <span className="muted small">Showing first {visible.length} of {list.length}</span>
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 50 }}>Row</th>
                <th style={{ width: 90 }}>Status</th>
                <th>Name</th>
                <th>Agency</th>
                <th>Department</th>
                <th>Unit</th>
                <th>Designation</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(({ idx, record, warnings }) => (
                <tr key={idx} style={warnings.length ? { background: '#fffbeb' } : undefined}>
                  <td>{idx + 2}</td>
                  <td>
                    {warnings.length ? (
                      <span className="chip" style={{ background: '#fef3c7', color: '#92400e' }}>
                        <AlertTriangle size={12} /> Check
                      </span>
                    ) : (
                      <span className="chip" style={{ background: '#dcfce7', color: '#166534' }}>
                        <CheckCircle2 size={12} /> Ready
                      </span>
                    )}
                  </td>
                  <td>{[record.firstName, record.lastName].filter(Boolean).join(' ') || <em className="muted">—</em>}</td>
                  <td>{record.agency || <em className="muted">—</em>}</td>
                  <td>{record.department || <em className="muted">—</em>}</td>
                  <td>{record.unit || <em className="muted">—</em>}</td>
                  <td>{record.designation || <em className="muted">—</em>}</td>
                  <td style={{ fontSize: '0.85rem', color: '#b45309' }}>
                    {warnings.join(' · ')}
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr><td colSpan={8} className="muted" style={{ textAlign: 'center', padding: '1.5rem' }}>
                  No rows match this filter.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {importing && (
        <div style={{ marginTop: '1rem' }}>
          <div className="muted small" style={{ marginBottom: 4 }}>
            Importing {progress.done} of {progress.total}…
          </div>
          <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: '#27ae60', transition: 'width 0.2s' }} />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
        <button className="btn btn-outline" onClick={onBack} disabled={importing}>
          <ArrowLeft size={16} /> Back to mapping
        </button>
        <button
          className="btn btn-primary"
          onClick={onConfirm}
          disabled={importing || importableCount === 0}
        >
          {importing ? <Loader size={16} /> : <CheckCircle2 size={16} />}
          {importing ? 'Importing…' : `Import ${importableCount} record${importableCount === 1 ? '' : 's'}`}
        </button>
      </div>
    </>
  )
}

const StatTile = ({ color, label, value }) => (
  <div className="col-4">
    <div className="card">
      <div className="card-body">
        <div className="muted" style={{ fontSize: '0.9rem' }}>{label}</div>
        <div style={{ color, fontSize: '2rem', fontWeight: 700 }}>{value}</div>
      </div>
    </div>
  </div>
)

export default BulkImport
