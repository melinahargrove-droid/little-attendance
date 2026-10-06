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
that engine. CI runs both engines with fictional QA rosters in isolated browser
contexts. The visual-art check also opens the published Pages app with its own
fictional local roster and permits only the three exact public Fall artwork
URLs. It does not read a teacher's browser data or deploy the branch.

## Add a class list

In **My Classroom**, choose **Paste a list** next to **Add a Friend**.
Paste one name per line and review the count and preview, then choose
**Add friends to class**. Blank lines and leading/trailing spaces are ignored.
Names are added at the end; existing children, their stable IDs, attendance
and check-in history stay intact. The addition becomes the next Undo action.
Cancel or Escape leaves the class as it was.
Individual add/edit controls are still available.

The list must fit the existing limit of 30 friends, with at most 40 characters
per new name. Over-limit lists are blocked as a whole; no names are silently
truncated or partially added. Matching names are marked for review and require
an explicit checkbox before adding. Every line remains a separate child,
including two children who share a name. Nothing is uploaded by pasting a list.
If browser storage fails, the added friends remain in the current session with
a visible **Not saved** warning; keep the tab open until saving works again.

## School Bus and Attendance Controls

School Bus uses the recovered standalone artwork and its approved layout.
Waiting friends show their name and initials (or an existing embedded photo).
Arriving friends move into a fixed place on the bus; other friends stay put.
The scene uses the existing stable-ID attendance and undo state. Original art
and the locked layout JSON are byte-preserved; see `themes/school-bus/README.md`.
This release targets computers and classroom displays. Phone layouts are not
supported. Portrait captures remain in browser evidence to document that limit.

The homepage has two destinations: **Take Attendance** and **My Classroom**.
**Attendance Controls** lives inside My Classroom and remains available directly
on each attendance board, including Fall Leaves. It opens Undo, Reset, Full Screen
and dated-attendance options. It is not a protected teacher account or security
boundary. The approved two-card update uses `assets/home-two-actions.png` in the
same watercolor style. The authentic transparent One Little Teacher logo is a
separate, unchanged image so there is no rectangular backing. Both home actions
retain visible labels if the background cannot load. The old three-card source
remains archived as `assets/home-approved.png`.
Full Screen closes the controls menu before switching display modes. Unsupported
or rejected fullscreen requests show an explanatory message without changing
the classroom or attendance.

## Saved-classroom upgrade

This repair retains `littleAttendanceCleanV4` as the browser storage key.
Each roster entry now has a stable `id` and `name`; present and undo entries
refer to that ID, so spelling fixes and roster moves do not change attendance.
Legacy roster positions are converted in memory on load. The exact original
saved text is retained under `littleAttendanceCleanV4_beforeStableIds` before
the first migrated save. Loading the app alone does not rewrite saved data.
An existing backup is never replaced. Duplicate names remain separate children.

Unreadable or unsupported saved data is left untouched. Storage failures show
a persistent warning and retain changes in the open session. Detected stale tabs
are blocked from saving over a newer classroom. This is conflict detection, not
multi-device or multi-tab synchronization.
The original classroom is not uploaded by these changes.

If a save fails, the action's feedback says **Not saved** and **Try saving again**
retries the current session without repeating the action. The same warning and
retry are available inside open dialogs. Retrying checks for changes from other
tabs before writing, and never bypasses a conflict or unreadable saved data.
Unsaved classroom changes request the browser's standard warning before leaving
or reloading; browsers can suppress that warning, so it is not a backup.
Successful saving removes that navigation warning. Other-tab changes are flagged
when received or when the tab becomes active; the current session is never
automatically replaced. If both tabs have different changes, keep the unsaved tab
open to review them before reloading. This build holds one exclusive browser Web Lock
(named for the classroom storage key) for the editing tab. Other tabs are read-only.
Close the owner after its work is saved, then choose **Try editing** in another tab.
Before enabling edits, that tab compares the current saved bytes with its loaded
snapshot while holding the lock. A stale tab must be explicitly reloaded; the app
never replaces a board or pending form draft automatically. No lock is forcibly
taken, and unsaved owners retain ownership. Refresh/close releases the lock; a
restored page reacquires and validates it before editing.

