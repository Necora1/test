/* ==========================================================
   pinterest.js — the gallery's pictures, from Pinterest's
   public widget feed (the one their profile widget uses), so
   no key is needed. Shared by both versions of the site.

   Void.pinterest.load() → Promise of
     [{ w, h, thumb, full, color, text, link, key }, …]
   The request is made once and shared; after a failure the
   next call tries again.
   ========================================================== */
(() => {
  const { config, jsonp, fetchWithTimeout } = Void;
  let request = null;

  const clean = (s) => String(s || '').trim().replace(/^\/+|\/+$/g, '');
  const user = () => clean(config.pinterest?.user);
  const board = () => clean(config.pinterest?.board);

  const profileUrl = () => `https://www.pinterest.com/${encodeURIComponent(user())}/${board() ? `${encodeURIComponent(board())}/` : ''}`;

  const feedUrl = () => (board()
    ? `https://widgets.pinterest.com/v3/pidgets/boards/${encodeURIComponent(user())}/${encodeURIComponent(board())}/pins/`
    : `https://widgets.pinterest.com/v3/pidgets/users/${encodeURIComponent(user())}/pins/`);

  // Pinterest image addresses carry their size: …/236x/…, …/564x/…, …/736x/…
  const resize = (url, size) => url.replace(/\/(\d+x\d*|originals)\//, `/${size}/`);

  function normalize(raw, i) {
    const images = Object.values(raw?.images || {}).filter((im) => im && typeof im.url === 'string');
    if (!images.length) return null;
    const best = images.sort((a, b) => (Number(b.width) || 0) - (Number(a.width) || 0))[0];
    const color = String(raw.dominant_color || '');
    return {
      w: Number(best.width) || 0,
      h: Number(best.height) || 0,
      thumb: resize(best.url, '564x'),
      full: resize(best.url, '736x'),
      color: /^#[0-9a-f]{3,8}$/i.test(color) ? color : '#1b1b1f',
      text: String(raw.description || raw.title || '').trim(),
      link: raw.id ? `https://www.pinterest.com/pin/${encodeURIComponent(raw.id)}/` : profileUrl(),
      key: String(raw.id || i)
    };
  }

  async function fetchRaw() {
    try {
      const answer = await jsonp(feedUrl(), 10000);
      const list = answer?.data?.pins;
      if (Array.isArray(list)) return list;
      throw new Error(answer?.message || 'Pinterest sent something unexpected');
    } catch (err) {
      // Second chance through your own worker, if you set one up (see README)
      const relay = String(config.relayUrl || '').replace(/\/+$/, '');
      if (!relay) throw err;
      const query = new URLSearchParams({ user: user(), board: board() });
      const res = await fetchWithTimeout(`${relay}/pinterest?${query}`, {}, 10000);
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
      const data = await res.json();
      if (!Array.isArray(data.pins)) throw new Error('the worker sent something unexpected');
      return data.pins;
    }
  }

  Void.pinterest = {
    profileUrl,
    load() {
      if (!request) {
        request = fetchRaw().then((raw) => raw.map(normalize).filter(Boolean));
        request.catch(() => { request = null; });
      }
      return request;
    }
  };
})();
