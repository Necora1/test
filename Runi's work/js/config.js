/* ==========================================================
   config.js — everything you are likely to change lives here
   ========================================================== */
window.Void = window.Void || {};

Void.config = {
  version: 'v0.10.0-beta',

  // Login + control panel server
  apiUrl: 'https://api.zeroedmyworld.com',

  // Discord webhooks that receive anonymous messages and drawings.
  // Note: anyone can read these URLs in the browser. To hide them, deploy
  // server/void-worker.js and put its address in relayUrl (see README).
  webhooks: {
    text: 'https://discord.com/api/webhooks/1547595509298892881/eCAh-1xAP_nbdmyfZpUUxHhOUXFE5uPBCpgxSr5jgIciUc_zq97V5P1VOG6OPnNri7fx',
    drawing: 'https://discord.com/api/webhooks/1547590235834032199/R6chHgBOhBcWmcaJG9Pw2gtc6-j80t1DCuVv97T3ons86uUucCFlp1Qv9YKTC1_4jKQW'
  },

  // Optional: your worker address, e.g. 'https://withered-sea-30c9.1romandor.workers.dev'.
  // When set, messages and drawings go through the worker instead of the webhooks above.
  relayUrl: '',

  // Returns { access_token, expires_in } for Spotify search (Cloudflare Worker)
  spotifyTokenUrl: 'https://withered-sea-30c9.1romandor.workers.dev/',

  // Juicer feed used on the gallery page
  juicerFeedId: 'xqygen',

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
