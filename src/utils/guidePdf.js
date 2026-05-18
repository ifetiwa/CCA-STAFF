import { jsPDF } from 'jspdf';
import { GUIDE_META, GUIDE_SECTIONS } from '../data/guideContent';

const NAVY = [26, 58, 82];
const NAVY_DARK = [15, 37, 56];
const GOLD = [212, 165, 116];
const MUTED = [107, 114, 128];
const BORDER = [226, 231, 238];
const BG_SOFT = [245, 247, 250];
const BG_CARD = [249, 250, 252];
const TEXT = [31, 41, 55];

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 16;
const CONTENT_W = PAGE_W - MARGIN * 2;

const drawCoverHeader = (doc) => {
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PAGE_W, 80, 'F');
  doc.setFillColor(...GOLD);
  doc.rect(0, 80, PAGE_W, 1.4, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('CUSTOMARY COURT OF APPEAL · FCT', MARGIN, 22);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.text(GUIDE_META.title, MARGIN, 50);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.text(GUIDE_META.subtitle, MARGIN, 60);

  doc.setFontSize(9);
  doc.text(`Version ${GUIDE_META.version} · Released ${GUIDE_META.releaseDate}`, MARGIN, 70);
};

const drawPageHeader = (doc, title) => {
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PAGE_W, 14, 'F');
  doc.setFillColor(...GOLD);
  doc.rect(0, 14, PAGE_W, 0.8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('CCA Staff Biodata · System Guide', MARGIN, 9);
  doc.setFont('helvetica', 'normal');
  doc.text(title, PAGE_W - MARGIN, 9, { align: 'right' });
};

const drawFooter = (doc) => {
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    if (i === 1) continue;
    doc.setDrawColor(...BORDER);
    doc.line(MARGIN, PAGE_H - 12, PAGE_W - MARGIN, PAGE_H - 12);
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text('Confidential · For official use only', MARGIN, PAGE_H - 7);
    doc.text(`Page ${i} of ${pageCount}`, PAGE_W - MARGIN, PAGE_H - 7, { align: 'right' });
  }
};

// Ensure there is at least `needed` mm of vertical space; otherwise paginate.
const ensureSpace = (doc, y, needed, title) => {
  if (y + needed > PAGE_H - 18) {
    doc.addPage();
    drawPageHeader(doc, title);
    return 24;
  }
  return y;
};

const wrap = (doc, text, width) =>
  doc.splitTextToSize(String(text || ''), width);

// ── MOCKUP DRAWERS ─────────────────────────────────────────────────────────
// Every drawer takes (doc, x, y, w, h) and paints inside the given rect.
// Width and height are chosen by drawMockup() — drawers should not paginate.

const mockupFrame = (doc, x, y, w, h, label) => {
  doc.setFillColor(...BG_SOFT);
  doc.setDrawColor(...BORDER);
  doc.roundedRect(x, y, w, h, 1.5, 1.5, 'FD');
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.setFont('helvetica', 'italic');
  doc.text(label, x + 2, y - 1);
};

const tinyText = (doc, text, x, y, size = 7, color = TEXT, bold = false) => {
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setFontSize(size);
  doc.setTextColor(...color);
  doc.text(text, x, y);
};

const fillRect = (doc, color, x, y, w, h, r = 0) => {
  doc.setFillColor(...color);
  if (r) doc.roundedRect(x, y, w, h, r, r, 'F');
  else doc.rect(x, y, w, h, 'F');
};

const strokeRect = (doc, x, y, w, h, r = 0) => {
  doc.setDrawColor(...BORDER);
  doc.setFillColor(255, 255, 255);
  if (r) doc.roundedRect(x, y, w, h, r, r, 'FD');
  else doc.rect(x, y, w, h, 'FD');
};

