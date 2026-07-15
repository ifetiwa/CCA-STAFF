import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Save, X, ArrowLeft, User, Briefcase, GraduationCap, Banknote, Users as UsersIcon, Image as ImageIcon, PenTool, Upload, Trash2, Plus } from 'lucide-react';
import { staffAPI } from '../utils/api';
import { useToast } from '../context/ToastContext';
import {
  calcRetirementDate, calcNextPromotionDate, formatDate,
  getStaff, addStaffRecord, updateStaffRecord, STATUSES,
  MAX_NEXT_OF_KIN, NEXT_OF_KIN_LABELS, normaliseNextOfKins,
  createStaffFromForm, updateStaffFromForm,
} from '../data/staff';
import { listDepartmentNames, listUnits, subscribeDepartments } from '../data/departments';
import { listDesignations, subscribeDesignations } from '../data/designations';

const NIGERIAN_STATES = [
  'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta',
  'Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi',
  'Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto',
  'Taraba','Yobe','Zamfara',
];

const ZONES = ['North Central', 'North East', 'North West', 'South East', 'South South', 'South West'];
// Designations now come from the Settings → Designations store (localStorage)
// so admins can add/rename/remove them without code changes.
const TITLES = ['Mr.', 'Mrs.', 'Miss', 'Ms.', 'Dr.', 'Engr.', 'Barr.', 'Alhaji', 'Hajia', 'Chief', 'Hon.'];
const GRADE_LEVELS = ['01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17'];
const STEPS = ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15'];
const RELIGIONS = ['Christianity', 'Islam', 'Traditional', 'Other'];
const MARITAL = ['Single', 'Married', 'Divorced', 'Widowed'];
const GENDERS = ['Male', 'Female'];
const BLOOD = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const GENOTYPE = ['AA', 'AS', 'SS', 'AC', 'SC'];
const EMPLOYMENT = ['Permanent', 'Contract', 'Probation', 'Secondment', 'Temporary'];

const EMPTY = {
  // Identity
  title: '', firstName: '', middleName: '', lastName: '',
  gender: '', dateOfBirth: '', placeOfBirth: '',
  nationality: 'Nigerian', stateOfOrigin: '', lga: '',
  senatorialDistrict: '', geopoliticalZone: '',
  tribe: '', religion: '', languages: '',
  bloodGroup: '', genotype: '', disability: 'None',
  maritalStatus: 'Single', spouseName: '', numberOfChildren: 0,
  nin: '',
  // Contact
  email: '', phonePrimary: '', phoneAlt: '',
  permanentAddress: '', residentialAddress: '',
  state: '', city: '',
  // Employment
  fileNumber: '', secretFileNumber: '', nhisNumber: '', nhfNumber: '',
  cadre: '', department: '', unit: '', designation: '', postingLocation: 'CCA Headquarters, Abuja',
  organizationalRole: '',
  gradeLevel: '', step: '1',
  salaryAnnualNGN: '', employmentType: 'Permanent',
  status: 'Active',
  firstAppointmentDate: '', confirmationDate: '',
  presentAppointmentDate: '', lastPromotionDate: '',
  yearOfCallToBar: '',
  // Identity media. The Data URLs power the on-screen preview and the local
  // store; the File objects (when present) are what we upload to Django as
  // multipart so they land in the corresponding ImageField columns.
  photoDataUrl: '', signatureDataUrl: '',
  photoFile: null, signatureFile: null,
  // Education (single row capture; multi-row managed via list)
  qualifications: [],
  qualSchool: '', qualName: '', qualYear: '', qualGrade: '',
  // Financial
  bankName: '', accountNumber: '', pfa: '', rsaPin: '', tin: '',
  // Next of kin — up to 3 entries (Primary, Secondary, Tertiary). The form
  // always starts with one empty Primary slot; the user clicks "Add another"
  // to reveal additional slots.
  noks: [{ name: '', relationship: '', phone: '', email: '', address: '' }],
};

// email and phonePrimary are intentionally NOT required (optional fields).
// The email-format check further below still runs when one is entered.
const REQUIRED = ['firstName', 'lastName', 'gender', 'dateOfBirth', 'stateOfOrigin',
  'department', 'designation', 'gradeLevel', 'firstAppointmentDate'];

