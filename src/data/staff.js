// =============================================================================
// CCA Staff — Centralised mock data + service-rule calculators.
// Tuned to Nigerian Public/Civil Service standards.
// Rules used (set in one place so they can be tweaked or pulled from a settings
// table later):
//   - Mandatory retirement: 60 years OR 35 years of service, whichever first.
//   - Standard promotion review cycle: 3 years from last promotion.
// =============================================================================

export const RETIREMENT_AGE_YEARS = 60;
export const MAX_SERVICE_YEARS = 35;
export const PROMOTION_CYCLE_YEARS = 3;

// Allowed values for the staff Status field. Used by the AddStaff form,
// the StaffList filter, and the badge colour mapping below.
export const STATUSES = [
  'Active',
  'On Leave',
  'Pending',
  'Secondment',
  'Suspension',
  'Retirement',
  'Resignation',
  'Deceased',
  'Archive',
];

// Maps a status to a semantic badge tone (matches the `badge-<tone>` classes
// already defined in styles/index.css). Centralised so every list/detail/PDF
// renders the same colour for the same status.
export const statusTone = (status) => ({
  Active:      'success',
  'On Leave':  'info',
  Pending:     'warning',
  Secondment:  'info',
  Suspension:  'danger',
  Retirement:  'muted',
  Resignation: 'danger',
  Deceased:    'danger',
  Archive:     'muted',
}[status] || 'warning');

const parse = (d) => (d ? new Date(d + (d.length === 10 ? 'T00:00:00' : '')) : null);
const iso = (d) => (d instanceof Date && !isNaN(d) ? d.toISOString().slice(0, 10) : null);
const addYears = (d, n) => { const c = new Date(d); c.setFullYear(c.getFullYear() + n); return c; };
const dayDiff = (a, b) => Math.floor((b - a) / 86_400_000);

export const yearsBetween = (from, to = new Date()) => {
  const f = parse(from); if (!f) return 0;
  const t = to instanceof Date ? to : parse(to);
  let years = t.getFullYear() - f.getFullYear();
  const before = t.getMonth() < f.getMonth() || (t.getMonth() === f.getMonth() && t.getDate() < f.getDate());
  if (before) years -= 1;
  return Math.max(0, years);
};

export const calcRetirementDate = (dateOfBirth, firstAppointmentDate) => {
  const dob = parse(dateOfBirth);
  const start = parse(firstAppointmentDate);
  if (!dob && !start) return null;
  const byAge = dob ? addYears(dob, RETIREMENT_AGE_YEARS) : null;
  const byService = start ? addYears(start, MAX_SERVICE_YEARS) : null;
  if (byAge && byService) return iso(byAge < byService ? byAge : byService);
  return iso(byAge || byService);
};

export const calcNextPromotionDate = (lastPromotionDate, firstAppointmentDate) => {
  const last = parse(lastPromotionDate) || parse(firstAppointmentDate);
  if (!last) return null;
  return iso(addYears(last, PROMOTION_CYCLE_YEARS));
};

export const daysUntil = (date) => {
  const t = parse(date); if (!t) return null;
  return dayDiff(new Date(), t);
};

export const formatDate = (d) => {
  if (!d) return '—';
  const date = parse(d);
  if (!date || isNaN(date)) return '—';
  return date.toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: '2-digit' });
};

export const fullName = (s) =>
  [s.title, s.firstName, s.middleName, s.lastName].filter(Boolean).join(' ').trim();

export const initialsOf = (s) =>
  ((s.firstName?.[0] || '') + (s.lastName?.[0] || '')).toUpperCase() || 'S';

// Up to 3 next-of-kin entries: Primary, Secondary, Tertiary. We normalise
// legacy single-NOK records (`nextOfKin: {...}`) into the `nextOfKins` array
// in enrich() so the rest of the app only has to deal with one shape.
export const MAX_NEXT_OF_KIN = 3;
export const NEXT_OF_KIN_LABELS = ['Primary', 'Secondary', 'Tertiary'];

const emptyNok = () => ({ name: '', relationship: '', phone: '', email: '', address: '' });

const nokIsEmpty = (n) =>
  !n || !['name', 'relationship', 'phone', 'email', 'address'].some((k) => String(n[k] || '').trim());

export const normaliseNextOfKins = (s) => {
  let list = Array.isArray(s.nextOfKins) ? [...s.nextOfKins] : [];
  if (!list.length && s.nextOfKin) list = [s.nextOfKin];
  list = list.slice(0, MAX_NEXT_OF_KIN).map((n) => ({ ...emptyNok(), ...(n || {}) }));
  return list;
};

// -- Decorate raw rows with calculated fields ---------------------------------
export const enrich = (s) => {
  const yearsOfService = yearsBetween(s.firstAppointmentDate);
  const age = yearsBetween(s.dateOfBirth);
  const retirementDate = calcRetirementDate(s.dateOfBirth, s.firstAppointmentDate);
  const nextPromotionDate = calcNextPromotionDate(s.lastPromotionDate, s.firstAppointmentDate);
  const nextOfKins = normaliseNextOfKins(s);
  return {
    ...s,
    nextOfKins,
    nextOfKin: nextOfKins[0] || emptyNok(),
    fullName: fullName(s),
    initials: initialsOf(s),
    age,
    yearsOfService,
    retirementDate,
    retirementInDays: daysUntil(retirementDate),
    nextPromotionDate,
    nextPromotionInDays: daysUntil(nextPromotionDate),
  };
};

