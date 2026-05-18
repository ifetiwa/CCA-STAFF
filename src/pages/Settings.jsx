import { useEffect, useState } from 'react'
import { Save, User, Bell, Lock, Building2, Users, Layers, Briefcase, Plus, Trash2, Pencil, Check, X, ChevronDown, ChevronRight } from 'lucide-react'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import {
  listDepartments, addDepartment, renameDepartment, removeDepartment, subscribeDepartments,
  addUnit, renameUnit, removeUnit,
} from '../data/departments'
import {
  listDesignations, addDesignation, renameDesignation, removeDesignation, subscribeDesignations,
} from '../data/designations'
import { getAllStaff, subscribeStaff } from '../data/staff'

const baseTabs = [
  { id: 'profile', label: 'My Profile', icon: User, perm: null },
  { id: 'organisation', label: 'Organisation', icon: Building2, perm: null },
  { id: 'departments', label: 'Departments', icon: Layers, perm: 'manage_settings' },
  { id: 'designations', label: 'Designations', icon: Briefcase, perm: 'manage_settings' },
  { id: 'roles', label: 'Roles & Access', icon: Users, perm: null },
  { id: 'security', label: 'Security', icon: Lock, perm: null },
  { id: 'notifications', label: 'Notifications', icon: Bell, perm: null },
]