// Hydrate the form from a stored staff record (the data shape used by
// src/data/staff.js). Keeps the form's flat field names independent of the
// nested record layout so we can swap to the real API later.
const formFromRecord = (s) => {
  if (!s) return null;
  return {
    ...EMPTY,
    title: s.title || '', firstName: s.firstName || '', middleName: s.middleName || '',
    lastName: s.lastName || '', gender: s.gender || '',
    dateOfBirth: s.dateOfBirth || '', placeOfBirth: s.placeOfBirth || '',
    nationality: s.nationality || 'Nigerian',
    stateOfOrigin: s.stateOfOrigin || '', lga: s.lga || '',
    senatorialDistrict: s.senatorialDistrict || '', geopoliticalZone: s.geopoliticalZone || '',
    tribe: s.tribe || '', religion: s.religion || '', languages: s.languages || '',
    bloodGroup: s.bloodGroup || '', genotype: s.genotype || '',
    disability: s.disability || 'None',
    maritalStatus: s.maritalStatus || 'Single', spouseName: s.spouseName || '',
    numberOfChildren: s.numberOfChildren ?? 0, nin: s.nin || '',
    email: s.email || '', phonePrimary: s.phonePrimary || '', phoneAlt: s.phoneAlt || '',
    permanentAddress: s.permanentAddress || '', residentialAddress: s.residentialAddress || '',
    state: s.state || '', city: s.city || '',
    staffId: s.staffId || '',
    fileNumber: s.fileNumber || '',
    secretFileNumber: s.secretFileNumber || '',
    nhisNumber: s.nhisNumber || s.ippisNumber || '',
    nhfNumber: s.nhfNumber || '',
    cadre: s.cadre || '', department: s.department || '', unit: s.unit || '', designation: s.designation || '',
    organizationalRole: s.organizationalRole || '',
    postingLocation: s.postingLocation || 'CCA Headquarters, Abuja',
    gradeLevel: s.gradeLevel || '', step: s.step || '1',
    salaryAnnualNGN: s.salaryAnnualNGN ?? '', employmentType: s.employmentType || 'Permanent',
    status: s.status || 'Active',
    firstAppointmentDate: s.firstAppointmentDate || '',
    confirmationDate: s.confirmationDate || '',
    presentAppointmentDate: s.presentAppointmentDate || '',
    lastPromotionDate: s.lastPromotionDate || '',
    yearOfCallToBar: s.yearOfCallToBar || '',
    photoDataUrl: s.photoDataUrl || '',
    signatureDataUrl: s.signatureDataUrl || '',
    qualifications: Array.isArray(s.qualifications) ? s.qualifications : [],
    qualSchool: '', qualName: '', qualYear: '', qualGrade: '',
    bankName: s.bankName || '', accountNumber: s.accountNumber || '',
    pfa: s.pfa || '', rsaPin: s.rsaPin || '', tin: s.tin || '',
    noks: (() => {
      const list = normaliseNextOfKins(s);
      return list.length ? list : [{ name: '', relationship: '', phone: '', email: '', address: '' }];
    })(),
  };
};

// Convert the form payload back into the data-store record shape.
const recordFromForm = (d) => ({
  title: d.title, firstName: d.firstName, middleName: d.middleName, lastName: d.lastName,
  gender: d.gender, dateOfBirth: d.dateOfBirth, placeOfBirth: d.placeOfBirth,
  nationality: d.nationality, stateOfOrigin: d.stateOfOrigin, lga: d.lga,
  senatorialDistrict: d.senatorialDistrict, geopoliticalZone: d.geopoliticalZone,
  tribe: d.tribe, religion: d.religion, languages: d.languages,
  bloodGroup: d.bloodGroup, genotype: d.genotype, disability: d.disability,
  maritalStatus: d.maritalStatus, spouseName: d.spouseName,
  numberOfChildren: Number(d.numberOfChildren) || 0, nin: d.nin,
  email: d.email, phonePrimary: d.phonePrimary, phoneAlt: d.phoneAlt,
  permanentAddress: d.permanentAddress, residentialAddress: d.residentialAddress,
  state: d.state, city: d.city,
  fileNumber: d.fileNumber,
  secretFileNumber: d.secretFileNumber,
  nhisNumber: d.nhisNumber,
  nhfNumber: d.nhfNumber,
  cadre: d.cadre, department: d.department, unit: d.unit, designation: d.designation,
  organizationalRole: d.organizationalRole,
  postingLocation: d.postingLocation,
  gradeLevel: d.gradeLevel, step: d.step,
  salaryAnnualNGN: d.salaryAnnualNGN === '' ? null : Number(d.salaryAnnualNGN),
  employmentType: d.employmentType,
  status: d.status,
  firstAppointmentDate: d.firstAppointmentDate,
  confirmationDate: d.confirmationDate,
  presentAppointmentDate: d.presentAppointmentDate,
  lastPromotionDate: d.lastPromotionDate,
  yearOfCallToBar: d.yearOfCallToBar ? Number(d.yearOfCallToBar) : null,
  photoDataUrl: d.photoDataUrl,
  signatureDataUrl: d.signatureDataUrl,
  qualifications: d.qualifications,
  bankName: d.bankName, accountNumber: d.accountNumber,
  pfa: d.pfa, rsaPin: d.rsaPin, tin: d.tin,
  nextOfKins: (d.noks || []).map((n) => ({
    name: n?.name || '', relationship: n?.relationship || '',
    phone: n?.phone || '', email: n?.email || '', address: n?.address || '',
  })),
  // Keep legacy `nextOfKin` (singular) in sync with the primary entry so any
  // older readers still work; enrich() will re-derive it anyway.
  nextOfKin: {
    name: d.noks?.[0]?.name || '', relationship: d.noks?.[0]?.relationship || '',
    phone: d.noks?.[0]?.phone || '', email: d.noks?.[0]?.email || '',
    address: d.noks?.[0]?.address || '',
  },
});

