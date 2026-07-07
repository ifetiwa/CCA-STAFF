import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Mail, Phone, MapPin, Briefcase, Calendar, Award, User,
  Edit, Printer, Download, Heart, Hash, IdCard, Globe, GraduationCap,
  Building2, Banknote, Users, FileText, Clock, AlertTriangle,
  ArrowRightLeft, TrendingUp, X,
} from 'lucide-react';
import { formatDate, statusTone, updateStaffRecord } from '../data/staff';
import { downloadCsv, printElement } from '../utils/download';
import { generateStaffPdf } from '../utils/pdf';
import { useToast } from '../context/ToastContext';
import { useStaff } from '../hooks/useStaff';
import { FileDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { listDepartmentNames, listUnits, subscribeDepartments } from '../data/departments';
import { listDesignations, subscribeDesignations } from '../data/designations';

const Section = ({ title, icon: Icon, children }) => (
  <div className="card">
    <div className="card-head">
      <div className="card-head-title">
        {Icon && <Icon size={18} className="card-head-icon" />}
        <h3>{title}</h3>
      </div>
    </div>
    <div className="card-body">{children}</div>
  </div>
);

const Row = ({ icon: Icon, label, value }) => (
  <div className="detail-row">
    <div className="detail-label">
      {Icon && <Icon size={14} />}
      <span>{label}</span>
    </div>
    <div className="detail-value">{value || '—'}</div>
  </div>
);

const StatTile = ({ label, value, sub, tone = 'primary' }) => (
  <div className={`profile-stat profile-stat--${tone}`}>
    <div className="profile-stat-label">{label}</div>
    <div className="profile-stat-value">{value}</div>
    {sub && <div className="profile-stat-sub">{sub}</div>}
  </div>
);

const TABS = [
  { id: 'overview',    label: 'Overview' },
  { id: 'employment',  label: 'Employment' },
  { id: 'education',   label: 'Education' },
  { id: 'financial',   label: 'Financial & Pension' },
  { id: 'history',     label: 'Service History' },
  { id: 'kin',         label: 'Next of Kin' },
];

const StaffDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { can } = useAuth();
  const [tab, setTab] = useState('overview');

  const live = useStaff();
  const staff = useMemo(
    () => live.find((s) => String(s.id) === String(id)) || live[0],
    [live, id],
  );

  const [postOpen, setPostOpen] = useState(false);
  const [departments, setDepartments] = useState(() => listDepartmentNames());
  const [designations, setDesignations] = useState(() => listDesignations());
  useEffect(() => subscribeDepartments(() => setDepartments(listDepartmentNames())), []);
  useEffect(() => subscribeDesignations(() => setDesignations(listDesignations())), []);

  const todayIso = new Date().toISOString().slice(0, 10);
  const blankPostForm = () => ({
    department: staff.department || '',
    unit: staff.unit || '',
    designation: staff.designation || '',
    postingLocation: staff.postingLocation || '',
    effectiveDate: todayIso,
    remarks: '',
  });
  const [postForm, setPostForm] = useState(blankPostForm);

  const openPostingModal = () => {
    setPostForm(blankPostForm());
    setPostOpen(true);
  };

  const setPF = (k, v) => setPostForm((prev) => ({ ...prev, [k]: v }));

  const handlePosting = (e) => {
    e.preventDefault();
    const dept = (postForm.department || '').trim();
    const unit = (postForm.unit || '').trim();
    const desig = (postForm.designation || '').trim();
    const loc = (postForm.postingLocation || '').trim();
    if (!postForm.effectiveDate) {
      toast.error('Effective date is required.');
      return;
    }
    const changes = [];
    if (dept !== (staff.department || '')) {
      changes.push(`Department: ${staff.department || '—'} → ${dept || '—'}`);
    }
    if (unit !== (staff.unit || '')) {
      changes.push(`Unit: ${staff.unit || '—'} → ${unit || '—'}`);
    }
    if (desig !== (staff.designation || '')) {
      changes.push(`Designation: ${staff.designation || '—'} → ${desig || '—'}`);
    }
    if (loc !== (staff.postingLocation || '')) {
      changes.push(`Duty Station: ${staff.postingLocation || '—'} → ${loc || '—'}`);
    }
    if (changes.length === 0) {
      toast.error('Change at least one of department, unit, designation or duty station.');
      return;
    }
    const detail = changes.join('; ') + (postForm.remarks.trim() ? ` — ${postForm.remarks.trim()}` : '');
    const entry = { date: postForm.effectiveDate, event: 'Posting / Transfer', detail };
    const history = [...(staff.serviceHistory || []), entry]
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    updateStaffRecord(staff.id, {
      department: dept,
      unit,
      designation: desig,
      postingLocation: loc,
      presentAppointmentDate: postForm.effectiveDate,
      serviceHistory: history,
    });
    toast.success(`${staff.fullName} posted successfully.`);
    setPostOpen(false);
    setTab('history');
  };

  // -- Conversion / Promotion ------------------------------------------------
  const GRADE_LEVELS = ['01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17'];
  const STEPS = ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15'];

  const [convOpen, setConvOpen] = useState(false);
  const blankConvForm = () => ({
    actionType: 'Promotion',
    designation: staff.designation || '',
    cadre: staff.cadre || '',
    gradeLevel: staff.gradeLevel || '',
    step: staff.step || '',
    effectiveDate: todayIso,
    remarks: '',
  });
  const [convForm, setConvForm] = useState(blankConvForm);
  const setCF = (k, v) => setConvForm((prev) => ({ ...prev, [k]: v }));

  const openConversionModal = () => {
    setConvForm(blankConvForm());
    setConvOpen(true);
  };

  const handleConversion = (e) => {
    e.preventDefault();
    const desig = (convForm.designation || '').trim();
    const cadre = (convForm.cadre || '').trim();
    const gl = (convForm.gradeLevel || '').trim();
    const stp = (convForm.step || '').trim();
    if (!convForm.effectiveDate) {
      toast.error('Effective date is required.');
      return;
    }
    const changes = [];
    if (desig !== (staff.designation || '')) {
      changes.push(`Designation: ${staff.designation || '—'} → ${desig || '—'}`);
    }
    if (cadre !== (staff.cadre || '')) {
      changes.push(`Cadre: ${staff.cadre || '—'} → ${cadre || '—'}`);
    }
    if (gl !== (staff.gradeLevel || '') || stp !== (staff.step || '')) {
      changes.push(
        `Grade: GL ${staff.gradeLevel || '—'}/${staff.step || '—'} → GL ${gl || '—'}/${stp || '—'}`,
      );
    }
    if (changes.length === 0) {
      toast.error('Change designation, cadre or grade level to record a conversion or promotion.');
      return;
    }
    const detail = changes.join('; ') + (convForm.remarks.trim() ? ` — ${convForm.remarks.trim()}` : '');
    const entry = { date: convForm.effectiveDate, event: convForm.actionType, detail };
    const history = [...(staff.serviceHistory || []), entry]
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    const patch = {
      designation: desig,
      cadre,
      gradeLevel: gl,
      step: stp,
      serviceHistory: history,
    };
    if (convForm.actionType === 'Promotion') {
      patch.lastPromotionDate = convForm.effectiveDate;
    }
    updateStaffRecord(staff.id, patch);
    toast.success(
      `${convForm.actionType} recorded for ${staff.fullName}.`,
    );
    setConvOpen(false);
    setTab('history');
  };

  const formatNaira = (n) => (typeof n === 'number'
    ? '₦' + n.toLocaleString('en-NG')
    : '—');

  const retirementSub = staff.retirementInDays !== null
    ? (staff.retirementInDays < 0
        ? `Retired ${Math.abs(staff.retirementInDays)} days ago`
        : `${staff.retirementInDays.toLocaleString()} days remaining`)
    : '—';

  const promotionSub = staff.nextPromotionInDays !== null
    ? (staff.nextPromotionInDays < 0
        ? `Due ${Math.abs(staff.nextPromotionInDays)} days ago`
        : `${staff.nextPromotionInDays.toLocaleString()} days remaining`)
    : '—';

  const handleExport = () => {
    downloadCsv(
      [{
        StaffID: staff.staffId, FileNo: staff.fileNumber,
        NHIS: staff.nhisNumber, NHF: staff.nhfNumber,
        Name: staff.fullName, Gender: staff.gender, DOB: staff.dateOfBirth,
        Age: staff.age, NIN: staff.nin, Department: staff.department, Unit: staff.unit || '',
        Designation: staff.designation, GradeLevel: `GL ${staff.gradeLevel}/${staff.step}`,
        Status: staff.status, YearOfCallToBar: staff.yearOfCallToBar || '',
        FirstAppointment: staff.firstAppointmentDate,
        Confirmation: staff.confirmationDate, LastPromotion: staff.lastPromotionDate,
        NextPromotion: staff.nextPromotionDate, RetirementDate: staff.retirementDate,
        Email: staff.email, Phone: staff.phonePrimary,
        StateOfOrigin: staff.stateOfOrigin, LGA: staff.lga, Zone: staff.geopoliticalZone,
      }],
      null,
      `${staff.staffId.replace(/[^a-z0-9]/gi, '-')}-biodata.csv`,
    );
    toast.success('Biodata exported as CSV.');
  };

  return (
    <div className="staff-detail">
      <div className="page-header">
        <div className="d-flex align-items-center gap-1">
          <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="page-header-title">Staff Profile</h1>
            <p className="page-header-sub">Full biodata, service record and calculated milestones.</p>
          </div>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline" onClick={() => printElement()}>
            <Printer size={18} /> Print
          </button>
          <button className="btn btn-outline" onClick={handleExport}>
            <Download size={18} /> CSV
          </button>
          <button className="btn btn-outline" onClick={() => { generateStaffPdf(staff); toast.success('Profile exported as PDF.'); }}>
            <FileDown size={18} /> Export PDF
          </button>
          {can('edit_staff') && (
            <button className="btn btn-outline" onClick={openPostingModal}>
              <ArrowRightLeft size={18} /> Post / Transfer
            </button>
          )}
          {can('edit_staff') && (
            <button className="btn btn-outline" onClick={openConversionModal}>
              <TrendingUp size={18} /> Conversion / Promotion
            </button>
          )}
          {can('edit_staff') && (
            <button className="btn btn-primary" onClick={() => navigate(`/staff/${staff.id}/edit`)}>
              <Edit size={18} /> Edit Profile
            </button>
          )}
        </div>
      </div>

      {/* HERO */}
      <div className="card profile-hero mb-3">
        <div className="profile-hero-top">
          <div className="profile-avatar">
            {staff.photoDataUrl
              ? <img src={staff.photoDataUrl} alt={staff.fullName} className="profile-avatar-photo" />
              : staff.initials}
          </div>
          <div className="profile-meta">
            <h2 className="profile-name">{staff.fullName}</h2>
            <div className="profile-position">{staff.designation} · {staff.department} Department</div>
            <div className="profile-chips">
              <span className={`badge badge-${statusTone(staff.status)}`}>{staff.status}</span>
              <span className="chip">{staff.staffId}</span>
              <span className="chip">GL {staff.gradeLevel} / Step {staff.step}</span>
              <span className="chip">{staff.employmentType}</span>
              <span className="chip">{staff.cadre}</span>
            </div>
          </div>
          <div className="profile-quick">
            <a href={`mailto:${staff.email}`}><Mail size={14} /> {staff.email}</a>
            <a href={`tel:${staff.phonePrimary}`}><Phone size={14} /> {staff.phonePrimary}</a>
            <span><MapPin size={14} /> {staff.postingLocation}</span>
          </div>
        </div>
        <div className="profile-stats">
          <StatTile label="Age" value={staff.age + ' yrs'} sub={`DOB ${formatDate(staff.dateOfBirth)}`} tone="primary" />
          <StatTile label="Years of Service" value={staff.yearsOfService} sub={`Since ${formatDate(staff.firstAppointmentDate)}`} tone="info" />
          <StatTile label="Next Promotion" value={formatDate(staff.nextPromotionDate)} sub={promotionSub} tone={staff.nextPromotionInDays !== null && staff.nextPromotionInDays <= 90 ? 'warning' : 'success'} />
          <StatTile label="Retirement Date" value={formatDate(staff.retirementDate)} sub={retirementSub} tone={staff.retirementInDays !== null && staff.retirementInDays <= 365 ? 'danger' : 'primary'} />
        </div>
      </div>

      {/* TABS */}
      <div className="profile-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`profile-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === 'overview' && (
        <div className="row gap-3">
          <div className="col-6">
            <Section title="Personal Information" icon={User}>
              <Row icon={User}    label="Full Name"          value={staff.fullName} />
              <Row icon={IdCard}  label="NIN"                value={staff.nin} />
              <Row icon={Calendar} label="Date of Birth"     value={formatDate(staff.dateOfBirth)} />
              <Row icon={MapPin}  label="Place of Birth"     value={staff.placeOfBirth} />
              <Row                label="Gender"             value={staff.gender} />
              <Row                label="Marital Status"     value={staff.maritalStatus} />
              <Row                label="Spouse Name"        value={staff.spouseName} />
              <Row                label="Number of Children" value={staff.numberOfChildren} />
              <Row icon={Heart}   label="Blood Group · Genotype" value={`${staff.bloodGroup || '—'} · ${staff.genotype || '—'}`} />
              <Row                label="Disability"         value={staff.disability} />
            </Section>
          </div>

          <div className="col-6">
            <Section title="Origin & Identity" icon={Globe}>
              <Row icon={Globe}   label="Nationality"          value={staff.nationality} />
              <Row icon={MapPin}  label="State of Origin"      value={staff.stateOfOrigin} />
              <Row                label="LGA"                  value={staff.lga} />
              <Row                label="Senatorial District"  value={staff.senatorialDistrict} />
              <Row                label="Geopolitical Zone"    value={staff.geopoliticalZone} />
              <Row                label="Tribe / Ethnic Group" value={staff.tribe} />
              <Row                label="Religion"             value={staff.religion} />
              <Row                label="Languages Spoken"     value={staff.languages} />
            </Section>
          </div>

          <div className="col-6">
            <Section title="Contact" icon={Phone}>
              <Row icon={Mail}    label="Email"               value={staff.email} />
              <Row icon={Phone}   label="Phone (primary)"     value={staff.phonePrimary} />
              <Row icon={Phone}   label="Phone (alternative)" value={staff.phoneAlt} />
              <Row icon={MapPin}  label="Residential Address" value={staff.residentialAddress} />
              <Row icon={MapPin}  label="Permanent Home Address" value={staff.permanentAddress} />
            </Section>
          </div>

          <div className="col-6">
            <Section title="Government Identifiers" icon={Hash}>
              <Row icon={Hash}   label="Staff ID"                 value={staff.staffId} />
              <Row icon={Hash}   label="File Number"              value={staff.fileNumber} />
              <Row icon={Hash}   label="Secret File Number"       value={staff.secretFileNumber} />
              <Row icon={Hash}   label="NHIS Number"              value={staff.nhisNumber} />
              <Row icon={Hash}   label="National Housing Number"  value={staff.nhfNumber} />
              <Row icon={IdCard} label="NIN"                      value={staff.nin} />
              <Row icon={Hash}   label="TIN"                      value={staff.tin} />
              <Row icon={Hash}   label="RSA PIN"                  value={staff.rsaPin} />
              <Row icon={Award}  label="Year of Call to Bar"      value={staff.yearOfCallToBar || '—'} />
            </Section>
          </div>

          {staff.signatureDataUrl && (
            <div className="col-6">
              <Section title="Signature" icon={Edit}>
                <div className="profile-signature">
                  <img src={staff.signatureDataUrl} alt={`Signature of ${staff.fullName}`} />
                </div>
              </Section>
            </div>
          )}
        </div>
      )}

      {/* EMPLOYMENT */}
      {tab === 'employment' && (
        <div className="row gap-3">
          <div className="col-6">
            <Section title="Posting & Cadre" icon={Briefcase}>
              <Row icon={Building2} label="Agency"             value={staff.agency || '—'} />
              <Row icon={Building2} label="Department"         value={staff.department} />
              <Row icon={Building2} label="Unit"               value={staff.unit || '—'} />
              <Row icon={Briefcase} label="Designation"        value={staff.designation} />
              <Row                  label="Cadre"              value={staff.cadre} />
              <Row icon={MapPin}    label="Duty Station"       value={staff.postingLocation} />
              <Row                  label="Employment Type"    value={staff.employmentType} />
              <Row                  label="Salary Grade"       value={`GL ${staff.gradeLevel} / Step ${staff.step}`} />
            </Section>
          </div>
          <div className="col-6">
            <Section title="Service Milestones" icon={Clock}>
              <Row icon={Calendar} label="First Appointment"     value={formatDate(staff.firstAppointmentDate)} />
              <Row icon={Calendar} label="Confirmation Date"     value={formatDate(staff.confirmationDate)} />
              <Row icon={Calendar} label="Present Appointment"   value={formatDate(staff.presentAppointmentDate)} />
              <Row icon={Calendar} label="Last Promotion"        value={formatDate(staff.lastPromotionDate)} />
              <Row icon={Calendar} label="Years of Service"      value={`${staff.yearsOfService} year(s)`} />
              <Row icon={AlertTriangle} label="Next Promotion (calculated)" value={`${formatDate(staff.nextPromotionDate)} · ${promotionSub}`} />
              <Row icon={AlertTriangle} label="Retirement (calculated)"     value={`${formatDate(staff.retirementDate)} · ${retirementSub}`} />
              <div className="muted small mt-1">
                Retirement = whichever comes first of age&nbsp;60 or 35 years of service. Next promotion = 3 years from last promotion.
              </div>
            </Section>
          </div>
        </div>
      )}

      {/* EDUCATION */}
      {tab === 'education' && (
        <Section title="Educational & Professional Qualifications" icon={GraduationCap}>
          {(staff.qualifications || []).length === 0 && <div className="muted">No qualifications on file.</div>}
          <table className="table table-modern">
            <thead>
              <tr>
                <th>Institution / Body</th>
                <th>Qualification</th>
                <th>Year</th>
                <th>Grade / Result</th>
              </tr>
            </thead>
            <tbody>
              {(staff.qualifications || []).map((q, idx) => (
                <tr key={idx}>
                  <td>{q.school}</td>
                  <td>{q.qualification}</td>
                  <td>{q.year}</td>
                  <td><span className="chip">{q.grade}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* FINANCIAL */}
      {tab === 'financial' && (
        <div className="row gap-3">
          <div className="col-6">
            <Section title="Salary Account" icon={Banknote}>
              <Row label="Bank Name"      value={staff.bankName} />
              <Row label="Account Number" value={staff.accountNumber} />
              <Row label="TIN"            value={staff.tin} />
            </Section>
          </div>
          <div className="col-6">
            <Section title="Pension (PFA)" icon={FileText}>
              <Row label="Pension Fund Administrator" value={staff.pfa} />
              <Row label="RSA PIN"                    value={staff.rsaPin} />
              <Row label="NHIS Number"                value={staff.nhisNumber} />
              <Row label="National Housing Number"    value={staff.nhfNumber} />
            </Section>
          </div>
        </div>
      )}

      {/* HISTORY */}
      {tab === 'history' && (
        <Section title="Service History" icon={Clock}>
          {(staff.serviceHistory || []).length === 0 && <div className="muted">No service history on file.</div>}
          <ul className="timeline">
            {(staff.serviceHistory || []).map((e, idx) => (
              <li key={idx}>
                <span className="dot" />
                <div>
                  <strong>{e.event}</strong>
                  <div className="muted small">{formatDate(e.date)} — {e.detail}</div>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* KIN */}
      {tab === 'kin' && (
        <div className="row gap-3">
          {(staff.nextOfKins && staff.nextOfKins.length ? staff.nextOfKins : [staff.nextOfKin || {}]).map((nok, idx) => {
            const labels = ['Primary', 'Secondary', 'Tertiary'];
            const hasAny = ['name','relationship','phone','email','address'].some((k) => nok && nok[k]);
            if (!hasAny && idx > 0) return null;
            return (
              <div className="col-6" key={idx}>
                <Section title={`${labels[idx] || `Next of Kin #${idx + 1}`} Next of Kin`} icon={Users}>
                  <Row icon={User}   label="Name"         value={nok?.name} />
                  <Row               label="Relationship" value={nok?.relationship} />
                  <Row icon={Phone}  label="Phone"        value={nok?.phone} />
                  <Row icon={Mail}   label="Email"        value={nok?.email} />
                  <Row icon={MapPin} label="Address"      value={nok?.address} />
                </Section>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3 muted small">
        Looking for the full list? <Link to="/staff">Return to staff directory</Link>.
      </div>

      {postOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            zIndex: 1000, padding: '4rem 1rem 1rem',
          }}
          onClick={() => setPostOpen(false)}
        >
          <div
            className="card"
            style={{ width: '100%', maxWidth: 640, maxHeight: 'calc(100vh - 6rem)', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: '#fff' }}>Post / Transfer {staff.fullName}</h3>
              <button className="btn btn-sm btn-ghost" onClick={() => setPostOpen(false)} aria-label="Close" style={{ color: '#fff' }}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handlePosting} className="card-body">
              <div className="muted small mb-2">
                Update the staff member's department, unit, designation or duty station. A new entry will
                be appended to the Service History on save.
              </div>

              <div className="row gap-2">
                <div className="col-6">
                  <div className="form-group">
                    <label>Department</label>
                    <select
                      className="form-control"
                      value={postForm.department}
                      onChange={(e) => {
                        const v = e.target.value;
                        setPostForm((prev) => ({ ...prev, department: v, unit: '' }));
                      }}
                    >
                      <option value="">—</option>
                      {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                      {postForm.department && !departments.includes(postForm.department) && (
                        <option value={postForm.department}>{postForm.department} (not in current list)</option>
                      )}
                    </select>
                  </div>
                </div>
                <div className="col-6">
                  <div className="form-group">
                    <label>Unit</label>
                    {(() => {
                      const units = postForm.department ? listUnits(postForm.department) : [];
                      const noDept = !postForm.department;
                      return (
                        <select
                          className="form-control"
                          value={postForm.unit || ''}
                          onChange={(e) => setPF('unit', e.target.value)}
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
                          {postForm.unit && !units.includes(postForm.unit) && (
                            <option value={postForm.unit}>{postForm.unit} (not in current list)</option>
                          )}
                        </select>
                      );
                    })()}
                  </div>
                </div>
              </div>

              <div className="row gap-2">
                <div className="col-6">
                  <div className="form-group">
                    <label>Designation</label>
                    <select
                      className="form-control"
                      value={postForm.designation}
                      onChange={(e) => setPF('designation', e.target.value)}
                    >
                      <option value="">—</option>
                      {designations.map((d) => <option key={d} value={d}>{d}</option>)}
                      {postForm.designation && !designations.includes(postForm.designation) && (
                        <option value={postForm.designation}>{postForm.designation} (not in current list)</option>
                      )}
                    </select>
                  </div>
                </div>
                <div className="col-6">
                  <div className="form-group">
                    <label>Duty Station / Posting Location</label>
                    <input
                      className="form-control"
                      value={postForm.postingLocation}
                      onChange={(e) => setPF('postingLocation', e.target.value)}
                      placeholder="e.g. CCA Headquarters, Abuja"
                    />
                  </div>
                </div>
              </div>

              <div className="row gap-2">
                <div className="col-6">
                  <div className="form-group">
                    <label>Effective Date *</label>
                    <input
                      type="date"
                      className="form-control"
                      value={postForm.effectiveDate}
                      onChange={(e) => setPF('effectiveDate', e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="col-6">
                  <div className="form-group">
                    <label>Remarks</label>
                    <input
                      className="form-control"
                      value={postForm.remarks}
                      onChange={(e) => setPF('remarks', e.target.value)}
                      placeholder="e.g. Redeployment per memo CCA/HR/2026/03"
                    />
                  </div>
                </div>
              </div>

              <div className="muted small mb-2">
                Current posting: <strong>{staff.department || '—'}</strong>
                {staff.unit ? ` · ${staff.unit}` : ''} · {staff.designation || '—'} · {staff.postingLocation || '—'}
              </div>

              <div className="d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-outline" onClick={() => setPostOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  <ArrowRightLeft size={16} /> Save Posting
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {convOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            zIndex: 1000, padding: '4rem 1rem 1rem',
          }}
          onClick={() => setConvOpen(false)}
        >
          <div
            className="card"
            style={{ width: '100%', maxWidth: 640, maxHeight: 'calc(100vh - 6rem)', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: '#fff' }}>Conversion / Promotion — {staff.fullName}</h3>
              <button className="btn btn-sm btn-ghost" onClick={() => setConvOpen(false)} aria-label="Close" style={{ color: '#fff' }}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleConversion} className="card-body">
              <div className="form-group">
                <label>Action Type *</label>
                <div className="d-flex gap-2">
                  {['Promotion', 'Conversion'].map((t) => (
                    <label
                      key={t}
                      className="d-flex align-items-center gap-1"
                      style={{
                        padding: '0.5rem 0.9rem',
                        border: `1px solid ${convForm.actionType === t ? '#1a3a52' : '#d6dde4'}`,
                        background: convForm.actionType === t ? '#1a3a521f' : '#fff',
                        borderRadius: 6,
                        cursor: 'pointer',
                        flex: 1,
                        justifyContent: 'center',
                      }}
                    >
                      <input
                        type="radio"
                        name="actionType"
                        value={t}
                        checked={convForm.actionType === t}
                        onChange={() => setCF('actionType', t)}
                      />
                      <strong>{t}</strong>
                    </label>
                  ))}
                </div>
                <div className="muted small mt-1">
                  {convForm.actionType === 'Promotion'
                    ? 'Promotions update the Last Promotion date, which shifts the next promotion review forward.'
                    : 'Conversions move the staff member to a new cadre or designation without resetting the promotion cycle.'}
                </div>
              </div>

              <div className="row gap-2">
                <div className="col-6">
                  <div className="form-group">
                    <label>New Designation</label>
                    <select
                      className="form-control"
                      value={convForm.designation}
                      onChange={(e) => setCF('designation', e.target.value)}
                    >
                      <option value="">—</option>
                      {designations.map((d) => <option key={d} value={d}>{d}</option>)}
                      {convForm.designation && !designations.includes(convForm.designation) && (
                        <option value={convForm.designation}>{convForm.designation} (not in current list)</option>
                      )}
                    </select>
                  </div>
                </div>
                <div className="col-6">
                  <div className="form-group">
                    <label>New Cadre</label>
                    <input
                      className="form-control"
                      value={convForm.cadre}
                      onChange={(e) => setCF('cadre', e.target.value)}
                      placeholder="e.g. Legal, Court Operations"
                    />
                  </div>
                </div>
              </div>

              <div className="row gap-2">
                <div className="col-4">
                  <div className="form-group">
                    <label>New Grade Level</label>
                    <select
                      className="form-control"
                      value={convForm.gradeLevel}
                      onChange={(e) => setCF('gradeLevel', e.target.value)}
                    >
                      <option value="">—</option>
                      {GRADE_LEVELS.map((g) => <option key={g} value={g}>GL {g}</option>)}
                    </select>
                  </div>
                </div>
                <div className="col-4">
                  <div className="form-group">
                    <label>New Step</label>
                    <select
                      className="form-control"
                      value={convForm.step}
                      onChange={(e) => setCF('step', e.target.value)}
                    >
                      <option value="">—</option>
                      {STEPS.map((s) => <option key={s} value={s}>Step {s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="col-4">
                  <div className="form-group">
                    <label>Effective Date *</label>
                    <input
                      type="date"
                      className="form-control"
                      value={convForm.effectiveDate}
                      onChange={(e) => setCF('effectiveDate', e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>Remarks</label>
                <input
                  className="form-control"
                  value={convForm.remarks}
                  onChange={(e) => setCF('remarks', e.target.value)}
                  placeholder={convForm.actionType === 'Promotion'
                    ? 'e.g. Promoted per CCA/HR memo …'
                    : 'e.g. Converted to Legal cadre per Establishment Circular …'}
                />
              </div>

              <div className="muted small mb-2">
                Current posting: <strong>{staff.designation || '—'}</strong> · {staff.cadre || '—'} cadre · GL {staff.gradeLevel || '—'}/{staff.step || '—'}
              </div>

              <div className="d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-outline" onClick={() => setConvOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  <TrendingUp size={16} /> Save {convForm.actionType}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffDetail;
