// Lightweight client-side download helpers — used until the Django export
// endpoints are wired through axios.

export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

const escapeCsv = (v) => {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const downloadCsv = (rows, columns, filename) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    downloadBlob(new Blob(['No data'], { type: 'text/plain' }), filename.replace(/\.csv$/, '') + '.txt');
    return;
  }
  const cols = columns || Object.keys(rows[0]);
  const header = cols.map(escapeCsv).join(',');
  const body = rows.map((r) => cols.map((c) => escapeCsv(r[c])).join(',')).join('\n');
  const blob = new Blob([header + '\n' + body], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename);
};

export const printElement = () => {
  // Defer to give React a tick to render print-mode changes.
  setTimeout(() => window.print(), 0);
};
