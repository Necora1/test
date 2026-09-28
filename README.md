# zeroed my world

renn's website: one room, one afternoon, rewound to 0:00:00 and played back.

It opens like a tape. The counter spins back from somewhere far to
**0:00:00**, the title plays, and you're in renn's room at 5:47 pm: the
real attic room, remembered a little softer. The slatted ceiling slopes
down on both sides, the blackout curtains are half drawn, and the sun is
going down behind the brick house across the street. A window-shaped
patch of light lies on the floor. There is no menu: the
things in the room are the way around. Click the guitar and the camera drifts
to it while the light changes, and the guitar "track" surfaces over it. Every
room is a track on the tape (side a, track 01…), and the counter in the corner
runs for as long as you stay.

Plain HTML, CSS and JavaScript. No build step, no frameworks, no npm.

## Run it

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

It needs to be served over http(s) (not opened as a file) for the room's
painting, the song search and the login to work.

## What's where

```
index.html            the room, and every track in it (the about letter is here)
panel.html            renn's door: sign in, and the small control panel
dream/index.html      old links to the "dream version" land in the room
favicon.svg
assets/fonts/         Fraunces, Caveat, Klee One (all local)
assets/covers/        album covers for the favorite songs
css/
  dream.css           the basics: tokens, fonts, rooms, letter, tapes, walkman
  rooms.css           games, guitar, cards, wishes, lucid, "again"
  memory.css          the room as home: hotspots, captions, title, camera panel
  panel.css           renn's door
js/
  config.js           ← settings you'll actually edit (see below)
  core.js             helpers, dialogs, reduce-motion
  api.js              login server + sending messages and drawings
  pinterest.js        the pictures, from Pinterest
  spotify.js          plays the favorite songs through Spotify
  music.js            song search (for adding a song to a message)
  messages.js         the letter
  drawing.js          the sketchbook
  memory/paint.js     the room, painted in code, in layers
  memory/engine.js    lights it on the GPU, the film look, the camera's travels
  memory/camera.js    the camera panel (looks, effects, time of day, photos)
  scene.js            the room's hotspots, the tape intro, the counter, captions
  views.js            the tracks: the camera travels, then the room surfaces
  palette.js          which song each track is tuned to; colours that glide
  sky.js              the night sea out of the window + the frame loop
  life.js             jellyfish, dust and rain over the night sea
  rain.js             rain sounds, generated in the browser
  sound.js            the little synth: chimes, plucked strings, a reverb room
  fx.js               sparks, comets, catchable shooting stars, wish stars
  tapes.js            the cassette shelf and the walkman
  pictures.js         polaroids you can pick up, and the viewer
  letters.js          a sent letter folding up and flying off
  arcade.js, games/   the laptop: star catcher, cover memory, blurry covers, lanterns
  guitar.js           a guitar you can play (standard or FACGCE)
  oracle.js           the cards on the bed
  wishes.js           the wish jar (wishes stay in the visitor's browser)
  extras.js           lucid mode, keys, typed words, the memory fading
  panel.js            renn's door
  main.js             starts everything
server/
  void-worker.js      Cloudflare Worker: Spotify token, message relay,
                      Pinterest fallback
```

## The room

- **Where things go:** the window → out into the night sea, to make a wish ·
  the pictures over the bed → pictures · the frames by the corner → friends ·
  the note under the black shelf → about · the tapes on the desk → songs ·
  the guitar in the corner → guitar · the laptop on the bed → games (at
  night) · the letter by the alarm clock → write to me (lamp on) · the cards
  on the bed → fortune (3am) · the wire lamp on the ceiling → on/off. At
  night the windows across the street light up.
  The light and caption of each track are `PRESETS` in
  `js/memory/engine.js`; the camera aims at wherever the thing ends up in
  the painting.
- **The perspective:** the room is drawn in one-point perspective, like a
  photo from the doorway. Everything is placed in 3D (x, y on the back wall,
  z towards you) and projected to one vanishing point, just under the sun
  (`VP` in `js/memory/paint.js`). The bed, shelf, nightstand and crate are
  real boxes, and the sunlight is traced through the window panes onto the
  bed and the floor. The clickable areas are worked out from the same
  projection. Turn on **perspective guides** in the camera panel (or open
  the site with `?guides`) to see the horizon, the vanishing point, the
  floor grid, and every edge running back to it.
- **The look:** painted once in code, then lit every frame: the low sun in
  the window (it sinks as the day goes on), gold raking across the bed,
  god rays, dust turning in the light, a lens flare with ghosts, birds going
  past, night and rain in the window. Then a pseudo-HDR film pass: the eye
  adapting, local contrast, bloom, halation, lens dirt, grain.
- **The camera** (`C`, or the aperture in the corner): looks — eye candy (the
  default), memory, super 8, vhs (with a tape counter on screen), cinestill
  800t, black & white, clean — and a slider for every effect, the time of day,
  "let time pass" (a whole day in four minutes), birds, resolution, and "take
  a photo" to save the frame as a PNG. Remembered per browser (`dream_camera`).
- **Keys:** `?` lists them. `1`–`9` go to a track, `0` steps back, `L` lucid
  (the room folds into a kaleidoscope), `R` rain on the window, `M` mute,
  `C` the camera. Type `again` to rewind the whole thing to zero, or `wish`.
  Stay still for a minute and the memory fades.

## Editing

Most things live in **`js/config.js`**:

- **Favorite songs:** the `Void.favorites` list. Each song needs its Spotify id
  (the part after `open.spotify.com/track/` in the song's share link) and,
  optionally, a cover image in `assets/covers/` and a `palette` (four colours:
  sky, horizon, glow, accent). When only the record is on Spotify, use
  `album:` with the album id instead.
- **Pictures:** `pinterest.user` is the Pinterest account the pictures come
  from; set `pinterest.board` to show only one board.
- **Services:** the login server (`apiUrl`), the Spotify token URL and the
  message relay (`relayUrl`).
- **Which song each track is tuned to:** the top of `js/palette.js`.

The about letter and the other words are in `index.html`.

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
   like, `PINTEREST_USER` (`xqygen`) so the pictures fallback only serves your
   account.
3. Put the worker's address in `relayUrl` in `js/config.js`.

Until `relayUrl` (or a webhook) is set, sending says "This feature isn't set
up yet." and nothing is sent.

## Songs and pictures

Songs play through Spotify's iFrame API on the walkman. Visitors logged in to
Spotify in that browser hear whole songs, everyone else gets 30-second
previews (Spotify's rule for embeds). The pictures come from Pinterest's
public widget feed (no key needed); if it can't be reached and `relayUrl` is
set, the worker's `/pinterest` route is tried instead.

## Motion

"Reduce motion" on the visitor's device is respected: no camera travel, no
drift, no flicker; the room still changes its light.

## Fonts

Fraunces, Caveat and Klee One are open-source (SIL Open Font License) and
served from `assets/fonts/`.
