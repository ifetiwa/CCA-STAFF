import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Menu, LogOut, Settings, Search, User } from 'lucide-react'
import NotificationBell from './NotificationBell'
import { useAuth } from '../context/AuthContext'

const routeTitles = {
  '/': 'Dashboard',
  '/dashboard': 'Dashboard',
  '/staff': 'All Staff',
  '/add-staff': 'Add New Staff',
  '/records': 'Personnel Records',
  '/reports': 'Reports & Analytics',
  '/audit': 'Audit Trail',
  '/settings': 'Settings',
  '/notifications': 'Notifications',
  '/testing-checklist': 'Testing Checklist',
}

const Header = ({ toggleSidebar }) => {
  const [showUserMenu, setShowUserMenu] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const menuRef = useRef(null)
  const { user, logout } = useAuth()

  const displayUser = user || { name: 'Guest', role: 'Visitor', initials: 'G' }

  useEffect(() => {
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowUserMenu(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const title = routeTitles[location.pathname] || (location.pathname.startsWith('/staff/') ? 'Staff Profile' : 'Staff Biodata Management')

  const handleLogout = () => {
    setShowUserMenu(false)
    logout()
    navigate('/login')
  }

  return (
    <header className="header">
      <div className="header-left">
        <button className="icon-btn" onClick={toggleSidebar} aria-label="Toggle sidebar">
          <Menu size={20} />
        </button>
        <div>
          <div className="header-eyebrow">Customary Court of Appeal · FCT</div>
          <h1 className="header-title">{title}</h1>
        </div>
      </div>

      <div className="header-right">
        <div className="search-box">
          <Search size={18} />
          <input type="text" placeholder="Search staff, records…" className="form-control" />
        </div>

        <NotificationBell />

        <div className="user-menu" ref={menuRef}>
          <button className="user-avatar" onClick={() => setShowUserMenu((v) => !v)} title={displayUser.name}>
            {displayUser.initials}
          </button>

          {showUserMenu && (
            <div className="user-dropdown">
              <div className="user-dropdown-header">
                <div className="user-dropdown-name">{displayUser.name}</div>
                <div className="user-dropdown-role">{displayUser.role}</div>
              </div>
              <button className="user-dropdown-item" onClick={() => { setShowUserMenu(false); navigate('/settings') }}>
                <User size={16} /> Profile
              </button>
              <button className="user-dropdown-item" onClick={() => { setShowUserMenu(false); navigate('/settings') }}>
                <Settings size={16} /> Settings
              </button>
              <button className="user-dropdown-item danger" onClick={handleLogout}>
                <LogOut size={16} /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export default Header