// -- The dataset ---------------------------------------------------------------
const RAW = [
  {
    id: 1,
    staffId: 'CCA/2020/0001',
    fileNumber: 'F-2020-0001',
    nhisNumber: '20200001',
    title: 'Mrs.',
    firstName: 'Chisom',
    middleName: 'Amaka',
    lastName: 'Adiala',
    otherNames: '',
    gender: 'Female',
    dateOfBirth: '1989-07-21',
    placeOfBirth: 'Enugu',
    nationality: 'Nigerian',
    stateOfOrigin: 'Anambra',
    lga: 'Awka South',
    senatorialDistrict: 'Anambra Central',
    geopoliticalZone: 'South East',
    tribe: 'Igbo',
    religion: 'Christianity',
    languages: 'English, Igbo, Yoruba',
    bloodGroup: 'O+',
    genotype: 'AA',
    disability: 'None',
    maritalStatus: 'Married',
    spouseName: 'Ifeanyi Adiala',
    numberOfChildren: 2,
    nin: '12345678901',
    email: 'chisom.adiala@cca.gov.ng',
    phonePrimary: '08012345678',
    phoneAlt: '07098765432',
    permanentAddress: 'No 14 Aminu Kano Crescent, Wuse II, Abuja',
    residentialAddress: 'No 14 Aminu Kano Crescent, Wuse II, Abuja',
    state: 'FCT', city: 'Abuja',
    cadre: 'Legal',
    department: 'Litigation Department',
    designation: 'Legal Officer',
    postingLocation: 'CCA Headquarters, Abuja',
    gradeLevel: '12',
    step: '4',
    salaryAnnualNGN: 2_400_000,
    employmentType: 'Permanent',
    firstAppointmentDate: '2020-03-15',
    confirmationDate: '2022-03-15',
    presentAppointmentDate: '2020-03-15',
    lastPromotionDate: '2024-01-01',
    isActive: true,
    status: 'Active',
    bankName: 'Zenith Bank',
    accountNumber: '2089123456',
    pfa: 'ARM Pension Managers',
    rsaPin: 'PEN200000123456',
    tin: '12345678-0001',
    qualifications: [
      { school: 'University of Nigeria, Nsukka', qualification: 'LL.B (Hons)', year: 2010, grade: '2:1' },
      { school: 'Nigerian Law School, Abuja', qualification: 'B.L', year: 2011, grade: 'Pass' },
      { school: 'University of Lagos', qualification: 'LL.M', year: 2018, grade: 'Distinction' },
    ],
    nextOfKin: { name: 'Ifeanyi Adiala', relationship: 'Husband', phone: '08099887766', email: 'ifeanyi.adiala@gmail.com', address: 'Wuse II, Abuja' },
    serviceHistory: [
      { date: '2020-03-15', event: 'First appointment', detail: 'Engaged as Legal Officer II, GL 09' },
      { date: '2022-03-15', event: 'Confirmation of appointment', detail: 'Confirmed by HR' },
      { date: '2024-01-01', event: 'Promotion', detail: 'Promoted to Legal Officer I (GL 12)' },
    ],
  },
  {
    id: 2,
    staffId: 'CCA/2019/0002',
    fileNumber: 'F-2019-0002',
    nhisNumber: '20190002',
    title: 'Hajia',
    firstName: 'Fatima',
    middleName: 'Aisha',
    lastName: 'Ibrahim',
    otherNames: '',
    gender: 'Female',
    dateOfBirth: '1986-02-04',
    placeOfBirth: 'Kano',
    nationality: 'Nigerian',
    stateOfOrigin: 'Kano',
    lga: 'Nasarawa',
    senatorialDistrict: 'Kano Central',
    geopoliticalZone: 'North West',
    tribe: 'Hausa',
    religion: 'Islam',
    languages: 'English, Hausa, Fulfulde',
    bloodGroup: 'A+',
    genotype: 'AA',
    disability: 'None',
    maritalStatus: 'Married',
    spouseName: 'Suleiman Ibrahim',
    numberOfChildren: 3,
    nin: '23456789012',
    email: 'fatima.ibrahim@cca.gov.ng',
    phonePrimary: '08023456789',
    phoneAlt: '',
    permanentAddress: 'No 7 Hadejia Road, Kano',
    residentialAddress: 'Plot 22, Garki II, Abuja',
    state: 'FCT', city: 'Abuja',
    cadre: 'Administration',
    department: 'Administration Department',
    designation: 'Administrative Officer',
    postingLocation: 'CCA Headquarters, Abuja',
    gradeLevel: '10',
    step: '6',
    salaryAnnualNGN: 1_900_000,
    employmentType: 'Permanent',
    firstAppointmentDate: '2019-07-20',
    confirmationDate: '2021-07-20',
    presentAppointmentDate: '2019-07-20',
    lastPromotionDate: '2023-07-20',
    isActive: true,
    status: 'Active',
    bankName: 'GTBank',
    accountNumber: '0123456789',
    pfa: 'Stanbic IBTC Pensions',
    rsaPin: 'PEN200000234567',
    tin: '23456789-0001',
    qualifications: [
      { school: 'Bayero University, Kano', qualification: 'B.Sc Public Administration', year: 2009, grade: '2:1' },
      { school: 'University of Abuja', qualification: 'M.Sc Public Administration', year: 2017, grade: 'Distinction' },
    ],
    nextOfKin: { name: 'Suleiman Ibrahim', relationship: 'Husband', phone: '08055667788', email: '', address: 'Garki II, Abuja' },
    serviceHistory: [
      { date: '2019-07-20', event: 'First appointment', detail: 'Engaged as Admin Officer II, GL 08' },
      { date: '2021-07-20', event: 'Confirmation of appointment', detail: 'Confirmed by HR' },
      { date: '2023-07-20', event: 'Promotion', detail: 'Promoted to Admin Officer I (GL 10)' },
    ],
  },
  {
    id: 3,
    staffId: 'CCA/2021/0003',
    fileNumber: 'F-2021-0003',
    nhisNumber: '20210003',
    title: 'Mr.',
    firstName: 'Emeka',
    middleName: 'Chukwudi',
    lastName: 'Okonkwo',
    otherNames: '',
    gender: 'Male',
    dateOfBirth: '1992-11-30',
    placeOfBirth: 'Onitsha',
    nationality: 'Nigerian',
    stateOfOrigin: 'Anambra',
    lga: 'Onitsha North',
    senatorialDistrict: 'Anambra North',
    geopoliticalZone: 'South East',
    tribe: 'Igbo',
    religion: 'Christianity',
    languages: 'English, Igbo',
    bloodGroup: 'B+',
    genotype: 'AS',
    disability: 'None',
    maritalStatus: 'Single',
    spouseName: '',
    numberOfChildren: 0,
    nin: '34567890123',
    email: 'emeka.okonkwo@cca.gov.ng',
    phonePrimary: '08034567890',
    phoneAlt: '',
    permanentAddress: 'No 5 Awka Road, Onitsha',
    residentialAddress: 'Lugbe Phase 1, Abuja',
    state: 'FCT', city: 'Abuja',
    cadre: 'Court Operations',
    department: 'Litigation Department',
    designation: 'Court Clerk',
    postingLocation: 'CCA Headquarters, Abuja',
    gradeLevel: '08',
    step: '3',
    salaryAnnualNGN: 1_350_000,
    employmentType: 'Permanent',
    firstAppointmentDate: '2021-01-10',
    confirmationDate: '2023-01-10',
    presentAppointmentDate: '2021-01-10',
    lastPromotionDate: '2024-01-10',
    isActive: true,
    status: 'Active',
    bankName: 'Access Bank',
    accountNumber: '0987654321',
    pfa: 'Pensions Alliance',
    rsaPin: 'PEN200000345678',
    tin: '34567890-0001',
    qualifications: [
      { school: 'Federal Polytechnic, Oko', qualification: 'HND Public Administration', year: 2015, grade: 'Upper Credit' },
    ],
    nextOfKin: { name: 'Chinedu Okonkwo', relationship: 'Brother', phone: '08033445566', email: '', address: 'Onitsha' },
    serviceHistory: [
      { date: '2021-01-10', event: 'First appointment', detail: 'Engaged as Assistant Court Clerk, GL 07' },
      { date: '2023-01-10', event: 'Confirmation of appointment', detail: 'Confirmed by HR' },
      { date: '2024-01-10', event: 'Promotion', detail: 'Promoted to Court Clerk (GL 08)' },
    ],
  },
  {
    id: 4,
    staffId: 'CCA/2026/0004',
    fileNumber: 'F-2026-0004',
    nhisNumber: '20260004',
    title: 'Ms.',
    firstName: 'Grace',
    middleName: 'Oluwakemi',
    lastName: 'Oduwole',
    gender: 'Female',
    dateOfBirth: '1990-04-12',
    placeOfBirth: 'Ibadan',
    nationality: 'Nigerian',
    stateOfOrigin: 'Oyo',
    lga: 'Ibadan North',
    senatorialDistrict: 'Oyo Central',
    geopoliticalZone: 'South West',
    tribe: 'Yoruba',
    religion: 'Christianity',
    languages: 'English, Yoruba',
    bloodGroup: 'O+', genotype: 'AA', disability: 'None',
    maritalStatus: 'Single', spouseName: '', numberOfChildren: 0,
    nin: '45678901234',
    email: 'grace.oduwole@cca.gov.ng', phonePrimary: '08045678901', phoneAlt: '',
    permanentAddress: 'Bodija, Ibadan', residentialAddress: 'Wuye, Abuja',
    state: 'FCT', city: 'Abuja',
    cadre: 'Human Resources',
    department: 'Administration Department', designation: 'Human Resources Officer',
    postingLocation: 'CCA Headquarters, Abuja',
    gradeLevel: '09', step: '1', salaryAnnualNGN: 1_550_000,
    employmentType: 'Probation',
    firstAppointmentDate: '2026-05-01',
    confirmationDate: '',
    presentAppointmentDate: '2026-05-01',
    lastPromotionDate: '',
    isActive: true, status: 'Pending',
    bankName: 'UBA', accountNumber: '2080000000',
    pfa: 'Stanbic IBTC Pensions', rsaPin: 'PEN200000456789', tin: '45678901-0001',
    qualifications: [
      { school: 'University of Ibadan', qualification: 'B.Sc Industrial Relations & Personnel Mgmt', year: 2013, grade: '2:1' },
      { school: 'Chartered Institute of Personnel Management', qualification: 'CIPM Professional', year: 2019, grade: 'Pass' },
    ],
    nextOfKin: { name: 'Tunde Oduwole', relationship: 'Father', phone: '08033112244', email: '', address: 'Bodija, Ibadan' },
    serviceHistory: [
      { date: '2026-05-01', event: 'First appointment', detail: 'Engaged on probation as HR Officer, GL 09' },
    ],
  },
  {
    id: 5,
    staffId: 'CCA/2018/0005',
    fileNumber: 'F-2018-0005',
    nhisNumber: '20180005',
    title: 'Alhaji',
    firstName: 'Ahmed',
    middleName: 'Bello',
    lastName: 'Hassan',
    gender: 'Male',
    dateOfBirth: '1968-09-08',
    placeOfBirth: 'Kaduna',
    nationality: 'Nigerian',
    stateOfOrigin: 'Kaduna',
    lga: 'Kaduna North',
    senatorialDistrict: 'Kaduna Central',
    geopoliticalZone: 'North West',
    tribe: 'Hausa', religion: 'Islam', languages: 'English, Hausa, Arabic',
    bloodGroup: 'AB+', genotype: 'AA', disability: 'None',
    maritalStatus: 'Married', spouseName: 'Hadiza Hassan', numberOfChildren: 4,
    nin: '56789012345',
    email: 'ahmed.hassan@cca.gov.ng', phonePrimary: '08056789012', phoneAlt: '08145566778',
    permanentAddress: 'No 14 Ahmadu Bello Way, Kaduna', residentialAddress: 'Maitama, Abuja',
    state: 'FCT', city: 'Abuja',
    cadre: 'Court Registry',
    department: 'Litigation Department', designation: 'Senior Registrar',
    postingLocation: 'CCA Headquarters, Abuja',
    gradeLevel: '15', step: '8', salaryAnnualNGN: 4_300_000,
    employmentType: 'Permanent',
    firstAppointmentDate: '1993-05-12',
    confirmationDate: '1995-05-12',
    presentAppointmentDate: '2018-05-12',
    lastPromotionDate: '2022-05-12',
    isActive: true, status: 'Active',
    bankName: 'First Bank', accountNumber: '3030001234',
    pfa: 'ARM Pension Managers', rsaPin: 'PEN200000567890', tin: '56789012-0001',
    qualifications: [
      { school: 'Ahmadu Bello University', qualification: 'LL.B (Hons)', year: 1991, grade: '2:1' },
      { school: 'Nigerian Law School, Lagos', qualification: 'B.L', year: 1992, grade: 'Pass' },
      { school: 'University of London', qualification: 'LL.M', year: 2002, grade: 'Distinction' },
    ],
    nextOfKin: { name: 'Hadiza Hassan', relationship: 'Wife', phone: '08066778899', email: '', address: 'Maitama, Abuja' },
    serviceHistory: [
      { date: '1993-05-12', event: 'First appointment', detail: 'Engaged as Court Clerk II' },
      { date: '2018-05-12', event: 'Transfer', detail: 'Posted to CCA HQ as Registrar' },
      { date: '2022-05-12', event: 'Promotion', detail: 'Promoted to Senior Registrar (GL 15)' },
    ],
  },
  {
    id: 6,
    staffId: 'CCA/2021/0006',
    fileNumber: 'F-2021-0006',
    nhisNumber: '20210006',
    title: 'Ms.',
    firstName: 'Zainab',
    middleName: 'Amina',
    lastName: 'Ahmed',
    gender: 'Female',
    dateOfBirth: '1994-12-02',
    placeOfBirth: 'Maiduguri',
    nationality: 'Nigerian',
    stateOfOrigin: 'Borno', lga: 'Maiduguri', senatorialDistrict: 'Borno Central', geopoliticalZone: 'North East',
    tribe: 'Kanuri', religion: 'Islam', languages: 'English, Hausa, Kanuri',
    bloodGroup: 'O-', genotype: 'AS', disability: 'None',
    maritalStatus: 'Single', spouseName: '', numberOfChildren: 0,
    nin: '67890123456',
    email: 'zainab.ahmed@cca.gov.ng', phonePrimary: '08067890123', phoneAlt: '',
    permanentAddress: 'Maiduguri', residentialAddress: 'Gwarinpa, Abuja',
    state: 'FCT', city: 'Abuja',
    cadre: 'Information Technology',
    department: 'Planning, Research & Statistics Department', designation: 'IT Support Officer',
    postingLocation: 'CCA Headquarters, Abuja',
    gradeLevel: '09', step: '4', salaryAnnualNGN: 1_650_000,
    employmentType: 'Permanent',
    firstAppointmentDate: '2021-09-08',
    confirmationDate: '2023-09-08',
    presentAppointmentDate: '2021-09-08',
    lastPromotionDate: '2024-09-08',
    isActive: true, status: 'Active',
    bankName: 'Zenith Bank', accountNumber: '2089991122',
    pfa: 'Stanbic IBTC Pensions', rsaPin: 'PEN200000678901', tin: '67890123-0001',
    qualifications: [
      { school: 'University of Maiduguri', qualification: 'B.Sc Computer Science', year: 2017, grade: '2:1' },
      { school: 'Cisco', qualification: 'CCNA', year: 2020, grade: 'Pass' },
    ],
    nextOfKin: { name: 'Bukar Ahmed', relationship: 'Father', phone: '08033221100', email: '', address: 'Maiduguri' },
    serviceHistory: [
      { date: '2021-09-08', event: 'First appointment', detail: 'Engaged as IT Support Officer II, GL 08' },
      { date: '2024-09-08', event: 'Promotion', detail: 'Promoted to IT Support Officer I (GL 09)' },
    ],
  },
  {
    id: 7,
    staffId: 'CCA/2019/0007',
    fileNumber: 'F-2019-0007',
    nhisNumber: '20190007',
    title: 'Mr.',
    firstName: 'David',
    middleName: 'Chima',
    lastName: 'Nwosu',
    gender: 'Male',
    dateOfBirth: '1983-06-18',
    placeOfBirth: 'Aba',
    nationality: 'Nigerian',
    stateOfOrigin: 'Abia', lga: 'Aba South', senatorialDistrict: 'Abia South', geopoliticalZone: 'South East',
    tribe: 'Igbo', religion: 'Christianity', languages: 'English, Igbo',
    bloodGroup: 'B+', genotype: 'AA', disability: 'None',
    maritalStatus: 'Married', spouseName: 'Adaeze Nwosu', numberOfChildren: 2,
    nin: '78901234567',
    email: 'david.nwosu@cca.gov.ng', phonePrimary: '08078901234', phoneAlt: '',
    permanentAddress: 'No 9 Faulks Road, Aba', residentialAddress: 'Lokogoma, Abuja',
    state: 'FCT', city: 'Abuja',
    cadre: 'Accounts & Finance',
    department: 'Finance and Supply Department', designation: 'Finance Officer',
    postingLocation: 'CCA Headquarters, Abuja',
    gradeLevel: '11', step: '5', salaryAnnualNGN: 2_100_000,
    employmentType: 'Permanent',
    firstAppointmentDate: '2019-11-22',
    confirmationDate: '2021-11-22',
    presentAppointmentDate: '2019-11-22',
    lastPromotionDate: '2023-11-22',
    isActive: true, status: 'On Leave',
    bankName: 'Fidelity Bank', accountNumber: '6010012345',
    pfa: 'ARM Pension Managers', rsaPin: 'PEN200000789012', tin: '78901234-0001',
    qualifications: [
      { school: 'University of Nigeria, Enugu Campus', qualification: 'B.Sc Accounting', year: 2007, grade: '2:1' },
      { school: 'ICAN', qualification: 'ACA', year: 2014, grade: 'Pass' },
    ],
    nextOfKin: { name: 'Adaeze Nwosu', relationship: 'Wife', phone: '08099001122', email: '', address: 'Lokogoma, Abuja' },
    serviceHistory: [
      { date: '2019-11-22', event: 'First appointment', detail: 'Engaged as Finance Officer II, GL 09' },
      { date: '2023-11-22', event: 'Promotion', detail: 'Promoted to Finance Officer (GL 11)' },
    ],
  },
  {
    id: 8,
    staffId: 'CCA/2020/0008',
    fileNumber: 'F-2020-0008',
    nhisNumber: '20200008',
    title: 'Barr.',
    firstName: 'Victoria',
    middleName: 'Eno',
    lastName: 'Ekpo',
    gender: 'Female',
    dateOfBirth: '1985-03-25',
    placeOfBirth: 'Uyo',
    nationality: 'Nigerian',
    stateOfOrigin: 'Akwa Ibom', lga: 'Uyo', senatorialDistrict: 'Akwa Ibom North-East', geopoliticalZone: 'South South',
    tribe: 'Ibibio', religion: 'Christianity', languages: 'English, Ibibio',
    bloodGroup: 'A-', genotype: 'AA', disability: 'None',
    maritalStatus: 'Married', spouseName: 'Imo Ekpo', numberOfChildren: 1,
    nin: '89012345678',
    email: 'victoria.ekpo@cca.gov.ng', phonePrimary: '08089012345', phoneAlt: '',
    permanentAddress: 'No 12 Ikot Ekpene Road, Uyo', residentialAddress: 'Asokoro, Abuja',
    state: 'FCT', city: 'Abuja',
    cadre: 'Legal',
    department: 'Litigation Department', designation: 'Legal Counsel',
    postingLocation: 'CCA Headquarters, Abuja',
    gradeLevel: '13', step: '2', salaryAnnualNGN: 2_800_000,
    employmentType: 'Permanent',
    firstAppointmentDate: '2020-02-05',
    confirmationDate: '2022-02-05',
    presentAppointmentDate: '2020-02-05',
    lastPromotionDate: '2024-02-05',
    isActive: true, status: 'Active',
    bankName: 'Stanbic IBTC', accountNumber: '0019988776',
    pfa: 'Stanbic IBTC Pensions', rsaPin: 'PEN200000890123', tin: '89012345-0001',
    qualifications: [
      { school: 'University of Calabar', qualification: 'LL.B (Hons)', year: 2007, grade: '2:1' },
      { school: 'Nigerian Law School, Abuja', qualification: 'B.L', year: 2008, grade: 'Pass' },
      { school: 'University of Lagos', qualification: 'LL.M Corporate Law', year: 2015, grade: '2:1' },
    ],
    nextOfKin: { name: 'Imo Ekpo', relationship: 'Husband', phone: '08099887700', email: '', address: 'Asokoro, Abuja' },
    serviceHistory: [
      { date: '2020-02-05', event: 'First appointment', detail: 'Engaged as Legal Officer I, GL 10' },
      { date: '2024-02-05', event: 'Promotion', detail: 'Promoted to Legal Counsel (GL 13)' },
    ],
  },
];

