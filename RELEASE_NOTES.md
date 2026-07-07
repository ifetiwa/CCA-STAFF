## CCA Staff Biodata v0.3.4

### Dashboard
- **Cards are now clickable** and jump straight to the real, filtered list behind each number — Total Staff, Due for Promotion, Due for Retirement, and Pending Review.
- Replaced the placeholder "Updated This Month" tile with a real **Pending Review** count.
- **Fixed the staff count occasionally dropping from the full roster to ~1,000** — the roster now loads reliably (each page is retried, and a partial load can never overwrite a complete one).

### Staff Management
- New **Duty Station** filter listing every posting location.
- **Bulk-select → Export to Excel**: tick staff and export just the selection (with Duty Station, PFA, RSA PIN, NHIS, NHF, and more).

### Reports & Analytics
- **Redesigned summary cards** — the analytics cards now use one consistent, responsive grid (matching the dashboard) with colour-coded tones, so the page looks clean and professional on any screen size.
- **Promotion figures now reconcile.** The Reports "Promotion Windows" only count officers whose review falls in the next 12 months, so they match the dashboard's **Due for Promotion** total. Officers who are already **overdue** are shown as their own clearly-labelled figure instead of being folded into the next window.
- **New summary cards:** Due for Promotion, Overdue for Promotion, Retiring ≤ 12 months, and Data Completeness.
- **New downloadable reports:** Overdue Promotions, Departmental Headcount, Grade Level Distribution, Gender & Diversity, State of Origin Spread, New Hires, Age & Service Profile, and Data Quality (missing fields). The Promotions Due export now shows a Status column and breaks the count into due vs overdue.

### App Updates
- New **Settings → App Updates** tab: check for a new version, read the release notes, and download + install it in place with a progress bar. The app restarts itself when finished — no reinstall needed.

### Records
- File numbers are now stored in their own field (previously mixed up with the confidential file reference), and the **Date of Present Appointment** is captured.
- Eight more fields from the nominal roll are now structured and searchable: title, permanent address, date confirmed, pay status, pension administrator, RSA PIN, sort code, and duty location.