const AddStaff = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { id: editId } = useParams();
  const isEdit = Boolean(editId);
  const [searchParams] = useSearchParams();
  // Preset the Organizational Role when arriving from "Add Judge" (/add-staff?role=Judge).
  const presetRole = searchParams.get('role') || '';

  const [formData, setFormData] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [departments, setDepartments] = useState(() => listDepartmentNames());
  const [designations, setDesignations] = useState(() => listDesignations());

  useEffect(() => subscribeDepartments(() => setDepartments(listDepartmentNames())), []);
  useEffect(() => subscribeDesignations(setDesignations), []);

  // Hydrate when entering edit mode.
  useEffect(() => {
    if (!isEdit) {
      setFormData(presetRole ? { ...EMPTY, organizationalRole: presetRole } : EMPTY);
      setNotFound(false);
      return;
    }
    const record = getStaff(editId);
    if (!record) {
      setNotFound(true);
      return;
    }
    setFormData(formFromRecord(record));
    setNotFound(false);
  }, [editId, isEdit, presetRole]);

  const set = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleChange = (e) => set(e.target.name, e.target.value);

  // Reads an image file from the user and stores both the original File
  // (for multipart upload to Django) and a base64 data URL (for the in-app
  // preview and the localStorage-backed staff record). Caps the source at
  // ~2MB so we don't bloat the store or the request body.
  const handleImageUpload = (urlField, fileField) => (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file (PNG or JPG).');
      e.target.value = '';
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be 2MB or smaller.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFormData((prev) => ({ ...prev, [urlField]: reader.result, [fileField]: file }));
    };
    reader.onerror = () => toast.error('Could not read that file.');
    reader.readAsDataURL(file);
  };

  const clearImage = (urlField, fileField) => () => {
    setFormData((prev) => ({ ...prev, [urlField]: '', [fileField]: null }));
  };

  const setNokField = (idx, key, value) => {
    setFormData((prev) => {
      const noks = [...(prev.noks || [])];
      noks[idx] = { ...noks[idx], [key]: value };
      return { ...prev, noks };
    });
  };
  const addNok = () => {
    setFormData((prev) => {
      const noks = [...(prev.noks || [])];
      if (noks.length >= MAX_NEXT_OF_KIN) return prev;
      noks.push({ name: '', relationship: '', phone: '', email: '', address: '' });
      return { ...prev, noks };
    });
  };
  const removeNok = (idx) => {
    if (idx === 0) return; // Primary cannot be removed; users clear its fields instead.
    setFormData((prev) => {
      const noks = (prev.noks || []).filter((_, i) => i !== idx);
      return { ...prev, noks: noks.length ? noks : [{ name: '', relationship: '', phone: '', email: '', address: '' }] };
    });
  };

  const addQualification = () => {
    const { qualSchool, qualName, qualYear, qualGrade } = formData;
    if (!qualSchool || !qualName) {
      toast.error('Enter institution and qualification first.');
      return;
    }
    setFormData((prev) => ({
      ...prev,
      qualifications: [...prev.qualifications, { school: qualSchool, qualification: qualName, year: qualYear, grade: qualGrade }],
      qualSchool: '', qualName: '', qualYear: '', qualGrade: '',
    }));
  };
  const removeQualification = (idx) => {
    setFormData((prev) => ({ ...prev, qualifications: prev.qualifications.filter((_, i) => i !== idx) }));
  };

  const validate = () => {
    const next = {};
    REQUIRED.forEach((k) => {
      if (!String(formData[k] || '').trim()) next[k] = 'Required';
    });
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      next.email = 'Invalid email format';
    }
    if (formData.nin && !/^\d{11}$/.test(formData.nin)) {
      next.nin = 'NIN must be 11 digits';
    }
    return next;
  };

  // Live preview of calculated milestones
  const previewRetirement = calcRetirementDate(formData.dateOfBirth, formData.firstAppointmentDate);
  const previewNextPromo = calcNextPromotionDate(formData.lastPromotionDate, formData.firstAppointmentDate, formData.gradeLevel);

  const toApiPayload = (d) => ({
    title: d.title, first_name: d.firstName, middle_name: d.middleName, last_name: d.lastName,
    gender: d.gender, date_of_birth: d.dateOfBirth, place_of_birth: d.placeOfBirth,
    nationality: d.nationality, state_of_origin: d.stateOfOrigin, lga: d.lga,
    senatorial_district: d.senatorialDistrict, geopolitical_zone: d.geopoliticalZone,
    tribe: d.tribe, religion: d.religion, languages: d.languages,
    blood_group: d.bloodGroup, genotype: d.genotype, disability: d.disability,
    marital_status: d.maritalStatus, spouse_name: d.spouseName, number_of_children: Number(d.numberOfChildren) || 0,
    nin: d.nin,
    email: d.email, phone_primary: d.phonePrimary, phone_alt: d.phoneAlt,
    permanent_address: d.permanentAddress, residential_address: d.residentialAddress,
    state: d.state, city: d.city,
    file_number: d.fileNumber,
    nhis_number: d.nhisNumber,
    nhf_number: d.nhfNumber,
    cadre: d.cadre, department_name: d.department, unit_name: d.unit, designation_title: d.designation,
    posting_location: d.postingLocation,
    grade_level: d.gradeLevel, step: d.step,
    salary_annual_ngn: Number(d.salaryAnnualNGN) || null,
    employment_type: d.employmentType,
    employment_status: d.status,
    first_appointment_date: d.firstAppointmentDate, confirmation_date: d.confirmationDate,
    present_appointment_date: d.presentAppointmentDate, last_promotion_date: d.lastPromotionDate,
    year_of_call_to_bar: d.yearOfCallToBar ? Number(d.yearOfCallToBar) : null,
    qualifications: d.qualifications,
    bank_name: d.bankName, account_number: d.accountNumber, pension_administrator: d.pfa, rsa_pin: d.rsaPin, tin: d.tin,
    // Three flat sets of NOK columns on the Staff model; we send whichever
    // slots are filled and leave the rest as empty strings.
    next_of_kin_name: d.noks?.[0]?.name || '',
    next_of_kin_relationship: d.noks?.[0]?.relationship || '',
    next_of_kin_phone: d.noks?.[0]?.phone || '',
    next_of_kin_email: d.noks?.[0]?.email || '',
    next_of_kin_address: d.noks?.[0]?.address || '',
    next_of_kin_2_name: d.noks?.[1]?.name || '',
    next_of_kin_2_relationship: d.noks?.[1]?.relationship || '',
    next_of_kin_2_phone: d.noks?.[1]?.phone || '',
    next_of_kin_2_email: d.noks?.[1]?.email || '',
    next_of_kin_2_address: d.noks?.[1]?.address || '',
    next_of_kin_3_name: d.noks?.[2]?.name || '',
    next_of_kin_3_relationship: d.noks?.[2]?.relationship || '',
    next_of_kin_3_phone: d.noks?.[2]?.phone || '',
    next_of_kin_3_email: d.noks?.[2]?.email || '',
    next_of_kin_3_address: d.noks?.[2]?.address || '',
  });

  // When the user attaches a photo or signature we need to send the request
  // as multipart/form-data instead of JSON so the files land in Django's
  // ImageField columns. Nested objects/arrays are JSON-stringified — DRF
  // serializers can opt into parsing them but the photo + signature path is
  // what we strictly need to land. Empty/null fields are skipped so we don't
  // overwrite stored values with empty strings on PATCH/PUT.
  const buildFormData = (payload, files) => {
    const fd = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') return;
      if (Array.isArray(value) || (typeof value === 'object' && !(value instanceof Blob))) {
        fd.append(key, JSON.stringify(value));
      } else {
        fd.append(key, value);
      }
    });
    if (files.passport_photo) fd.append('passport_photo', files.passport_photo, files.passport_photo.name);
    if (files.signature) fd.append('signature', files.signature, files.signature.name);
    return fd;
  };

  const hasFileUploads = () => Boolean(formData.photoFile || formData.signatureFile);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const v = validate();
    if (Object.keys(v).length) {
      setErrors(v);
      toast.error('Please fix the highlighted fields.');
      return;
    }
    setSubmitting(true);
    const files = {
      passportPhoto: formData.photoFile,
      signature: formData.signatureFile,
    };
    try {
      // The wrapper handles the mock-shape → DRF-shape translation:
      //   - gender (Male/Female → M/F)
      //   - department / designation name → FK PK (auto-create if missing)
      //   - grade_level / posting_location name → FK PK (optional)
      //   - staff_id auto-generated if blank
      // …and writes the returned row back into the local store so the
      // list/dashboard refresh without a full reload.
      const saved = isEdit
        ? await updateStaffFromForm(editId, formData, files)
        : await createStaffFromForm(formData, files);
      toast.success(isEdit ? 'Staff record updated.' : 'Staff member added successfully.');
      setTimeout(() => navigate(`/staff/${saved?.id || editId || ''}`), 600);
    } catch (err) {
      const data = err.response?.data;
      const detail = data?.detail
        || (typeof data === 'object' && data ? Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' · ') : null)
        || `Request failed (${err.response?.status || 'unknown'})`;
      toast.error(detail);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData(EMPTY);
    setErrors({});
  };

  const fieldError = (name) => (errors[name] ? 'error' : '');

  if (isEdit && notFound) {
    return (
      <div>
        <div className="page-header">
          <div>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/staff')}>
              <ArrowLeft size={14} /> Back to staff
            </button>
            <h1 className="page-header-title" style={{ marginTop: '0.4rem' }}>Staff not found</h1>
          </div>
        </div>
        <div className="alert alert-danger">
          No staff record with ID <strong>{editId}</strong> exists. It may have been removed.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(isEdit ? `/staff/${editId}` : '/staff')}>
            <ArrowLeft size={14} /> {isEdit ? 'Back to profile' : 'Back to staff'}
          </button>
          <h1 className="page-header-title" style={{ marginTop: '0.4rem' }}>
            {isEdit ? `Edit Staff — ${formData.firstName} ${formData.lastName}` : 'Add New Staff Member'}
          </h1>
          <p className="page-header-sub">
            {isEdit ? 'Update biodata, employment record and emergency contacts.' : 'Capture biodata, employment record and emergency contacts.'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* === Identity === */}
        <div className="card mb-3">
          <div className="card-head">
            <div className="card-head-title">
              <User size={18} className="card-head-icon" />
              <h3>Personal &amp; Identity</h3>
            </div>
          </div>
          <div className="card-body">
            <div className="row gap-2">
              <div className="col-2">
                <div className="form-group">
                  <label>Title</label>
                  <select name="title" className="form-control" value={formData.title} onChange={handleChange}>
                    <option value="">—</option>
                    {TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="col-3">
                <div className="form-group">
                  <label>First Name *</label>
                  <input name="firstName" className={`form-control ${fieldError('firstName')}`}
                    value={formData.firstName} onChange={handleChange} />
                </div>
              </div>
              <div className="col-3">
                <div className="form-group">
                  <label>Middle Name</label>
                  <input name="middleName" className="form-control" value={formData.middleName} onChange={handleChange} />
                </div>
              </div>
              <div className="col-3">
                <div className="form-group">
                  <label>Last Name *</label>
                  <input name="lastName" className={`form-control ${fieldError('lastName')}`}
                    value={formData.lastName} onChange={handleChange} />
                </div>
              </div>
            </div>

            <div className="row gap-2">
              <div className="col-3">
                <div className="form-group">
                  <label>Gender *</label>
                  <select name="gender" className={`form-control ${fieldError('gender')}`}
                    value={formData.gender} onChange={handleChange}>
                    <option value="">—</option>
                    {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>
              <div className="col-3">
                <div className="form-group">
                  <label>Date of Birth *</label>
                  <input type="date" name="dateOfBirth" className={`form-control ${fieldError('dateOfBirth')}`}
                    value={formData.dateOfBirth} onChange={handleChange} />
                </div>
              </div>
              <div className="col-3">
                <div className="form-group">
                  <label>Place of Birth</label>
                  <input name="placeOfBirth" className="form-control" value={formData.placeOfBirth} onChange={handleChange} />
                </div>
              </div>
              <div className="col-3">
                <div className="form-group">
                  <label>Nationality</label>
                  <input name="nationality" className="form-control" value={formData.nationality} onChange={handleChange} />
                </div>
              </div>
            </div>

            <div className="row gap-2">
              <div className="col-3">
                <div className="form-group">
                  <label>State of Origin *</label>
                  <select name="stateOfOrigin" className={`form-control ${fieldError('stateOfOrigin')}`}
                    value={formData.stateOfOrigin} onChange={handleChange}>
                    <option value="">—</option>
                    {NIGERIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="col-3">
                <div className="form-group">
                  <label>L.G.A.</label>
                  <input name="lga" className="form-control" value={formData.lga} onChange={handleChange} />
                </div>
              </div>
              <div className="col-3">
                <div className="form-group">
                  <label>Senatorial District</label>
                  <input name="senatorialDistrict" className="form-control" value={formData.senatorialDistrict} onChange={handleChange} />
                </div>
              </div>
              <div className="col-3">
                <div className="form-group">
                  <label>Geopolitical Zone</label>
                  <select name="geopoliticalZone" className="form-control" value={formData.geopoliticalZone} onChange={handleChange}>
                    <option value="">—</option>
                    {ZONES.map((z) => <option key={z} value={z}>{z}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="row gap-2">
              <div className="col-3">
                <div className="form-group">
                  <label>Tribe / Ethnic Group</label>
                  <input name="tribe" className="form-control" value={formData.tribe} onChange={handleChange} />
                </div>
              </div>
              <div className="col-3">
                <div className="form-group">
                  <label>Religion</label>
                  <select name="religion" className="form-control" value={formData.religion} onChange={handleChange}>
                    <option value="">—</option>
                    {RELIGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div className="col-6">
                <div className="form-group">
                  <label>Languages Spoken</label>
                  <input name="languages" className="form-control" value={formData.languages} onChange={handleChange} placeholder="e.g. English, Igbo, Yoruba" />
                </div>
              </div>
            </div>

            <div className="row gap-2">
              <div className="col-3">
                <div className="form-group">
                  <label>Marital Status</label>
                  <select name="maritalStatus" className="form-control" value={formData.maritalStatus} onChange={handleChange}>
                    {MARITAL.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div className="col-5">
                <div className="form-group">
                  <label>Spouse Name</label>
                  <input name="spouseName" className="form-control" value={formData.spouseName} onChange={handleChange} disabled={formData.maritalStatus !== 'Married'} />
                </div>
              </div>
              <div className="col-2">
                <div className="form-group">
                  <label>No. of Children</label>
                  <input type="number" min="0" name="numberOfChildren" className="form-control"
                    value={formData.numberOfChildren} onChange={handleChange} />
                </div>
              </div>
              <div className="col-2">
                <div className="form-group">
                  <label>NIN</label>
                  <input name="nin" className={`form-control ${fieldError('nin')}`}
                    value={formData.nin} onChange={handleChange} placeholder="11 digits" />
                  {errors.nin && <div className="form-text error">{errors.nin}</div>}
                </div>
              </div>
            </div>

            <div className="row gap-2">
              <div className="col-3">
                <div className="form-group">
                  <label>Blood Group</label>
                  <select name="bloodGroup" className="form-control" value={formData.bloodGroup} onChange={handleChange}>
                    <option value="">—</option>
                    {BLOOD.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>
              <div className="col-3">
                <div className="form-group">
                  <label>Genotype</label>
                  <select name="genotype" className="form-control" value={formData.genotype} onChange={handleChange}>
                    <option value="">—</option>
                    {GENOTYPE.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>
              <div className="col-6">
                <div className="form-group">
                  <label>Disability (if any)</label>
                  <input name="disability" className="form-control" value={formData.disability} onChange={handleChange} placeholder="None / specify" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* === Contact === */}
        <div className="card mb-3">
          <div className="card-head"><div className="card-head-title"><User size={18} className="card-head-icon" /><h3>Contact</h3></div></div>
          <div className="card-body">
            <div className="row gap-2">
              <div className="col-6">
                <div className="form-group">
                  <label>Email Address</label>
                  <input type="email" name="email" className={`form-control ${fieldError('email')}`}
                    value={formData.email} onChange={handleChange} placeholder="name@cca.gov.ng (optional)" />
                  {errors.email && <div className="form-text error">{errors.email}</div>}
                </div>
              </div>
              <div className="col-3">
                <div className="form-group">
                  <label>Phone (primary)</label>
                  <input name="phonePrimary" className={`form-control ${fieldError('phonePrimary')}`}
                    value={formData.phonePrimary} onChange={handleChange} placeholder="08012345678 (optional)" />
                </div>
              </div>
              <div className="col-3">
                <div className="form-group">
                  <label>Phone (alternative)</label>
                  <input name="phoneAlt" className="form-control" value={formData.phoneAlt} onChange={handleChange} />
                </div>
              </div>
            </div>
            <div className="form-group">
              <label>Residential Address</label>
              <input name="residentialAddress" className="form-control" value={formData.residentialAddress} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Permanent Home Address</label>
              <input name="permanentAddress" className="form-control" value={formData.permanentAddress} onChange={handleChange} />
            </div>
          </div>
        </div>

        {/* === Employment === */}
        <div className="card mb-3">
          <div className="card-head"><div className="card-head-title"><Briefcase size={18} className="card-head-icon" /><h3>Employment</h3></div></div>
          <div className="card-body">
            <div className="row gap-2">
              <div className="col-3">
                <div className="form-group">
                  <label>File Number</label>
                  <input name="fileNumber" className="form-control" value={formData.fileNumber} onChange={handleChange} />
                </div>
              </div>
              <div className="col-3">
                <div className="form-group">
                  <label>Secret File Number</label>
                  <input
                    name="secretFileNumber"
                    className="form-control"
                    value={formData.secretFileNumber}
                    onChange={handleChange}
                    placeholder="e.g. CCA/SF/2026/0001"
                    autoComplete="off"
                  />
                </div>
              </div>
              <div className="col-3">
                <div className="form-group">
                  <label>NHIS Number</label>
                  <input name="nhisNumber" className="form-control" value={formData.nhisNumber} onChange={handleChange} placeholder="National Health Insurance Scheme" />
                </div>
              </div>
              <div className="col-3">
                <div className="form-group">
                  <label>National Housing Number</label>
                  <input name="nhfNumber" className="form-control" value={formData.nhfNumber} onChange={handleChange} placeholder="NHF / housing PIN" />
                </div>
              </div>
              <div className="col-3">
                <div className="form-group">
                  <label>Cadre</label>
                  <input name="cadre" className="form-control" value={formData.cadre} onChange={handleChange} placeholder="e.g. Legal, Court Operations" />
                </div>
              </div>
            </div>

            <div className="row gap-2">
              <div className="col-4">
                <div className="form-group">
                  <label>Department *</label>
                  <select
                    name="department"
                    className={`form-control ${fieldError('department')}`}
                    value={formData.department}
                    onChange={(e) => {
                      // Clear unit when department changes so we don't carry
                      // over a unit that belongs to a different department.
                      handleChange(e);
                      set('unit', '');
                    }}
                  >
                    <option value="">—</option>
                    {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                    {formData.department && !departments.includes(formData.department) && (
                      <option value={formData.department}>{formData.department} (not in current list)</option>
                    )}
                  </select>
                </div>
              </div>
              <div className="col-4">
                <div className="form-group">
                  <label>Unit</label>
                  {(() => {
                    const units = formData.department ? listUnits(formData.department) : [];
                    const noDept = !formData.department;
                    return (
                      <select
                        name="unit"
                        className="form-control"
                        value={formData.unit || ''}
                        onChange={handleChange}
                        disabled={noDept || units.length === 0}
                      >
                        <option value="">
                          {noDept
                            ? 'Pick a department first'
                            : units.length === 0
                              ? 'No units defined for this department'
                              : '—'}
                        </option>
                        {units.map((u) => <option key={u} value={u}>{u}</option>)}
                        {formData.unit && !units.includes(formData.unit) && (
                          <option value={formData.unit}>{formData.unit} (not in current list)</option>
                        )}
                      </select>
                    );
                  })()}
                </div>
              </div>
              <div className="col-4">
                <div className="form-group">
                  <label>Designation *</label>
                  <select name="designation" className={`form-control ${fieldError('designation')}`}
                    value={formData.designation} onChange={handleChange}>
                    <option value="">—</option>
                    {designations.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="row gap-2">
              <div className="col-12">
                <div className="form-group">
                  <label>Duty Station / Posting</label>
                  <input name="postingLocation" className="form-control" value={formData.postingLocation} onChange={handleChange} />
                </div>
              </div>
            </div>

            <div className="row gap-2">
              <div className="col-6">
                <div className="form-group">
                  <label>Organizational Role</label>
                  <select
                    name="organizationalRole"
                    className="form-control"
                    value={formData.organizationalRole || ''}
                    onChange={handleChange}
                  >
                    <option value="">— None —</option>
                    <option value="Chief Registrar">Chief Registrar</option>
                    <option value="Director">Director</option>
                    <option value="Deputy Director">Deputy Director</option>
                    <option value="Head of Department">Head of Department</option>
                    <option value="Head of Unit">Head of Unit</option>
                    <option value="Judge">Judge</option>
                  </select>
                  <small className="muted">
                    Choose “Judge” to also list the officer in the Judges section
                    (judges still appear in the main staff list).
                  </small>
                </div>
              </div>
            </div>

            <div className="row gap-2">
              <div className="col-2">
                <div className="form-group">
                  <label>Grade Level *</label>
                  <select name="gradeLevel" className={`form-control ${fieldError('gradeLevel')}`}
                    value={formData.gradeLevel} onChange={handleChange}>
                    <option value="">—</option>
                    {GRADE_LEVELS.map((g) => <option key={g} value={g}>GL {g}</option>)}
                  </select>
                </div>
              </div>
              <div className="col-2">
                <div className="form-group">
                  <label>Step</label>
                  <select name="step" className="form-control" value={formData.step} onChange={handleChange}>
                    {STEPS.map((s) => <option key={s} value={s}>Step {s}</option>)}
                  </select>
                </div>
              </div>
              <div className="col-4">
                <div className="form-group">
                  <label>Employment Type</label>
                  <select name="employmentType" className="form-control" value={formData.employmentType} onChange={handleChange}>
                    {EMPLOYMENT.map((e) => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="row gap-2">
              <div className="col-3">
                <div className="form-group">
                  <label>Status</label>
                  <select name="status" className="form-control" value={formData.status} onChange={handleChange}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="col-3">
                <div className="form-group">
                  <label>Year of Call to Bar <span className="muted small">(optional)</span></label>
                  <input
                    type="number"
                    name="yearOfCallToBar"
                    className="form-control"
                    value={formData.yearOfCallToBar}
                    onChange={handleChange}
                    placeholder="e.g. 2011"
                    min="1960"
                    max={new Date().getFullYear()}
                  />
                </div>
              </div>
            </div>

            <div className="row gap-2">
              <div className="col-3">
                <div className="form-group">
                  <label>First Appointment *</label>
                  <input type="date" name="firstAppointmentDate" className={`form-control ${fieldError('firstAppointmentDate')}`}
                    value={formData.firstAppointmentDate} onChange={handleChange} />
                </div>
              </div>
              <div className="col-3">
                <div className="form-group">
                  <label>Confirmation Date</label>
                  <input type="date" name="confirmationDate" className="form-control"
                    value={formData.confirmationDate} onChange={handleChange} />
                </div>
              </div>
              <div className="col-3">
                <div className="form-group">
                  <label>Present Appointment</label>
                  <input type="date" name="presentAppointmentDate" className="form-control"
                    value={formData.presentAppointmentDate} onChange={handleChange} />
                </div>
              </div>
              <div className="col-3">
                <div className="form-group">
                  <label>Last Promotion Date</label>
                  <input type="date" name="lastPromotionDate" className="form-control"
                    value={formData.lastPromotionDate} onChange={handleChange} />
                </div>
              </div>
            </div>

            {(previewRetirement || previewNextPromo) && (
              <div className="calc-preview">
                <div>
                  <span className="calc-preview-label">Calculated retirement</span>
                  <span className="calc-preview-value">{formatDate(previewRetirement)}</span>
                </div>
                <div>
                  <span className="calc-preview-label">Next promotion review</span>
                  <span className="calc-preview-value">{formatDate(previewNextPromo)}</span>
                </div>
                <span className="muted small">Auto-computed: retirement is 60y OR 35y of service; promotion review is 3y from last promotion.</span>
              </div>
            )}
          </div>
        </div>

        {/* === Education === */}
        <div className="card mb-3">
          <div className="card-head"><div className="card-head-title"><GraduationCap size={18} className="card-head-icon" /><h3>Educational &amp; Professional Qualifications</h3></div></div>
          <div className="card-body">
            <div className="row gap-2">
              <div className="col-4">
                <div className="form-group">
                  <label>Institution / Body</label>
                  <input name="qualSchool" className="form-control" value={formData.qualSchool} onChange={handleChange} />
                </div>
              </div>
              <div className="col-3">
                <div className="form-group">
                  <label>Qualification</label>
                  <input name="qualName" className="form-control" value={formData.qualName} onChange={handleChange} placeholder="e.g. LL.B (Hons)" />
                </div>
              </div>
              <div className="col-2">
                <div className="form-group">
                  <label>Year</label>
                  <input name="qualYear" className="form-control" value={formData.qualYear} onChange={handleChange} placeholder="2018" />
                </div>
              </div>
              <div className="col-2">
                <div className="form-group">
                  <label>Grade / Result</label>
                  <input name="qualGrade" className="form-control" value={formData.qualGrade} onChange={handleChange} placeholder="2:1" />
                </div>
              </div>
              <div className="col-1 col-reset-action">
                <button type="button" className="btn btn-outline btn-block" onClick={addQualification}>+</button>
              </div>
            </div>
            {formData.qualifications.length > 0 && (
              <table className="table table-modern">
                <thead><tr><th>Institution</th><th>Qualification</th><th>Year</th><th>Grade</th><th></th></tr></thead>
                <tbody>
                  {formData.qualifications.map((q, idx) => (
                    <tr key={idx}>
                      <td>{q.school}</td>
                      <td>{q.qualification}</td>
                      <td>{q.year}</td>
                      <td><span className="chip">{q.grade}</span></td>
                      <td className="text-right">
                        <button type="button" className="action-btn action-btn--danger" onClick={() => removeQualification(idx)}><X size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* === Financial === */}
        <div className="card mb-3">
          <div className="card-head"><div className="card-head-title"><Banknote size={18} className="card-head-icon" /><h3>Financial &amp; Pension</h3></div></div>
          <div className="card-body">
            <div className="row gap-2">
              <div className="col-4">
                <div className="form-group">
                  <label>Bank Name</label>
                  <input name="bankName" className="form-control" value={formData.bankName} onChange={handleChange} />
                </div>
              </div>
              <div className="col-4">
                <div className="form-group">
                  <label>Account Number</label>
                  <input name="accountNumber" className="form-control" value={formData.accountNumber} onChange={handleChange} />
                </div>
              </div>
              <div className="col-4">
                <div className="form-group">
                  <label>Tax Identification Number (TIN)</label>
                  <input name="tin" className="form-control" value={formData.tin} onChange={handleChange} />
                </div>
              </div>
            </div>
            <div className="row gap-2">
              <div className="col-6">
                <div className="form-group">
                  <label>Pension Fund Administrator (PFA)</label>
                  <input name="pfa" className="form-control" value={formData.pfa} onChange={handleChange} placeholder="e.g. Stanbic IBTC Pensions" />
                </div>
              </div>
              <div className="col-6">
                <div className="form-group">
                  <label>RSA PIN</label>
                  <input name="rsaPin" className="form-control" value={formData.rsaPin} onChange={handleChange} placeholder="PEN..." />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* === Next of kin (up to 3 entries) === */}
        <div className="card mb-3">
          <div className="card-head">
            <div className="card-head-title">
              <UsersIcon size={18} className="card-head-icon" />
              <h3>Next of Kin</h3>
            </div>
            <div className="muted small">You can add up to {MAX_NEXT_OF_KIN} contacts (Primary, Secondary, Tertiary).</div>
          </div>
          <div className="card-body">
            {(formData.noks || []).map((nok, idx) => (
              <div key={idx} className="nok-block" style={{ marginBottom: idx < (formData.noks.length - 1) ? '1rem' : 0, paddingBottom: idx < (formData.noks.length - 1) ? '1rem' : 0, borderBottom: idx < (formData.noks.length - 1) ? '1px dashed var(--border, #e5e7eb)' : 'none' }}>
                <div className="d-flex justify-content-between align-items-center mb-2" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <strong>{NEXT_OF_KIN_LABELS[idx]} Next of Kin</strong>
                  {idx > 0 && (
                    <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => removeNok(idx)}>
                      <Trash2 size={14} /> Remove
                    </button>
                  )}
                </div>
                <div className="row gap-2">
                  <div className="col-6">
                    <div className="form-group">
                      <label>Name</label>
                      <input className="form-control" value={nok.name} onChange={(e) => setNokField(idx, 'name', e.target.value)} />
                    </div>
                  </div>
                  <div className="col-3">
                    <div className="form-group">
                      <label>Relationship</label>
                      <input className="form-control" value={nok.relationship} onChange={(e) => setNokField(idx, 'relationship', e.target.value)} />
                    </div>
                  </div>
                  <div className="col-3">
                    <div className="form-group">
                      <label>Phone</label>
                      <input className="form-control" value={nok.phone} onChange={(e) => setNokField(idx, 'phone', e.target.value)} />
                    </div>
                  </div>
                </div>
                <div className="row gap-2">
                  <div className="col-6">
                    <div className="form-group">
                      <label>Email</label>
                      <input className="form-control" value={nok.email} onChange={(e) => setNokField(idx, 'email', e.target.value)} />
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="form-group">
                      <label>Address</label>
                      <input className="form-control" value={nok.address} onChange={(e) => setNokField(idx, 'address', e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {(formData.noks?.length || 0) < MAX_NEXT_OF_KIN && (
              <div style={{ marginTop: '0.75rem' }}>
                <button type="button" className="btn btn-outline-primary btn-sm" onClick={addNok}>
                  <Plus size={14} /> Add another Next of Kin
                </button>
              </div>
            )}
          </div>
        </div>

        {/* === Photo & Signature === */}
        <div className="card mb-3">
          <div className="card-head"><div className="card-head-title"><ImageIcon size={18} className="card-head-icon" /><h3>Photo &amp; Signature</h3></div></div>
          <div className="card-body">
            <div className="row gap-2">
              <div className="col-6">
                <div className="form-group">
                  <label>Passport Photograph</label>
                  <div className="image-upload">
                    <div className="image-upload-preview image-upload-preview--photo">
                      {formData.photoDataUrl
                        ? <img src={formData.photoDataUrl} alt="Staff photo preview" />
                        : <div className="image-upload-placeholder"><User size={40} /></div>}
                    </div>
                    <div className="image-upload-actions">
                      <label className="btn btn-outline">
                        <Upload size={16} /> {formData.photoDataUrl ? 'Replace' : 'Upload'}
                        <input type="file" accept="image/*" onChange={handleImageUpload('photoDataUrl', 'photoFile')} hidden />
                      </label>
                      {formData.photoDataUrl && (
                        <button type="button" className="btn btn-outline btn-danger-outline" onClick={clearImage('photoDataUrl', 'photoFile')}>
                          <Trash2 size={16} /> Remove
                        </button>
                      )}
                      <span className="muted small">PNG or JPG, up to 2MB.</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-6">
                <div className="form-group">
                  <label>Signature</label>
                  <div className="image-upload">
                    <div className="image-upload-preview image-upload-preview--signature">
                      {formData.signatureDataUrl
                        ? <img src={formData.signatureDataUrl} alt="Signature preview" />
                        : <div className="image-upload-placeholder"><PenTool size={36} /></div>}
                    </div>
                    <div className="image-upload-actions">
                      <label className="btn btn-outline">
                        <Upload size={16} /> {formData.signatureDataUrl ? 'Replace' : 'Upload'}
                        <input type="file" accept="image/*" onChange={handleImageUpload('signatureDataUrl', 'signatureFile')} hidden />
                      </label>
                      {formData.signatureDataUrl && (
                        <button type="button" className="btn btn-outline btn-danger-outline" onClick={clearImage('signatureDataUrl', 'signatureFile')}>
                          <Trash2 size={16} /> Remove
                        </button>
                      )}
                      <span className="muted small">Scanned signature on white background.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-outline" onClick={handleReset} disabled={submitting}>
            <X size={18} /> Clear Form
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? <span className="loading" /> : <Save size={18} />}
            {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Save Staff Member'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddStaff;
