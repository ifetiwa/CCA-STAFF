# Pre-Handover Testing Checklist
## Django Staff Biodata Management System — Customary Court of Appeal

**Tester:** ______________________  **Date:** ______________________
**Build/Version:** ______________________  **Environment:** ☐ Local ☐ Staging ☐ Production

**Result legend:** P = Pass · F = Fail · N/A = Not Applicable · Add defect ID in Notes if F.

---

## 1. Authentication & Session Management

| Test ID | Description | Expected Result | P/F | Notes |
|---------|-------------|-----------------|-----|-------|
| AUTH-01 | Login with valid Admin credentials | Redirects to admin dashboard; user name shown in header | | |
| AUTH-02 | Login with valid HR Officer credentials | Redirects to HR dashboard; menu limited to HR scope | | |
| AUTH-03 | Login with valid Viewer credentials | Redirects to read-only dashboard; no edit/delete buttons visible | | |
| AUTH-04 | Login with invalid username | Error: "Invalid username or password"; no system info leaked | | |
| AUTH-05 | Login with valid username + wrong password | Same generic error; failed attempt counter increments | | |
| AUTH-06 | Login with empty username/password fields | Client-side and server-side validation errors shown | | |
| AUTH-07 | Failed login lockout — 5 consecutive failures | Account locked for configured cooldown (e.g., 15 min); admin alerted | | |
| AUTH-08 | Locked account — attempt during cooldown | Login blocked even with correct password; message "Account temporarily locked" | | |
| AUTH-09 | Admin unlock locked account | Account immediately usable; reset event in audit log | | |
| AUTH-10 | Logout from authenticated session | Session destroyed; redirect to login; back button does not restore session | | |
| AUTH-11 | Session timeout — idle for configured duration (e.g., 30 min) | Next request redirects to login with "Session expired" notice | | |
| AUTH-12 | Concurrent session — same user logs in from second browser | Behavior matches policy (allow / kick previous); documented in user guide | | |
| AUTH-13 | "Remember Me" if implemented | Persistent cookie respects expiry; clearing cookie forces re-login | | |
| AUTH-14 | Password reset flow | Reset link emailed; link single-use; expires after configured window | | |
| AUTH-15 | Password complexity enforcement | Rejects weak passwords (min length, mixed case, digits, symbols) | | |
| AUTH-16 | Role-based access — Viewer attempts /staff/delete/<id> direct URL | 403 Forbidden; attempt logged in audit trail | | |
| AUTH-17 | Role-based access — HR Officer attempts user management URL | 403 Forbidden | | |
| AUTH-18 | Role-based access — Admin accesses all modules | All menus visible and functional | | |
| AUTH-19 | CSRF token present on all POST forms | Tampered/missing CSRF token rejected with 403 | | |
| AUTH-20 | Login over HTTPS only (production) | HTTP redirects to HTTPS; Secure & HttpOnly cookies set | | |

---

## 2. Staff Management (CRUD)

| Test ID | Description | Expected Result | P/F | Notes |
|---------|-------------|-----------------|-----|-------|
| STAFF-01 | Create staff — all required fields valid | Record saved; success message; redirected to staff detail page | | |
| STAFF-02 | Create staff — missing required field (e.g., DOB) | Form rejects; error indicator beside field | | |
| STAFF-03 | Create staff — duplicate Staff ID/File No | Validation error: "Staff ID already exists" | | |
| STAFF-04 | Create staff — invalid date (DOB in future, employment > today) | Rejected with clear message | | |
| STAFF-05 | Create staff — DOB makes hire age < 18 or > 60 | Warning or rejection per business rule | | |
| STAFF-06 | Read — open staff profile | All fields render correctly; computed fields (age, years of service) accurate | | |
| STAFF-07 | Read — staff list pagination | Page navigation works; counts correct; sort persists across pages | | |
| STAFF-08 | Update — edit name, grade, department | Changes saved; old/new values captured in audit log | | |
| STAFF-09 | Update — invalid value (e.g., non-numeric in salary) | Rejected; record unchanged | | |
| STAFF-10 | Delete — soft-delete a staff record | Record marked inactive; hidden from default lists; recoverable | | |
| STAFF-11 | Delete — hard delete (Admin only) | Confirmation prompt; record removed; audit entry created | | |
| STAFF-12 | Delete — non-Admin attempts delete | Button hidden in UI; direct URL returns 403 | | |
| STAFF-13 | Photo upload — valid JPG ≤ 2 MB | Photo saved and displayed on profile | | |
| STAFF-14 | Photo upload — valid PNG | Accepted and displayed | | |
| STAFF-15 | Photo upload — oversized file (> max size) | Rejected with size limit message | | |
| STAFF-16 | Photo upload — disallowed type (.exe, .pdf, .svg with script) | Rejected; MIME and extension both validated | | |
| STAFF-17 | Photo upload — replace existing photo | Old file removed from storage or archived; new photo shown | | |
| STAFF-18 | Bulk import — valid CSV with 50 rows | All rows imported; success summary shown (50 created, 0 errors) | | |
| STAFF-19 | Bulk import — CSV with mixed valid/invalid rows | Valid rows imported; invalid rows reported with row number + reason; downloadable error report | | |
| STAFF-20 | Bulk import — wrong file format (.txt, .docx) | Rejected with format guidance | | |
| STAFF-21 | Bulk import — duplicate Staff IDs within file | Duplicates flagged; not imported twice | | |
| STAFF-22 | Bulk import — duplicate against existing DB records | Skipped or updated per documented behavior; logged | | |
| STAFF-23 | Bulk import — Excel template download | Template downloads with correct column headers and sample row | | |
| STAFF-24 | Bulk import transaction integrity | Failure mid-import does not leave partial data (or partial behavior is documented) | | |

