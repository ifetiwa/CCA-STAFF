import { useState } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Dashboard from './pages/Dashboard'
import StaffList from './pages/StaffList'
import AddStaff from './pages/AddStaff'
import BulkImport from './pages/BulkImport'
import StaffDetail from './pages/StaffDetail'
import PersonnelRecords from './pages/PersonnelRecords'
import Reports from './pages/Reports'
import AuditTrail from './pages/AuditTrail'
import Settings from './pages/Settings'
import Notifications from './pages/Notifications'
import TestingChecklist from './pages/TestingChecklist'
import UserManagement from './pages/UserManagement'
import Tasks from './pages/Tasks'
import Login from './pages/Login'

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}

function RequirePermission({ permission, children }) {
  const { can } = useAuth()
  if (!can(permission)) {
    return (
      <div className="card">
        <div className="card-body">
          <h3>Access Denied</h3>
          <p className="muted">You do not have permission to view this section. Please contact your administrator.</p>
        </div>
      </div>
    )
  }
  return children
}

function AppContent() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const location = useLocation()
  const { isAuthenticated } = useAuth()

  if (location.pathname === '/login') {
    return isAuthenticated ? <Navigate to="/" replace /> : <Login />
  }

  return (
    <ProtectedRoute>
      <div className={`layout ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
        <Sidebar isOpen={sidebarOpen} />
        <div className="main-content">
          <Header toggleSidebar={() => setSidebarOpen((v) => !v)} />
          <main className="content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/staff" element={<RequirePermission permission="view_staff"><StaffList /></RequirePermission>} />
              <Route path="/staff/:id" element={<RequirePermission permission="view_staff"><StaffDetail /></RequirePermission>} />
              <Route path="/add-staff" element={<RequirePermission permission="create_staff"><AddStaff /></RequirePermission>} />
              <Route path="/import-staff" element={<RequirePermission permission="create_staff"><BulkImport /></RequirePermission>} />
              <Route path="/staff/:id/edit" element={<RequirePermission permission="edit_staff"><AddStaff /></RequirePermission>} />
              <Route path="/records" element={<RequirePermission permission="view_records"><PersonnelRecords /></RequirePermission>} />
              <Route path="/reports" element={<RequirePermission permission="view_reports"><Reports /></RequirePermission>} />
              <Route path="/audit" element={<RequirePermission permission="view_audit"><AuditTrail /></RequirePermission>} />
              <Route path="/tasks" element={<RequirePermission permission="view_tasks"><Tasks /></RequirePermission>} />
              <Route path="/users" element={<RequirePermission permission="manage_users"><UserManagement /></RequirePermission>} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/testing-checklist" element={<TestingChecklist />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <footer className="app-footer">
            <span>© 2026 Customary Court of Appeal, FCT — Staff Biodata Management System</span>
          </footer>
        </div>
      </div>
    </ProtectedRoute>
  )
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  )
}

export default App
