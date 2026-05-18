import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, FileText, UserPlus, BarChart3, Settings, Clock, Scale,
  ClipboardCheck, ShieldCheck, CheckSquare, Upload, BookOpen,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const Sidebar = ({ isOpen }) => {
  const { can, user } = useAuth()

  const menuItems = [
    { to: '/',                    label: 'Dashboard',          icon: LayoutDashboard, end: true, perm: 'view_dashboard' },
    { to: '/staff',               label: 'All Staff',          icon: Users,           perm: 'view_staff' },
    { to: '/add-staff',           label: 'Add New Staff',      icon: UserPlus,        perm: 'create_staff' },
    { to: '/import-staff',        label: 'Bulk Import',        icon: Upload,          perm: 'create_staff' },
    { to: '/records',             label: 'Personnel Records',  icon: FileText,        perm: 'view_records' },
    { to: '/reports',             label: 'Reports & Analytics', icon: BarChart3,      perm: 'view_reports' },
    { to: '/tasks',               label: 'Tasks',              icon: CheckSquare,     perm: 'view_tasks' },
    { to: '/audit',               label: 'Audit Trail',        icon: Clock,           perm: 'view_audit' },
    { to: '/users',               label: 'User Management',    icon: ShieldCheck,     perm: 'manage_users' },
    { to: '/testing-checklist',   label: 'Testing Checklist',  icon: ClipboardCheck,  superOnly: true },
    { to: '/guide',               label: 'Help / Guide',       icon: BookOpen,        perm: null },
    { to: '/settings',            label: 'Settings',           icon: Settings,        perm: null },
  ]

  const isSuper = user?.role === 'Super Administrator'
  const visibleItems = menuItems.filter((it) => {
    if (it.superOnly) return isSuper
    return !it.perm || can(it.perm)
  })

  return (
    <aside className={`sidebar ${isOpen ? '' : 'collapsed'}`}>
      <div className="sidebar-brand">
        <div className="brand-mark">
          <Scale size={26} />
        </div>
        <div className="brand-text">
          <h3>Customary Court<br />of Appeal</h3>
          <span className="brand-sub">Federal Capital Territory</span>
        </div>
      </div>

      <nav>
        <div className="sidebar-section-label">Main Menu</div>
        <ul className="sidebar-menu">
          {visibleItems.map((item) => {
            const Icon = item.icon
            return (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end} className={({ isActive }) => (isActive ? 'active' : '')}>
                  <Icon size={20} />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="sidebar-footer">
        {user?.role && <div className="muted small" style={{ marginBottom: 4 }}>{user.role}</div>}
        <div>© 2026 CCA-FCT</div>
        <div className="muted">v1.0.0 · Internal</div>
      </div>
    </aside>
  )
}

export default Sidebar
