# Theme thumbnail illustrations

This change is limited to the theme chooser and My Classroom's Current Theme
card. Both locations use the same local illustration and preserve it with
`object-fit: contain` for these three themes:

- **Our Friends:** a cream pinned photo frame with a painted friendship heart
- **Halloween:** the smiling orange trick-or-treat bucket with a friendly ghost
- **Pumpkin Patch:** one large solid watercolor pumpkin, without a portrait hole,
  nameplate, or background scene

The separate `thumbnail-illustration.png` files are transparent 1254 × 1254 RGBA
PNGs made with the built-in image-generation tool from the recovered board art.
They are derivatives, not recovered originals. Exact input/output hashes and
generation prompts are recorded in `thumbnail-source-manifest.json`. The original
Pumpkin Patch scene thumbnail is retained byte-for-byte as `thumbnail.png`.
None of the recovered board PNGs, locked slot geometry, attendance renderers,
ownership logic, or saved classroom state was changed.

Full theme labels remain visible in both locations. The three images have named
alternative text, and labels/navigation remain usable when an image fails to load.
Unrelated themes retain their existing image metadata and sizing rules.

## Verification

`npm run check` covers local asset signatures, dimensions, transparency format,
input/output hashes, shared chooser/current-card sources and labels, no writes
on render, unchanged ownership, and preservation of all original recovered PNGs.

`tests/restored-thumbnails-browser.cjs` is called by the existing browser harness
through `theme-preview-browser.cjs`. Native Chromium and WebKit runs produce:

- Chooser and Current Theme screenshots for each illustration at 1024 × 768,
  1280 × 720, and 1671 × 941
- `theme-preview-thumbnail-geometry.json` with contain sizing, whole-image bounds,
  accessible alternative text, and center/corner transparency evidence
- Missing-art screenshots and checks that repeated selection/return do not change
  attendance or other classroom state

Screenshot filenames start with `theme-preview-thumbnail-`; the existing CI
artifact rules collect their PNGs. Geometry JSON is included in the aggregate
attendance artifact. Browser execution is required before claiming native visual
verification. It was not attempted in the restricted implementation executor
because its local browser/socket route is blocked; use the existing CI engines.