// =============================================================================
// Live store backed by localStorage so additions and edits survive a reload
// even when the Django API is unreachable. A tiny pub/sub keeps Dashboard,
// StaffList, StaffDetail and AddStaff/Edit in sync within the page. When
// the backend is fully wired up, swap this for a fetch-on-mount hook.
// =============================================================================

const STORAGE_KEY = 'cca.staff.v1';

// Strip enrich()'s computed fields before persisting — they're a function of
// the raw record and get recomputed at read time. This also keeps the
// payload smaller (and re-derivable if the calculation rules change).
const stripComputed = ({
  fullName, initials, age, yearsOfService,
  retirementDate, retirementInDays,
  nextPromotionDate, nextPromotionInDays,
  ...base
}) => base;

const readStored = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) {
        // Re-run enrich() so date-derived fields reflect *today* rather than
        // whenever the row was last written.
        return parsed.map(stripComputed).map(enrich);
      }
    }
  } catch (_) { /* fall through to seed */ }
  return RAW.map(enrich);
};

let _quotaWarned = false;
const writeStored = (list) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.map(stripComputed)));
  } catch (err) {
    // QuotaExceededError typically means the user uploaded several large
    // photos. Warn once so they don't think the save silently failed; the
    // in-memory copy still works for the rest of the session.
    if (!_quotaWarned) {
      _quotaWarned = true;
      console.warn(
        'Could not persist staff to localStorage (likely browser storage quota). ' +
        'Records remain in memory for this session; consider smaller passport / signature images.',
        err,
      );
    }
  }
};

