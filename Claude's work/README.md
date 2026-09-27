# Renn | Void — reworked

This folder is a complete, working copy of the site. Your original files next to it were not changed.
To try it, open `index.html` in a browser. To put it live, upload the contents of this folder the same
way you uploaded the old version (so that `index.html`, `css/`, `js/` and `fonts/` sit at the top of the site).

## Bugs fixed

| Problem | Cause | Fix |
|---|---|---|
| Menu animation jittery when opening | The dock animated `left` while `translateX(-50%)` changed with its own width, the side buttons appeared instantly, and every button had its own blur layer that popped in at the end | The button now glides with `transform` only, and the menu is one glass panel that fades and scales in on its own |
| Sliding to the centre jittery on tall/phone screens | While `left` moved, the space left for the menu shrank every frame, so the menu kept re-wrapping its buttons while it moved | The dock spans the whole bottom edge, so nothing re-wraps while it moves |
| Phone layout never applied | `index.html` asked for `css/mobile.css`, the file was called `moblie.css` | Phone styles now live next to the styles they change |
| Spotify search broken | Spotify lowered the search limit for Development Mode apps to 10 (February 2026). The site asked for 15, so every search failed, and the CORS proxies it fell back on are unreliable | Asks for 10, keeps the token for an hour instead of fetching a new one on every keystroke, and falls back to Apple Music and then Deezer with requests that work without a proxy |
| Shake after sending too strong | A CSS keyframe shake (±3px, ±1°, 10×/s) ran on top of a JS shake of up to 12px + random jitter | One smooth rumble, about 2–3px and 0.2° at the peak, fading in and out |
| "favoomfs" button showed an empty page | The page didn't exist | Added the page (W.I.P for now, with a ready card layout in a comment) |
| Settings and profile buttons did nothing | No code behind them | Settings dialog (reduce motion, warp intro, lite background) and a profile dialog |
| Sent drawings could come out invisible | The PNG had a transparent background, so black-on-white drawings were black on Discord's dark background | The background colour is baked into the PNG |
| Attached song couldn't be removed | No remove button | Song chip with change / remove |
| Menu closed by itself after 5 seconds on phones | The auto-collapse timer only reset on mouse movement | The open menu stays open until you pick something, tap outside or press Esc |
| Song titles inserted as HTML | `innerHTML` with text from the music APIs | Text is inserted as plain text |

## Other improvements

- **Much lighter background.** The fog was redrawn at full size every frame and then blurred with CSS, which is very heavy. It is now drawn tiny and scaled up (same look), and stars cover any screen size (before they stopped at 2000px, so big monitors had an empty right side). In a test browser without graphics acceleration, the desktop version went from about 5 to about 35 frames per second.
- **Menu:** one glass panel with the current page highlighted, a coloured dot per page, a gold "send me something" button, settings and login in the footer. Hover the button to see where you are. Works with the keyboard (Tab, Enter, Esc).
- **Home page** has cards leading to every page.
- **Links to pages** work: `yoursite/#send` opens "send me something" directly, and the browser back button works.
- **Send page:** write / draw tabs, character counter, the message draft is kept if the tab is closed, Ctrl/Cmd + Enter sends.
- **Drawing:** redo, clear, colour swatches, brush-size preview, pen pressure, smoother lines, Ctrl/Cmd + Z / Shift + Z.
- **Login** is a real form (password managers work), shows clear errors, and forgets expired sessions.
- Smaller font file (`escargoth.woff2`, 7 KB instead of 30 KB; the .ttf stays as a fallback), favicon, link-preview tags for Discord, respects the phone's "reduce motion" setting.

## Files

```
index.html          all pages, the menu and the dialogs
favicon.svg
css/
  base.css          font, colours, reset, headings
  background.css    sky and warp layers
  layout.css        page column, page transitions, intro
  dock.css          the floating menu
  components.css    buttons, fields, dialogs, switches
  pages.css         home cards, W.I.P boxes, gallery, favoomfs, control panel
  send.css          write/draw tabs, message box, song search, drawing canvas
js/                 loaded in this order
  config.js         ← the file to edit: server addresses, webhooks, pages and their colours
  core.js           shared helpers, settings, dialogs
  api.js            login server + Discord
  background.js     stars, fog, warp and shake
  navigation.js     pages, the menu, gallery loading
  auth.js           login, logout, profile, control panel
  music.js          song search (Spotify → Apple Music → Deezer)
  messages.js       write/draw tabs and the text message
  drawing.js        the canvas
  main.js           starts everything and plays the intro
server/
  void-worker.js    optional Cloudflare Worker (see below)
fonts/
```

## Adding a page

1. In `js/config.js`, add an entry to `Void.pages` (id, label, colours).
2. In `index.html`, add `<section class="page" id="page-yourid" data-page="yourid" hidden> … </section>` inside `<main>`.

The menu button and the home card are created automatically.

## Spotify

The search uses your worker at `spotifyTokenUrl`. If Spotify results still don't show up, open the browser console
(the search logs why it fell back). Since the February 2026 changes, a Spotify Development Mode app only works while
its owner has Spotify Premium. If the worker fails, the search still works through Apple Music or Deezer.

## Optional: hide the Discord webhooks

Right now the webhook addresses are inside `js/config.js`, so anyone can copy them and post to your channel with
any name, or delete the webhook. `server/void-worker.js` fixes that. It also serves the Spotify token, so it can
replace the worker you have now:

1. Paste it into your Cloudflare Worker and add the secrets listed at the top of the file.
2. In `js/config.js`, set `relayUrl` to the worker's address and set both webhook URLs to `''`.
3. Create new webhooks in Discord (the old addresses were public) and put them in the worker secrets.

## Control panel

"Add entity" isn't connected to your server yet, because the site only knows the `/api/login` route. When your
server has a route for it, fill in `api.createUser` in `js/api.js`.
