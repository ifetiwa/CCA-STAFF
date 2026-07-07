## CCA Staff Biodata v0.3.6

### Staff Management
- **Rows-per-page selector** — choose to view **100, 500, 1000, or 2000** staff per page.
- **The staff table now scrolls sideways** on smaller screens, so the **View / Delete** action buttons are always reachable instead of being cut off.

### Fixes
- **Pension Fund Administrator (PFA) now displays correctly.** On staff profiles the PFA was showing a dash even when a value was on record — the profile view was reading the wrong field. It now shows the stored administrator (e.g. *Premium Pension Limited*).
- **Editing a staff member's PFA now saves.** The Add/Edit form was sending the PFA under the wrong field name, so changes were silently dropped on save. It now persists to the database.
- These fixes also flow through to the **Duty Station** and **Grade Level** filters and the bulk Excel export, which read the same records.

> If a profile still shows a dash after updating, open the record once so the app re-syncs it from the server.