let _staff = readStored();
const _listeners = new Set();
const _emit = () => {
  writeStored(_staff);
  _listeners.forEach((fn) => fn(_staff));
};

export const STAFF = _staff;                                  // back-compat read
export const getStaff = (id) => _staff.find((s) => String(s.id) === String(id));
export const subscribeStaff = (fn) => { _listeners.add(fn); return () => _listeners.delete(fn); };

const nextId = () => Math.max(0, ..._staff.map((s) => s.id)) + 1;

export const addStaffRecord = (raw) => {
  const id = raw.id || nextId();
  const record = enrich({ ...raw, id, isActive: raw.isActive !== false, status: raw.status || 'Active' });
  _staff = [record, ..._staff];
  _emit();
  return record;
};

export const updateStaffRecord = (id, patch) => {
  let updated = null;
  _staff = _staff.map((s) => {
    if (String(s.id) !== String(id)) return s;
    updated = enrich({ ...stripComputed(s), ...patch });
    return updated;
  });
  _emit();
  return updated;
};

export const removeStaffRecord = (id) => {
  _staff = _staff.filter((s) => String(s.id) !== String(id));
  _emit();
};

export const getAllStaff = () => _staff;

// Wipe the persisted copy and reset back to the seed dataset. Useful for
// "Restore demo data" tooling or tests.
export const resetStaffStore = () => {
  _staff = RAW.map(enrich);
  _emit();
};