const drawShellMockup = (doc, x, y, w, h) => {
  // sidebar
  fillRect(doc, NAVY, x, y, 26, h);
  fillRect(doc, GOLD, x + 26, y, 0.6, h);
  tinyText(doc, 'CCA', x + 3, y + 6, 7, [255, 255, 255], true);
  const items = ['Dashboard', 'All Staff', 'Add Staff', 'Reports', 'Tasks', 'Audit', 'Users', 'Guide', 'Settings'];
  items.forEach((it, i) => tinyText(doc, '• ' + it, x + 3, y + 14 + i * 5, 6, [255, 255, 255]));
  // header
  fillRect(doc, [255, 255, 255], x + 26.6, y, w - 26.6, 9);
  doc.setDrawColor(...BORDER);
  doc.line(x + 26.6, y + 9, x + w, y + 9);
  tinyText(doc, 'Dashboard', x + 30, y + 6, 8, NAVY_DARK, true);
  // search
  strokeRect(doc, x + w - 50, y + 2.5, 30, 4, 1);
  tinyText(doc, 'Search…', x + w - 48, y + 5.4, 6, MUTED);
  // avatar
  fillRect(doc, NAVY, x + w - 6, y + 2.5, 4, 4, 2);
  // body
  fillRect(doc, [255, 255, 255], x + 26.6, y + 9, w - 26.6, h - 9);
  // stat cards
  for (let i = 0; i < 4; i++) {
    const cx = x + 30 + i * ((w - 34) / 4);
    strokeRect(doc, cx, y + 13, (w - 38) / 4, 12, 1);
    tinyText(doc, ['Total Staff', 'Updated', 'Promotion', 'Retirement'][i], cx + 1.5, y + 17, 6, MUTED);
    tinyText(doc, ['148', '81', '12', '7'][i], cx + 1.5, y + 22, 9, NAVY_DARK, true);
  }
  // chart placeholder
  strokeRect(doc, x + 30, y + 28, w - 38, h - 33, 1);
  tinyText(doc, 'Recent Staff & Upcoming Events', x + 32, y + 32, 6, MUTED, true);
  for (let r = 0; r < 4; r++) {
    doc.setDrawColor(...BORDER);
    doc.line(x + 32, y + 36 + r * 5, x + w - 8, y + 36 + r * 5);
  }
};

const drawLoginMockup = (doc, x, y, w, h) => {
  // navy left panel
  fillRect(doc, NAVY, x, y, w * 0.55, h);
  fillRect(doc, GOLD, x + w * 0.55, y, 0.6, h);
  tinyText(doc, 'CUSTOMARY COURT OF APPEAL', x + 4, y + 8, 7, [255, 255, 255], true);
  tinyText(doc, 'Federal Capital Territory, Abuja', x + 4, y + 12, 6, [220, 220, 220]);
  tinyText(doc, 'Staff Biodata Management', x + 4, y + 22, 9, [255, 255, 255], true);
  tinyText(doc, 'A secure digital register for personnel records,', x + 4, y + 27, 6, [220, 220, 220]);
  tinyText(doc, 'postings, and service history.', x + 4, y + 30, 6, [220, 220, 220]);
  // form panel
  const fx = x + w * 0.55 + 2;
  fillRect(doc, [255, 255, 255], fx, y, w - (w * 0.55 + 2), h);
  tinyText(doc, 'Welcome back', fx + 4, y + 10, 9, NAVY_DARK, true);
  tinyText(doc, 'Email address', fx + 4, y + 18, 6, TEXT, true);
  strokeRect(doc, fx + 4, y + 20, w * 0.4, 5, 1);
  tinyText(doc, 'Password', fx + 4, y + 30, 6, TEXT, true);
  strokeRect(doc, fx + 4, y + 32, w * 0.4, 5, 1);
  fillRect(doc, NAVY, fx + 4, y + 42, w * 0.4, 6, 1);
  tinyText(doc, 'Sign in', fx + 4 + (w * 0.4) / 2 - 5, y + 46, 7, [255, 255, 255], true);
};

const drawDashboardMockup = (doc, x, y, w, h) => drawShellMockup(doc, x, y, w, h);

