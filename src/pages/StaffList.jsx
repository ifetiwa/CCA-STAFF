import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Download, Edit, Eye, Trash2, UserPlus, FileDown, ArrowDownAZ, ArrowUpZA, ChevronLeft, ChevronRight } from 'lucide-react';
import { bulkDeleteStaff, formatDate, statusTone, STATUSES } from '../data/staff';
import { staffAPI } from '../utils/api';
import { downloadCsv } from '../utils/download';
import { generateStaffPdf } from '../utils/pdf';
import { useToast } from '../context/ToastContext';
import { useStaff } from '../hooks/useStaff';
import { useAuth } from '../context/AuthContext';

const StaffList = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const staff = useStaff();
  const { can } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState('all');
  const [filterUnit, setFilterUnit] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterLocation, setFilterLocation] = useState('all');
  const [sortOrder, setSortOrder] = useState('az'); // 'az' | 'za' — alphabetical by name
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  // Row selection is available to anyone who can either delete or export, so
  // export-only users can still bulk-select and export to Excel.
  const canSelect = can('delete_staff') || can('export_staff');

  const PAGE_SIZE = 100;

  const departments = useMemo(() => [...new Set(staff.map((s) => s.department).filter(Boolean))], [staff]);
  const statuses = STATUSES;
  // Distinct duty stations (from the nominal roll's Location), sorted for the filter.
  const locations = useMemo(
    () => [...new Set(staff.map((s) => s.location).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [staff],
  );
  const unitsForDept = useMemo(() => {
    if (filterDept === 'all') return [];
    return [...new Set(staff.filter((s) => s.department === filterDept).map((s) => s.unit).filter(Boolean))];
  }, [staff, filterDept]);

  const filtered = staff.filter((s) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      s.fullName.toLowerCase().includes(term) ||
      s.email.toLowerCase().includes(term) ||
      s.designation.toLowerCase().includes(term) ||
      s.staffId.toLowerCase().includes(term);
    const matchesDept = filterDept === 'all' || s.department === filterDept;
    const matchesUnit = filterUnit === 'all' || s.unit === filterUnit;
    const matchesStatus = filterStatus === 'all' || s.status === filterStatus;
    const matchesLocation = filterLocation === 'all' || s.location === filterLocation;
    return matchesSearch && matchesDept && matchesUnit && matchesStatus && matchesLocation;
  });

  // Sort alphabetically by surname then first name (falls back to full name).
  const sorted = useMemo(() => {
    const sortKey = (s) =>
      `${s.lastName || ''} ${s.firstName || ''}`.trim().toLowerCase() || (s.fullName || '').toLowerCase();
    const arr = [...filtered].sort((a, b) => sortKey(a).localeCompare(sortKey(b), 'en'));
    return sortOrder === 'za' ? arr.reverse() : arr;
  }, [filtered, sortOrder]);

  // Paginate — 100 records per page. Clamp the page at render time so removing
  // rows (e.g. after a delete) can never leave us on an out-of-range page.
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const paged = sorted.slice(pageStart, pageStart + PAGE_SIZE);

  // Filter/sort changes should send the user back to the first page. Wrap the
  // setters so the reset happens with the change (avoids setState-in-effect).
  const goToPageOne = () => setPage(1);

  const statusBadge = statusTone;

  const resetFilters = () => {
    setSearchTerm('');
    setFilterDept('all');
    setFilterUnit('all');
    setFilterStatus('all');
    setFilterLocation('all');
    goToPageOne();
  };

  // Shared row shape for every CSV export (opens directly in Excel).
  const toExportRow = (s) => ({
    StaffID: s.staffId,
    FileNo: s.fileNumber,
    NHIS: s.nhisNumber,
    NHF: s.nhfNumber,
    Name: s.fullName,
    Gender: s.gender,
    Department: s.department,
    Unit: s.unit || '',
    DutyStation: s.location || '',
    Designation: s.designation,
    GradeLevel: `GL ${s.gradeLevel}/${s.step}`,
    Status: s.status,
    PFA: s.pensionAdministrator || '',
    RSAPin: s.rsaPin || '',
    YearOfCallToBar: s.yearOfCallToBar || '',
    AppointmentDate: s.firstAppointmentDate,
    NextPromotion: s.nextPromotionDate,
    RetirementDate: s.retirementDate,
    Email: s.email,
    Phone: s.phonePrimary,
    StateOfOrigin: s.stateOfOrigin,
    LGA: s.lga,
  });

  const handleExport = () => {
    downloadCsv(
      filtered.map(toExportRow),
      null,
      `cca-staff-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    toast.success(`Exported ${filtered.length} staff record${filtered.length === 1 ? '' : 's'}.`);
  };

  const handleExportSelected = () => {
    const rows = staff.filter((s) => selectedIds.has(s.id));
    if (!rows.length) return;
    downloadCsv(
      rows.map(toExportRow),
      null,
      `cca-staff-selected-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    toast.success(`Exported ${rows.length} selected staff record${rows.length === 1 ? '' : 's'} to Excel (CSV).`);
  };

  const handleDelete = async (s) => {
    const ok = window.confirm(`Permanently remove ${s.fullName} (${s.staffId})?`);
    if (!ok) return;
    try {
      await bulkDeleteStaff([s.id]);
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(s.id); return n; });
      toast.success(`${s.fullName} removed.`);
    } catch (err) {
      const detail = err.response?.data?.detail || 'Delete failed.';
      toast.error(detail);
    }
  };

  const visibleIds = useMemo(() => paged.map((s) => s.id), [paged]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someVisibleSelected = visibleIds.some((id) => selectedIds.has(id));

  const toggleOne = (id) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };
  const toggleAllVisible = () => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (allVisibleSelected) {
        visibleIds.forEach((id) => n.delete(id));
      } else {
        visibleIds.forEach((id) => n.add(id));
      }
      return n;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    const ok = window.confirm(
      `Permanently delete ${ids.length} staff record${ids.length === 1 ? '' : 's'}? This cannot be undone.`,
    );
    if (!ok) return;
    setBulkBusy(true);
    try {
      const res = await bulkDeleteStaff(ids);
      toast.success(`Deleted ${res?.deleted ?? ids.length} record${(res?.deleted ?? ids.length) === 1 ? '' : 's'}.`);
      if (res?.missing?.length) {
        toast.error(`${res.missing.length} id(s) were not found and skipped.`);
      }
      clearSelection();
    } catch (err) {
      const detail = err.response?.data?.detail || 'Bulk delete failed.';
      toast.error(detail);
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header-title">All Staff Members</h1>
          <p className="page-header-sub">{filtered.length} of {staff.length} staff visible.</p>
        </div>
        <div className="page-header-actions">
          {can('create_staff') && (
            <button className="btn btn-outline" onClick={() => navigate('/add-staff')}>
              <UserPlus size={18} />
              Add Staff
            </button>
          )}
          {can('export_staff') && (
            <button className="btn btn-primary" onClick={handleExport}>
              <Download size={18} />
              Export CSV
            </button>
          )}
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-body">
          <div className="row gap-2">
            <div className="col-4">
              <div className="form-group form-group--inline">
                <label>Search</label>
                <div className="input-with-icon">
                  <Search size={18} />
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search name, ID, email, designation…"
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); goToPageOne(); }}
                  />
                </div>
              </div>
            </div>

            <div className="col-2">
              <div className="form-group form-group--inline">
                <label>Department</label>
                <select
                  className="form-control"
                  value={filterDept}
                  onChange={(e) => { setFilterDept(e.target.value); setFilterUnit('all'); goToPageOne(); }}
                >
                  <option value="all">All Departments</option>
                  {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>

            <div className="col-2">
              <div className="form-group form-group--inline">
                <label>Unit</label>
                <select
                  className="form-control"
                  value={filterUnit}
                  onChange={(e) => { setFilterUnit(e.target.value); goToPageOne(); }}
                  disabled={filterDept === 'all' || unitsForDept.length === 0}
                >
                  <option value="all">
                    {filterDept === 'all'
                      ? 'Pick a department first'
                      : unitsForDept.length === 0
                        ? 'No units in this dept'
                        : 'All Units'}
                  </option>
                  {unitsForDept.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>

            <div className="col-2">
              <div className="form-group form-group--inline">
                <label>Duty Station</label>
                <select className="form-control" value={filterLocation} onChange={(e) => { setFilterLocation(e.target.value); goToPageOne(); }}>
                  <option value="all">All Duty Stations</option>
                  {locations.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>

            <div className="col-2">
              <div className="form-group form-group--inline">
                <label>Status</label>
                <select className="form-control" value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); goToPageOne(); }}>
                  <option value="all">All Statuses</option>
                  {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className="col-2 col-reset-action">
              <button className="btn btn-outline btn-block" onClick={resetFilters}>
                <Filter size={18} />
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      {canSelect && selectedIds.size > 0 && (
        <div className="card mb-2" style={{ background: 'var(--surface-2, #fff8e6)' }}>
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <strong>{selectedIds.size}</strong> staff selected.
              <button type="button" className="btn btn-link" style={{ marginLeft: 8 }} onClick={clearSelection}>
                Clear
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {can('export_staff') && (
                <button type="button" className="btn btn-primary" onClick={handleExportSelected}>
                  <FileDown size={16} />
                  Export {selectedIds.size} to Excel
                </button>
              )}
              {can('delete_staff') && (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleBulkDelete}
                  disabled={bulkBusy}
                >
                  <Trash2 size={16} />
                  {bulkBusy ? 'Deleting…' : `Delete ${selectedIds.size} selected`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, flexWrap: 'wrap', marginBottom: 8,
      }}>
        <div className="btn-group" style={{ display: 'inline-flex', gap: 4 }} role="group" aria-label="Sort order">
          <button
            className={`btn btn-sm ${sortOrder === 'az' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => { setSortOrder('az'); goToPageOne(); }}
            title="Sort by name A to Z"
          >
            <ArrowDownAZ size={16} /> A–Z
          </button>
          <button
            className={`btn btn-sm ${sortOrder === 'za' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => { setSortOrder('za'); goToPageOne(); }}
            title="Sort by name Z to A"
          >
            <ArrowUpZA size={16} /> Z–A
          </button>
        </div>
        <span className="muted small">
          {sorted.length === 0
            ? 'No records'
            : `Showing ${pageStart + 1}–${Math.min(pageStart + PAGE_SIZE, sorted.length)} of ${sorted.length}`}
        </span>
      </div>

      <div className="card">
        <div className="card-body card-body--flush">
          <table className="table table-modern">
            <thead>
              <tr>
                {canSelect && (
                  <th style={{ width: 36 }}>
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      ref={(el) => { if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected; }}
                      onChange={toggleAllVisible}
                      aria-label="Select all visible staff"
                    />
                  </th>
                )}
                <th>Staff</th>
                <th>Designation</th>
                <th>Department</th>
                <th>GL / Step</th>
                <th>Status</th>
                <th>Next Promotion</th>
                <th>Retirement</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.length > 0 ? (
                paged.map((s) => (
                  <tr key={s.id}>
                    {canSelect && (
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(s.id)}
                          onChange={() => toggleOne(s.id)}
                          aria-label={`Select ${s.fullName}`}
                        />
                      </td>
                    )}
                    <td>
                      <div className="cell-user">
                        {s.photoDataUrl
                          ? <img src={s.photoDataUrl} alt={s.fullName} className="cell-avatar cell-avatar-photo" />
                          : <span className="cell-avatar">{s.initials}</span>}
                        <div>
                          <div className="cell-user-name">{s.fullName}</div>
                          <div className="muted small">{s.staffId}</div>
                        </div>
                      </div>
                    </td>
                    <td>{s.designation}</td>
                    <td>
                      <span className="chip">{s.department}</span>
                      {s.unit && <div className="muted small" style={{ marginTop: 2 }}>{s.unit}</div>}
                    </td>
                    <td className="muted small">GL {s.gradeLevel} / Step {s.step}</td>
                    <td>
                      <span className={`badge badge-${statusBadge(s.status)}`}>{s.status}</span>
                    </td>
                    <td className="muted small">{formatDate(s.nextPromotionDate)}</td>
                    <td className="muted small">{formatDate(s.retirementDate)}</td>
                    <td className="text-right">
                      <div className="action-group">
                        <button className="action-btn" title="View" onClick={() => navigate(`/staff/${s.id}`)}>
                          <Eye size={16} />
                        </button>
                        {can('export_staff') && (
                          <button
                            className="action-btn"
                            title="Export profile as PDF"
                            onClick={() => { generateStaffPdf(s); toast.success(`${s.fullName} exported as PDF.`); }}
                          >
                            <FileDown size={16} />
                          </button>
                        )}
                        {can('edit_staff') && (
                          <button className="action-btn" title="Edit" onClick={() => navigate(`/staff/${s.id}/edit`)}>
                            <Edit size={16} />
                          </button>
                        )}
                        {can('delete_staff') && (
                          <button className="action-btn action-btn--danger" title="Delete" onClick={() => handleDelete(s)}>
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={canSelect ? 9 : 8} className="empty-row">
                    No staff members found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, flexWrap: 'wrap', marginTop: 12,
        }}>
          <span className="muted small">Page {currentPage} of {totalPages}</span>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <button
              className="btn btn-sm btn-outline"
              onClick={() => setPage(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
            >
              <ChevronLeft size={16} /> Prev
            </button>
            {getPageNumbers(currentPage, totalPages).map((n, i) => (
              n === '…'
                ? <span key={`gap-${i}`} className="muted" style={{ padding: '0 6px' }}>…</span>
                : (
                  <button
                    key={n}
                    className={`btn btn-sm ${n === currentPage ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setPage(n)}
                    style={{ minWidth: 38 }}
                  >
                    {n}
                  </button>
                )
            ))}
            <button
              className="btn btn-sm btn-outline"
              onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Compact page-number list with ellipses, e.g. 1 … 4 5 [6] 7 8 … 20.
const getPageNumbers = (current, total) => {
  const pages = [];
  const push = (n) => { if (!pages.includes(n)) pages.push(n); };
  const windowed = new Set([1, total, current, current - 1, current + 1]);
  const sortedNums = [...windowed].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  let prev = 0;
  for (const n of sortedNums) {
    if (n - prev > 1) push('…');
    push(n);
    prev = n;
  }
  return pages;
};

export default StaffList;
