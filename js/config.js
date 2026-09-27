/* ==========================================================
   config.js — everything you are likely to change lives here
   ========================================================== */
window.Void = window.Void || {};

Void.config = {
  version: 'v0.11.0-beta',

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

  // Juicer feed used on the gallery page
  juicerFeedId: 'xqygen',

  // Longest message a visitor can type
  messageMaxLength: 2000
};

/* ----------------------------------------------------------
   The "right now" box on the home page. One mood and one song
   are picked at random on every visit.
   ---------------------------------------------------------- */
Void.rightNow = {
  moods: [
    'bored z z 1,', 'listening to sad songs', 'in the void', 'sleepy ...',
    'hyper >:3', 'wired on coffee', 'thinking about the stars',
    'nostalgic for 2008', 'not here'
  ],
  listening: [
    'the smiths', 'slowdive', 'radiohead', 'bauhaus', 'the cure',
    'evanescence', 'violent vira', 'g n r'
  ]
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
    id: 'interests', label: 'interests', short: 'INTERESTS', blurb: 'media, hobbies, etc', nav: true, portal: true,
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