const drawListMockup = (doc, x, y, w, h, opts = {}) => {
  const cols = opts.cols || ['Name', 'Department', 'Designation', 'GL', 'Status', ''];
  strokeRect(doc, x, y, w, h, 1);
  // toolbar
  strokeRect(doc, x + 2, y + 2, w * 0.4, 5, 1);
  tinyText(doc, 'Search…', x + 4, y + 5.4, 6, MUTED);
  for (let i = 0; i < 3; i++) {
    strokeRect(doc, x + w * 0.42 + i * (w * 0.15), y + 2, w * 0.14, 5, 1);
    tinyText(doc, ['Dept', 'Unit', 'Status'][i], x + w * 0.42 + i * (w * 0.15) + 1.5, y + 5.4, 6, MUTED);
  }
  fillRect(doc, NAVY, x + w - 18, y + 2, 16, 5, 1);
  tinyText(doc, 'Export', x + w - 15, y + 5.4, 6, [255, 255, 255], true);
  // table header
  fillRect(doc, BG_CARD, x + 2, y + 9, w - 4, 5);
  const colW = (w - 4) / cols.length;
  cols.forEach((c, i) => tinyText(doc, c, x + 3 + i * colW, y + 12.4, 6, NAVY_DARK, true));
  // rows
  const rowCount = Math.floor((h - 16) / 5);
  for (let r = 0; r < rowCount; r++) {
    doc.setDrawColor(...BORDER);
    doc.line(x + 2, y + 14 + (r + 1) * 5, x + w - 2, y + 14 + (r + 1) * 5);
    cols.forEach((_, i) => {
      tinyText(doc, ['Aminu Bello', 'Registry', 'Senior Reg.', 'GL 12', 'Active', '•'][i % 6], x + 3 + i * colW, y + 18 + r * 5, 6, TEXT);
    });
  }
};

const drawFormMockup = (doc, x, y, w, h) => {
  strokeRect(doc, x, y, w, h, 1);
  tinyText(doc, 'Add New Staff', x + 3, y + 5, 8, NAVY_DARK, true);
  doc.setDrawColor(...BORDER);
  doc.line(x + 2, y + 7, x + w - 2, y + 7);
  // section tabs
  ['Personal', 'Origin', 'Contact', 'Employment', 'Qualifications', 'Financial', 'Kin'].forEach((s, i) => {
    const tx = x + 3 + i * ((w - 6) / 7);
    tinyText(doc, s, tx, y + 11, 6, i === 0 ? NAVY_DARK : MUTED, i === 0);
  });
  fillRect(doc, NAVY, x + 3, y + 13, ((w - 6) / 7) - 1, 0.6);
  // form grid
  const startY = y + 17;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 2; c++) {
      const fx = x + 3 + c * ((w - 6) / 2);
      tinyText(doc, ['First Name', 'Last Name', 'Date of Birth', 'Gender', 'Email', 'Phone', 'State', 'LGA', 'Designation', 'Grade'][r * 2 + c], fx, startY + r * 8, 5, MUTED);
      strokeRect(doc, fx, startY + r * 8 + 1, ((w - 6) / 2) - 2, 4, 0.6);
    }
  }
  // save button
  fillRect(doc, NAVY, x + w - 22, y + h - 7, 18, 5, 1);
  tinyText(doc, 'Save Record', x + w - 20, y + h - 3.4, 6, [255, 255, 255], true);
};

const drawImportMockup = (doc, x, y, w, h) => {
  strokeRect(doc, x, y, w, h, 1);
  tinyText(doc, 'Bulk Import', x + 3, y + 5, 8, NAVY_DARK, true);
  // drop zone
  doc.setDrawColor(...BORDER);
  doc.setLineDashPattern([1, 1], 0);
  doc.roundedRect(x + 4, y + 9, w - 8, 16, 1, 1, 'S');
  doc.setLineDashPattern([], 0);
  tinyText(doc, 'Drop CSV / .xlsx here, or click to choose', x + w / 2 - 24, y + 18, 6, MUTED, true);
  // template + preview
  strokeRect(doc, x + 4, y + 28, 30, 5, 1);
  tinyText(doc, '↓ Download Template', x + 5, y + 31.4, 6, NAVY_DARK, true);
  tinyText(doc, 'Preview', x + 4, y + 38, 7, NAVY_DARK, true);
  drawListMockup(doc, x + 4, y + 40, w - 8, h - 44, { cols: ['Row', 'Name', 'Email', 'Status'] });
};

