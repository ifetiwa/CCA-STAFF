// Permission catalog for the CCA Staff Biodata system.
// Every gated capability in the UI references one of these keys.

export const PERMISSIONS = [
  { key: 'view_dashboard',  label: 'View Dashboard',                group: 'General' },
  { key: 'view_staff',      label: 'View Staff Directory',          group: 'Staff' },
  { key: 'create_staff',    label: 'Add New Staff',                 group: 'Staff' },
  { key: 'edit_staff',      label: 'Edit Staff Profile',            group: 'Staff' },
  { key: 'delete_staff',    label: 'Delete Staff',                  group: 'Staff' },
  { key: 'export_staff',    label: 'Export Staff (CSV / PDF)',      group: 'Staff' },
  { key: 'view_records',    label: 'View Personnel Records',        group: 'Records' },
  { key: 'view_reports',    label: 'View Reports & Analytics',      group: 'Reports' },
  { key: 'view_audit',      label: 'View Audit Trail',              group: 'Audit' },
  { key: 'view_notifications', label: 'View Notifications',         group: 'General' },
  { key: 'view_tasks',      label: 'View My Tasks',                 group: 'Tasks' },
  { key: 'assign_tasks',    label: 'Assign Tasks to Users',         group: 'Tasks' },
  { key: 'manage_users',    label: 'Manage Users & Permissions',    group: 'Administration' },
  { key: 'manage_settings', label: 'Manage System Settings',        group: 'Administration' },
];

export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

// Built-in role presets. The Super Administrator always has every permission
// and cannot be edited or deleted.
export const ROLE_PRESETS = {
  'Super Administrator': PERMISSION_KEYS,
  'Administrator': [
    'view_dashboard', 'view_staff', 'create_staff', 'edit_staff', 'delete_staff',
    'export_staff', 'view_records', 'view_reports', 'view_audit',
    'view_notifications', 'view_tasks', 'assign_tasks', 'manage_settings',
  ],
  'HR Officer': [
    'view_dashboard', 'view_staff', 'create_staff', 'edit_staff', 'export_staff',
    'view_records', 'view_reports', 'view_notifications', 'view_tasks',
  ],
  'Department Head': [
    'view_dashboard', 'view_staff', 'view_records', 'view_notifications', 'view_tasks',
  ],
  'Auditor': [
    'view_dashboard', 'view_staff', 'view_audit', 'view_reports',
    'view_notifications', 'view_tasks',
  ],
  'Staff': [
    'view_dashboard', 'view_notifications', 'view_tasks',
  ],
};

export const ROLE_NAMES = Object.keys(ROLE_PRESETS);