A browser without Web Locks, an insecure page, or a rejected lock request stays
read-only with an explanation. Normal use requires HTTPS (localhost is suitable
for tests) and Web Locks support. Viewing the saved classroom/history remains
available. Close or reload tabs running an older, non-cooperating app version
before editing: older code cannot be controlled by this lock. Existing conflict
checks remain as an additional safeguard against external writers. This does not
provide cross-device synchronization. Local storage can still be lost when browser
data is cleared or the browser/device fails; this is not cross-device storage.

For a rollback to the older positional build, retain both stored values and
restore the pre-upgrade backup in the browser before using that build. The old
build does not understand the stable-ID schema. Any edits made after the backup
would need to be reconciled before such a rollback; do not blindly replace data.

## Repair scope

- Simplify the approved dashboard to two destinations, with the original logo
  and named navigation available if the image is delayed or unavailable
- Let taps pass through empty Apple Orchard layers to the child buttons
- Preserve attendance and undo for unaffected children during roster changes
- Render saved child names as literal text, including markup-like names

All 19 catalog entries and existing theme artwork remain. This is not a
commercial release approval. Licensing/entitlements, release privacy instructions, full offline support and broad
device/accessibility certification remain separate release work. Dated browser-local
attendance is described below and is not a cloud backup. No backend, account, payment or launch work is
included here.

## Daily attendance and optional history

Attendance Controls now shows the board's date and a **Start today…** action.
When the saved date differs from this device's local date, the app asks **Start
a new day?** It also checks an open board after midnight and when returning to
the tab. **Keep current attendance** or Escape leaves everything in place for
this session; opening the app again on a different date asks again. No attendance
is silently cleared. Legacy and empty undated boards stay undated until an
explicit start; records saved before that are labeled **Undated attendance**.

**Save attendance history** is off by default and remembers your choice after a
successful save. On saves each current record automatically, including attendance
changes and Undo. There is no daily save question. Off stops record updates and
keeps existing records unchanged. **View saved attendance** opens the local
records and **Print record** prints only their date, student names and Here/Not
here yet status. Photos and extra student profile fields are excluded. Names in
completed records remain as saved even when the current roster changes. A repeated
calendar date gets a separate record, so clock/timezone changes cannot overwrite
another day's record with the same date. No retention or archive deletion controls
are included in this chunk.

Starting a new day preserves the outgoing record when history is on, clears the
board and old Undo actions, and writes that transition as one localStorage value.
If a backup, storage read, detected conflict or write fails, the old in-session
board and saved bytes are retained; retry saving and explicitly start again.
The exclusive editing lock serializes cooperating same-origin tabs sharing the
classroom key. This is browser-local storage, not a backup or cloud sync;
clearing browser data can erase your classroom and saved history. Printed records
are separate copies under your control.

**Reset** means clear this board now, keeping its current date. It asks before
clearing and can be undone. **Undo** now also restores a removed student with the
same ID, complete local profile, former position and attendance. It leaves other
roster/settings changes intact, and refuses to overwrite a reused ID or exceed
30 students. Repeated resets of an empty board do not hide the previous recovery.
Individual additions and pasted additions can also be undone, removing only their
created IDs. This lets a full class undo a replacement addition before restoring
the previous removed student. Later check-ins, resets and removals unwind first;
other children and their edits are left alone. Recovery actions are saved with the classroom and survive reload; starting a new
day clears them. The existing check-in Undo order is retained.

The data schema is now 2. The exact pre-upgrade saved text is backed up once under
`littleAttendanceCleanV4_beforeAttendanceDays` before the first upgraded save;
the original stable-ID migration backup is also retained. Loading alone never
writes. Invalid or unsupported day/history fields block saving rather than being
silently discarded. To roll back to schema 1, retain both saved values and manually
reconcile post-upgrade changes before restoring the pre-days backup. The schema 1
safety build refuses schema 2; the older positional build is not compatible either.
Never restore a backup blindly over newer attendance.

