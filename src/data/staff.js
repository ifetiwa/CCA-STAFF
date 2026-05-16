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

// -- Decorate raw rows with calculated fields ---------------------------------
export const enrich = (s) => {
  const yearsOfService = yearsBetween(s.firstAppointmentDate);
  const age = yearsBetween(s.dateOfBirth);
  const retirementDate = calcRetirementDate(s.dateOfBirth, s.firstAppointmentDate);
  const nextPromotionDate = calcNextPromotionDate(s.lastPromotionDate, s.firstAppointmentDate);
  return {
    ...s,
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
    ippisNumber: '20200001',
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
    ippisNumber: '20190002',
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
    ippisNumber: '20210003',
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
    ippisNumber: '20260004',
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
    ippisNumber: '20180005',
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
    ippisNumber: '20210006',
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
    ippisNumber: '20190007',
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
    ippisNumber: '20200008',
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
// Live in-memory store with a tiny pub/sub so multiple pages share the same
// state (Dashboard, StaffList, StaffDetail, AddStaff/Edit). When the backend
// is wired through axios for real, swap this for a fetch-on-mount hook.
// =============================================================================
let _staff = RAW.map(enrich);
const _listeners = new Set();
const _emit = () => _listeners.forEach((fn) => fn(_staff));

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
    // Strip the previously-computed fields so enrich() can recompute cleanly.
    const { fullName: _f, initials: _i, age: _a, yearsOfService: _y,
            retirementDate: _r, retirementInDays: _rd,
            nextPromotionDate: _np, nextPromotionInDays: _npd,
            ...base } = s;
    updated = enrich({ ...base, ...patch });
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