import { staffAPI } from '../utils/api';

// ============================================================================
// Live-API bridge.
//
// The mock store above keeps the UI working offline / pre-auth. Once the
// user is authenticated, hydrateStaffFromApi() pulls real rows from Django
// and replaces the in-memory store with them (preserving the shape the UI
// expects via mapApiStaff). Subsequent additions / edits / deletes go
// through the API and update the store on success.
//
// The API serializer keys (first_name, date_of_birth, …) are remapped to
// the camelCase shape the rest of the SPA already understands, then run
// through enrich() so all derived fields (age, fullName, retirementInDays,
// nextPromotionInDays) stay consistent with the offline store.
// ============================================================================

const _toIso = (v) => {
  if (!v) return null;
  if (typeof v === 'string') return v.slice(0, 10);
  try { return new Date(v).toISOString().slice(0, 10); } catch (_) { return null; }
};

// Parse the server's newline-delimited qualifications text back into the
// array shape the UI renders. Blank school/year/grade are fine.
const _qualsFromApi = (text) => {
  if (!text) return [];
  return String(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    .map((line) => ({ school: '', qualification: line, year: '', grade: '' }));
};

// Rebuild the next-of-kin array from the backend's suffixed columns.
const _noksFromApi = (api) => {
  const out = [];
  [['', ''], ['_2', ''], ['_3', '']].forEach(([sfx]) => {
    const n = {
      name: api[`next_of_kin${sfx}_name`] || '',
      relationship: api[`next_of_kin${sfx}_relationship`] || '',
      phone: api[`next_of_kin${sfx}_phone`] || '',
      email: api[`next_of_kin${sfx}_email`] || '',
      address: api[`next_of_kin${sfx}_address`] || '',
    };
    if (Object.values(n).some((v) => String(v).trim())) out.push(n);
  });
  return out;
};

// Translate one Django StaffSerializer object → mock-shape row.
export const mapApiStaff = (api) => {
  if (!api) return null;
  return enrich({
    id: api.id,
    staffId: api.staff_id,
    secretFileNumber: api.secret_file_number || '',
    firstName: api.first_name,
    middleName: api.middle_name || '',
    lastName: api.last_name,
    title: api.title || '',
    gender: api.gender === 'M' ? 'Male' : api.gender === 'F' ? 'Female' : (api.gender || ''),
    dateOfBirth: _toIso(api.date_of_birth),
    stateOfOrigin: api.state_of_origin || '',
    email: api.email || '',
    phonePrimary: api.phone_number || '',
    phoneAlt: api.alternate_phone || '',
    residentialAddress: api.residential_address || '',
    state: api.residential_state || '',
    city: api.residential_city || '',
    agency: api.agency || '',
    cadre: api.cadre || '',
    unit: api.unit || '',
    nin: api.nin || '',
    maritalStatus: api.marital_status || '',
    numberOfChildren: api.number_of_dependents ?? '',
    nationality: api.nationality || '',
    lga: api.local_government_area || '',
    permanentAddress: api.residential_address || '',
    bankName: api.bank_name || '',
    accountNumber: api.account_number || '',
    qualifications: _qualsFromApi(api.qualifications),
    nextOfKins: _noksFromApi(api),
    department: api.department_name || api.department || '',
    departmentId: api.department || null,
    designation: api.designation_title || api.designation || '',
    designationId: api.designation || null,
    postingLocation: api.posting_location_name || '',
    postingLocationId: api.posting_location || null,
    gradeLevel: api.grade_level_name || api.grade_level || '',
    gradeLevelId: api.grade_level || null,
    step: api.grade_step ?? '',
    employmentType: api.employment_type || '',
    employmentStatus: api.employment_status || '',
    firstAppointmentDate: _toIso(api.first_appointment_date),
    lastPromotionDate: _toIso(api.last_promotion_date),
    nextPromotionDate: _toIso(api.next_promotion_date),
    lastIncrementDate: _toIso(api.last_increment_date),
    nextIncrementDate: _toIso(api.next_increment_date),
    nhisNumber: api.nhis_number || '',
    nhfNumber: api.nhf_number || '',
    yearOfCallToBar: api.year_of_call_to_bar || '',
    passportPhoto: api.passport_photo || null,
    // Older SPA components read `photoDataUrl`. Mirror the API URL there so
    // existing avatar <img> tags work without each call-site changing.
    photoDataUrl: api.passport_photo || null,
    signature: api.signature || null,
    isActive: api.is_active !== false,
    status: api.is_active === false ? 'Archive' : 'Active',
    createdAt: api.created_at,
    updatedAt: api.updated_at,
    _api: api,
  });
};

// Replace the in-memory store with what the backend says is current.
// Resilient: on any failure (offline, 401, etc.) the existing in-memory
// rows are left alone so the UI keeps rendering something.
let _hydrated = false;
let _hydratingPromise = null;
export const hydrateStaffFromApi = async ({ force = false } = {}) => {
  if (_hydrated && !force) return _staff;
  if (_hydratingPromise) return _hydratingPromise;
  _hydratingPromise = (async () => {
    try {
      // Replay any offline edits before pulling the server's current truth.
      await flushPendingStaff();
      // Pull the FULL roster, following DRF pagination pages. Requesting a
      // large page_size keeps this to one or two round-trips on the tuned
      // Staff endpoint, but we still walk `next` so nothing is dropped if the
      // server caps page size lower (this was the "only 25 staff show" bug).
      const PAGE_SIZE = 1000;
      const MAX_PAGES = 1000; // hard safety cap (≈1M rows) to avoid a runaway loop
      const rows = [];
      let page = 1;
      while (page <= MAX_PAGES) {
        const { data } = await staffAPI.list({ page_size: PAGE_SIZE, page });
        // DRF pagination → {results: [...], next}, no pagination → array.
        const batch = Array.isArray(data) ? data : (data?.results || []);
        rows.push(...batch);
        const hasNext = !Array.isArray(data) && Boolean(data?.next);
        if (!hasNext || batch.length === 0) break;
        page += 1;
      }
      _staff = rows.map(mapApiStaff).filter(Boolean);
      _hydrated = true;
      _emit();
      return _staff;
    } catch (err) {
      // Leave the mock seed in place so the UI isn't blank if the API is
      // temporarily down or the user isn't authorised. Caller can retry.
      console.warn('Staff hydration failed:', err?.response?.status || err?.message);
      return _staff;
    } finally {
      _hydratingPromise = null;
    }
  })();
  return _hydratingPromise;
};

// Force a refetch on next call (e.g. after logout / login).
export const invalidateStaffStore = () => {
  _hydrated = false;
};

// =============================================================================
// Form → API payload mapping
//
// The Django StaffSerializer expects:
//   - gender as 'M' / 'F' / 'O' (not 'Male' / 'Female')
//   - department, designation, posting_location, grade_level as PRIMARY KEYS
//   - staff_id as a non-empty unique string
//   - dates as ISO YYYY-MM-DD strings
//
// The SPA form gives us labels and free text. This helper resolves the
// labels against the live lookup tables (caching them for the session),
// auto-creates Departments / Designations that the form invents on the fly,
// auto-generates a staff_id when the form leaves it blank, and packages
// the result as either JSON or FormData depending on whether a photo /
// signature file is attached.
// =============================================================================

const GENDER_MAP = { Male: 'M', Female: 'F', Other: 'O', M: 'M', F: 'F', O: 'O' };

// Repair the two email typos that otherwise get a whole staff row rejected on
// import — a doubled "@@" and a comma used in place of the final dot
// (e.g. "name@gmail,com") — then validate. Returns a clean address, or "" when
// blank or unfixable (so the record still saves, just without the bad email).
// Mirrors backend staff.serializers.clean_email so client and server agree.
export const cleanEmail = (raw) => {
  const s = String(raw || '').trim();
  if (!s) return '';
  const fixed = s.replace(/@@/g, '@').replace(/,/g, '.').toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fixed) ? fixed : '';
};

