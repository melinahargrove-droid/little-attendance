# Restored standalone School Bus

The neutral watercolor artwork is copied without pixel changes from the finished
Little Classroom 0.16.82 School Bus handoff for standalone Little Attendance.
It contains no Early Eagle branding. Do not replace it with the earlier
`bus-theme-background.png` or the older v5.12 transfer artwork.

- Original file: `src/ui/attendance-final-1554.png`
- Dimensions: 1671 × 941
- SHA-256: `c0701618a36c4982d0a6ca74fbc94a276e160012574537e3d4ec52f6349918ce`
- Locked geometry source: `assets/attendance/bus-approved-layout.json`
- Geometry SHA-256: `32a476e0b9dbae93b979c29d1dd35f5303aa160240168f8d3f2e2e9e607c3e07`
- Source build named by geometry: `Little-Classroom-0.15.77-FINAL-Attendance-Bus`

The adapter preserves the final CSS positions, counter offsets, full-artwork
stretch, waiting-name styling, and photo-only bus seats. It retains the final
cascade's effective waiting photo sizes: 82px for 1–6 students, 68px for 7–12,
64px for 13–16, 58px for 17–20, 52px for 21–25, and 46px for 26–30.

Two old implementation problems are intentionally corrected:

- Both zones retain a slot for each stable child ID. Inactive copies use
  visibility-hidden placeholders, so checking in/returning one child cannot
  compact or reposition the others
- Density is chosen from total roster size, instead of adding density classes
  as arrivals increase. It stays fixed through check-in, return, Undo and Reset

The original shelter and its approved translate/scale remain unchanged. If a
landscape viewport or long names would overflow, a centered inner fit adjustment
keeps the full roster inside that shelter. A bounded inner-width search avoids
unnecessary shrinking. Source-size hidden labels preserve the verified layout
footprint while visible names use at least 12px effective text, fitted into the
existing row gaps with ellipsis. Photo/button positions are checked against
prior Chromium/WebKit geometry fixtures; names cannot overlap another portrait.
Initials fit within their existing avatar boxes. The source layout stays
unchanged whenever it fits. This adjustment measures all slots,
including placeholders, so it does not change on attendance actions. Names keep
the source's single-line ellipsis and a complete accessible button label.

Only existing embedded raster data images are used for student photos. Remote
URLs, HTML and SVG data are not loaded. Missing/broken images use initials. No
photo upload, new roster format, sample children, or separate persistence layer
is introduced. The current stable-ID migration, exact pre-upgrade backup,
storage warnings and stale-tab protection remain in charge.

The browser tests use synthetic classrooms. They verify original-size and
landscape layouts, click hit-testing, stationary slots, bounds, controls and
reload. Portrait/phone screenshots record the original artwork's narrow-screen
limitations; they are not portrait usability certification and do not silently
substitute another attendance board.
