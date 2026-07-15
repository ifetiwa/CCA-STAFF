## CCA Staff Biodata v0.5.6

### All designations now show (and adding them works)
The designation picker was only showing the **first 25** designations, so most of
the ~291 (including "Hon. Justice") were hidden — and trying to re-add a hidden one
failed as a "duplicate". The lists (designations, grade levels, departments,
duty stations) now load **in full**. Adding a designation also works from any app
version now.

### Designation is optional
The **Designation** field on the Add/Edit Staff form is **no longer required**.

## CCA Staff Biodata v0.5.5

### Photo & signature uploads now save
Fixed a bug where manually uploading a passport photo or signature (on Add/Edit
Staff) silently failed to save — uploads were being sent in the wrong format. They
now upload and appear on every device.

### Staff ID no longer changes on edit
Fixed a serious bug where editing a staff member generated a **new Staff ID**
(e.g. `CCA/2026/…`). The **Staff ID now always mirrors the File Number** and never
changes on edit.

### Search by qualification
The All-Staff search box now also matches by **qualification** (degree, school,
etc.), alongside name, Staff ID, email and designation.

### Archived staff move to the bottom
Archived (inactive) staff now sort to the **bottom** of the All-Staff list in
every sort mode.

### Arrange the Judges list
Super Admins and Admins can now **rearrange the Judges** page with up/down arrows
— the chosen order is saved and shown to everyone.

## CCA Staff Biodata v0.5.4

### Two more judges added
Two Judges of the Customary Court of Appeal — **Hon. Justice Unwana Sam Ubom**
and **Hon. Justice Mohammed Boyi Marafa** — have been added and now appear on
the **Judges** page (order: 4, 007, 09, 10). Judge Ubom's passport photo is
included.

### Tidier staff list
The separate Judges panel that used to sit at the bottom of the All-Staff list
has been removed now that **Judges** has its own menu page. Judges still appear
as normal rows within the staff list.

## CCA Staff Biodata v0.5.3

### Judges now have their own page
A **Judges** item has been added to the left-hand menu. It opens a dedicated
page listing every judge, with an **Add Judge** button that takes you straight
to the staff form with the role pre-selected. Judges also still appear in the
main staff list.

## CCA Staff Biodata v0.5.2

### Staff list is now numbered
Every row in the All-Staff list now has a plain **serial number** (1, 2, 3 …) in
its own column — a simple count of the rows, not tied to the Staff ID or file
number.

### New default order — leadership first
The list now opens in a **Default** order that puts the court's leadership at the
top, starting with the **Chief Registrar**, followed by the Directors and Heads
in the agreed sequence. Everyone else follows by **grade level, highest to
lowest**. The A–Z, Z–A and grade-level sort buttons are still there.

### Judges
- Officers can be marked with an **Organizational Role** (Chief Registrar,
  Director, Deputy Director, Head of Department, Head of Unit, or **Judge**) on
  the Add/Edit Staff form.
- A dedicated **Judges** section now appears below the staff list. Judges also
  remain in the main staff list.

### Adding designations now works
Fixed a bug that stopped new **designations** from being added from the admin
section (the save silently failed). You can now add them normally.

## CCA Staff Biodata v0.5.1

### Staff photos from the ID cards
Passport photos (and, where missing, signatures) were imported from the scanned
staff ID cards for **212 more officers**, each matched to the right record by the
P/No printed on the card. They appear on every device after the update.

### Correct staff count on every device
The app now shows the **true roster total (1,911)** everywhere. Some PCs were
showing inflated numbers (e.g. 1,929 or 1,922) because their local copy still
held test records that had since been removed on the server. On the next sign-in
the app does a **one-time clean refresh** — it rebuilds its local copy to match
the server exactly, dropping any leftovers. (Behind this: duplicate records were
removed on the server and one officer's ID was corrected, so the database now
matches the nominal roll exactly.)

### Duty Station in the staff list
The All-Staff list now shows each officer's **Duty Station** column (in place of
the Retirement date, which is still on the profile, in Reports and in exports).

## CCA Staff Biodata v0.5.0

### Changes now appear on every device automatically (offline-first sync)
The app now keeps a full copy of the staff records **on each PC** and syncs with
the server in the background. What this means for you:

- **Edits propagate across devices.** When someone adds or updates a staff
  member on one PC, it now appears on the other PCs within about a minute — no
  more logging out and back in to see other people's changes.
- **It works offline.** The app reads instantly from the on-device copy and
  keeps working with no internet; your changes are queued and sent automatically
  once you're back online.
- **Photos sync too.** Passport photos and signatures attached to a record
  upload in the background and then show on every device.
- **Faster and lighter.** Instead of re-downloading the whole 1,900-person
  roster on every launch, the app now pulls only what changed since last time.

### Duty Station now shows on the staff profile
Fixed the **Duty Station** field appearing blank on a staff member's detail page
even though the data was present. It now displays correctly everywhere.

*(No action needed — just install this update. The first launch does a one-time
full sync, then only changes are exchanged after that.)*

## CCA Staff Biodata v0.4.3

### Stay signed in across devices
Fixed a bug where signing in on one device (e.g. the web app) would sign you
out of another (e.g. the desktop app) — leaving it stuck with no data and
bouncing you back to the login screen. Your session now stays valid across
devices. *(This fix is applied on the server; you may just need to sign in once
more after it goes live.)*

### Windows release pipeline
The macOS build was removed from the release pipeline for now — a stuck macOS
build was stalling releases for hours. Windows releases are unaffected and now
publish promptly again.

## CCA Staff Biodata v0.4.2

### Dashboard shows the real numbers on login
Fixed the dashboard briefly flashing a placeholder count (e.g. **8** demo rows,
or a stale **1000**) before updating to the real total. The app no longer seeds
the screen with demo/stale data: it caches the **full real roster** in a
slimmed form that fits in storage, so on startup it reads the true figures
immediately and then refreshes from the database in the background. (The old
cache silently exceeded the storage limit on the full roster, which is what left
the stale number behind.)

## CCA Staff Biodata v0.4.1

### Now available for macOS
- The desktop app now ships for **macOS** — both **Apple Silicon** (M1–M4) and
  **Intel** Macs — alongside Windows. Grab the `.dmg` for your Mac from the
  release page.
- **First launch on Mac:** because the build is not yet notarised by Apple,
  macOS may say the app is from an unidentified developer. See the step-by-step
  [Mac install guide](MAC_INSTALL.md) — in short, approve it once via
  **System Settings → Privacy & Security → Open Anyway** (or right-click →
  **Open**), and it launches normally thereafter.
- No functional changes for existing Windows users — this release only adds the
  Mac builds.

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