// In-session lookup cache. Keyed by name (lower-case).
const _lookupCache = {
  departments: null,    // [{id, name, ...}]
  designations: null,
  gradeLevels: null,
  postingLocations: null,
};

const _fetchAll = async (apiCall) => {
  const { data } = await apiCall({ page_size: 500 });
  return Array.isArray(data) ? data : (data?.results || []);
};

const _findByName = (list, name, keys = ['name']) => {
  if (!name || !Array.isArray(list)) return null;
  const needle = String(name).trim().toLowerCase();
  return list.find((row) => keys.some((k) => String(row?.[k] || '').trim().toLowerCase() === needle)) || null;
};

// Lazy-load (and cache) one of the lookup tables. Pass force=true to refetch.
const _loadLookup = async (kind, apiCall, { force = false } = {}) => {
  if (!force && _lookupCache[kind]) return _lookupCache[kind];
  try {
    _lookupCache[kind] = await _fetchAll(apiCall);
  } catch (err) {
    console.warn(`Failed to load ${kind}:`, err?.response?.status || err?.message);
    _lookupCache[kind] = [];
  }
  return _lookupCache[kind];
};

// Generate a fresh staff_id when the form leaves the field blank.
let _staffIdSeq = 0;
const _generateStaffId = () => {
  const year = new Date().getFullYear();
  // Timestamp tail + a monotonic counter keeps this unique even when
  // generating thousands of ids in one bulk import (random alone collided).
  _staffIdSeq += 1;
  const tail = `${Date.now().toString().slice(-6)}${_staffIdSeq}`;
  return `CCA/${year}/${tail}`;
};

const _toIsoDate = (v) => {
  if (!v) return null;
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  try { return new Date(v).toISOString().slice(0, 10); } catch (_) { return null; }
};

// Resolve a department name to a PK. Creates the row if missing so the
// form can invent new departments freely (the Settings → Departments page
// can also create these explicitly).
const _resolveDepartment = async (name) => {
  if (!name) return null;
  const list = await _loadLookup('departments', staffAPI.listDepartments);
  const hit = _findByName(list, name);
  if (hit) return hit.id;
  // Auto-create — the backend serializer accepts {name, code, description}.
  try {
    const code = String(name)
      .replace(/&/g, 'and')
      .split(/\s+/)
      .filter((w) => w[0] && w[0].match(/[A-Za-z]/) && !['and','of','the','department'].includes(w.toLowerCase()))
      .map((w) => w[0].toUpperCase())
      .join('')
      .slice(0, 10) || name.slice(0, 3).toUpperCase();
    const { data } = await staffAPI.createDepartment({ name, code });
    _lookupCache.departments = [...(_lookupCache.departments || []), data];
    return data.id;
  } catch (err) {
    console.warn('Could not create department', name, err?.response?.data);
    return null;
  }
};

const _resolveDesignation = async (title) => {
  if (!title) return null;
  const list = await _loadLookup('designations', staffAPI.listDesignations);
  const hit = _findByName(list, title, ['title', 'name']);
  if (hit) return hit.id;
  try {
    const { data } = await staffAPI.createDesignation({ title, rank_order: 1 });
    _lookupCache.designations = [...(_lookupCache.designations || []), data];
    return data.id;
  } catch (err) {
    console.warn('Could not create designation', title, err?.response?.data);
    return null;
  }
};

const _resolveGradeLevel = async (raw) => {
  if (raw === '' || raw === null || raw === undefined) return null;
  const list = await _loadLookup('gradeLevels', staffAPI.listGradeLevels);
  const wanted = String(raw).trim().toUpperCase();
  const variants = [wanted, `GL${wanted}`, wanted.replace(/^GL/, '')];
  const hit = list.find((g) => variants.some((v) => String(g.grade_level || g.name || '').toUpperCase() === v));
  if (hit) return hit.id;
  return null;  // Don't auto-create — grade levels carry salary data we shouldn't fabricate.
};

const _resolvePostingLocation = async (name) => {
  if (!name) return null;
  const list = await _loadLookup('postingLocations', staffAPI.listPostingLocations);
  const hit = _findByName(list, name);
  return hit ? hit.id : null;  // Optional FK — null is fine.
};

// Flatten the up-to-3 next-of-kin objects into the backend's suffixed columns.
const _nokPayload = (form) => {
  const noks = Array.isArray(form.nextOfKins) && form.nextOfKins.length
    ? form.nextOfKins
    : (form.nextOfKin ? [form.nextOfKin] : []);
  const out = {};
  const suffixes = ['', '_2', '_3'];
  suffixes.forEach((sfx, i) => {
    const n = noks[i] || {};
    out[`next_of_kin${sfx}_name`] = n.name || '';
    out[`next_of_kin${sfx}_relationship`] = n.relationship || '';
    out[`next_of_kin${sfx}_phone`] = n.phone || '';
    out[`next_of_kin${sfx}_email`] = cleanEmail(n.email);
    out[`next_of_kin${sfx}_address`] = n.address || '';
  });
  return out;
};