---

## 3. Auto-Calculations — Promotion & Retirement

**Rules under test:**
- **Promotion eligibility:** 3 years on current grade since last promotion date.
- **Retirement:** earlier of (a) age 60 from DOB, or (b) 35 years of service from first appointment date.
- **Today's reference date for verification:** 2026-05-16.

### 3a. Sample staff records (create or use existing)

| Sample | Name | DOB | First Appt | Last Promotion | Expected Promotion Due | Expected Retirement Date | Driver (Age 60 / 35-yr) |
|--------|------|-----|------------|----------------|------------------------|--------------------------|-------------------------|
| S1 | Test Staff A | 1970-01-15 | 1995-06-01 | 2023-06-01 | 2026-06-01 | 2030-01-15 | Age 60 (60 reached 2030-01-15 before 35-yr 2030-06-01) |
| S2 | Test Staff B | 1980-03-10 | 1992-04-01 | 2020-04-01 | 2023-04-01 (overdue) | 2027-04-01 | 35-yr rule (35-yr 2027-04-01 before age 60 2040-03-10) |
| S3 | Test Staff C | 1975-12-20 | 2005-08-15 | 2024-08-15 | 2027-08-15 | 2035-12-20 | Age 60 (35-yr 2040-08-15 after age-60 2035-12-20) |
| S4 | Test Staff D | 1990-07-05 | 2015-01-10 | 2025-01-10 | 2028-01-10 | 2050-01-10 | 35-yr rule (35-yr 2050-01-10 before age-60 2050-07-05) |
| S5 | Test Staff E | 1966-11-30 | 1990-02-01 | 2024-02-01 | 2027-02-01 | 2026-11-30 | Age 60 (35-yr 2025-02-01 already past; retirement effectively imminent — confirm override logic) |

### 3b. Test cases

| Test ID | Description | Expected Result | P/F | Notes |
|---------|-------------|-----------------|-----|-------|
| CALC-01 | Verify Promotion Due Date for S1 | System shows 2026-06-01 | | |
| CALC-02 | Verify Promotion Due Date for S2 | Shows 2023-04-01; flagged as **OVERDUE** | | |
| CALC-03 | Verify Promotion Due Date for S3 | Shows 2027-08-15 | | |
| CALC-04 | Verify Promotion Due Date for S4 | Shows 2028-01-10 | | |
| CALC-05 | Verify Promotion Due Date for S5 | Shows 2027-02-01 | | |
| CALC-06 | Verify Retirement Date for S1 | Shows 2030-01-15 (age 60 driver) | | |
| CALC-07 | Verify Retirement Date for S2 | Shows 2027-04-01 (35-yr driver) | | |
| CALC-08 | Verify Retirement Date for S3 | Shows 2035-12-20 (age 60 driver) | | |
| CALC-09 | Verify Retirement Date for S4 | Shows 2050-01-10 (35-yr driver) | | |
| CALC-10 | Verify Retirement Date for S5 | Shows 2026-11-30 (age 60 driver) | | |
| CALC-11 | Edit Last Promotion Date — promotion due recomputes | New due date = last promotion + 3 years; saved immediately | | |
| CALC-12 | Edit DOB — retirement date recomputes | Earlier of new age-60 vs 35-yr from first appt | | |
| CALC-13 | Edit First Appointment Date — 35-yr line recomputes | Retirement updates if 35-yr is the driver | | |
| CALC-14 | Years of Service display | (Today − first appt) shown in years and months, accurate | | |
| CALC-15 | Age display | Computed from DOB to today; updates after midnight on birthday | | |
| CALC-16 | Boundary — staff turning 60 today | Marked as retiring today; appears on retirement-due list | | |
| CALC-17 | Boundary — staff hitting 3-yr promotion mark today | Appears on promotion-due list | | |
| CALC-18 | Leap year DOB (Feb 29) | Retirement computes deterministically (document Feb 28 vs Mar 1 choice) | | |
| CALC-19 | Staff with no Last Promotion date (never promoted) | Promotion due = first appointment + 3 yrs (or per documented rule) | | |
| CALC-20 | Recompute job/cron — bulk recompute across all staff | All derived fields refreshed; runtime acceptable; no records corrupted | | |

