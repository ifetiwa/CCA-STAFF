import { useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { useNavigate } from 'react-router-dom'
import {
  Upload, Download, ArrowRight, ArrowLeft, CheckCircle2, AlertTriangle,
  FileSpreadsheet, X, Loader,
} from 'lucide-react'
import { addStaffRecord } from '../data/staff'
import { listDepartments, subscribeDepartments } from '../data/departments'
import { useToast } from '../context/ToastContext'

// Fields that can be set when importing a staff row. The label is what's shown
// in the mapping dropdown; the `key` is the property on the staff record.
const IMPORT_FIELDS = [
  { key: 'staffId',               label: 'Staff ID',                 group: 'Identity', required: false },
  { key: 'fileNumber',            label: 'File Number',              group: 'Identity' },
  { key: 'nhisNumber',            label: 'NHIS Number',              group: 'Identity' },
  { key: 'nhfNumber',             label: 'National Housing Number',  group: 'Identity' },
  { key: 'yearOfCallToBar',       label: 'Year of Call to Bar',      group: 'Identity', type: 'number' },
  { key: 'status',                label: 'Status',                   group: 'Employment' },
  { key: 'title',                 label: 'Title',                    group: 'Identity' },
  { key: 'firstName',             label: 'First Name',               group: 'Identity', required: true },
  { key: 'middleName',            label: 'Middle Name',              group: 'Identity' },
  { key: 'lastName',              label: 'Last Name',                group: 'Identity', required: true },
  { key: 'gender',                label: 'Gender',                   group: 'Identity', required: true },
  { key: 'dateOfBirth',           label: 'Date of Birth',            group: 'Identity', required: true, type: 'date' },
  { key: 'placeOfBirth',          label: 'Place of Birth',           group: 'Identity' },
  { key: 'nationality',           label: 'Nationality',              group: 'Identity' },
  { key: 'stateOfOrigin',         label: 'State of Origin',          group: 'Identity', required: true },
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

  { key: 'email',                 label: 'Email',                    group: 'Contact', required: true },
  { key: 'phonePrimary',          label: 'Phone (primary)',          group: 'Contact', required: true },
  { key: 'phoneAlt',              label: 'Phone (alternative)',      group: 'Contact' },
  { key: 'residentialAddress',    label: 'Residential Address',      group: 'Contact' },
  { key: 'permanentAddress',      label: 'Permanent Address',        group: 'Contact' },
  { key: 'state',                 label: 'State (residence)',        group: 'Contact' },
  { key: 'city',                  label: 'City',                     group: 'Contact' },

  { key: 'cadre',                 label: 'Cadre',                    group: 'Employment' },
  { key: 'department',            label: 'Department',               group: 'Employment', required: true },
  { key: 'unit',                  label: 'Unit',                     group: 'Employment' },
  { key: 'designation',           label: 'Designation',              group: 'Employment', required: true },
  { key: 'postingLocation',       label: 'Posting Location',         group: 'Employment' },
  { key: 'gradeLevel',            label: 'Grade Level',              group: 'Employment', required: true },
  { key: 'step',                  label: 'Step',                     group: 'Employment' },
  { key: 'salaryAnnualNGN',       label: 'Annual Salary (₦)',        group: 'Employment', type: 'number' },
  { key: 'employmentType',        label: 'Employment Type',          group: 'Employment' },
  { key: 'firstAppointmentDate',  label: 'First Appointment Date',   group: 'Employment', required: true, type: 'date' },
  { key: 'confirmationDate',      label: 'Confirmation Date',        group: 'Employment', type: 'date' },
  { key: 'presentAppointmentDate',label: 'Present Appointment Date', group: 'Employment', type: 'date' },
  { key: 'lastPromotionDate',     label: 'Last Promotion Date',      group: 'Employment', type: 'date' },

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
  department: ['department', 'dept', 'division'],
  unit: ['unit', 'subunit', 'team', 'section'],
  designation: ['designation', 'role', 'jobtitle', 'position'],
  gradeLevel: ['gradelevel', 'grade', 'gl'],
  salaryAnnualNGN: ['salary', 'annualsalary', 'salaryannual', 'pay'],
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

// Convert an Excel-style date number, ISO string or dd/mm/yyyy into ISO.
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

const buildRecord = (rawRow, mapping) => {
  const out = {}
  const noks = [{}, {}, {}] // primary, secondary, tertiary
  for (const [header, key] of Object.entries(mapping)) {
    if (!key) continue
    const field = FIELDS_BY_KEY[key]
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

const validateRecord = (record, departments) => {
  const errors = []
  IMPORT_FIELDS.forEach((f) => {
    if (!f.required) return
    const v = f.key.startsWith('nok.')
      ? record.nextOfKins?.[0]?.[f.key.slice(4)]
      : f.key.startsWith('nok2.')
        ? record.nextOfKins?.[1]?.[f.key.slice(5)]
        : f.key.startsWith('nok3.')
          ? record.nextOfKins?.[2]?.[f.key.slice(5)]
          : record[f.key]
    if (v == null || String(v).trim() === '') errors.push(`${f.label} is required`)
  })
  if (record.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email)) errors.push('Invalid email format')
  if (record.nin && !/^\d{11}$/.test(String(record.nin))) errors.push('NIN must be 11 digits')
  if (record.dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(record.dateOfBirth)) errors.push('Date of Birth not in YYYY-MM-DD')
  if (record.firstAppointmentDate && !/^\d{4}-\d{2}-\d{2}$/.test(record.firstAppointmentDate)) {
    errors.push('First Appointment Date not in YYYY-MM-DD')
  }
  const matchedDept = record.department
    ? departments.find((d) => d.name.toLowerCase() === String(record.department).toLowerCase())
    : null
  if (record.department && !matchedDept) {
    errors.push(`Department "${record.department}" not found — add it under Settings → Departments`)
  }
  if (record.unit && matchedDept) {
    const units = matchedDept.units || []
    if (!units.some((u) => u.toLowerCase() === String(record.unit).toLowerCase())) {
      errors.push(`Unit "${record.unit}" is not defined under ${matchedDept.name}`)
    }
  } else if (record.unit && !matchedDept) {
    errors.push(`Unit "${record.unit}" set but no valid department mapped`)
  }
  return errors
}

const downloadTemplate = () => {
  const headers = IMPORT_FIELDS.map((f) => f.label)
  const sample = {
    'First Name': 'Chisom', 'Last Name': 'Adiala', 'Gender': 'Female',
    'Date of Birth': '1989-07-21', 'State of Origin': 'Anambra',
    'Email': 'chisom@example.com', 'Phone (primary)': '08012345678',
    'Department': 'Litigation Department', 'Unit': 'Stenography Unit',
    'Designation': 'Legal Officer',
    'Grade Level': '12', 'Step': '4', 'First Appointment Date': '2020-03-15',
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
  const [departments, setDepartments] = useState(() => listDepartments())
  useEffect(() => subscribeDepartments(() => setDepartments(listDepartments())), [])

  const [step, setStep] = useState(1)
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState([])    // array of objects keyed by header
  const [headers, setHeaders] = useState([])
  const [mapping, setMapping] = useState({}) // header -> field key or ''
  const [importing, setImporting] = useState(false)
  const [parseError, setParseError] = useState('')

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
      const errors = validateRecord(record, departments)
      return { idx, raw, record, errors }
    })
  }, [step, rows, mapping, departments])

  const validCount = validatedRows.filter((r) => r.errors.length === 0).length
  const invalidCount = validatedRows.length - validCount

  const mappedFieldKeys = useMemo(
    () => new Set(Object.values(mapping).filter(Boolean)),
    [mapping],
  )
  const missingRequired = IMPORT_FIELDS.filter((f) => f.required && !mappedFieldKeys.has(f.key))

  const doImport = () => {
    setImporting(true)
    const toImport = validatedRows.filter((r) => r.errors.length === 0)
    toImport.forEach(({ record }) => addStaffRecord(record))
    setImporting(false)
    toast.success(`Imported ${toImport.length} staff record(s).`)
    setStep(4)
  }

  const reset = () => {
    setStep(1); setFileName(''); setRows([]); setHeaders([]); setMapping({}); setParseError('')
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
          missingRequired={missingRequired}
          onBack={reset}
          onNext={() => setStep(3)}
        />
      )}

      {step === 3 && (
        <PreviewStep
          validatedRows={validatedRows}
          validCount={validCount}
          invalidCount={invalidCount}
          importing={importing}
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
              {validCount} record(s) added. {invalidCount > 0 && `${invalidCount} row(s) were skipped due to validation errors.`}
            </p>
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

const MappingStep = ({ fileName, headers, rows, mapping, setMapping, missingRequired, onBack, onNext }) => {
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

      {missingRequired.length > 0 && (
        <div className="alert alert-warning" style={{ marginBottom: '1rem' }}>
          <AlertTriangle size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Required fields not yet mapped: <strong>{missingRequired.map((f) => f.label).join(', ')}</strong>
        </div>
      )}

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
                                {f.label}{f.required ? ' *' : ''}{taken ? ' (already mapped)' : ''}
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
          disabled={missingRequired.length > 0}
          title={missingRequired.length > 0 ? 'Map all required fields first' : ''}
        >
          Continue to preview <ArrowRight size={16} />
        </button>
      </div>
    </>
  )
}

const PreviewStep = ({ validatedRows, validCount, invalidCount, importing, onBack, onConfirm }) => {
  const [showOnly, setShowOnly] = useState('all') // 'all' | 'valid' | 'invalid'
  const list = validatedRows.filter((r) => {
    if (showOnly === 'valid') return r.errors.length === 0
    if (showOnly === 'invalid') return r.errors.length > 0
    return true
  })
  const visible = list.slice(0, 50)

  return (
    <>
      <div className="row gap-3 mb-3">
        <StatTile color="#1a3a52" label="Total Rows" value={validatedRows.length} />
        <StatTile color="#27ae60" label="Ready to Import" value={validCount} />
        <StatTile color="#e74c3c" label="With Errors" value={invalidCount} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div className="btn-group" style={{ display: 'inline-flex', gap: 4 }}>
          {['all', 'valid', 'invalid'].map((key) => (
            <button
              key={key}
              className={`btn btn-sm ${showOnly === key ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setShowOnly(key)}
            >
              {key === 'all' ? 'All' : key === 'valid' ? 'Valid' : 'Errors'}
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
                <th style={{ width: 80 }}>Status</th>
                <th>Name</th>
                <th>Department</th>
                <th>Designation</th>
                <th>Email</th>
                <th>Errors</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(({ idx, record, errors }) => (
                <tr key={idx} style={errors.length ? { background: '#fef2f2' } : undefined}>
                  <td>{idx + 2}</td>
                  <td>
                    {errors.length ? (
                      <span className="chip" style={{ background: '#fee2e2', color: '#991b1b' }}>
                        <AlertTriangle size={12} /> Error
                      </span>
                    ) : (
                      <span className="chip" style={{ background: '#dcfce7', color: '#166534' }}>
                        <CheckCircle2 size={12} /> Valid
                      </span>
                    )}
                  </td>
                  <td>{[record.firstName, record.lastName].filter(Boolean).join(' ') || <em className="muted">—</em>}</td>
                  <td>{record.department || <em className="muted">—</em>}</td>
                  <td>{record.designation || <em className="muted">—</em>}</td>
                  <td>{record.email || <em className="muted">—</em>}</td>
                  <td style={{ fontSize: '0.85rem', color: '#b91c1c' }}>
                    {errors.join(' · ')}
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: '1.5rem' }}>
                  No rows match this filter.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
        <button className="btn btn-outline" onClick={onBack} disabled={importing}>
          <ArrowLeft size={16} /> Back to mapping
        </button>
        <button
          className="btn btn-primary"
          onClick={onConfirm}
          disabled={importing || validCount === 0}
        >
          {importing ? <Loader size={16} /> : <CheckCircle2 size={16} />}
          {importing ? 'Importing…' : `Import ${validCount} record${validCount === 1 ? '' : 's'}`}
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
