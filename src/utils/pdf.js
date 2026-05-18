import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate } from '../data/staff';

// Brand palette mirrored from src/styles/index.css
const NAVY = [26, 58, 82];
const NAVY_DARK = [15, 37, 56];
const GOLD = [212, 165, 116];
const MUTED = [107, 114, 128];
const BORDER = [226, 231, 238];
const TEXT = [31, 41, 55];

const drawHeader = (doc, title, subtitle) => {
  // Navy band
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 26, 'F');
  // Gold accent stripe
  doc.setFillColor(...GOLD);
  doc.rect(0, 26, doc.internal.pageSize.getWidth(), 1.2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('CUSTOMARY COURT OF APPEAL · FCT', 14, 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Staff Biodata Management System', 14, 16.5);

  doc.setFontSize(8);
  doc.text(`Generated ${new Date().toLocaleString('en-NG')}`, doc.internal.pageSize.getWidth() - 14, 11, { align: 'right' });

  // Title
  doc.setTextColor(...NAVY_DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(title, 14, 38);
  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
    doc.text(subtitle, 14, 44);
  }
};

const drawFooter = (doc) => {
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    doc.setDrawColor(...BORDER);
    doc.line(14, pageH - 14, pageW - 14, pageH - 14);
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text('Confidential · For official use only', 14, pageH - 9);
    doc.text(`Page ${i} of ${pageCount}`, pageW - 14, pageH - 9, { align: 'right' });
  }
};

const section = (doc, title, startY) => {
  doc.setFillColor(245, 247, 250);
  doc.rect(14, startY, doc.internal.pageSize.getWidth() - 28, 7, 'F');
  doc.setTextColor(...NAVY_DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(title.toUpperCase(), 17, startY + 5);
  return startY + 9;
};

const twoCol = (doc, rows, startY) => {
  autoTable(doc, {
    startY,
    body: rows,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: { top: 1.2, bottom: 1.2, left: 0, right: 4 }, textColor: TEXT },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: MUTED, cellWidth: 50 },
      1: { textColor: TEXT, cellWidth: 50 },
      2: { fontStyle: 'bold', textColor: MUTED, cellWidth: 50 },
      3: { textColor: TEXT, cellWidth: 'auto' },
    },
    margin: { left: 17, right: 14 },
  });
  return doc.lastAutoTable.finalY + 3;
};

const pairRows = (pairs) => {
  // Convert flat label/value pairs into [label, value, label, value] rows.
  const rows = [];
  for (let i = 0; i < pairs.length; i += 2) {
    const a = pairs[i];
    const b = pairs[i + 1] || [' ', ' '];
    rows.push([a[0], a[1] ?? '—', b[0], b[1] ?? '—']);
  }
  return rows;
};