---

## 4. Search & Filter

| Test ID | Description | Expected Result | P/F | Notes |
|---------|-------------|-----------------|-----|-------|
| SRCH-01 | Search by full name | Exact and partial matches returned | | |
| SRCH-02 | Search by partial name (3 letters) | Returns all containing the substring; case-insensitive | | |
| SRCH-03 | Search by Staff ID / File No | Exact match returns single record | | |
| SRCH-04 | Search by department name | All staff in department returned | | |
| SRCH-05 | Search with no results | "No records found" message; no error | | |
| SRCH-06 | Search with SQL injection payload (e.g., `' OR 1=1 --`) | Treated as literal string; no records leaked; attempt logged | | |
| SRCH-07 | Search with XSS payload (`<script>alert(1)</script>`) | Rendered as text, script does not execute | | |
| SRCH-08 | Filter by Department only | List filtered correctly | | |
| SRCH-09 | Filter by Grade Level only | List filtered correctly | | |
| SRCH-10 | Filter by Gender only | List filtered correctly | | |
| SRCH-11 | Filter by Employment Status (Active/Retired/On leave) | List filtered correctly | | |
| SRCH-12 | Combined filter — Department + Grade Level | Intersection only | | |
| SRCH-13 | Combined filter — Department + Promotion Due (this year) | Correct intersection | | |
| SRCH-14 | Combined filter — Retirement in next 12 months + Department | Correct subset | | |
| SRCH-15 | Clear filters button | All filters reset; full list returned | | |
| SRCH-16 | Search + filter combined | Search applies within filtered subset | | |
| SRCH-17 | Filter state persists on pagination | Page 2 retains filters | | |
| SRCH-18 | Export respects current filter/search | Exported file contains only filtered rows | | |

---

## 5. Notifications & Alerts

| Test ID | Description | Expected Result | P/F | Notes |
|---------|-------------|-----------------|-----|-------|
| NOTIF-01 | Promotion alert — staff with due date within 30 days | Appears on dashboard "Upcoming Promotions" widget | | |
| NOTIF-02 | Promotion alert — overdue promotion | Flagged red/highlighted on dashboard and staff list | | |
| NOTIF-03 | Promotion alert — email to HR (if enabled) | Email delivered with staff name, ID, due date | | |
| NOTIF-04 | Promotion alert — does NOT fire for already-promoted staff (last promo within 3 yrs) | Not in alert list | | |
| NOTIF-05 | Retirement alert — staff retiring within 6 months | Appears on "Upcoming Retirements" widget | | |
| NOTIF-06 | Retirement alert — staff retiring within 12 months | Appears with lower urgency styling | | |
| NOTIF-07 | Retirement alert — already-retired staff | Excluded from upcoming list; visible only in "Retired" filter | | |
| NOTIF-08 | Retirement alert — driver visible (Age 60 or 35-yr) | UI shows which rule triggers the date | | |
| NOTIF-09 | Notification badge count in header | Matches sum of unread alerts | | |
| NOTIF-10 | Mark notification as read | Removed from unread list; badge decrements | | |
| NOTIF-11 | Daily cron / scheduled job runs | Alerts recompute every day; no duplicates | | |
| NOTIF-12 | Editing staff date triggers re-evaluation | If new date moves staff into alert window, alert appears immediately | | |
| NOTIF-13 | Notification respects role | HR sees HR-relevant alerts only; Viewer sees none or read-only | | |

---

## 6. Audit Trail

