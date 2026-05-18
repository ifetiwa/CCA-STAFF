// Source-of-truth content for the System Guide. Consumed both by the
// in-app Guide page (rendered as HTML mockups) and the downloadable
// PDF (rendered as bordered schematic frames).
//
// Each section is self-contained: a description, a numbered set of
// steps, and a "mockup" descriptor that maps to a visual schematic
// (see Guide.jsx for the HTML map and guidePdf.js for the PDF map).

export const GUIDE_META = {
  title: 'System Guide',
  subtitle: 'Customary Court of Appeal · Staff Biodata Management System',
  version: '1.0',
  releaseDate: '2026-05-18',
};

export const GUIDE_SECTIONS = [
  {
    id: 'getting-started',
    title: 'Getting Started · Signing In',
    intro:
      'Every action in the system requires a signed-in account. The login page authenticates you against your CCA staff credentials and assigns the menu and permissions tied to your role.',
    steps: [
      'Open the application in your browser. You will be taken to the sign-in screen automatically if you are not already signed in.',
      'Enter your CCA email address (e.g. yourname@cca.gov.ng) in the Email field.',
      'Enter your password. Use the eye icon on the right of the field to reveal it briefly if you need to verify what you typed.',
      'Tick "Remember me" if this is your own device. Leave it unticked on shared workstations.',
      'Click "Sign in". If your credentials are correct you will land on the Dashboard. If not, the page will show the specific reason (unknown email, wrong password, or deactivated account).',
      'After 30 minutes of inactivity you will be signed out automatically and asked to log in again.',
    ],
    tips: [
      'Passwords are case-sensitive.',
      'If your account has been deactivated by an administrator, the system will say so on the login form — contact the Super Administrator to re-enable it.',
    ],
    mockup: 'login',
  },
  {
    id: 'navigation',
    title: 'Navigating the System',
    intro:
      'The application has a fixed left sidebar (main menu), a top header (page title, search, profile menu), and a content area in the middle. Items in the sidebar are filtered automatically based on the permissions your role has.',
    steps: [
      'Use the sidebar on the left to switch between major sections: Dashboard, All Staff, Add New Staff, Bulk Import, Personnel Records, Reports & Analytics, Tasks, Audit Trail, User Management, Testing Checklist, Help / Guide, and Settings.',
      'Click the menu icon at the top-left of the header to collapse or expand the sidebar when you need more screen space.',
      'Use the search box in the header to jump quickly to a staff member by name, staff ID, or designation.',
      'Click your initials (top-right of the header) to open the profile menu, where you can open Settings or sign out.',
    ],
    tips: [
      'If a menu item is missing for you, it means your role does not have permission to see it. Ask the Super Administrator to grant the relevant permission.',
    ],
    mockup: 'shell',
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    intro:
      'The Dashboard is your daily landing page. It summarises the directory, surfaces staff due for promotion or retirement, lists recent additions, and gives you a one-click export of the entire directory as a CSV.',
    steps: [
      'Open the Dashboard from the sidebar (or by clicking the CCA crest in the header).',
      'Review the four stat cards at the top: Total Staff, Updated This Month, Due for Promotion, and Due for Retirement.',
      'Scroll to the Recent Staff list to see the five most recently appointed officers.',
      'Use the Upcoming Events list on the right to see scheduled promotion reviews ranked by urgency.',
      'Click "Export CSV" in the top-right of the Dashboard to download the full directory as a spreadsheet snapshot.',
    ],
    tips: [
      'Stat cards are live — they reflect the directory state at the moment the page is opened, not a cached value.',
    ],
    mockup: 'dashboard',
  },
  {
    id: 'staff-list',
    title: 'All Staff · Directory',
    intro:
      'The All Staff page is the central directory. Every staff record is searchable and filterable, and you can open, edit, export, or remove records from here.',
    steps: [
      'Open "All Staff" from the sidebar.',
      'Type into the search box to filter by name, email, staff ID, or designation. The list updates as you type.',
      'Use the Department, Unit, and Status filters above the table to narrow the list further. Click "Reset" to clear all filters.',
      'Click the eye icon on a row to open the full staff profile.',
      'Click the pencil icon to edit the staff record (only visible if you have the Edit Staff permission).',
      'Click the download icon on a row to generate that staff member\'s biodata as a formatted PDF.',
      'Click "Export CSV" in the top-right to export the currently filtered list as a spreadsheet.',
      'Click the trash icon to remove a staff record (Administrators and above only). You will be asked to confirm.',
    ],
    tips: [
      'CSV exports respect the filters that are active — export a single department by filtering first.',
      'The PDF biodata is the official record and includes the full service history.',
    ],
    mockup: 'staff-list',
  },
  {
    id: 'add-staff',
    title: 'Adding a New Staff Member',
    intro:
      'Use this form to register a new officer. The form is grouped into sections (Personal, Origin, Contact, Employment, Qualifications, Financial, Next of Kin) so you can complete it in stages. Computed fields such as Years of Service, Next Promotion and Retirement Date are derived automatically.',
    steps: [
      'Open "Add New Staff" from the sidebar.',
      'Fill in Personal Information — full name, date of birth, gender, marital status, blood group, etc.',
      'Fill in Origin & Identity — nationality, state of origin, LGA, NIN, TIN.',
      'Fill in Contact details — email, phone numbers, residential and permanent addresses.',
      'Fill in Employment — File Number, NHIS Number, National Housing Number, Cadre, Department, Designation, Grade Level/Step, Status, dates of appointment, confirmation and last promotion. For legal staff, enter Year of Call to Bar (optional).',
      'Upload the staff Passport Photograph and Signature in the Photo & Signature section (PNG or JPG, up to 2MB each). These appear on the biodata PDF.',
      'Add Educational & Professional Qualifications using the "Add Row" button. Enter institution, qualification, year and grade for each row.',
      'Fill in Financial — bank name, account number, PFA, RSA PIN.',
      'Fill in Next of Kin — name, relationship, phone, email, address.',
      'Click "Save Record". The system validates required fields and shows a success toast on save.',
    ],
    tips: [
      'Required fields are marked with an asterisk and the form will scroll to the first missing field if you try to save without completing them.',
      'Computed fields (Years of Service, Age, Next Promotion, Retirement Date) update on save based on the dates you entered.',
    ],
    mockup: 'form',
  },
  {
    id: 'bulk-import',
    title: 'Bulk Import',
    intro:
      'When onboarding a large batch (e.g. a new intake), use Bulk Import to bring in many staff records at once from a CSV or Excel file.',
    steps: [
      'Open "Bulk Import" from the sidebar.',
      'Download the import template using the "Download Template" button to see the required columns and example rows.',
      'Fill in the template, one staff member per row.',
      'Click "Choose File" and select your filled-in CSV or .xlsx file.',
      'Review the preview table — the system shows which rows it parsed correctly and flags rows with missing or invalid data.',
      'Click "Import Valid Rows" to commit the valid records to the directory. Invalid rows remain in the preview so you can fix and re-upload.',
    ],
    tips: [
      'The system only imports valid rows — invalid rows are never silently dropped, they are reported back to you.',
      'After import, open All Staff and verify a few of the new records before announcing the import as complete.',
    ],
    mockup: 'import',
  },
  {
    id: 'staff-profile',
    title: 'Viewing & Editing a Staff Profile',
    intro:
      'The staff profile page is the full record for one officer, grouped into tabs (Overview, Personal, Employment, Qualifications, Service History, Documents). You can edit any field your permissions allow and generate a formatted PDF biodata at any time.',
    steps: [
      'Open the staff profile from All Staff (eye icon) or from a search result.',
      'Use the tabs at the top to switch between Overview, Personal, Employment, Qualifications, Service History, and Documents.',
      'Click "Edit" (top-right) to open the record in edit mode. The form is the same as Add New Staff but pre-filled.',
      'Make your changes and click "Save". Every change is captured in the Audit Trail with the editor, timestamp and field-level diff.',
      'Click "Download PDF" to generate the official biodata document.',
    ],
    tips: [
      'Only users with the Edit Staff permission see the Edit button.',
      'Service History is appended automatically on key events (promotion, transfer, confirmation) — you do not edit it directly.',
    ],
    mockup: 'profile',
  },
  {
    id: 'records',
    title: 'Personnel Records',
    intro:
      'Personnel Records is the document side of each staff file — appointment letters, promotion letters, confirmation letters, training certificates, and other supporting documents.',
    steps: [
      'Open "Personnel Records" from the sidebar.',
      'Filter by staff member or document type using the controls at the top.',
      'Click a document row to preview it.',
      'Use "Upload Document" to attach a new document to a staff file. Pick the staff member, the document type and the file.',
      'Use the download icon on each row to retrieve the original file.',
    ],
    tips: [
      'Document type is required so that filters work correctly later. Use the closest match if the exact type is not in the list.',
    ],
    mockup: 'records',
  },
  {
    id: 'reports',
    title: 'Reports & Analytics',
    intro:
      'Reports & Analytics provides aggregate views across the directory — distribution by department, grade, gender, age, state of origin, and projected promotions and retirements over the next 12 months.',
    steps: [
      'Open "Reports & Analytics" from the sidebar.',
      'Choose a report from the list on the left (Department Distribution, Grade Profile, Promotion Forecast, Retirement Forecast, Gender Balance, etc.).',
      'Use the date-range and department filters above the chart to refine the view.',
      'Click "Export" to download the underlying figures as CSV or PDF.',
    ],
    tips: [
      'Forecasts use the dates you entered on each staff record — keep dates of appointment, confirmation and promotion accurate to keep the forecasts accurate.',
    ],
    mockup: 'reports',
  },
  {
    id: 'tasks',
    title: 'Tasks',
    intro:
      'Tasks lets HR and administrators assign work items (e.g. "Review John Doe\'s promotion file by 30 June") to specific users and track completion.',
    steps: [
      'Open "Tasks" from the sidebar.',
      'Review your assigned tasks at the top, then tasks you assigned to others below.',
      'Click "New Task" to create one — choose the assignee, write a title, optional description, due date and priority.',
      'Click on a task to update its status (Open, In Progress, Done) or to add a comment.',
      'Tasks marked Done move to the "Completed" tab so the active list stays focused.',
    ],
    tips: [
      'Only users with the Assign Tasks permission can create tasks for other users — everyone can see and update tasks assigned to them.',
    ],
    mockup: 'tasks',
  },
  {
    id: 'audit',
    title: 'Audit Trail',
    intro:
      'Every create, edit, delete, login, permission change and password reset is recorded in the Audit Trail. The trail cannot be edited from the UI and is the system\'s single source of truth for "who did what, when".',
    steps: [
      'Open "Audit Trail" from the sidebar (requires the View Audit permission).',
      'Use the filters at the top to narrow by user, action type, date range, or affected staff member.',
      'Click on an entry to expand it and see the full before/after diff for record changes.',
      'Click "Export" to download the filtered audit log as CSV for record-keeping.',
    ],
    tips: [
      'Auditors typically have read-only access to the trail and nothing else — this is intentional and supports independence.',
    ],
    mockup: 'audit',
  },
  {
    id: 'users',
    title: 'User Management (Super Administrator)',
    intro:
      'The User Management page is where the Super Administrator creates accounts, assigns roles, sets per-user permissions, resets passwords, deactivates users, and removes accounts. Only the Super Administrator can open this page.',
    steps: [
      'Open "User Management" from the sidebar.',
      'Click "Create User" — enter name, email, department, role, and an initial password.',
      'Choose a role (Super Administrator, Administrator, HR Officer, Department Head, Auditor, Staff). The role automatically applies its permission preset.',
      'Optionally adjust individual permissions for that user using the permission checkboxes — this overrides the role preset for them only.',
      'Click "Save". The new user can now sign in with the email and password you set.',
      'Click the pencil icon on an existing row to edit a user, the key icon to reset their password, and the toggle to deactivate or reactivate them.',
      'Click the trash icon to permanently remove a user. The Super Administrator account cannot be removed and cannot be demoted.',
    ],
    tips: [
      'Always assign the least-privileged role that lets a user do their job. Use individual permission overrides sparingly.',
      'When an officer leaves the organisation, deactivate the account first; only delete it after the audit retention period has passed.',
    ],
    mockup: 'users',
  },
  {
    id: 'settings',
    title: 'Settings & Personal Profile',
    intro:
      'Settings holds your personal preferences (name, contact, password change) and — for Administrators — system-wide configuration such as default Grade Level steps and retirement age.',
    steps: [
      'Open "Settings" from the sidebar (also accessible from the profile menu).',
      'Update your name, contact details, or profile picture in the Profile tab.',
      'Use the Security tab to change your password. You will need to enter your current password.',
      'Administrators can use the System tab to adjust defaults applied across all staff records.',
    ],
    tips: [
      'Change your password every 90 days or sooner if you suspect it has been seen by anyone else.',
    ],
    mockup: 'settings',
  },
  {
    id: 'security',
    title: 'Security & Best Practice',
    intro:
      'A few habits make the difference between a system that protects staff data and one that leaks it. Please follow these whenever you use the application.',
    steps: [
      'Never share your password — even with a colleague filling in for you. Ask the Super Administrator to create a separate account instead.',
      'Sign out (profile menu → Logout) when you step away from your computer, especially in shared offices.',
      'Use the eye icon on the login page only when you are sure no one is shoulder-surfing.',
      'Report suspicious activity (entries you do not recognise in the Audit Trail, unexpected emails about your account) to the Super Administrator immediately.',
      'Keep your browser updated. The application uses modern web security features that older browsers do not support.',
    ],
    tips: [
      'The system auto-signs you out after 30 minutes of inactivity. This is a feature, not an inconvenience.',
    ],
    mockup: 'security',
  },
];