`npm run check` includes synthetic regressions for these behaviors, with fictional
rosters only. The test files run serially to avoid concurrent DOM-suite memory
pressure. Browser-engine scenarios additionally cover physical controls, midnight,
modal retry, keyboard cancellation, history scrolling, and 30-name print pagination.
The single-writer suite additionally uses native Web Locks in two same-origin
pages sharing one browser storage partition, with broadcast-triggered concurrent
edit attempts, refresh, close/reacquisition, dirty-owner protection, stale drafts,
unsupported/rejected APIs and async file-read ownership changes. Chromium has an
actual renderer-crash release test; WebKit covers normal close but does not claim
renderer-crash coverage. Synthetic DOM tests use a deterministic lock helper,
with old conflict tests deliberately retaining non-cooperating legacy-writer
models. Those mocks do not establish browser serialization.

Run both engines before claiming the candidate is browser-verified. OS print
dialog lifecycle is mocked; Chromium PDF generation and print CSS are separate
checks. Original Apple and School Bus artwork and locked layouts remain unchanged.
The homepage artwork is the separately approved two-card update. This branch
does not merge or deploy the app.

## Bounded visual repairs

Apple Orchard keeps its original art, student coordinates and Close hit area.
A visible **Close** label appears when the viewport crops out the painted X;
the original X is retained at matching wide proportions. Keyboard focus remains
visible. Sidebar branding uses intentional **One Little Teacher** text instead
of an empty image URL.

Fall Leaves uses the exact supplied artwork and approved layout arrays. The
waiting and Here PNG mappings, canopy/pile coordinate spaces, photo/name
alignment and live count positions follow the supplied Fall Leaves handoff.
The original 80px vertical counter offset scales with the viewport height,
anchored to its 720px layout, to avoid overlapping the painted labels on taller
screens. This is a correction to the literal fixed-pixel source rule.
The old tracing masks are omitted because they exclude several approved slots
and can hide a child completely. No slots, scales or piece sizes are changed.
All five class-size buckets are checked at 1024×768, 1280×720 and 1671×941,
including real taps inside photos, arrivals, Undo and roster renaming. The three
existing external image URLs remain dependencies; they are not an offline cache.

## Recovered theme renderers (review candidate)

Pumpkin Patch, Halloween and Our Friends retain the recovered v6.0 art and fixed
roster-slot geometry. The thirteen image files have SHA-256 provenance in
`themes/restored-source-manifest.json`; original source is
`Little_Attendance_v6_0_Our_Friends_Free_Theme.zip`.
The Pumpkin crate front, Halloween bucket mask, and Our Friends box front remain
above the Here pieces. Only the tapped child's composite moves; other slots do
not compact. Names use literal text and photos accept only embedded raster data.
Attendance Controls, Undo, Reset, dated history and the editing lock are the
current application's shared controls. Animations cannot queue delayed state
writes after navigation or reset. Missing artwork falls back to the usable list.

This restoration does not import the historical build's ownership migration or
change the current default selection. Historically Our Friends was included
free and selected by default, while that build also auto-unlocked the other
finished themes. That commercial behavior is not assumed here. Newly cataloged
entries use the existing ownership mechanism, so absent entitlements appear
locked. This is a review candidate: settle intended Our Friends availability
before publication. No prices, purchases or entitlements are created by this PR.

Computer/classroom-display support remains the target. Browser tests use only
fictional rosters. Overlapping Here piles preserve keyboard access to all pieces.

Source reconciliation: Pumpkin uses the original clean 1731 × 909 background from the bundled HANDOFF/source (0.16.39 onward). The top-level v6.0 asset accidentally retains the retired wagon and would draw a second crate. All locked foreground/slot geometry and source PNG bytes remain intact.
