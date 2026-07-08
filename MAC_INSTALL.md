# Installing CCA Staff Biodata on a Mac

The Mac app works exactly like the Windows one — it just needs a few extra
clicks the **first time**, because the build is not yet notarised by Apple (the
free distribution path). After the first launch it opens normally, and future
updates install themselves automatically with no prompts.

---

## Step 1 — Download the right version for your Mac

Click the  **Apple menu → About This Mac** and look at the chip/processor:

| What you see | Download this file |
| --- | --- |
| **Chip: Apple M1 / M2 / M3 / M4** (Apple Silicon) | `CCA.Staff.Biodata_<version>_aarch64.dmg` |
| **Processor: Intel** | `CCA.Staff.Biodata_<version>_x64.dmg` |

Get it from the latest release:
**https://github.com/ifetiwa/CCA-STAFF/releases/latest**

> ⚠️ Downloading the wrong architecture is the most common reason the app "won't
> open." If unsure, re-check **About This Mac** first.

---

## Step 2 — Install

1. Double-click the downloaded `.dmg` file.
2. In the window that opens, **drag the "CCA Staff Biodata" icon onto the
   Applications folder**.
3. Eject the disk image (drag it to the Trash, or click the ⏏ next to it in
   Finder).

---

## Step 3 — First launch (do this once)

Open the app from your **Applications** folder (not from the dmg window).
macOS will block it the first time. Use **one** of these:

### Method A — the reliable one (all macOS versions)

1. Open **System Settings → Privacy & Security**.
2. Scroll down to the message *"CCA Staff Biodata was blocked…"* and click
   **Open Anyway**.
3. Confirm with your password / Touch ID, then click **Open**.

### Method B — right-click (macOS Ventura and earlier)

1. In Applications, **right-click** (or Control-click) **CCA Staff Biodata**.
2. Choose **Open**, then **Open** again in the dialog.

You only do this **once per Mac**. Every launch afterwards is a normal
double-click.

---

## If you see *"…is damaged and can't be opened"*

This is just the macOS quarantine flag on an unsigned app — the file is **not**
actually damaged. Clear it:

1. Open **Terminal** (Applications → Utilities → Terminal).
2. Paste this and press **Return**:
   ```bash
   xattr -cr "/Applications/CCA Staff Biodata.app"
   ```
3. Open the app normally.

---

## Updates

Once installed, the app **checks for updates on launch** and updates itself in
the background. You will **not** need to repeat any of the steps above for
future versions.

---

## Want a one-click install with no warnings?

The warnings above exist only because the app is unsigned. Notarising it through
the **Apple Developer Program** ($99/year) removes them entirely — the app then
installs with a normal double-click. Ask the maintainer if you'd like that set
up.
