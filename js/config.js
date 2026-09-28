/* ==========================================================
   config.js — everything you are likely to change lives here
   ========================================================== */
window.Void = window.Void || {};

Void.config = {
  version: 'v1.0.0',

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
   Favorite songs (interests page). They play through Spotify.
     spotify  – the id at the end of the song's Spotify link:
                open.spotify.com/track/<this part>
     cover    – a file in assets/covers/ (without .jpg)
     explicit – shows the little [E]
     palette  – the room's colours while the song plays
                while the song plays: [sky, horizon, glow, accent]
   ---------------------------------------------------------- */
Void.favorites = [
  { title: 'Black Catcher', artist: 'VK Blanka', spotify: '2y7f8qkrgIqY5KsfPNcuix', cover: 'black-catcher', explicit: true, palette: ['#120c1f', '#4a2c5e', '#f3d6ff', '#c2415f'] },
  { title: 'veil', artist: '須田景凪', spotify: '1dGF5ymTyBB2ZmOypkeU1F', cover: 'veil', palette: ['#1d1830', '#5b4f86', '#fff0dc', '#f29fc0'] },
  { title: 'cattle mutilation, strange U.F.O.', artist: '死んだ僕の彼女', spotify: '1UP3kGL3vshjRy4jg3PQWa', cover: 'cattle-mutilation', palette: ['#0a0a0e', '#2a2d3a', '#f4f4f0', '#8c8c9c'] },
  { title: 'deep love', artist: 'Split end', spotify: '3QyD6PkfdRWUrlbEzXoqBT', cover: 'deep-love', palette: ['#051014', '#12343a', '#bfe3da', '#3f8f86'] },
  { title: 'ヴァージン・スーサイド', artist: 'Kinokoteikoku', spotify: '124yhXmfewTTdLWcT9F0p8', cover: 'virgin-suicide', palette: ['#0f1a17', '#3f5a4a', '#fff6d0', '#e98fa3'] },
  { title: '3月5日。', artist: 'Plastic Tree', spotify: '46JoGRd1QYQj3CrULjCi0j', cover: 'march-5', palette: ['#0e1320', '#56657f', '#ffffff', '#9bb3d6'] },
  { title: 'hades in the dead of winter', artist: '死んだ僕の彼女', spotify: '1oolhBXiOpyr1j3SMxFX8h', cover: 'hades', palette: ['#08090d', '#3b3f4a', '#eef2f7', '#b8c4d4'] },
  { title: 'PICNIC', artist: 'SEAPOOL', spotify: '1MT1O2LP1GkE0sPG7cUktb', cover: 'picnic', palette: ['#1d0f12', '#6e3a3e', '#ffe2c6', '#e2837a'] },
  { title: '刺繍', artist: 'SEAPOOL', spotify: '57YJ6PLOktLZNYT1xVoeA2', cover: 'shishu', palette: ['#1a1216', '#5b4750', '#f5ead8', '#d8697e'] },
  { title: 'Steel Birds', artist: 'Slow Pulp', spotify: '2En9hPrl1Z2raU3CeYleUI', cover: 'steel-birds', palette: ['#1f0d12', '#7a3140', '#ffe98a', '#f0c63a'] },
  { title: 'it’s like i’m not even here', artist: 'mthu', spotify: '30J9kqGXEjw7sFfROke92N', cover: 'not-even-here', explicit: true, palette: ['#17130e', '#5a4a35', '#fff0cf', '#d4463f'] },
  { title: 'Medication', artist: 'The Skin Cells', spotify: '395LNTO3yHseVHGpuwQuKj', cover: 'medication', palette: ['#030305', '#18181f', '#d8d8de', '#6d6d80'] },
  { title: 'September Come Take This Heart Away', artist: 'Carissa’s Wierd', spotify: '1bnEw1xzEc5f05KdbU9M7r', cover: 'september', palette: ['#120a08', '#6b2716', '#ffcf94', '#e0623a'] },
  { title: 'Hollow', artist: 'Alex G', spotify: '1cqdaKd3q3EyHKEnjaLKKt', cover: 'hollow', palette: ['#07130c', '#2f5a38', '#e8f7c0', '#7fd46b'] },
  { title: 'Time', artist: 'Vundabar', spotify: '1kOrZmrSnP1gub1kneRNHF', cover: 'time', palette: ['#121214', '#4e4a47', '#f4efe6', '#c9714a'] },
  { title: 'Harvest', artist: 'Vundabar', spotify: '2vEtFTXFv57OCjH3ADEotk', cover: 'harvest', palette: ['#0e0e11', '#454552', '#fafafa', '#b5b5c5'] },
  { title: 'Sad Clown', artist: 'Vundabar', spotify: '1s4RMtbjUh3vcLCIAnmaZ6', cover: 'sad-clown', explicit: true, palette: ['#040407', '#1b1d2c', '#b8c0e0', '#5a78c8'] },
  { title: 'happy news for sadness', artist: 'Car Seat Headrest', spotify: '2Rr4raGZMslo4jCPwddih1', cover: 'happy-news', palette: ['#1a1308', '#6e5a1f', '#fff7c2', '#f0b43a'] },
  // ---- more on repeat ----
  { title: 'Memory', artist: 'Alex G', spotify: '3LOuU9L8SJ574EBc4PtOyA', cover: 'memory', palette: ['#1c1512', '#6b5144', '#f7e3d2', '#c98f7a'] },
  { title: 'Trick', artist: 'Alex G', spotify: '12jhJqbXPT9OWuyWZO5pPh', cover: 'trick', palette: ['#1a1411', '#5e4a40', '#f2ddc9', '#8fd0cf'] },
  { title: 'Clouds', artist: 'Alex G', spotify: '3ZauR91AFewYdWC7hojdCD', cover: 'clouds', palette: ['#17120f', '#6d564a', '#fbeee0', '#b99f8f'] },
  { title: 'String', artist: 'Alex G', spotify: '5QUcQ7OmRTzGAZT6IkhMO8', cover: 'string', palette: ['#15110f', '#5a473d', '#f0dccb', '#a57c69'] },
  { title: 'Treehouse', artist: 'Alex G, Emily Yacina', spotify: '7fyG2MquxykO3Ufiku1Dj2', cover: 'treehouse', palette: ['#030805', '#123a1a', '#d9f7c4', '#57a64a'] },
  { title: 'Let It Happen', artist: 'Tame Impala', spotify: '7LeKbLHNCwqcLHNIRq7wVp', cover: 'let-it-happen', palette: ['#1d1630', '#5a4b82', '#f3eaff', '#e0314a'] },
  { title: 'The Less I Know The Better', artist: 'Tame Impala', spotify: '5etnb1PyMbamJ68LZ5c5AZ', cover: 'less-i-know', explicit: true, palette: ['#1b1530', '#4f437a', '#e8e0ff', '#b0334d'] },
  { title: "I Don't Love", artist: 'Have A Nice Life', spotify: '1AOisyOwLgQ7EveVBCo0GG', cover: 'i-dont-love', palette: ['#050505', '#2b2418', '#f3e6c4', '#b68a3c'] },
  { title: 'Earthmover', artist: 'Have A Nice Life', spotify: '3wSYM0gFBlZ9u8BgcReQhJ', cover: 'earthmover', palette: ['#040404', '#231e15', '#efe0bb', '#8f6a2c'] },
  { title: 'There Is No Food', artist: 'Have A Nice Life', spotify: '30j2ZsXF9MpdbDrCwYwPNk', cover: 'there-is-no-food', palette: ['#060606', '#2d2519', '#f0e4c8', '#6f7a3a'] },
  { title: 'Milk', artist: 'Sweet Trip', spotify: '7Jq4cV3F5puQfUAxL4sHL8', cover: 'milk', palette: ['#1e2024', '#6f747c', '#ffffff', '#c7cbd3'] },
  { title: 'Things to Ponder While Falling', artist: 'Sweet Trip', spotify: '2SuXyqZXegiarBxFXTqoo8', cover: 'things-to-ponder', palette: ['#1c1f24', '#61666f', '#fbfbfb', '#a9b4c4'] },
  { title: 'It Almost Worked', artist: 'TV Girl', spotify: '4NUhcsz9E1LrBe8nXLZqzp', cover: 'it-almost-worked', palette: ['#020408', '#0b2233', '#c9f4ff', '#27b6e6'] },
  { title: 'County', artist: 'Alex G', spotify: '0boOQ81nFpxt2n7OCxXGcG', cover: 'county', palette: ['#141a10', '#58703f', '#f6f0da', '#c2483e'] },
  { title: 'Anthems For A Seventeen Year-Old Girl', artist: 'yeule', spotify: '15kuqWifv5GzGq3A2P6EbC', cover: 'anthems', palette: ['#0b0614', '#3b1f5c', '#ffd6f4', '#3fdc9a'] },
  { title: 'sun and moon', artist: 'mage tears', spotify: '1fkJeS8eigd7lwml2aqIGG', cover: 'sun-and-moon', palette: ['#1f1d22', '#7a7580', '#fbf7f0', '#a79ad6'] },
  { title: 'Kicker', artist: 'Alex G', spotify: '1fIQvCdSwK3PGLxxkFsiMr', cover: 'kicker', palette: ['#1a1e1c', '#5d6c68', '#f5f1e4', '#5aa3c8'] },
  { title: 'Walk Away', artist: 'Alex G', spotify: '36hTYlFbEsH2SOu24KJNtH', cover: 'walk-away', palette: ['#070a1a', '#1f2c5a', '#f1e9ff', '#c0392b'] },
  { title: 'Gretel', artist: 'Alex G', spotify: '1i6axTp0VHKEWxPsQsHugc', cover: 'gretel', palette: ['#070a1a', '#243263', '#eef0ff', '#d35050'] },
  { title: 'Boy', artist: 'Alex G', spotify: '3sBq5cKi3jhdrhlfUwW2l8', cover: 'boy', palette: ['#0c1a10', '#2f7a3a', '#f5ffe6', '#7ecf3a'] },
  { title: 'After Ur Gone', artist: 'Alex G', spotify: '5BjwwMwWSp2Zv7O8oYrz8N', cover: 'after-ur-gone', palette: ['#0b1a0f', '#2c6f36', '#f0ffe0', '#9be04a'] },
  { title: 'The Same', artist: 'Alex G', spotify: '7tcmxexcz66H462fzWsAsA', cover: 'the-same', palette: ['#0c1d33', '#3f78b8', '#eaf5ff', '#e03a8c'] },
  { title: 'After All', artist: 'Alex G', spotify: '1wHiZMPV9waV8Uru0eW26d', cover: 'after-all', palette: ['#0f1a2a', '#3f6fa0', '#fff6dc', '#e2862f'] },
  { title: "They'll Only Miss You When You Leave", artist: "Carissa's Wierd", spotify: '15HjxMKhAthegIWk5qjBLW', cover: 'only-miss-you', palette: ['#1a0704', '#6e200e', '#ffe2a8', '#f0a02a'] },
  { title: '恋愛サーキュレーション', artist: '物語シリーズ', spotify: '6OqWHLHeQMTgDwtYAY8uiO', cover: 'renai-circulation', palette: ['#241522', '#b0476b', '#fff3f5', '#39c3cf'] },
  { title: 'ラグトレイン', artist: 'INABAKUMORI', spotify: '6v8fX5yXd15H3xSyvVvJ5e', cover: 'rag-train', palette: ['#121214', '#5b5b62', '#f6f6f6', '#9a9aa6'] },
  { title: 'Kuchuu Buranko (空中ブランコ)', artist: 'ROCKSTXR!, Ronerom', spotify: '76wYJ52u3p4eRzMdHomDag', cover: 'kuchuu-buranko', palette: ['#0a0808', '#3c3230', '#f4e8e0', '#b8a49a'] },
  { title: 'ヒトガワリ', artist: 'きくおはな', spotify: '40KFocvzK7xc1jHzBDM8k4', cover: 'hitogawari', palette: ['#16121a', '#5b4b63', '#fff4ea', '#e46b8f'] },
  { title: 'odoriko', artist: 'Vaundy', spotify: '1uK4zAdMcBRyinAOArUA5X', cover: 'odoriko', palette: ['#1a0c0a', '#6e2a1f', '#ffe6d6', '#e8472d'] },
  { title: '風神', artist: 'Vaundy', spotify: '00GDUNeJd97qjKp2yrx0OC', cover: 'fujin', palette: ['#2a1a3a', '#9a6fc4', '#fff8e8', '#f2c14b'] },
  { title: 'DAI DAI DAI KIRAI', artist: 'dennokop', spotify: '5IHJVTiUEkaTQYH1tibQVu', cover: 'dai-dai-dai-kirai', palette: ['#241a14', '#8a6a52', '#fff1e2', '#d9a47c'] },
  { title: 'Conflict', artist: 'DURDN', spotify: '6riC3JbelswTdXrOyuREzM', cover: 'conflict', palette: ['#050d08', '#1b3a26', '#e6f5e6', '#6aa77c'] },
  { title: '鏡面の波', artist: 'YURiKA', spotify: '17pYAFEZjKZFU5PHiUMzqx', cover: 'kyoumen-no-nami', palette: ['#1b1b24', '#6d6d86', '#fdfcff', '#b3b7e8'] },
  { title: 'Thousand Vinegar', artist: 'The Wisely Brothers', album: '3AYs0rKyyubfym59RY719v', spotify: 'wisely-thousand-vinegar', cover: 'thousand-vinegar', palette: ['#241c18', '#8d7466', '#fff5ea', '#d9795e'] },
  { title: 'カワキヲアメク', artist: '美波', spotify: '1gUAX2ImxDsB3YDcyxMXlB', cover: 'kawaki-wo-ameku', palette: ['#1d1e22', '#7d8089', '#ffffff', '#c9ccd6'] }
];
