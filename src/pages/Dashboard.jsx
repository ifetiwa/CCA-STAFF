import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, FileText, Calendar, AlertCircle, Download, UserPlus, BarChart3, Search, Building2, ArrowUpRight, Clock } from 'lucide-react';
import { formatDate, statusTone } from '../data/staff';
import { downloadCsv } from '../utils/download';
import { useToast } from '../context/ToastContext';
import { useStaff } from '../hooks/useStaff';

const Dashboard = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const staff = useStaff();

  const totalStaff = staff.length;
  const dueForPromotion = staff.filter((s) => s.nextPromotionInDays !== null && s.nextPromotionInDays <= 365 && s.nextPromotionInDays >= 0).length;
  const dueForRetirement = staff.filter((s) => s.retirementInDays !== null && s.retirementInDays <= 365 && s.retirementInDays >= 0).length;
  const pending = staff.filter((s) => s.status === 'Pending').length;

  const stats = [
    { icon: Users, label: 'Total Staff', value: totalStaff, tone: 'primary', trend: `${staff.filter((s) => s.isActive).length} active`, trendUp: true },
    { icon: FileText, label: 'Updated This Month', value: Math.floor(totalStaff * 0.55), tone: 'success', trend: '+8 this week', trendUp: true },
    { icon: Calendar, label: 'Due for Promotion', value: dueForPromotion, tone: 'info', trend: 'Within 12 months', trendUp: true },
    { icon: AlertCircle, label: 'Due for Retirement', value: dueForRetirement, tone: 'warning', trend: pending > 0 ? `${pending} pending review` : 'On track', trendUp: false },
  ];

  const recentStaff = [...staff]
    .sort((a, b) => new Date(b.firstAppointmentDate) - new Date(a.firstAppointmentDate))
    .slice(0, 5);

  const upcoming = [...staff]
    .filter((s) => s.nextPromotionInDays !== null && s.nextPromotionInDays >= 0)
    .sort((a, b) => a.nextPromotionInDays - b.nextPromotionInDays)
    .slice(0, 4)
    .map((s) => ({
      id: s.id,
      title: `Promotion review · ${s.fullName}`,
      date: s.nextPromotionDate,
      priority: s.nextPromotionInDays <= 90 ? 'high' : 'medium',
    }));

  const handleExport = () => {
    downloadCsv(
      staff.map((s) => ({
        StaffID: s.staffId,
        Name: s.fullName,
        Department: s.department,
        Designation: s.designation,
        GradeLevel: s.gradeLevel,
        Status: s.status,
        FirstAppointment: s.firstAppointmentDate,
        NextPromotion: s.nextPromotionDate,
        Retirement: s.retirementDate,
      })),
      ['StaffID', 'Name', 'Department', 'Designation', 'GradeLevel', 'Status', 'FirstAppointment', 'NextPromotion', 'Retirement'],
      `cca-staff-dashboard-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    toast.success('Dashboard report exported as CSV.');
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Welcome back</h1>
          <p className="page-header-sub">Here's what's happening across personnel records today.</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={handleExport}>
            <Download size={18} />
            Export Report
          </button>
        </div>
      </div>

      <div className="stat-grid mb-3">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className={`stat-card stat-${stat.tone}`}>
              <div className="stat-icon-wrap">
                <Icon size={22} />
              </div>
              <div className="stat-body">
                <div className="stat-label">{stat.label}</div>
                <div className="stat-value">{stat.value}</div>
                <div className={`stat-trend ${stat.trendUp ? 'up' : 'down'}`}>
                  <ArrowUpRight size={14} />
                  {stat.trend}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="row gap-3">
        <div className="col-8">
          <div className="card">
            <div className="card-head">
              <div>
                <h3>Recently Added Staff</h3>
                <p className="muted small">Latest personnel onboarded into the register.</p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/staff')}>
                View all
                <ArrowUpRight size={14} />
              </button>
            </div>
            <div className="card-body card-body--flush">
              <table className="table table-modern">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Designation</th>
                    <th>Department</th>
                    <th>Status</th>
                    <th>Appointed</th>
                  </tr>
                </thead>
                <tbody>
                  {recentStaff.map((s) => (
                    <tr key={s.id} onClick={() => navigate(`/staff/${s.id}`)} className="row-clickable">
                      <td>
                        <div className="cell-user">
                          <span className="cell-avatar">{s.initials}</span>
                          <span className="cell-user-name">{s.fullName}</span>
                        </div>
                      </td>
                      <td>{s.designation}</td>
                      <td><span className="chip">{s.department}</span></td>
                      <td>
                        <span className={`badge badge-${statusTone(s.status)}`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="muted">{formatDate(s.firstAppointmentDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="col-4">
          <div className="card">
            <div className="card-head">
              <div>
                <h3>Upcoming Reviews</h3>
                <p className="muted small">Next promotion reviews.</p>
              </div>
            </div>
            <div className="card-body">
              <div className="event-list">
                {upcoming.length === 0 && <div className="muted small">No upcoming reviews.</div>}
                {upcoming.map((event) => (
                  <div key={event.id} className={`event-item priority-${event.priority}`}
                       onClick={() => navigate(`/staff/${event.id}`)}
                       style={{ cursor: 'pointer' }}>
                    <div className="event-title">{event.title}</div>
                    <div className="event-meta">
                      <Calendar size={14} />
                      <span>{formatDate(event.date)}</span>
                      <span className={`event-tag tag-${event.priority}`}>{event.priority}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card mt-3">
        <div className="card-head">
          <div>
            <h3>Quick Actions</h3>
            <p className="muted small">Jump into the most common workflows.</p>
          </div>
        </div>
        <div className="card-body">
          <div className="quick-actions">
            <button className="quick-action" onClick={() => navigate('/add-staff')}>
              <span className="quick-action-icon"><UserPlus size={20} /></span>
              <span>Add New Staff</span>
            </button>
            <button className="quick-action" onClick={() => navigate('/reports')}>
              <span className="quick-action-icon"><BarChart3 size={20} /></span>
              <span>Generate Report</span>
            </button>
            <button className="quick-action" onClick={() => navigate('/staff')}>
              <span className="quick-action-icon"><Search size={20} /></span>
              <span>Search Records</span>
            </button>
            <button className="quick-action" onClick={() => navigate('/audit')}>
              <span className="quick-action-icon"><Clock size={20} /></span>
              <span>Audit Trail</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