| Test ID | Description | Expected Result | P/F | Notes |
|---------|-------------|-----------------|-----|-------|
| AUDIT-01 | Login event logged | Entry with username, timestamp, IP, success/failure | | |
| AUDIT-02 | Logout event logged | Entry with username, timestamp | | |
| AUDIT-03 | Failed login logged | Username attempted, IP, timestamp, reason | | |
| AUDIT-04 | Create staff logged | Action=CREATE, target=Staff:<id>, actor, before=null, after=full record | | |
| AUDIT-05 | Update staff logged with field-level diff | Old value and new value captured per changed field | | |
| AUDIT-06 | Delete staff logged | Action=DELETE, includes snapshot of deleted record | | |
| AUDIT-07 | Photo upload logged | Action=UPLOAD with file name, size, uploader | | |
| AUDIT-08 | Bulk import logged | Single batch entry + per-row outcomes accessible | | |
| AUDIT-09 | Report export logged | Action=EXPORT with report type, format, filters, user | | |
| AUDIT-10 | Permission change / role assignment logged | Old role → new role, actor, target user | | |
| AUDIT-11 | Audit log is append-only (no edit/delete from UI) | Edit/delete buttons absent; direct API attempts return 403 | | |
| AUDIT-12 | Audit log timestamps in correct timezone (Africa/Lagos) | Times match server clock and user expectation | | |
| AUDIT-13 | Audit log searchable/filterable by user, date, action | Filters return correct subset | | |
| AUDIT-14 | Audit log exportable (PDF/Excel) for admin review | Export contains all visible columns | | |
| AUDIT-15 | Unauthorized access attempt logged | 403 events captured with URL, user, IP | | |

---

## 7. Reports — PDF & Excel Export

| Test ID | Description | Expected Result | P/F | Notes |
|---------|-------------|-----------------|-----|-------|
| RPT-01 | Staff Directory — PDF export | PDF opens; CCA letterhead; all selected columns; pagination; page numbers | | |
| RPT-02 | Staff Directory — Excel export | .xlsx opens in Excel; correct column headers; data types preserved (dates, numbers) | | |
| RPT-03 | Promotion Due List — PDF | Filtered to upcoming/overdue; sorted by due date; signatory block present | | |
| RPT-04 | Promotion Due List — Excel | Same data; sortable; no merged-cell artifacts | | |
| RPT-05 | Retirement Due List — PDF | Includes driver column (Age 60 / 35-yr) and retirement date | | |
| RPT-06 | Retirement Due List — Excel | Same data; date column formatted as date, not text | | |
| RPT-07 | Departmental Headcount — PDF | Group totals and grand total accurate | | |
| RPT-08 | Departmental Headcount — Excel | Pivot-friendly format (one row per record or totals row clearly marked) | | |
| RPT-09 | Individual Biodata Sheet — PDF | One-page printable; photo embedded; all fields present | | |
| RPT-10 | Audit Log Report — PDF/Excel | Date range honored; user filter honored | | |
| RPT-11 | Report respects active filters on screen | Export = filtered view, not full DB | | |
| RPT-12 | Large export (300+ records) | Completes without timeout; file size reasonable | | |
| RPT-13 | Special characters (Yoruba/Igbo/Hausa names, apostrophes) | Render correctly in both PDF (font) and Excel (UTF-8) | | |
| RPT-14 | Empty result set export | Exports header-only file with a "No records" note rather than crashing | | |
| RPT-15 | Concurrent exports by two users | Both succeed; files isolated | | |
| RPT-16 | File name convention | Includes report name + timestamp (e.g., `StaffDirectory_2026-05-16.pdf`) | | |

---

## 8. Security

