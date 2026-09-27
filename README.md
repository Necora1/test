# Renn's Void

My website: an old-web (SpaceHey / MySpace era) profile page with woven metal,
chrome-bevel boxes, blackletter pixel titles, a drifting star sky and a warp
intro, plus a liquid-chrome animation layer on top.

It's plain HTML, CSS and JavaScript. No build step, no frameworks, no npm.

## Run it

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

Opening `index.html` directly also works, but the song search and the login
need the page to be served over http(s).

## What's where

```
index.html            every page and dialog (the about text lives here)
favicon.svg
assets/fonts/         Jacquard 12, Silkscreen, Lato, Escargoth (all local)
assets/covers/        album covers for the favorite songs list
css/
  base.css            fonts, colours, reset, liquid-chrome titles
  background.css      the sky canvas and the warp overlay
  layout.css          banner, page column, page transitions, footer
  dock.css            the menu button and menu panel
  components.css      buttons, fields, dialogs, switches
  pages.css           home, gallery, favoomfs, control panel
  send.css            "send me something": write, draw, song search
  music.css           favorite songs player + the "now playing" chip
  gallery.css         the Pinterest wall and the picture viewer
  effects.css         the liquid layer (sheen, tilt, jelly press, sparkles)
js/
  config.js           ← settings you'll actually edit (see below)
  core.js             shared helpers, settings, dialogs
  api.js              login server + sending messages/drawings
  background.js       star sky, fog, warp intro, send shake
  navigation.js       pages, page colours, the menu
  auth.js             login, logout, profile, control panel
  music.js            "add a song" search (Spotify → Apple Music → Deezer)
  messages.js         write tab
  drawing.js          draw tab
  gallery.js          pictures from Pinterest, masonry wall, viewer
  songs.js            favorite songs, played through Spotify
  banner.js           banner search, LogIn link, banner height
  effects.js          liquid titles, sheen, tilt, press bounce, sparkles
  main.js             starts everything in order
server/
  void-worker.js      Cloudflare Worker: Spotify token, message relay,
                      Pinterest fallback
```

## Editing

Most things live in **`js/config.js`**:

- **Pages:** the `Void.pages` list sets the menu order, the home cards, and each
  page's colours. To add a page, add an entry there and a matching
  `<section class="page" data-page="…">` in `index.html`.
- **Gallery:** `pinterest.user` is the Pinterest account the pictures come
  from. Set `pinterest.board` to one board's name (the last part of its
  address) to show only that board.
- **Favorite songs:** the `Void.favorites` list. Each song needs its Spotify id
  (the part after `open.spotify.com/track/` in the song's share link) and,
  optionally, a cover image in `assets/covers/`.
- **Services:** the login server, Spotify token URL and message relay.

Page text (about, interests, favoomfs) is in `index.html`. The favoomfs section
has a commented example of the card markup.

### Gallery

The gallery reads Pinterest's public widget feed, the same one Pinterest's
official profile widget uses, so it needs no key. It shows the latest pins
(Pinterest caps that feed at a few dozen) in a masonry wall, newest first.
Clicking a picture opens a viewer (arrow keys or swipe to move through them),
and there's a link to the full profile at the bottom. If the feed can't be
reached and `relayUrl` is set, the worker's `/pinterest` route is tried as
a fallback.

### Favorite songs

The interests page lists the songs; clicking one plays it in a single Spotify
player through Spotify's iFrame API. Visitors logged in to Spotify in that
browser hear whole songs, everyone else gets 30-second previews (that's
Spotify's rule for embeds). A song keeps playing while you browse the other
pages, with a small "now playing" chip in the corner, and the next song
starts when one ends.

## Anonymous messages: set up the relay

Messages and drawings go to Discord. **Don't put webhook URLs in the
website.** Anyone can read them from the browser and use them to spam the
channel or delete the webhook.

1. In Discord, **delete the old webhooks and create new ones.** The previous
   URLs were published in this repository, so treat them as compromised.
2. In the Cloudflare dashboard, open your worker, replace its code with
   `server/void-worker.js`, and under *Settings → Variables and Secrets* add
   these secrets: `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`,
   `TEXT_WEBHOOK_URL`, `DRAWING_WEBHOOK_URL`. Also add the plain variables
   `ALLOWED_ORIGINS` (for example `https://zeroedmyworld.com`) and, if you
   like, `PINTEREST_USER` (`xqygen`) so the gallery fallback only serves your
   account.
3. Put the worker's address in `relayUrl` in `js/config.js`.

Until `relayUrl` (or a webhook) is set, the send button says
"This feature isn't set up yet." and nothing is sent.

## Motion and settings

Visitors can switch these in **menu → settings**, and "reduce motion" on
their device is respected automatically:

- **Reduce motion:** no warp, no shake, no drifting stars, no liquid effects.
- **Warp intro:** the star warp when the site opens.
- **Lite background:** fewer stars, capped frame rate.
- **Cursor sparkles:** pixel stars that trail the mouse.
- **Background fabric:** the woven metal layer.

## Fonts

Jacquard 12, Silkscreen and Lato are open-source (SIL Open Font License) and
served from `assets/fonts/`. Escargoth is the demo version of a commercial
font, kept only as a fallback; check its licence before using it more widely.