const Settings = () => {
  const [tab, setTab] = useState('profile')
  const toast = useToast()
  const { can } = useAuth()
  const tabs = baseTabs.filter((t) => !t.perm || can(t.perm))

  const handleSave = () => toast.success('Settings saved (session only).')

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Settings</h1>
          <p className="page-header-sub">System preferences and access controls.</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={handleSave}><Save size={18} /> Save Changes</button>
        </div>
      </div>

      <div className="settings-shell">
        <aside className="settings-tabs">
          {tabs.map((t) => {
            const Icon = t.icon
            return (
              <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
                <Icon size={18} /> {t.label}
              </button>
            )
          })}
        </aside>

        <div className="settings-pane card">
          {tab === 'profile' && (
            <div className="card-body">
              <h3>My Profile</h3>
              <p className="muted">Update your personal details and how others see you in the system.</p>
              <div className="row gap-2">
                <Field col={6} label="Full Name" value="Admin User" />
                <Field col={6} label="Staff ID" value="CCA-0000" disabled />
                <Field col={6} label="Email" value="admin@cca.gov.ng" type="email" />
                <Field col={6} label="Phone" value="08000000000" />
              </div>
            </div>
          )}

          {tab === 'organisation' && (
            <div className="card-body">
              <h3>Organisation</h3>
              <p className="muted">Court details displayed in reports and official documents.</p>
              <div className="row gap-2">
                <Field col={12} label="Court Name" value="Customary Court of Appeal, FCT" />
                <Field col={6} label="Registrar" value="Hon. Justice Anonymous" />
                <Field col={6} label="Address" value="Plot 100, Constitution Avenue, Abuja" />
                <Field col={6} label="Phone" value="+234 9 000 0000" />
                <Field col={6} label="Email" value="info@fctcca.gov.ng" />
              </div>
            </div>
          )}

          {tab === 'departments' && <DepartmentsPane toast={toast} />}

          {tab === 'designations' && <DesignationsPane toast={toast} />}

          {tab === 'roles' && (
            <div className="card-body">
              <h3>Roles &amp; Access</h3>
              <p className="muted">Manage system roles and what each role can do.</p>
              <table className="table">
                <thead>
                  <tr><th>Role</th><th>Members</th><th>Permissions</th></tr>
                </thead>
                <tbody>
                  <tr><td>Administrator</td><td>2</td><td>Full system access</td></tr>
                  <tr><td>HR Officer</td><td>5</td><td>Manage staff, records, reports</td></tr>
                  <tr><td>Department Head</td><td>8</td><td>View staff in department</td></tr>
                  <tr><td>Auditor</td><td>1</td><td>Read-only access &amp; logs</td></tr>
                </tbody>
              </table>
            </div>
          )}

          {tab === 'security' && (
            <div className="card-body">
              <h3>Security</h3>
              <p className="muted">Keep your account secure.</p>
              <div className="row gap-2">
                <Field col={6} label="Current Password" type="password" />
                <Field col={6} label="New Password" type="password" />
                <div className="col-12">
                  <label className="checkbox"><input type="checkbox" defaultChecked /> Require two-factor authentication for all administrators</label>
                </div>
                <div className="col-12">
                  <label className="checkbox"><input type="checkbox" defaultChecked /> Auto sign-out after 30 minutes of inactivity</label>
                </div>
              </div>
            </div>
          )}

          {tab === 'notifications' && (
            <div className="card-body">
              <h3>Notifications</h3>
              <p className="muted">Choose how you want to be alerted about activity.</p>
              {[
                { id: 'new', label: 'New staff added' },
                { id: 'edit', label: 'Personnel record changes' },
                { id: 'audit', label: 'Weekly audit summary' },
                { id: 'login', label: 'Sign-in from a new device' },
              ].map((n) => (
                <label key={n.id} className="checkbox" style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid #ecf0f1' }}>
                  <span>{n.label}</span>
                  <span><input type="checkbox" defaultChecked /></span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const DepartmentsPane = ({ toast }) => {
  const [departments, setDepartments] = useState(() => listDepartments())
  const [staff, setStaff] = useState(() => getAllStaff())
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#1a3a52')
  const [editing, setEditing] = useState(null) // { name, draftName }
  const [expanded, setExpanded] = useState(() => new Set())

  useEffect(() => subscribeDepartments(setDepartments), [])
  useEffect(() => subscribeStaff(setStaff), [])

  const countFor = (name) => staff.filter((s) => s.department === name).length
  const unitCountFor = (deptName, unit) =>
    staff.filter((s) => s.department === deptName && s.unit === unit).length

  const handleAdd = (e) => {
    e.preventDefault()
    const result = addDepartment({ name: newName, color: newColor })
    if (!result.ok) return toast.error(result.reason)
    toast.success(`Department "${result.department.name}" added.`)
    setNewName('')
  }

  const handleRename = () => {
    if (!editing) return
    const result = renameDepartment(editing.name, editing.draftName)
    if (!result.ok) return toast.error(result.reason)
    toast.success(`Renamed to "${editing.draftName.trim()}".`)
    setEditing(null)
  }

  const handleDelete = (name) => {
    const count = countFor(name)
    if (count > 0) {
      toast.error(`"${name}" still has ${count} staff member(s). Reassign them before removing.`)
      return
    }
    if (!window.confirm(`Remove department "${name}"?`)) return
    removeDepartment(name)
    toast.success(`"${name}" removed.`)
  }

  const toggle = (name) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name); else next.add(name)
      return next
    })
  }

  return (
    <div className="card-body">
      <h3>Departments &amp; Units</h3>
      <p className="muted">
        Add the departments your organisation uses, and the units within each one. Departments and
        units become available in staff forms, reports, personnel records, and the bulk import
        field mapping.
      </p>

      <form onSubmit={handleAdd} className="row gap-2" style={{ marginBottom: '1.25rem', alignItems: 'flex-end' }}>
        <div className="col-6">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>New department name</label>
            <input
              className="form-control"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Procurement"
            />
          </div>
        </div>
        <div className="col-3">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Colour</label>
            <input
              type="color"
              className="form-control"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              style={{ padding: 2, height: 38 }}
            />
          </div>
        </div>
        <div className="col-3">
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={!newName.trim()}>
            <Plus size={16} /> Add Department
          </button>
        </div>
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {departments.map((d) => {
          const isEditing = editing?.name === d.name
          const count = countFor(d.name)
          const isOpen = expanded.has(d.name)
          const units = d.units || []
          return (
            <div key={d.name} style={{ border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '0.65rem 0.85rem', borderBottom: isOpen ? '1px solid #e2e8f0' : 'none',
              }}>
                <button
                  type="button"
                  onClick={() => toggle(d.name)}
                  style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', color: '#475569',
                  }}
                  aria-label={isOpen ? 'Collapse' : 'Expand'}
                >
                  {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                <span style={{
                  display: 'inline-block', width: 18, height: 18, borderRadius: 4,
                  background: d.color, border: '1px solid rgba(0,0,0,0.12)', flexShrink: 0,
                }} />
                <div style={{ flex: 1 }}>
                  {isEditing ? (
                    <input
                      className="form-control"
                      value={editing.draftName}
                      onChange={(e) => setEditing({ ...editing, draftName: e.target.value })}
                      autoFocus
                    />
                  ) : (
                    <>
                      <strong>{d.name}</strong>
                      <span className="muted small" style={{ marginLeft: 8 }}>
                        · {count} staff · {units.length} unit{units.length === 1 ? '' : 's'}
                      </span>
                    </>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {isEditing ? (
                    <>
                      <button className="btn btn-sm btn-primary" onClick={handleRename}>
                        <Check size={14} /> Save
                      </button>
                      <button className="btn btn-sm btn-outline" onClick={() => setEditing(null)}>
                        <X size={14} /> Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={() => setEditing({ name: d.name, draftName: d.name })}
                      >
                        <Pencil size={14} /> Rename
                      </button>
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={() => handleDelete(d.name)}
                        title={count > 0 ? `${count} staff still assigned` : 'Remove department'}
                      >
                        <Trash2 size={14} /> Remove
                      </button>
                    </>
                  )}
                </div>
              </div>

              {isOpen && (
                <UnitsList
                  department={d.name}
                  units={units}
                  unitCountFor={unitCountFor}
                  toast={toast}
                />
              )}
            </div>
          )
        })}
        {departments.length === 0 && (
          <div className="muted" style={{ textAlign: 'center', padding: '1.5rem' }}>
            No departments yet — add one above.
          </div>
        )}
      </div>
    </div>
  )
}

const UnitsList = ({ department, units, unitCountFor, toast }) => {
  const [newUnit, setNewUnit] = useState('')
  const [editingUnit, setEditingUnit] = useState(null) // { name, draft }

  const handleAdd = (e) => {
    e.preventDefault()
    const result = addUnit(department, newUnit)
    if (!result.ok) return toast.error(result.reason)
    toast.success(`Unit "${result.unit}" added to ${department}.`)
    setNewUnit('')
  }

  const handleRename = () => {
    if (!editingUnit) return
    const result = renameUnit(department, editingUnit.name, editingUnit.draft)
    if (!result.ok) return toast.error(result.reason)
    toast.success(`Unit renamed to "${editingUnit.draft.trim()}".`)
    setEditingUnit(null)
  }

  const handleRemove = (unit) => {
    const count = unitCountFor(department, unit)
    if (count > 0) {
      toast.error(`"${unit}" still has ${count} staff assigned. Reassign them before removing.`)
      return
    }
    if (!window.confirm(`Remove unit "${unit}" from ${department}?`)) return
    removeUnit(department, unit)
    toast.success(`"${unit}" removed.`)
  }

  return (
    <div style={{ padding: '0.75rem 1rem 1rem 2.85rem', background: '#f8fafc' }}>
      <form onSubmit={handleAdd} className="row gap-2" style={{ alignItems: 'flex-end', marginBottom: units.length ? '0.75rem' : 0 }}>
        <div className="col-9">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="muted small">Add unit to {department}</label>
            <input
              className="form-control"
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)}
              placeholder="e.g. Stenography Unit"
            />
          </div>
        </div>
        <div className="col-3">
          <button type="submit" className="btn btn-outline" style={{ width: '100%' }} disabled={!newUnit.trim()}>
            <Plus size={14} /> Add Unit
          </button>
        </div>
      </form>

      {units.length > 0 && (
        <table className="table" style={{ marginBottom: 0 }}>
          <thead>
            <tr>
              <th>Unit</th>
              <th style={{ width: 100 }}>Staff</th>
              <th style={{ width: 200, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {units.map((u) => {
              const isEditing = editingUnit?.name === u
              const count = unitCountFor(department, u)
              return (
                <tr key={u}>
                  <td>
                    {isEditing ? (
                      <input
                        className="form-control"
                        value={editingUnit.draft}
                        onChange={(e) => setEditingUnit({ ...editingUnit, draft: e.target.value })}
                        autoFocus
                      />
                    ) : u}
                  </td>
                  <td>{count}</td>
                  <td style={{ textAlign: 'right' }}>
                    {isEditing ? (
                      <>
                        <button className="btn btn-sm btn-primary" onClick={handleRename} style={{ marginRight: 6 }}>
                          <Check size={14} /> Save
                        </button>
                        <button className="btn btn-sm btn-outline" onClick={() => setEditingUnit(null)}>
                          <X size={14} /> Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={() => setEditingUnit({ name: u, draft: u })}
                          style={{ marginRight: 6 }}
                        >
                          <Pencil size={14} /> Rename
                        </button>
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={() => handleRemove(u)}
                          title={count > 0 ? `${count} staff still assigned` : 'Remove unit'}
                        >
                          <Trash2 size={14} /> Remove
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

const DesignationsPane = ({ toast }) => {
  const [designations, setDesignations] = useState(() => listDesignations())
  const [staff, setStaff] = useState(() => getAllStaff())
  const [newName, setNewName] = useState('')
  const [editing, setEditing] = useState(null) // { name, draft }

  useEffect(() => subscribeDesignations(setDesignations), [])
  useEffect(() => subscribeStaff(setStaff), [])

  const countFor = (name) => staff.filter((s) => s.designation === name).length

  const handleAdd = async (e) => {
    e.preventDefault()
    const result = await addDesignation(newName)
    if (!result.ok) return toast.error(result.reason)
    toast.success(`Designation "${result.designation}" added.`)
    setNewName('')
  }

  const handleRename = async () => {
    if (!editing) return
    const result = await renameDesignation(editing.name, editing.draft)
    if (!result.ok) return toast.error(result.reason)
    toast.success(`Renamed to "${editing.draft.trim()}".`)
    setEditing(null)
  }

  const handleDelete = async (name) => {
    const count = countFor(name)
    if (count > 0) {
      toast.error(`"${name}" is still assigned to ${count} staff member(s). Reassign them before removing.`)
      return
    }
    if (!window.confirm(`Remove designation "${name}"?`)) return
    const result = await removeDesignation(name)
    if (!result.ok) return toast.error(result.reason)
    toast.success(`"${name}" removed.`)
  }

  return (
    <div className="card-body">
      <h3>Designations</h3>
      <p className="muted">
        Add the job titles / designations used in your organisation. These appear in the staff form,
        promotion records, and reports.
      </p>

      <form onSubmit={handleAdd} className="row gap-2" style={{ marginBottom: '1.25rem', alignItems: 'flex-end' }}>
        <div className="col-9">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>New designation</label>
            <input
              className="form-control"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Senior Legal Counsel"
            />
          </div>
        </div>
        <div className="col-3">
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={!newName.trim()}>
            <Plus size={16} /> Add Designation
          </button>
        </div>
      </form>

      {designations.length > 0 ? (
        <table className="table" style={{ marginBottom: 0 }}>
          <thead>
            <tr>
              <th>Designation</th>
              <th style={{ width: 100 }}>Staff</th>
              <th style={{ width: 220, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {designations.map((d) => {
              const isEditing = editing?.name === d
              const count = countFor(d)
              return (
                <tr key={d}>
                  <td>
                    {isEditing ? (
                      <input
                        className="form-control"
                        value={editing.draft}
                        onChange={(e) => setEditing({ ...editing, draft: e.target.value })}
                        autoFocus
                      />
                    ) : d}
                  </td>
                  <td>{count}</td>
                  <td style={{ textAlign: 'right' }}>
                    {isEditing ? (
                      <>
                        <button className="btn btn-sm btn-primary" onClick={handleRename} style={{ marginRight: 6 }}>
                          <Check size={14} /> Save
                        </button>
                        <button className="btn btn-sm btn-outline" onClick={() => setEditing(null)}>
                          <X size={14} /> Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={() => setEditing({ name: d, draft: d })}
                          style={{ marginRight: 6 }}
                        >
                          <Pencil size={14} /> Rename
                        </button>
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={() => handleDelete(d)}
                          title={count > 0 ? `${count} staff still assigned` : 'Remove designation'}
                        >
                          <Trash2 size={14} /> Remove
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      ) : (
        <div className="muted" style={{ textAlign: 'center', padding: '1.5rem' }}>
          No designations yet — add one above.
        </div>
      )}
    </div>
  )
}

const Field = ({ col = 6, label, value = '', type = 'text', disabled = false }) => (
  <div className={`col-${col}`}>
    <div className="form-group">
      <label>{label}</label>
      <input className="form-control" type={type} defaultValue={value} disabled={disabled} />
    </div>
  </div>
)

export default Settings