const drawProfileMockup = (doc, x, y, w, h) => {
  strokeRect(doc, x, y, w, h, 1);
  fillRect(doc, NAVY, x + 4, y + 4, 12, 12, 6);
  tinyText(doc, 'AB', x + 7.5, y + 11.5, 8, [255, 255, 255], true);
  tinyText(doc, 'Aminu Bello', x + 19, y + 9, 9, NAVY_DARK, true);
  tinyText(doc, 'Senior Registrar · Administration · GL 12', x + 19, y + 13, 6, MUTED);
  // tabs
  ['Overview', 'Personal', 'Employment', 'Qualifications', 'Service', 'Docs'].forEach((s, i) => {
    const tx = x + 4 + i * ((w - 8) / 6);
    tinyText(doc, s, tx, y + 22, 6, i === 0 ? NAVY_DARK : MUTED, i === 0);
  });
  doc.setDrawColor(...BORDER);
  doc.line(x + 4, y + 24, x + w - 4, y + 24);
  // cards
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      const cx = x + 4 + c * ((w - 8) / 2);
      const cy = y + 28 + r * ((h - 32) / 2);
      strokeRect(doc, cx, cy, ((w - 8) / 2) - 2, ((h - 32) / 2) - 2, 1);
      tinyText(doc, ['Personal', 'Origin', 'Contact', 'Employment'][r * 2 + c], cx + 2, cy + 4, 6, NAVY_DARK, true);
      for (let k = 0; k < 3; k++) {
        tinyText(doc, '— field …', cx + 2, cy + 8 + k * 3, 5, TEXT);
      }
    }
  }
  // PDF button
  fillRect(doc, GOLD, x + w - 26, y + 6, 22, 5, 1);
  tinyText(doc, 'Download PDF', x + w - 24, y + 9.4, 6, NAVY_DARK, true);
};

const drawRecordsMockup = (doc, x, y, w, h) =>
  drawListMockup(doc, x, y, w, h, { cols: ['Staff', 'Doc Type', 'Filename', 'Uploaded', 'By', ''] });

const drawReportsMockup = (doc, x, y, w, h) => {
  strokeRect(doc, x, y, w, h, 1);
  // left list
  fillRect(doc, BG_CARD, x + 1, y + 1, w * 0.25, h - 2);
  ['Dept', 'Grade', 'Gender', 'Promotions', 'Retirement', 'Age', 'States'].forEach((s, i) =>
    tinyText(doc, '• ' + s, x + 3, y + 5 + i * 5, 6, i === 0 ? NAVY_DARK : MUTED, i === 0)
  );
  // chart
  const cx = x + w * 0.27;
  const cy = y + 3;
  const cw = w - w * 0.27 - 3;
  const ch = h - 6;
  strokeRect(doc, cx, cy, cw, ch, 1);
  tinyText(doc, 'Department Distribution', cx + 2, cy + 4, 7, NAVY_DARK, true);
  // bars
  for (let i = 0; i < 6; i++) {
    const bh = 4 + Math.random() * (ch - 10);
    const bw = (cw - 6) / 6 - 2;
    const bx = cx + 3 + i * (bw + 2);
    const by = cy + ch - 2 - bh;
    fillRect(doc, i % 2 ? NAVY : GOLD, bx, by, bw, bh);
  }
};

