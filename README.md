# Renn's Void

My website, in two versions:

- **classic** (`index.html`): an old-web (SpaceHey / MySpace era) profile page
  with woven metal, chrome-bevel boxes, blackletter pixel titles, a drifting
  star sky and a warp intro, plus a liquid-chrome animation layer on top.
- **dream** (`dream/index.html`): the same site, dreamt differently. It's a
  night sky over a sea that mirrors it, with two moons and glowing jellyfish
  drifting up like lanterns. The pages are things floating in it: a note, polaroids, a
  cassette, a photo strip and an envelope. Every room is tuned to one of the
  favorite songs and takes the colours of its cover. When a song plays, the
  whole dream takes that song's colours.

A link in each version switches to the other ("dream ✧" in the classic banner,
home cards and menu; "classic version" in the dream's corner). The site
remembers which one a visitor picked: opening `index.html` goes straight to
the dream for someone who chose it last time. `index.html?classic` always
opens the classic version.

It's plain HTML, CSS and JavaScript. No build step, no frameworks, no npm.

## Run it

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

Opening `index.html` directly also works, but the song search and the login
need the page to be served over http(s). The dream version is at
http://localhost:8000/dream/index.html.

## What's where

```
index.html            the classic version (the about text lives here)
favicon.svg
assets/fonts/         Jacquard 12, Silkscreen, Lato, Escargoth, and for the
                      dream: Fraunces, Caveat, Klee One (all local)
assets/covers/        album covers for the favorite songs
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
  config.js           ← settings you'll actually edit (see below)       [shared]
  core.js             shared helpers, settings, dialogs                   [shared]
  api.js              login server + sending messages/drawings            [shared]
  pinterest.js        the gallery's pictures from Pinterest               [shared]
  spotify.js          plays the favorite songs through Spotify            [shared]
  background.js       star sky, fog, warp intro, send shake
  navigation.js       pages, page colours, the menu
  auth.js             login, logout, profile, control panel
  music.js            "add a song" search (Spotify → Apple Music → Deezer)  [shared]
  messages.js         write tab                                           [shared]
  drawing.js          draw tab                                            [shared]
  gallery.js          the masonry wall and the picture viewer
  songs.js            the favorite songs list + "now playing" chip
  banner.js           banner search, LogIn link, banner height
  effects.js          liquid titles, sheen, tilt, press bounce, sparkles
  secrets.js          the black hole, and falling asleep into the dream
  main.js             starts everything in order
dream/
  index.html          the dream version (its about letter lives here)
  dream.css           everything it looks like
  rooms.css           games, guitar, cards, wishes, lucid, void
  js/palette.js       which song each room is tuned to; colours that glide
  js/sky.js           the night sea out of the window + the frame loop
  js/life.js          jellyfish, dust, rain streaks
  js/rain.js          rain sounds, generated in the browser
  js/scene.js         the room's hotspots, title card, captions
  js/views.js         the rooms (#about, #gallery, #interests, #favoomfs, #send,
                      #games, #guitar, #oracle, #wishes)
  memory.css          the room as home: hotspots, captions, title card
  js/memory/paint.js  the room, painted in code, in layers
  js/memory/engine.js lights it, film look, the camera's travels
  js/sound.js         the little synth: chimes, plucked strings, a reverb room
  js/fx.js            sparks, comets, catchable shooting stars, wish stars
  js/arcade.js        the games room; js/games/*.js are the four games
  js/guitar.js        the playable guitar
  js/oracle.js        the tarot reading
  js/wishes.js        the wish jar (kept in the visitor's browser only)
  js/extras.js        lucid mode, keys, typed words, drifting, the clock
  js/pictures.js      polaroids you can pick up, and the viewer
  js/tapes.js         cassettes and the walkman
  js/letters.js       a sent letter folding into an envelope and flying off
  js/main.js          starts the dream
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
  optionally, a cover image in `assets/covers/` and a `palette` (the four
  colours the dream turns into while it plays: sky, horizon, glow, accent).
- **Dream rooms:** which song each room of the dream is tuned to is at the top
  of `dream/js/palette.js`.
- **Services:** the login server, Spotify token URL and message relay.

Page text (about, interests, favoomfs) is in `index.html` for the classic
version and `dream/index.html` for the dream. The favoomfs section of the
classic page has a commented example of the card markup.

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

## Little extras

- **The black hole:** on the classic version, type `void` anywhere (or the
  Konami code: ↑ ↑ ↓ ↓ ← → ← → B A). A black hole opens where your mouse is,
  swallows the page and spits it back out.
- **CRT screen:** menu → settings → "CRT screen" puts scanlines, a rolling bar
  and a bit of flicker over the classic version.
- **Rain:** the dream's "rain" button plays rain on the window (made on the
  spot with Web Audio, no sound files) and makes it rain in the sky.
- **Now playing:** the classic footer marquee says which song is playing. In
  the dream, a song keeps playing on the walkman while you wander around.

### In the dream

The dream starts in renn's room, late in the afternoon, and there is no menu:
the things in the room are the way around. Click the guitar and the camera
drifts to it while the light changes, and the guitar room surfaces over it.

- **The room** is painted in code (`dream/js/memory/paint.js`: walls, window,
  desk, bed, guitar, polaroids, tapes, corkboard, a plant, curtains) and lit
  live on the GPU (`dream/js/memory/engine.js`): sun through the window with
  leaf shadows drifting across it, beams with dust turning in them (the dust
  moves away from the mouse), the lamp, the laptop screen, fairy lights,
  night and rain in the window. Then a film pass: bloom, red halation, zoom
  blur while travelling, soft-focus edges, light leaks, grain, a faded grade.
- **Where things go:** note → about · tapes → songs · laptop → games (at
  dusk) · letter → write to me (lamp on) · guitar → guitar · polaroids →
  pictures · cards on the bed → fortune (3am) · corkboard → friends ·
  window → out of it, into the night sea, to make a wish · lamp → on/off.
  The camera spot, light and caption for each are `PRESETS` in engine.js;
  the clickable areas are `HOTSPOTS` in paint.js (board units, 1600 × 1000).
- **Games:** star catcher, cover memory, blurry covers, lanterns.
- **Guitar:** drag across the strings; chords 1–8; A S D F G H pluck.
  "midwest tuning" retunes it to FACGCE, and "let it play" fingerpicks.
- **Keys:** `?` lists them. `1`–`9` go somewhere, `0` steps back, `L`
  lucid (the room folds into a kaleidoscope), `R` rain on the window, `M`
  mute. Type `void` or `wish`. Stay still for a minute and the memory fades.
- **Songs:** `Void.favorites` in `js/config.js`. A song can use `album:`
  instead of a track id when only its record is on Spotify.