// Serialise the qualifications array into one-per-line text for storage.
const _qualificationsToText = (form) => {
  if (typeof form.qualifications === 'string') return form.qualifications;
  if (!Array.isArray(form.qualifications)) return '';
  return form.qualifications
    .map((q) => [q.qualification, q.school, q.year, q.grade].filter(Boolean).join(' — '))
    .filter(Boolean)
    .join('\n');
};

// Build a payload object ready for staffAPI.create / .update.
const _toApiPayload = async (form) => {
  const [departmentId, designationId, gradeLevelId, postingLocationId] = await Promise.all([
    _resolveDepartment(form.department),
    _resolveDesignation(form.designation),
    _resolveGradeLevel(form.gradeLevel),
    _resolvePostingLocation(form.postingLocation),
  ]);

  const payload = {
    staff_id: (form.staffId || '').trim() || _generateStaffId(),
    secret_file_number: (form.secretFileNumber || '').trim(),
    first_name: form.firstName || '',
    middle_name: form.middleName || '',
    last_name: form.lastName || '',
    gender: GENDER_MAP[form.gender] || form.gender || '',
    date_of_birth: _toIsoDate(form.dateOfBirth),
    nationality: form.nationality || '',
    state_of_origin: form.stateOfOrigin || '',
    local_government_area: form.lga || form.localGovernmentArea || '',
    email: cleanEmail(form.email),
    phone_number: form.phonePrimary || form.phone_number || '',
    alternate_phone: form.phoneAlt || '',
    residential_address: form.residentialAddress || '',
    residential_state: form.state || form.residentialState || '',
    residential_city: form.city || form.residentialCity || '',
    nin: form.nin || '',
    marital_status: form.maritalStatus || '',
    number_of_dependents: form.numberOfChildren === '' || form.numberOfChildren == null
      ? null : Number(form.numberOfChildren),
    agency: form.agency || '',
    cadre: form.cadre || '',
    unit: form.unit || '',
    department: departmentId,
    designation: designationId,
    grade_step: Number(form.step) || 1,
    employment_type: form.employmentType || '',
    first_appointment_date: _toIsoDate(form.firstAppointmentDate),
    last_promotion_date: _toIsoDate(form.lastPromotionDate),
    nhis_number: form.nhisNumber || '',
    nhf_number: form.nhfNumber || '',
    year_of_call_to_bar: form.yearOfCallToBar ? Number(form.yearOfCallToBar) : null,
    qualifications: _qualificationsToText(form),
    bank_name: form.bankName || '',
    account_number: form.accountNumber || '',
    employment_status: form.employmentStatus || form.status || 'Active',
    is_active: form.isActive !== false,
    ...(_nokPayload(form)),
  };

  // Optional FKs — only include when resolved, otherwise let serializer treat
  // them as null/blank.
  if (gradeLevelId) payload.grade_level = gradeLevelId;
  if (postingLocationId) payload.posting_location = postingLocationId;

  // Cap string fields to the backend column limits so a stray long value
  // (e.g. a next-of-kin cell holding two phone numbers) never 400s the import.
  const CAPS = {
    staff_id: 20, secret_file_number: 50, phone_number: 20, alternate_phone: 20,
    nin: 20, national_identification: 50, passport_number: 50, nhis_number: 50,
    nhf_number: 50, marital_status: 50, employment_type: 50, bank_name: 100,
    account_number: 50, next_of_kin_phone: 20, next_of_kin_2_phone: 20,
    next_of_kin_3_phone: 20, next_of_kin_name: 200, next_of_kin_relationship: 50,
    next_of_kin_2_name: 200, next_of_kin_2_relationship: 50,
    next_of_kin_3_name: 200, next_of_kin_3_relationship: 50,
    agency: 200, unit: 200, cadre: 150, state_of_origin: 100,
    local_government_area: 150, nationality: 100, residential_state: 100,
    residential_city: 100,
  };
  Object.entries(CAPS).forEach(([k, max]) => {
    if (typeof payload[k] === 'string' && payload[k].length > max) {
      payload[k] = payload[k].slice(0, max);
    }
  });

  // Strip empty strings / nulls so we don't overwrite stored values on PATCH
  // and so the backend applies its own blank/null defaults on create.
  Object.entries(payload).forEach(([k, v]) => {
    if (v === '' || v === null || v === undefined) delete payload[k];
  });
  // staff_id is the one field we always send (unique, auto-generated if blank).
  payload.staff_id = payload.staff_id || _generateStaffId();
  if (form.gender) payload.gender = GENDER_MAP[form.gender] || form.gender;

  return payload;
};

const _buildFormData = (payload, files) => {
  const fd = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === null || value === undefined) return;
    fd.append(key, value);
  });
  if (files?.passportPhoto) fd.append('passport_photo', files.passportPhoto, files.passportPhoto.name);
  if (files?.signature) fd.append('signature', files.signature, files.signature.name);
  return fd;
};

// =============================================================================
// Offline write queue (API-replay).
//
// When the API is unreachable (no HTTP response), staff create/update/delete
// are applied to the local store immediately and the operation is queued here.
// On reconnect (the 'online' event or the next hydrate) queued operations are
// replayed against the API in order — reusing the tested _toApiPayload /
// mapApiStaff mapping rather than a second serialization path.
//
// This is the pragmatic offline-write path for the web app. The IndexedDB sync
// engine in src/offline/ is the target for the Tauri desktop build.
// See docs/OFFLINE_FIRST_ARCHITECTURE.md.
// =============================================================================
const PENDING_KEY = 'cca.staff.pending.v1';
const readPending = () => {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY)) || []; } catch (_) { return []; }
};
const writePending = (q) => {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(q)); } catch (_) { /* quota */ }
};
const enqueuePending = (op) => {
  const q = readPending();
  q.push({ ...op, queuedAt: new Date().toISOString() });
  writePending(q);
};
const isOffline = (err) => !err?.response;   // no HTTP response => network/offline
export const pendingStaffCount = () => readPending().length;

let _flushing = false;
export const flushPendingStaff = async () => {
  if (_flushing || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
  const queue = readPending();
  if (!queue.length) return;
  _flushing = true;
  const remaining = [];
  try {
    for (const op of queue) {
      try {
        if (op.kind === 'create') {
          const { data } = await staffAPI.create(await _toApiPayload(op.form));
          const mapped = mapApiStaff(data);
          if (mapped) {
            _staff = [mapped, ..._staff.filter(
              (s) => String(s.id) !== String(op.tempId) && String(s.id) !== String(mapped.id),
            )];
          }
        } else if (op.kind === 'update') {
          const { data } = await staffAPI.update(op.id, await _toApiPayload(op.form));
          const mapped = mapApiStaff(data);
          if (mapped) _staff = _staff.map((s) => (String(s.id) === String(op.id) ? mapped : s));
        } else if (op.kind === 'delete') {
          await staffAPI.bulkDelete(op.ids);
          const removed = new Set(op.ids.map(String));
          _staff = _staff.filter((s) => !removed.has(String(s.id)));
        }
      } catch (err) {
        if (isOffline(err)) remaining.push(op);   // still offline — retry later
        else console.warn('Dropping staff op the server rejected:', op.kind, err?.response?.data);
      }
    }
  } finally {
    writePending(remaining);
    _emit();
    _flushing = false;
  }
};

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { flushPendingStaff(); });
}