const drawTasksMockup = (doc, x, y, w, h) => {
  strokeRect(doc, x, y, w, h, 1);
  tinyText(doc, 'My Tasks', x + 3, y + 5, 8, NAVY_DARK, true);
  fillRect(doc, NAVY, x + w - 22, y + 2, 20, 5, 1);
  tinyText(doc, '+ New Task', x + w - 20, y + 5.4, 6, [255, 255, 255], true);
  for (let i = 0; i < 5; i++) {
    const ty = y + 10 + i * ((h - 12) / 5);
    strokeRect(doc, x + 3, ty, w - 6, ((h - 12) / 5) - 1, 1);
    fillRect(doc, [GOLD, NAVY, MUTED, GOLD, NAVY][i % 5], x + 4, ty + 1, 1.2, ((h - 12) / 5) - 3);
    tinyText(doc, ['Review promotion file — A. Bello', 'Confirm new hire records', 'Audit Q2 transfers', 'Update retirement projections', 'Prepare HR memo'][i], x + 8, ty + 4, 6, NAVY_DARK, true);
    tinyText(doc, ['High · Due 25 May', 'Med · Due 30 May', 'High · Due 03 Jun', 'Low · Due 10 Jun', 'Med · Due 15 Jun'][i], x + 8, ty + 8, 5, MUTED);
  }
};

const drawAuditMockup = (doc, x, y, w, h) =>
  drawListMockup(doc, x, y, w, h, { cols: ['When', 'User', 'Action', 'Subject', 'Detail', ''] });

const drawUsersMockup = (doc, x, y, w, h) =>
  drawListMockup(doc, x, y, w, h, { cols: ['Name', 'Email', 'Role', 'Dept', 'Status', 'Actions'] });

const drawSettingsMockup = (doc, x, y, w, h) => {
  strokeRect(doc, x, y, w, h, 1);
  ['Profile', 'Security', 'System', 'Notifications'].forEach((s, i) => {
    const tx = x + 3 + i * ((w - 6) / 4);
    tinyText(doc, s, tx, y + 5, 7, i === 0 ? NAVY_DARK : MUTED, i === 0);
  });
  doc.setDrawColor(...BORDER);
  doc.line(x + 3, y + 7, x + w - 3, y + 7);
  for (let r = 0; r < 4; r++) {
    tinyText(doc, ['Full name', 'Email', 'Phone', 'Department'][r], x + 4, y + 12 + r * 7, 6, MUTED);
    strokeRect(doc, x + 4, y + 13 + r * 7, w - 8, 4, 0.6);
  }
  fillRect(doc, NAVY, x + w - 22, y + h - 7, 18, 5, 1);
  tinyText(doc, 'Save Changes', x + w - 20, y + h - 3.4, 6, [255, 255, 255], true);
};

const drawSecurityMockup = (doc, x, y, w, h) => {
  strokeRect(doc, x, y, w, h, 1);
  tinyText(doc, 'Security Best Practice', x + 3, y + 5, 8, NAVY_DARK, true);
  const tips = [
    '🛡  Never share your password',
    '⏱  Sign out before stepping away',
    '👁  Watch for shoulder-surfing',
    '🚩  Report unknown audit entries',
    '🔐  Auto-logout after 30 minutes',
  ];
  tips.forEach((t, i) => {
    strokeRect(doc, x + 3, y + 10 + i * ((h - 12) / 5), w - 6, ((h - 12) / 5) - 1, 1);
    tinyText(doc, t, x + 6, y + 14 + i * ((h - 12) / 5), 7, NAVY_DARK, true);
  });
};

const MOCKUP_DRAWERS = {
  shell: drawShellMockup,
  login: drawLoginMockup,
  dashboard: drawDashboardMockup,
  'staff-list': drawListMockup,
  form: drawFormMockup,
  import: drawImportMockup,
  profile: drawProfileMockup,
  records: drawRecordsMockup,
  reports: drawReportsMockup,
  tasks: drawTasksMockup,
  audit: drawAuditMockup,
  users: drawUsersMockup,
  settings: drawSettingsMockup,
  security: drawSecurityMockup,
};

const drawMockup = (doc, key, x, y, w, h) => {
  mockupFrame(doc, x, y, w, h, 'Schematic preview — ' + key);
  const drawer = MOCKUP_DRAWERS[key] || drawShellMockup;
  drawer(doc, x + 2, y + 2, w - 4, h - 4);
};

// ── SECTION RENDERER ───────────────────────────────────────────────────────

