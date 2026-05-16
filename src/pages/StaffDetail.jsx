import { useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Mail, Phone, MapPin, Briefcase, Calendar, Award, User,
  Edit, Printer, Download, Heart, Hash, IdCard, Globe, GraduationCap,
  Building2, Banknote, Users, FileText, Clock, AlertTriangle,
} from 'lucide-react';
import { formatDate } from '../data/staff';
import { downloadCsv, printElement } from '../utils/download';
import { generateStaffPdf } from '../utils/pdf';
import { useToast } from '../context/ToastContext';
import { useStaff } from '../hooks/useStaff';
import { FileDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

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
        StaffID: staff.staffId, FileNo: staff.fileNumber, IPPIS: staff.ippisNumber,
        Name: staff.fullName, Gender: staff.gender, DOB: staff.dateOfBirth,
        Age: staff.age, NIN: staff.nin, Department: staff.department, Unit: staff.unit || '',
        Designation: staff.designation, GradeLevel: `GL ${staff.gradeLevel}/${staff.step}`,
        Status: staff.status, FirstAppointment: staff.firstAppointmentDate,
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
          {can('export_staff') && (
            <>
              <button className="btn btn-outline" onClick={handleExport}>
                <Download size={18} /> CSV
              </button>
              <button className="btn btn-outline" onClick={() => { generateStaffPdf(staff); toast.success('Profile exported as PDF.'); }}>
                <FileDown size={18} /> Export PDF
              </button>
            </>
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
          <div className="profile-avatar">{staff.initials}</div>
          <div className="profile-meta">
            <h2 className="profile-name">{staff.fullName}</h2>
            <div className="profile-position">{staff.designation} · {staff.department} Department</div>
            <div className="profile-chips">
              <span className={`badge badge-${staff.status === 'Active' ? 'success' : staff.status === 'On Leave' ? 'info' : 'warning'}`}>{staff.status}</span>
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
              <Row icon={Hash}   label="Staff ID"        value={staff.staffId} />
              <Row icon={Hash}   label="File Number"     value={staff.fileNumber} />
              <Row icon={Hash}   label="IPPIS Number"    value={staff.ippisNumber} />
              <Row icon={IdCard} label="NIN"             value={staff.nin} />
              <Row icon={Hash}   label="TIN"             value={staff.tin} />
              <Row icon={Hash}   label="RSA PIN"         value={staff.rsaPin} />
            </Section>
          </div>
        </div>
      )}

      {/* EMPLOYMENT */}
      {tab === 'employment' && (
        <div className="row gap-3">
          <div className="col-6">
            <Section title="Posting & Cadre" icon={Briefcase}>
              <Row icon={Building2} label="Department"         value={staff.department} />
              <Row icon={Building2} label="Unit"               value={staff.unit || '—'} />
              <Row icon={Briefcase} label="Designation"        value={staff.designation} />
              <Row                  label="Cadre"              value={staff.cadre} />
              <Row icon={MapPin}    label="Duty Station"       value={staff.postingLocation} />
              <Row                  label="Employment Type"    value={staff.employmentType} />
              <Row                  label="Salary Grade"       value={`GL ${staff.gradeLevel} / Step ${staff.step}`} />
              <Row icon={Banknote}  label="Annual Salary (₦)"  value={formatNaira(staff.salaryAnnualNGN)} />
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
              <Row label="Annual Salary"  value={formatNaira(staff.salaryAnnualNGN)} />
            </Section>
          </div>
          <div className="col-6">
            <Section title="Pension (PFA)" icon={FileText}>
              <Row label="Pension Fund Administrator" value={staff.pfa} />
              <Row label="RSA PIN"                    value={staff.rsaPin} />
              <Row label="IPPIS Number"               value={staff.ippisNumber} />
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
          <div className="col-6">
            <Section title="Next of Kin" icon={Users}>
              <Row icon={User}   label="Name"         value={staff.nextOfKin?.name} />
              <Row               label="Relationship" value={staff.nextOfKin?.relationship} />
              <Row icon={Phone}  label="Phone"        value={staff.nextOfKin?.phone} />
              <Row icon={Mail}   label="Email"        value={staff.nextOfKin?.email} />
              <Row icon={MapPin} label="Address"      value={staff.nextOfKin?.address} />
            </Section>
          </div>
        </div>
      )}

      <div className="mt-3 muted small">
        Looking for the full list? <Link to="/staff">Return to staff directory</Link>.
      </div>
    </div>
  );
};

export default StaffDetail;