// True when the browser reports no network. Used to short-circuit the slow
// server attempt (Render cold-start timeout is 90s) so offline saves are
// instant instead of hanging until the request finally times out.
const browserOffline = () => (typeof navigator !== 'undefined' && !navigator.onLine);

// --- Local-apply + queue helpers (shared by the offline short-circuit and the
// network-failure fallback). A queued op is replayed by flushPendingStaff. ---
const _localCreate = (form) => {
  const tempId = 'tmp-' + (crypto.randomUUID ? crypto.randomUUID() : Date.now());
  const localRow = enrich({
    ...form,
    id: tempId,
    status: form.status || form.employmentStatus || 'Active',
    isActive: form.isActive !== false,
    _pendingSync: true,
  });
  _staff = [localRow, ..._staff];
  enqueuePending({ kind: 'create', tempId, form });
  _emit();
  return localRow;
};

const _localUpdate = (id, form) => {
  let updated = null;
  _staff = _staff.map((s) => {
    if (String(s.id) !== String(id)) return s;
    updated = enrich({ ...stripComputed(s), ...form, _pendingSync: true });
    return updated;
  });
  enqueuePending({ kind: 'update', id, form });
  _emit();
  return updated;
};

const _localDelete = (idsArr) => {
  const removed = new Set(idsArr.map(String));
  _staff = _staff.filter((s) => !removed.has(String(s.id)));
  enqueuePending({ kind: 'delete', ids: idsArr });
  _emit();
  return { deleted: idsArr.length, queued: true, missing: [] };
};

// Public API: create a Staff row from the SPA form state.
// (A photo/signature can't be queued to localStorage — re-attach it once back
// online and the record picks it up on the next edit.)
export const createStaffFromForm = async (form, files = {}) => {
  if (browserOffline()) return _localCreate(form);
  const hasFiles = files?.passportPhoto || files?.signature;
  try {
    const payload = await _toApiPayload(form);
    const body = hasFiles ? _buildFormData(payload, files) : payload;
    const { data } = await staffAPI.create(body);
    const mapped = mapApiStaff(data);
    if (mapped) {
      _staff = [mapped, ..._staff.filter((s) => String(s.id) !== String(mapped.id))];
      _emit();
    }
    return mapped;
  } catch (err) {
    if (!isOffline(err)) throw err;
    return _localCreate(form);
  }
};

// Bulk-create staff from an array of SPA form objects (used by Bulk Import).
// Saves to the server so records appear on every device. Sends requests with
// bounded concurrency (several in flight at once) so a large roll imports in a
// fraction of the time a one-at-a-time loop would take, without overwhelming
// the backend. Reports per-row failures; when offline, rows are queued locally
// and replayed on reconnect. onProgress(done, total) drives the progress bar.
export const bulkCreateStaffFromForms = async (forms, { onProgress, concurrency = 8 } = {}) => {
  const created = [];
  const failed = [];
  const total = forms.length;
  let done = 0;

  const handleOne = async (form, index) => {
    try {
      if (browserOffline()) {
        _localCreate(form);
      } else {
        const { data } = await staffAPI.create(await _toApiPayload(form));
        const mapped = mapApiStaff(data);
        if (mapped) created.push(mapped);
      }
    } catch (err) {
      if (isOffline(err)) {
        _localCreate(form);   // network dropped mid-import → queue for later
      } else {
        const d = err.response?.data;
        const reason = d?.detail
          || (d && typeof d === 'object'
            ? Object.entries(d).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('; ')
            : 'Save failed');
        const name = [form.firstName, form.lastName].filter(Boolean).join(' ') || `Row ${index + 1}`;
        failed.push({ index, name, reason });
      }
    } finally {
      done += 1;
      if (onProgress) onProgress(done, total);
    }
  };

  // Warm the department/designation/grade lookup caches with the first record
  // before going parallel, so the initial wave doesn't race to create the same
  // lookups. Then process the rest in fixed-size concurrent waves.
  if (total > 0) {
    await handleOne(forms[0], 0);
    for (let i = 1; i < total; i += concurrency) {
      await Promise.all(forms.slice(i, i + concurrency).map((f, j) => handleOne(f, i + j)));
      await new Promise((r) => setTimeout(r, 0)); // let React repaint progress
    }
  }

  if (created.length) {
    const ids = new Set(created.map((s) => String(s.id)));
    _staff = [...created, ..._staff.filter((s) => !ids.has(String(s.id)))];
    _emit();
  }
  return { created: created.length, failed };
};

// Public API: update an existing Staff row from the SPA form state.
export const updateStaffFromForm = async (id, form, files = {}) => {
  if (browserOffline()) return _localUpdate(id, form);
  const hasFiles = files?.passportPhoto || files?.signature;
  try {
    const payload = await _toApiPayload(form);
    const body = hasFiles ? _buildFormData(payload, files) : payload;
    const { data } = await staffAPI.update(id, body);
    const mapped = mapApiStaff(data);
    if (mapped) {
      _staff = _staff.map((s) => (String(s.id) === String(id) ? mapped : s));
      _emit();
    }
    return mapped;
  } catch (err) {
    if (!isOffline(err)) throw err;
    return _localUpdate(id, form);
  }
};

// Delete a batch via the API and remove the rows from the local cache.
// Returns the parsed API response so callers can show counts.
export const bulkDeleteStaff = async (ids) => {
  const idsArr = (ids || []).map((v) => Number(v)).filter((n) => Number.isFinite(n));
  // Temp (offline-created, not yet synced) ids are dropped locally and their
  // queued create is cancelled — there's nothing on the server to delete.
  const tempIds = (ids || []).map(String).filter((v) => v.startsWith('tmp-'));
  if (tempIds.length) {
    writePending(readPending().filter(
      (op) => !(op.kind === 'create' && tempIds.includes(String(op.tempId))),
    ));
    const drop = new Set(tempIds);
    _staff = _staff.filter((s) => !drop.has(String(s.id)));
    _emit();
  }
  if (!idsArr.length) return { deleted: tempIds.length, missing: [] };
  if (browserOffline()) return _localDelete(idsArr);
  try {
    const { data } = await staffAPI.bulkDelete(idsArr);
    const removed = new Set(idsArr);
    _staff = _staff.filter((s) => !removed.has(Number(s.id)));
    _emit();
    return data;
  } catch (err) {
    if (!isOffline(err)) throw err;
    return _localDelete(idsArr);
  }
};