const renderSection = (doc, section, index) => {
  doc.addPage();
  drawPageHeader(doc, section.title);
  let y = 22;

  // Section number + title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...GOLD);
  doc.text(`SECTION ${String(index + 1).padStart(2, '0')}`, MARGIN, y);
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...NAVY_DARK);
  doc.text(section.title, MARGIN, y);
  y += 7;

  // Intro
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...TEXT);
  const introLines = wrap(doc, section.intro, CONTENT_W);
  introLines.forEach((ln) => {
    y = ensureSpace(doc, y, 5, section.title);
    doc.text(ln, MARGIN, y);
    y += 4.6;
  });
  y += 3;

  // Mockup
  const mockupH = 60;
  y = ensureSpace(doc, y, mockupH + 6, section.title);
  drawMockup(doc, section.mockup, MARGIN, y, CONTENT_W, mockupH);
  y += mockupH + 6;

  // Steps
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...NAVY_DARK);
  y = ensureSpace(doc, y, 8, section.title);
  doc.text('How to do it', MARGIN, y);
  y += 5;

  section.steps.forEach((step, i) => {
    const num = String(i + 1).padStart(2, '0');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...NAVY);
    const lines = wrap(doc, step, CONTENT_W - 10);
    y = ensureSpace(doc, y, lines.length * 4.6 + 2, section.title);
    doc.text(num, MARGIN, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT);
    lines.forEach((ln, j) => {
      doc.text(ln, MARGIN + 8, y + j * 4.4);
    });
    y += lines.length * 4.4 + 2;
  });

  // Tips
  if (section.tips && section.tips.length) {
    y += 2;
    y = ensureSpace(doc, y, 10 + section.tips.length * 6, section.title);
    doc.setFillColor(252, 246, 235);
    doc.setDrawColor(...GOLD);
    const tipsBlockH = 6 + section.tips.reduce((acc, t) => acc + wrap(doc, t, CONTENT_W - 14).length * 4.4, 0) + 2;
    doc.roundedRect(MARGIN, y, CONTENT_W, tipsBlockH, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...NAVY_DARK);
    doc.text('TIPS', MARGIN + 3, y + 5);
    let ty = y + 9;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT);
    section.tips.forEach((t) => {
      const lines = wrap(doc, '• ' + t, CONTENT_W - 14);
      lines.forEach((ln, j) => doc.text(ln, MARGIN + 6, ty + j * 4.4));
      ty += lines.length * 4.4;
    });
  }
};

const renderCover = (doc) => {
  drawCoverHeader(doc);
  let y = 100;
  doc.setTextColor(...NAVY_DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Welcome', MARGIN, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...TEXT);
  const blurb =
    'This guide walks you through every function of the CCA Staff Biodata Management System. Each section describes what the screen is for, gives a schematic preview, lists the steps you take, and finishes with practical tips. Keep this guide close — it is also the document you hand to a new colleague joining your office.';
  wrap(doc, blurb, CONTENT_W).forEach((ln) => {
    doc.text(ln, MARGIN, y);
    y += 5;
  });

  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...NAVY_DARK);
  doc.text('Contents', MARGIN, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...TEXT);
  GUIDE_SECTIONS.forEach((s, i) => {
    const num = String(i + 1).padStart(2, '0');
    doc.setTextColor(...GOLD);
    doc.setFont('helvetica', 'bold');
    doc.text(num, MARGIN, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT);
    doc.text(s.title, MARGIN + 8, y);
    y += 5;
  });

  y = PAGE_H - 30;
  doc.setDrawColor(...BORDER);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text('Confidential · For official use only · Customary Court of Appeal, FCT', MARGIN, y + 5);
  doc.text(`Generated ${new Date().toLocaleString('en-NG')}`, PAGE_W - MARGIN, y + 5, { align: 'right' });
};

export const generateGuidePdf = () => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  renderCover(doc);
  GUIDE_SECTIONS.forEach((section, i) => renderSection(doc, section, i));
  drawFooter(doc);
  doc.save('cca-staff-biodata-system-guide.pdf');
};
