## CCA Staff Biodata v0.4.0

### Reports & Analytics — "Awaiting Review"
- The promotion status previously labelled **Overdue** is now the friendlier
  **Awaiting Review** throughout Reports & Analytics.
- The **Awaiting Review** tile is now **clickable** — it expands an inline list
  of every officer whose promotion review date has already passed (Staff ID,
  name, department, designation, grade, review-due date and days past due).
- That list can be **downloaded as an Excel (.xlsx) file** with one click.

### New staff status — STOP PAY
- **STOP PAY** is now available as a staff status (alongside Active, Pending,
  On Leave, etc.) and shows as a red badge. Existing statuses are unchanged.

### Faster loading
- Server responses are now **gzip-compressed**, so the staff list and other
  large data pulls download roughly 8–10× smaller and load noticeably faster.

## CCA Staff Biodata v0.3.9

### Signatures now display
Fixed a mapping bug where scanned **signatures** were uploaded and stored but
never shown. They now appear on the staff **detail page**, the profile **PDF
export**, and the **edit form** preview (photos were already working).

### All Staff list — new sort & filter options
- **Sort by grade level** — two new buttons sort the list by grade level, either
  **highest → lowest** (GL High–Low) or **lowest → highest** (GL Low–High).
  Within the same grade, names stay alphabetical.
- **Photo filter** — a new *Photo* filter lets you show **only staff with a
  passport photo** (or only those without), handy for spotting records that
  still need an image.
