/* ==========================================================
   config.js — everything you are likely to change lives here
   ========================================================== */
window.Void = window.Void || {};

Void.config = {
  version: 'v0.12.0-beta',

  // Login + control panel server
  apiUrl: 'https://api.zeroedmyworld.com',

  // Where anonymous messages and drawings go.
  // Recommended: deploy server/void-worker.js (Cloudflare Worker) with your
  // Discord webhooks stored as secrets, and put the worker's address here.
  // The website then never contains the webhook URLs. See README.md.
  relayUrl: '',

  // Only if you have no worker: paste Discord webhook URLs here. Anyone can
  // read these in the browser and use them to post to (or delete) the webhook.
  webhooks: {
    text: '',
    drawing: ''
  },

  // Returns { access_token, expires_in } for Spotify search (Cloudflare Worker)
  spotifyTokenUrl: 'https://withered-sea-30c9.1romandor.workers.dev/',

  // Gallery: pictures come from this Pinterest account. Leave board empty
  // for the latest pins from the whole profile, or name one board
  // (the last part of its address, e.g. 'photos') to show only that.
  pinterest: {
    user: 'xqygen',
    board: ''
  },

  // Longest message a visitor can type
  messageMaxLength: 2000
};

/* ----------------------------------------------------------
   Pages. Order here = order in the menu.
   To add a page: add an entry here and a matching
   <section class="page" data-page="…"> in index.html.
     label  – name in the menu and on home cards
     short  – text on the menu button
     blurb  – line under the name on the home cards
     nav    – show in the menu
     portal – show as a card on the home page
     cta    – highlighted full-width menu button
   ---------------------------------------------------------- */
Void.pages = [
  {
    id: 'home', label: 'home', short: 'HOME', nav: true,
    theme: { bg: '#030303', stars: '#ffffff', accent: '#dfe6f2', fog1: [180, 195, 220], fog2: [100, 115, 140] }
  },
  {
    id: 'about', label: 'about', short: 'ABOUT', blurb: 'im renn! :3', nav: true, portal: true,
    theme: { bg: '#010a14', stars: '#a3d5ff', accent: '#7cc8ff', fog1: [0, 100, 200], fog2: [0, 200, 255] }
  },
  {
    id: 'gallery', label: 'gallery', short: 'GALLERY', blurb: 'pictures I make', nav: true, portal: true,
    theme: { bg: '#1c0d02', stars: '#ffe49e', accent: '#ffc46b', fog1: [255, 190, 80], fog2: [255, 110, 90] }
  },
  {
    id: 'interests', label: 'interests', short: 'INTERESTS', blurb: 'songs on repeat, etc', nav: true, portal: true,
    theme: { bg: '#100517', stars: '#d9b3ff', accent: '#c99bff', fog1: [150, 50, 200], fog2: [200, 100, 255] }
  },
  {
    id: 'favoomfs', label: 'favoomfs', short: 'FAVOOMFS', blurb: 'my favorite oomfs', nav: true, portal: true,
    theme: { bg: '#140202', stars: '#ffb3b3', accent: '#ff8593', fog1: [220, 20, 60], fog2: [255, 100, 100] }
  },
  {
    id: 'send', label: 'send me something', short: 'SEND', blurb: 'write or draw something for me', nav: true, portal: true, cta: true,
    theme: { bg: '#021207', stars: '#a3ffa3', accent: '#6dffa8', fog1: [0, 180, 80], fog2: [50, 255, 150] }
  },
  {
    // Control panel: only reachable when logged in (menu → panel)
    id: 'admin', label: 'panel', short: 'PANEL', requiresAuth: true,
    theme: { bg: '#120202', stars: '#ff4d4d', accent: '#ff5a5a', fog1: [180, 0, 0], fog2: [80, 0, 0] }
  }
];

/* ----------------------------------------------------------
   Favorite songs (interests page). They play through Spotify.
     spotify  – the id at the end of the song's Spotify link:
                open.spotify.com/track/<this part>
     cover    – a file in assets/covers/ (without .jpg)
     explicit – shows the little [E]
   ---------------------------------------------------------- */
Void.favorites = [
  { title: 'Black Catcher', artist: 'VK Blanka', spotify: '2y7f8qkrgIqY5KsfPNcuix', cover: 'black-catcher', explicit: true },
  { title: 'veil', artist: '須田景凪', spotify: '1dGF5ymTyBB2ZmOypkeU1F', cover: 'veil' },
  { title: 'cattle mutilation, strange U.F.O.', artist: '死んだ僕の彼女', spotify: '1UP3kGL3vshjRy4jg3PQWa', cover: 'cattle-mutilation' },
  { title: 'deep love', artist: 'Split end', spotify: '3QyD6PkfdRWUrlbEzXoqBT', cover: 'deep-love' },
  { title: 'ヴァージン・スーサイド', artist: 'Kinokoteikoku', spotify: '124yhXmfewTTdLWcT9F0p8', cover: 'virgin-suicide' },
  { title: '3月5日。', artist: 'Plastic Tree', spotify: '46JoGRd1QYQj3CrULjCi0j', cover: 'march-5' },
  { title: 'hades in the dead of winter', artist: '死んだ僕の彼女', spotify: '1oolhBXiOpyr1j3SMxFX8h', cover: 'hades' },
  { title: 'PICNIC', artist: 'SEAPOOL', spotify: '1MT1O2LP1GkE0sPG7cUktb', cover: 'picnic' },
  { title: '刺繍', artist: 'SEAPOOL', spotify: '57YJ6PLOktLZNYT1xVoeA2', cover: 'shishu' },
  { title: 'Steel Birds', artist: 'Slow Pulp', spotify: '2En9hPrl1Z2raU3CeYleUI', cover: 'steel-birds' },
  { title: 'it’s like i’m not even here', artist: 'mthu', spotify: '30J9kqGXEjw7sFfROke92N', cover: 'not-even-here', explicit: true },
  { title: 'Medication', artist: 'The Skin Cells', spotify: '395LNTO3yHseVHGpuwQuKj', cover: 'medication' },
  { title: 'September Come Take This Heart Away', artist: 'Carissa’s Wierd', spotify: '1bnEw1xzEc5f05KdbU9M7r', cover: 'september' },
  { title: 'Hollow', artist: 'Alex G', spotify: '1cqdaKd3q3EyHKEnjaLKKt', cover: 'hollow' },
  { title: 'Time', artist: 'Vundabar', spotify: '1kOrZmrSnP1gub1kneRNHF', cover: 'time' },
  { title: 'Harvest', artist: 'Vundabar', spotify: '2vEtFTXFv57OCjH3ADEotk', cover: 'harvest' },
  { title: 'Sad Clown', artist: 'Vundabar', spotify: '1s4RMtbjUh3vcLCIAnmaZ6', cover: 'sad-clown', explicit: true },
  { title: 'happy news for sadness', artist: 'Car Seat Headrest', spotify: '2Rr4raGZMslo4jCPwddih1', cover: 'happy-news' }
];
