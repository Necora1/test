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
index.html            every page and dialog
favicon.svg
assets/fonts/         Jacquard 12, Silkscreen, Lato, Escargoth (all local)
css/
  base.css            fonts, colours, reset, liquid-chrome titles
  background.css      the sky canvas and the warp overlay
  layout.css          banner, page column, page transitions, footer
  dock.css            the menu button and menu panel
  components.css      buttons, fields, dialogs, switches
  pages.css           home, gallery, favoomfs, control panel
  send.css            "send me something": write, draw, song search
  effects.css         the liquid layer (sheen, tilt, jelly press, sparkles)
js/
  config.js           ← settings you'll actually edit (see below)
  core.js             shared helpers, settings, dialogs
  api.js              login server + sending messages/drawings
  background.js       star sky, fog, warp intro, send shake
  navigation.js       pages, page colours, the menu, the gallery feed
  auth.js             login, logout, profile, control panel
  music.js            "add a song" search (Spotify → Apple Music → Deezer)
  messages.js         write tab
  drawing.js          draw tab
  profile.js          "right now" box, visit counter, banner search
  effects.js          liquid titles, sheen, tilt, press bounce, sparkles
  main.js             starts everything in order
server/
  void-worker.js      Cloudflare Worker: Spotify token + message relay
```

## Editing

Most things live in **`js/config.js`**:

- **Pages:** the `Void.pages` list sets the menu order, the home cards, and each
  page's colours. To add a page, add an entry there and a matching
  `<section class="page" data-page="…">` in `index.html`.
- **Right now box:** the `Void.rightNow` moods and songs. One of each is picked
  at random per visit.
- **Services:** the login server, Spotify token URL, Juicer gallery feed and
  message relay.

Page text (about, interests, favoomfs) is in `index.html`. The favoomfs section
has a commented example of the card markup.

## Anonymous messages: set up the relay

Messages and drawings go to Discord. **Don't put webhook URLs in the
website.** Anyone can read them from the browser and use them to spam the
channel or delete the webhook.

1. In Discord, **delete the old webhooks and create new ones.** The previous
   URLs were published in this repository, so treat them as compromised.
2. In the Cloudflare dashboard, open your worker, replace its code with
   `server/void-worker.js`, and under *Settings → Variables and Secrets* add
   these secrets: `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`,
   `TEXT_WEBHOOK_URL`, `DRAWING_WEBHOOK_URL`. Also add the plain variable
   `ALLOWED_ORIGINS`, for example `https://zeroedmyworld.com`.
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