export const generateStaffPdf = (staff) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const fullName = [staff.title, staff.firstName, staff.middleName, staff.lastName].filter(Boolean).join(' ');

  drawHeader(doc, 'Staff Biodata Record', fullName);

  // Profile strip — avatar + headline summary
  let y = 50;
  if (staff.photoDataUrl) {
    try {
      const fmt = /^data:image\/(png|jpeg|jpg)/i.exec(staff.photoDataUrl)?.[1]?.toUpperCase() || 'JPEG';
      doc.addImage(staff.photoDataUrl, fmt === 'JPG' ? 'JPEG' : fmt, 14, y, 16, 20);
      doc.setDrawColor(...BORDER);
      doc.rect(14, y, 16, 20);
    } catch (_) {
      doc.setFillColor(...NAVY);
      doc.circle(22, y + 8, 8, 'F');
    }
  } else {
    doc.setFillColor(...NAVY);
    doc.circle(22, y + 8, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(staff.initials || '?', 22, y + 9, { align: 'center' });
  }

  doc.setTextColor(...NAVY_DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(fullName, 35, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(`${staff.designation || ''} · ${staff.department || ''}`, 35, y + 10);
  doc.setFontSize(9);
  doc.text(`Staff ID: ${staff.staffId || '—'}  ·  GL ${staff.gradeLevel || '—'}/Step ${staff.step || '—'}  ·  Status: ${staff.status || '—'}`, 35, y + 15);

  y = y + 22;

  // ── PERSONAL ────────────────────────────────────────────────────────────
  y = section(doc, 'Personal Information', y);
  y = twoCol(doc, pairRows([
    ['Full Name', fullName],
    ['Date of Birth', formatDate(staff.dateOfBirth)],
    ['Gender', staff.gender],
    ['Place of Birth', staff.placeOfBirth],
    ['Marital Status', staff.maritalStatus],
    ['Spouse Name', staff.spouseName],
    ['No. of Children', staff.numberOfChildren ?? 0],
    ['Religion', staff.religion],
    ['Blood Group', staff.bloodGroup],
    ['Genotype', staff.genotype],
    ['Disability', staff.disability],
    ['Languages', staff.languages],
  ]), y);

  // ── ORIGIN ──────────────────────────────────────────────────────────────
  y = section(doc, 'Origin & Identity', y);
  y = twoCol(doc, pairRows([
    ['Nationality', staff.nationality],
    ['State of Origin', staff.stateOfOrigin],
    ['L.G.A.', staff.lga],
    ['Senatorial District', staff.senatorialDistrict],
    ['Geopolitical Zone', staff.geopoliticalZone],
    ['Tribe', staff.tribe],
    ['NIN', staff.nin],
    ['TIN', staff.tin],
  ]), y);

  // ── CONTACT ─────────────────────────────────────────────────────────────
  y = section(doc, 'Contact', y);
  y = twoCol(doc, pairRows([
    ['Email', staff.email],
    ['Phone (primary)', staff.phonePrimary],
    ['Phone (alternative)', staff.phoneAlt],
    ['Duty Station', staff.postingLocation],
    ['Residential Address', staff.residentialAddress],
    ['Permanent Home Address', staff.permanentAddress],
  ]), y);

  // Force a page break if needed
  if (y > 240) { doc.addPage(); y = 30; }

  // ── EMPLOYMENT ──────────────────────────────────────────────────────────
  y = section(doc, 'Employment & Service', y);
  y = twoCol(doc, pairRows([
    ['File Number', staff.fileNumber],
    ['NHIS Number', staff.nhisNumber],
    ['National Housing Number', staff.nhfNumber],
    ['Year of Call to Bar', staff.yearOfCallToBar || '—'],
    ['Cadre', staff.cadre],
    ['Department', staff.department],
    ['Designation', staff.designation],
    ['Grade Level / Step', `GL ${staff.gradeLevel || '—'} / Step ${staff.step || '—'}`],
    ['Employment Type', staff.employmentType],
    ['Annual Salary (₦)', typeof staff.salaryAnnualNGN === 'number' ? `₦${staff.salaryAnnualNGN.toLocaleString('en-NG')}` : '—'],
    ['First Appointment', formatDate(staff.firstAppointmentDate)],
    ['Confirmation Date', formatDate(staff.confirmationDate)],
    ['Present Appointment', formatDate(staff.presentAppointmentDate)],
    ['Last Promotion', formatDate(staff.lastPromotionDate)],
    ['Years of Service', `${staff.yearsOfService || 0} year(s)`],
    ['Age', `${staff.age || 0} years`],
    ['Next Promotion (computed)', formatDate(staff.nextPromotionDate)],
    ['Retirement Date (computed)', formatDate(staff.retirementDate)],
  ]), y);

  // ── QUALIFICATIONS ──────────────────────────────────────────────────────
  if (Array.isArray(staff.qualifications) && staff.qualifications.length) {
    if (y > 235) { doc.addPage(); y = 30; }
    y = section(doc, 'Educational & Professional Qualifications', y);
    autoTable(doc, {
      startY: y,
      head: [['Institution / Body', 'Qualification', 'Year', 'Grade']],
      body: staff.qualifications.map((q) => [q.school || '—', q.qualification || '—', q.year || '—', q.grade || '—']),
      theme: 'striped',
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: TEXT },
      alternateRowStyles: { fillColor: [249, 250, 252] },
      margin: { left: 17, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 4;
  }

  // ── FINANCIAL ───────────────────────────────────────────────────────────
  if (y > 240) { doc.addPage(); y = 30; }
  y = section(doc, 'Financial & Pension', y);
  y = twoCol(doc, pairRows([
    ['Bank Name', staff.bankName],
    ['Account Number', staff.accountNumber],
    ['Pension Fund Administrator', staff.pfa],
    ['RSA PIN', staff.rsaPin],
  ]), y);

  // ── NEXT OF KIN ─────────────────────────────────────────────────────────
  if (y > 240) { doc.addPage(); y = 30; }
  y = section(doc, 'Next of Kin', y);
  y = twoCol(doc, pairRows([
    ['Name', staff.nextOfKin?.name],
    ['Relationship', staff.nextOfKin?.relationship],
    ['Phone', staff.nextOfKin?.phone],
    ['Email', staff.nextOfKin?.email],
    ['Address', staff.nextOfKin?.address],
  ]), y);

  // ── SERVICE HISTORY ─────────────────────────────────────────────────────
  if (Array.isArray(staff.serviceHistory) && staff.serviceHistory.length) {
    if (y > 235) { doc.addPage(); y = 30; }
    y = section(doc, 'Service History', y);
    autoTable(doc, {
      startY: y,
      head: [['Date', 'Event', 'Details']],
      body: staff.serviceHistory.map((e) => [formatDate(e.date), e.event || '—', e.detail || '—']),
      theme: 'striped',
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: TEXT },
      alternateRowStyles: { fillColor: [249, 250, 252] },
      margin: { left: 17, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 4;
  }

  // ── SIGNATURE ───────────────────────────────────────────────────────────
  // Reserve space for the signature line; if it's a real image, draw it
  // above the line. Otherwise we still leave a printable space.
  const sigBlockH = 32;
  if (y + sigBlockH > 270) { doc.addPage(); y = 30; }
  y = section(doc, 'Signature', y);
  if (staff.signatureDataUrl) {
    try {
      const fmt = /^data:image\/(png|jpeg|jpg)/i.exec(staff.signatureDataUrl)?.[1]?.toUpperCase() || 'PNG';
      doc.addImage(staff.signatureDataUrl, fmt === 'JPG' ? 'JPEG' : fmt, 17, y, 60, 18);
    } catch (_) { /* fall through to blank line */ }
  }
  doc.setDrawColor(...BORDER);
  doc.line(17, y + 20, 77, y + 20);
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text('Staff signature', 17, y + 24);

  drawFooter(doc);

  const filename = `${(staff.staffId || 'staff').replace(/[^a-z0-9]/gi, '-')}-${(staff.lastName || 'biodata').toLowerCase()}.pdf`;
  doc.save(filename);
};
