# Little Attendance

Recovered Little Attendance v4 working build, organized for GitHub Pages and reusable attendance themes.

## Current structure
- `index.html` — app shell
- `app.css` — app styling
- `app.js` — roster, classroom, theme library, attendance logic
- `themes/apple-orchard/` — portable Apple Orchard theme package

The recovered v4 originally embedded large artwork directly in one HTML file. This repository-ready copy externalizes those references so the source stays maintainable. Apple Orchard is now stored as a reusable theme package so it can be shared with Little Classroom/commercial builds.

## Run checks

Requires Node.js 22 or newer. Run `npm ci`, then `npm run check`.
For browser-engine checks, run `npx playwright install chromium` and
`npm run test:browser`. Set `BROWSER=webkit` after installing WebKit to test
that engine. CI runs both engines with fictional QA rosters on localhost;
it does not access the deployed classroom or deploy the branch.

## Add a class list

In **My Classroom**, choose **Paste a list** next to **Add a Friend**.
Paste one name per line and review the count and preview, then choose
**Add friends to class**. Blank lines and leading/trailing spaces are ignored.
Names are added at the end; existing children, their stable IDs, attendance
and undo history remain unchanged. Cancel or Escape leaves the class as it was.
Individual add/edit controls are still available.

The list must fit the existing limit of 30 friends, with at most 40 characters
per new name. Over-limit lists are blocked as a whole; no names are silently
truncated or partially added. Matching names are marked for review and require
an explicit checkbox before adding. Every line remains a separate child,
including two children who share a name. Nothing is uploaded by pasting a list.
If browser storage fails, the added friends remain in the current session with
a visible **Not saved** warning; keep the tab open until saving works again.

## Saved-classroom upgrade

This repair retains `littleAttendanceCleanV4` as the browser storage key.
Each roster entry now has a stable `id` and `name`; present and undo entries
refer to that ID, so spelling fixes and roster moves do not change attendance.
Legacy roster positions are converted in memory on load. The exact original
saved text is retained under `littleAttendanceCleanV4_beforeStableIds` before
the first migrated save. Loading the app alone does not rewrite saved data.
An existing backup is never replaced. Duplicate names remain separate children.

Unreadable or unsupported saved data is left untouched. Storage failures show
a persistent warning and retain changes in the open session. A stale tab is
prevented from overwriting a newer saved classroom; reload it before continuing.
This is conflict protection, not multi-device or multi-tab synchronization.
The original classroom is not uploaded by these changes.

For a rollback to the older positional build, retain both stored values and
restore the pre-upgrade backup in the browser before using that build. The old
build does not understand the stable-ID schema. Any edits made after the backup
would need to be reconciled before such a rollback; do not blindly replace data.

## Repair scope

- Restore the original approved dashboard image without changing its pixels,
  with named navigation available if the image is delayed or unavailable
- Let taps pass through empty Apple Orchard layers to the child buttons
- Preserve attendance and undo for unaffected children during roster changes
- Render saved child names as literal text, including markup-like names

All 19 catalog entries and existing theme artwork remain. This is not a
commercial release approval. Dated attendance, licensing/entitlements, privacy
instructions, full offline support and broad device/accessibility certification
remain separate release work. No backend, account, payment or launch work is
included here.