| Test ID | Description | Expected Result | P/F | Notes |
|---------|-------------|-----------------|-----|-------|
| SEC-01 | Unauthenticated access to /dashboard, /staff, /reports | Redirect to /login | | |
| SEC-02 | Direct URL access to other user's edit page when unauthorized | 403 Forbidden | | |
| SEC-03 | IDOR — change `?staff_id=` to another record | Authorization re-checked server-side; blocked if not permitted | | |
| SEC-04 | SQL injection on search and login fields | Parameterized queries; no DB error leaked | | |
| SEC-05 | XSS — script in staff name/address fields | Escaped on render; no execution | | |
| SEC-06 | CSRF — cross-site POST to /staff/delete | Rejected without valid token | | |
| SEC-07 | File upload — disguised executable (.exe renamed .jpg) | Rejected via MIME sniffing / content inspection | | |
| SEC-08 | File upload — SVG with embedded script | Rejected or sanitized | | |
| SEC-09 | File upload — path traversal in filename (`../../etc/passwd`) | Filename sanitized; saved with safe name | | |
| SEC-10 | File upload max size enforced server-side (not just client) | Server returns 413 / clear error | | |
| SEC-11 | Uploaded files served with `Content-Disposition: attachment` or safe inline type | Browser does not execute as HTML | | |
| SEC-12 | Session cookie flags — HttpOnly, Secure, SameSite | Verified via browser devtools | | |
| SEC-13 | Session expiry forces re-login | After timeout, protected pages redirect to login | | |
| SEC-14 | DEBUG = False in production settings | No stack traces shown to users; generic error pages | | |
| SEC-15 | SECRET_KEY not committed / not default | Confirmed in deployment environment | | |
| SEC-16 | ALLOWED_HOSTS restricted | Requests with foreign Host header rejected | | |
| SEC-17 | Admin URL not at default `/admin/` (optional hardening) | Confirm per deployment policy | | |
| SEC-18 | Password hashing uses Django default (PBKDF2/Argon2) | No plaintext or weak hashes in DB | | |
| SEC-19 | HTTPS enforced; HTTP redirected | Confirmed in production env | | |
| SEC-20 | Security headers present (X-Frame-Options, X-Content-Type-Options, CSP) | Confirmed in response headers | | |
| SEC-21 | Backup files / .env / .git not accessible via web | 404 on direct URL | | |
| SEC-22 | Rate limiting on login endpoint | Burst attempts throttled | | |

---

## 9. Performance (Target: 300+ Staff Records)

**Setup:** Seed database with ≥ 300 staff records (use bulk import or factory script). Record metrics under typical load.

| Test ID | Description | Expected Result | P/F | Notes (measured time) |
|---------|-------------|-----------------|-----|----------------------|
| PERF-01 | Login page load | < 1.5 s on broadband | | |
| PERF-02 | Dashboard load with 300+ records | < 3 s; widgets render asynchronously if heavy | | |
| PERF-03 | Staff list — default page (25 per page) | < 2 s | | |
| PERF-04 | Staff list — pagination next/prev | < 1.5 s | | |
| PERF-05 | Search query on 300 records | < 1.5 s | | |
| PERF-06 | Combined filter on 300 records | < 2 s | | |
| PERF-07 | Open single staff profile | < 1.5 s | | |
| PERF-08 | Bulk import of 100 records | < 30 s; progress feedback shown | | |
| PERF-09 | Bulk import of 300 records | < 90 s; no timeout | | |
| PERF-10 | PDF export of full staff directory (300 records) | < 15 s; file < 10 MB | | |
| PERF-11 | Excel export of full staff directory | < 10 s | | |
| PERF-12 | Audit log query (last 30 days) | < 2 s | | |
| PERF-13 | Concurrent users — 5 simultaneous logins | All succeed; no degradation > 50% | | |
| PERF-14 | Database query count per page (Django Debug Toolbar) | No N+1 patterns; < 20 queries on list pages | | |
| PERF-15 | Static assets cached (CSS/JS/images) | 200 on first load, 304 on reload | | |
| PERF-16 | Memory / CPU stable over 30-minute session | No leak observed in `top` / Task Manager | | |

---

## 10. Cross-Browser & UI Sanity (recommended add-on)

| Test ID | Description | Expected Result | P/F | Notes |
|---------|-------------|-----------------|-----|-------|
| UI-01 | Chrome (latest) — full flow | All pages render and function | | |
| UI-02 | Edge (latest) — full flow | All pages render and function | | |
| UI-03 | Firefox (latest) — full flow | All pages render and function | | |
| UI-04 | Mobile responsive (tablet/phone) | Menus collapse; tables scroll horizontally | | |
| UI-05 | Print preview of biodata sheet | Prints on A4 without cutoff | | |
| UI-06 | Court letterhead/branding visible on all reports | Confirmed | | |

---

## 11. Backup & Recovery (pre-handover sign-off)

| Test ID | Description | Expected Result | P/F | Notes |
|---------|-------------|-----------------|-----|-------|
| BAK-01 | Automated DB backup schedule configured | Cron/scheduled task exists; last backup < 24 hrs old | | |
| BAK-02 | Restore from backup to staging | Restored DB usable; record counts match | | |
| BAK-03 | Media (photos) backup included | Photos restored alongside DB | | |
| BAK-04 | Backup retention policy documented | Documented in handover pack | | |

---

## Sign-Off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Tester / QA | | | |
| Developer | | | |
| HR / End-User Representative | | | |
| Court IT Officer | | | |
| Project Sponsor (CCA) | | | |

**Overall status:** ☐ Approved for handover ☐ Approved with minor defects (list attached) ☐ Rejected — rework required

**Defect log reference:** ______________________
**Outstanding items / waivers:** ______________________
