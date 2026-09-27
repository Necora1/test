/* ==========================================================
   void-worker.js — optional Cloudflare Worker for Renn's Void

   What it does
     GET  /  or /token   Spotify token for the song search
                         { access_token, token_type, expires_in }
     POST /send/text     forwards an anonymous message to Discord
     POST /send/drawing  forwards an anonymous drawing to Discord
     GET  /pinterest     the gallery's pins, if the browser can't
                         reach Pinterest's widget feed itself
                         (?user=…&board=…)

   Why: the website then never contains your Discord webhook URLs,
   so nobody can copy them to spam the channel as "anyone" or
   delete the webhook. The Spotify part is a drop-in replacement
   for the token worker you already use.

   Setup (Cloudflare dashboard → Workers → your worker → Settings →
   Variables and Secrets), add these as secrets:
     SPOTIFY_CLIENT_ID      from developer.spotify.com
     SPOTIFY_CLIENT_SECRET  from developer.spotify.com
     TEXT_WEBHOOK_URL       Discord webhook for messages
     DRAWING_WEBHOOK_URL    Discord webhook for drawings
   and these as plain variables:
     ALLOWED_ORIGINS        comma separated, e.g. https://zeroedmyworld.com,https://www.zeroedmyworld.com
     PINTEREST_USER         optional, e.g. xqygen (only this account can be fetched)

   Then in js/config.js set relayUrl to the worker address and
   empty the two webhook URLs. Rotate (re-create) both webhooks in
   Discord afterwards, because the old URLs were public.
   ========================================================== */

let cachedToken = null;
let cachedUntil = 0;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    try {
      if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/token')) {
        return json(await spotifyToken(env), 200, cors);
      }
      if (request.method === 'GET' && url.pathname === '/pinterest') return pinterest(request, url, env, cors);
      if (request.method === 'POST' && url.pathname === '/send/text') return sendText(request, env, cors);
      if (request.method === 'POST' && url.pathname === '/send/drawing') return sendDrawing(request, env, cors);
      return json({ error: 'Not found' }, 404, cors);
    } catch (err) {
      return json({ error: 'Upstream error' }, 502, cors);
    }
  }
};

/* ---------- helpers ---------- */
function allowedOrigins(env) {
  return (env.ALLOWED_ORIGINS || '*').split(',').map((s) => s.trim()).filter(Boolean);
}

function originAllowed(request, env) {
  const list = allowedOrigins(env);
  return list.includes('*') || list.includes(request.headers.get('Origin') || '');
}

function corsHeaders(request, env) {
  const list = allowedOrigins(env);
  const origin = request.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': list.includes('*') ? '*' : (list.includes(origin) ? origin : list[0] || ''),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
}

const cut = (value, max) => String(value ?? '').slice(0, max);

/* ---------- Spotify ---------- */
async function spotifyToken(env) {
  if (cachedToken && Date.now() < cachedUntil) {
    return { access_token: cachedToken, token_type: 'Bearer', expires_in: Math.floor((cachedUntil - Date.now()) / 1000) };
  }
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`)}`
    },
    body: 'grant_type=client_credentials'
  });
  if (!res.ok) throw new Error(`Spotify token request failed (${res.status})`);
  const data = await res.json();
  const life = Math.max(60, (Number(data.expires_in) || 3600) - 120);
  cachedToken = data.access_token;
  cachedUntil = Date.now() + life * 1000;
  return { access_token: cachedToken, token_type: 'Bearer', expires_in: life };
}

/* ---------- Discord ---------- */
async function forward(webhook, init, cors) {
  if (!webhook) return json({ error: 'Not configured' }, 500, cors);
  const res = await fetch(webhook, init);
  if (res.ok) return new Response(null, { status: 204, headers: cors });
  return json({ error: 'Discord refused the message' }, res.status === 429 ? 429 : 502, cors);
}

async function sendText(request, env, cors) {
  if (!originAllowed(request, env)) return json({ error: 'Forbidden' }, 403, cors);
  const raw = await request.text();
  if (raw.length > 12000) return json({ error: 'Too large' }, 413, cors);

  let payload;
  try { payload = JSON.parse(raw); } catch { return json({ error: 'Bad request' }, 400, cors); }
  const e = Array.isArray(payload.embeds) ? payload.embeds[0] : null;
  if (!e || typeof e !== 'object') return json({ error: 'Bad request' }, 400, cors);

  // Rebuild the embed so only the expected fields get through
  const embed = {
    title: '✍️ New anonymous message received.',
    description: cut(e.description, 4000) || '*No text, just vibes.*',
    color: Number.isInteger(e.color) ? e.color : 0xffffff,
    footer: { text: "Renn's Void • Anonymous Text" },
    timestamp: new Date().toISOString()
  };
  const field = Array.isArray(e.fields) ? e.fields[0] : null;
  if (field) embed.fields = [{ name: cut(field.name, 100), value: cut(field.value, 1024) }];
  if (e.thumbnail && /^https:\/\//.test(e.thumbnail.url || '')) embed.thumbnail = { url: cut(e.thumbnail.url, 500) };

  return forward(env.TEXT_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds: [embed], allowed_mentions: { parse: [] } })
  }, cors);
}

async function sendDrawing(request, env, cors) {
  if (!originAllowed(request, env)) return json({ error: 'Forbidden' }, 403, cors);
  let form;
  try { form = await request.formData(); } catch { return json({ error: 'Bad request' }, 400, cors); }
  const file = form.get('file');
  if (!file || typeof file === 'string' || file.size > 3000000) return json({ error: 'Bad drawing' }, 400, cors);

  const out = new FormData();
  out.append('file', file, 'drawing.png');
  out.append('payload_json', JSON.stringify({
    embeds: [{
      title: '🎨 New anonymous drawing received.',
      color: 0xffffff,
      image: { url: 'attachment://drawing.png' },
      footer: { text: "Renn's Void • Anonymous Canvas" },
      timestamp: new Date().toISOString()
    }],
    allowed_mentions: { parse: [] }
  }));
  return forward(env.DRAWING_WEBHOOK_URL, { method: 'POST', body: out }, cors);
}

/* ---------- Pinterest (gallery fallback) ---------- */
async function pinterest(request, url, env, cors) {
  if (!originAllowed(request, env)) return json({ error: 'Forbidden' }, 403, cors);
  const safe = (v) => String(v || '').replace(/[^\w.-]/g, '').slice(0, 60);
  const user = safe(url.searchParams.get('user') || env.PINTEREST_USER);
  const board = safe(url.searchParams.get('board'));
  if (!user) return json({ error: 'No user' }, 400, cors);
  if (env.PINTEREST_USER && user !== safe(env.PINTEREST_USER)) return json({ error: 'Forbidden' }, 403, cors);

  const feed = board
    ? `https://widgets.pinterest.com/v3/pidgets/boards/${user}/${board}/pins/`
    : `https://widgets.pinterest.com/v3/pidgets/users/${user}/pins/`;
  const res = await fetch(feed, { headers: { Accept: 'application/json' }, cf: { cacheTtl: 900, cacheEverything: true } });
  if (!res.ok) return json({ error: 'Pinterest refused' }, 502, cors);
  const data = await res.json();
  const pins = Array.isArray(data?.data?.pins) ? data.data.pins : [];
  return json({ pins }, 200, { ...cors, 'Cache-Control': 'public, max-age=900' });
}
