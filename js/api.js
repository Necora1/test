/* ==========================================================
   api.js — talking to the outside world
   (login server + Discord). Song search lives in music.js.
   ========================================================== */
(() => {
  const { config, fetchWithTimeout } = Void;
  const api = (Void.api = Void.api || {});

  const httpError = (res) => Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
  const configError = () => Object.assign(new Error('not configured'), { code: 'config' });

  // Escape Discord markdown so song titles can't break the link
  const md = (s) => String(s ?? '').replace(/([\\`*_~|[\]])/g, '\\$1');

  /* ---------- login server ---------- */
  api.login = async (username, password) => {
    if (!config.apiUrl) throw configError();
    const res = await fetchWithTimeout(`${config.apiUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    }, 12000);
    if (!res.ok) throw httpError(res);
    return res.json().catch(() => ({}));
  };

  // The control panel form is ready, but the server route isn't known yet.
  // Replace the body of this function once your server has an endpoint for it.
  api.createUser = async (/* username, password */) => {
    throw Object.assign(new Error('not wired'), { code: 'not-wired' });
  };

  /* ---------- Discord ---------- */
  async function post(kind, body) {
    const relay = config.relayUrl ? `${config.relayUrl.replace(/\/+$/, '')}/send/${kind}` : '';
    const url = relay || config.webhooks[kind];
    if (!url) throw configError();

    const options = { method: 'POST', body };
    if (typeof body === 'string') options.headers = { 'Content-Type': 'application/json' };

    const res = await fetchWithTimeout(url, options, 20000);
    if (!res.ok) throw httpError(res);
  }

  api.sendText = ({ text, song }) => {
    const embed = {
      title: '✍️ New anonymous message received.',
      description: text ? text.slice(0, 4000) : '*No text, just vibes.*',
      color: song ? 0x1DB954 : 0xFFFFFF,
      footer: { text: "Renn's Void • Anonymous Text" },
      timestamp: new Date().toISOString()
    };

    if (song) {
      const lines = [`[${md(song.title)} — ${md(song.artist)}](${String(song.url).replace(/\)/g, '%29')})`];
      if (song.source !== 'spotify') {
        const q = encodeURIComponent(`${song.title} ${song.artist}`);
        lines.push(`[Find it on Spotify](https://open.spotify.com/search/${q})`);
      }
      embed.fields = [{ name: '🎵 Attached song', value: lines.join('\n').slice(0, 1024) }];
      if (song.coverLarge) embed.thumbnail = { url: song.coverLarge };
    }

    // allowed_mentions: nobody gets pinged, whatever a visitor types
    return post('text', JSON.stringify({ embeds: [embed], allowed_mentions: { parse: [] } }));
  };

  api.sendDrawing = (blob) => {
    const form = new FormData();
    form.append('file', blob, 'drawing.png');
    form.append('payload_json', JSON.stringify({
      embeds: [{
        title: '🎨 New anonymous drawing received.',
        color: 0xFFFFFF,
        image: { url: 'attachment://drawing.png' },
        footer: { text: "Renn's Void • Anonymous Canvas" },
        timestamp: new Date().toISOString()
      }],
      allowed_mentions: { parse: [] }
    }));
    return post('drawing', form);
  };
})();
