import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { SyncProvider } from './context/SyncContext'
import { hydrateDesignations } from './data/designations'
import { hydrateDepartmentsFromApi, invalidateDepartments } from './data/departments'
import { hydrateStaffFromApi, invalidateStaffStore } from './data/staff'
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
import TestingChecklist from './pages/TestingChecklist'
import UserManagement from './pages/UserManagement'
import Tasks from './pages/Tasks'
import Guide from './pages/Guide'
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

function RequireSuperAdmin({ children }) {
  const { user } = useAuth()
  const isSuper =
    user?.role_key === 'super_admin' ||
    user?.role === 'Super Administrator' ||
    user?.is_superuser === true
  if (!isSuper) {
    return (
      <div className="card">
        <div className="card-body">
          <h3>Access Denied</h3>
          <p className="muted">This area is restricted to the Super Administrator.</p>
        </div>
      </div>
    )
  }
  return children
}

function AppContent() {
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window === 'undefined' ? true : window.innerWidth > 768
  )
  const location = useLocation()
  const { isAuthenticated } = useAuth()

  // On mobile, auto-close the drawer when navigating so the new page is visible.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      setSidebarOpen(false)
    }
  }, [location.pathname])

  // Pull the canonical designation list + staff roster from the backend
  // once we have an authenticated session. Failure is silent — the cached
  // copies keep the UI usable when the backend is unreachable.
  useEffect(() => {
    if (isAuthenticated) {
      hydrateDesignations()
      hydrateDepartmentsFromApi()
      hydrateStaffFromApi()
    } else {
      // Force a refetch on next login so a different user doesn't see
      // the previous session's cached rows.
      invalidateStaffStore()
      invalidateDepartments()
    }
  }, [isAuthenticated])

  if (location.pathname === '/login') {
    return isAuthenticated ? <Navigate to="/" replace /> : <Login />
  }

  return (
    <ProtectedRoute>
      <div className={`layout ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
        <Sidebar isOpen={sidebarOpen} />
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
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
              <Route path="/testing-checklist" element={<RequireSuperAdmin><TestingChecklist /></RequireSuperAdmin>} />
              <Route path="/guide" element={<Guide />} />
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
      <SyncProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </SyncProvider>
    </AuthProvider>
  )
}

export default App
