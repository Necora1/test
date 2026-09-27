# Renn | Void — Runi's skin

A copy of the site with the *look* reworked towards the old profile-site style
(SpaceHey / MySpace-era): woven metal panels, chrome-bevel boxes, blackletter
display type, a banner with a user search, and a page footer.

Everything underneath is Claude's working build, kept as-is: the star field, the
fog, the warp intro and the send shake are all still there. **No JavaScript file
that Claude wrote was deleted or replaced** — only three were touched, each for a
one-line reason listed below. `Claude's work/` next to this folder is untouched.

## What changed, and why

### Look only (nothing functional)

| File | What it does now |
|---|---|
| `css/base.css` | Dithered metal + diagonal weave tokens, chrome bevel edges, classic link blues, old fixed scrollbars. Two pixel faces: **Jacquard 12** (blackletter, titles) and **Silkscreen** (menus, buttons, small print), the same pairing the reference uses. |
| `css/layout.css` | The fixed banner (brand, search, LogIn, live mood/listening/last-active), the page column, and the footer with a marquee. |
| `css/dock.css` | The menu reads as an old taskbar: a metal rail, bevel buttons, a sunken pixel display for "you are here". |
| `css/components.css` | Buttons are chrome-beveled; dialogs are metal windows with a title bar and a beveled ✕; the settings switch is a chunky old toggle. |
| `css/pages.css` | Home cards are raised metal tiles with a coloured glow per page, the "right now" box, striped W.I.P panel, panel cards with a titled header bar. |
| `css/send.css` | Old tab strip for write/draw, sunken message box, sunken song list, beveled toolbar and swatches. |
| `index.html` | The banner, the tip line, the footer, the "right now" card, a "background fabric" setting. |

The stars, fog and warp canvases, and `css/background.css`, are untouched.

### Small wiring changes (each one line of intent)

| File | Change |
|---|---|
| `js/core.js` | Added `fabric: true` to the default settings, and the line that toggles the `no-fabric` class. |
| `js/main.js` | Wires the new "background fabric" switch; calls `Void.skin.init()`. |
| `index.html` | Loads `js/skin.js` **after** `core.js` (it uses `Void.$`), i.e. last before `main.js`. |

### New file

`js/skin.js` — the dressing that needs a little logic:

- **mood / listening / last active** — random flavour text; "last active" is real
  and comes from `localStorage`, counting up on later visits.
- **visitor counter** — counts up in `localStorage`, shown padded to six digits.
- **home search** — filters the home cards live and says how many matched.
- **banner LogIn** — clicks the existing dock login button, so there is one code path.
- **banner measurement** — keeps the page clear of the fixed banner at any width.

## Verified

Rendered and measured in headless Chrome at 1280px, 500px and 360px:

- Sky, fog, stars and the warp intro all still run; canvas is present and painting.
- Menu opens fully on screen (no clipping), marks the current page, gold CTA intact.
- All seven pages render; theme tint still cross-fades per page.
- Write/draw tabs, canvas (560×356), undo/redo/clear, swatches, song search dialog.
- Home search filters correctly and resets.
- Visitor counter, mood, "last active", footer year all populate.
- Reduced motion disables the marquee and the warp; "background fabric" off really
  removes the weave layer.
- No horizontal overflow at 360px; **zero console errors** on every page tested.

## Notes

- The two fonts load from `fonts.gstatic.com` (they are Google Fonts, not local
  files). `Escargoth` is still available as the fallback and is untouched.
- The banner's LogIn/About/Gallery links reuse the site's own router (`#about`).
- If you would rather keep the pixel font on the titles too, swap
  `--font-display` to `var(--font-pixel)` in `css/base.css`.
