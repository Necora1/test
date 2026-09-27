/* ==========================================================
   music.js — "add a song" search
   1. Spotify (through your token worker)
   2. Apple Music / iTunes   ┐ fallbacks that work without
   3. Deezer                 ┘ CORS proxies (JSONP)
   ========================================================== */
(() => {
  const { $, config, jsonp, fetchWithTimeout } = Void;
  const api = (Void.api = Void.api || {});

  // Spotify lowered the search limit for Development Mode apps to 10
  // (February 2026). Asking for more returns an error, which is what
  // broke the old search.
  const SPOTIFY_LIMIT = 10;
  const FALLBACK_LIMIT = 15;
  const SOURCE_NAMES = { spotify: 'Spotify', apple: 'Apple Music', deezer: 'Deezer' };

  /* ---------- Spotify ---------- */
  let token = null;
  let tokenExpires = 0;
  let tokenRequest = null;
  let spotifyPausedUntil = 0; // after a failure, skip Spotify for a minute instead of waiting on it every search

  async function getSpotifyToken(force = false) {
    if (!config.spotifyTokenUrl) return null;
    if (!force && token && Date.now() < tokenExpires) return token;
    if (!tokenRequest) {
      tokenRequest = (async () => {
        const res = await fetchWithTimeout(config.spotifyTokenUrl, {}, 6000);
        if (!res.ok) throw new Error(`token endpoint answered ${res.status}`);
        const data = await res.json();
        const value = data.access_token || data.accessToken || data.token;
        if (!value) throw new Error('token endpoint sent no access_token');
        token = value;
        tokenExpires = Date.now() + Math.max(60, (Number(data.expires_in) || 3600) - 60) * 1000;
        return value;
      })().finally(() => { tokenRequest = null; });
    }
    return tokenRequest;
  }

  const pickImage = (images, width) => {
    if (!images || !images.length) return '';
    return images.slice().sort((a, b) => Math.abs((a.width || 0) - width) - Math.abs((b.width || 0) - width))[0].url;
  };

  async function searchSpotify(query) {
    if (Date.now() < spotifyPausedUntil) return null;
    try {
      let access = await getSpotifyToken();
      if (!access) return null;
      const url = `https://api.spotify.com/v1/search?type=track&limit=${SPOTIFY_LIMIT}&q=${encodeURIComponent(query)}`;
      let res = await fetchWithTimeout(url, { headers: { Authorization: `Bearer ${access}` } }, 7000);
      if (res.status === 401) {
        access = await getSpotifyToken(true);
        res = await fetchWithTimeout(url, { headers: { Authorization: `Bearer ${access}` } }, 7000);
      }
      if (!res.ok) throw new Error(`search answered ${res.status}`);
      const data = await res.json();
      return (data.tracks?.items || []).filter(Boolean).map((t) => ({
        title: t.name,
        artist: (t.artists || []).map((a) => a.name).join(', '),
        url: t.external_urls?.spotify || `https://open.spotify.com/track/${t.id}`,
        coverSmall: pickImage(t.album?.images, 64),
        coverLarge: pickImage(t.album?.images, 640),
        source: 'spotify'
      }));
    } catch (err) {
      spotifyPausedUntil = Date.now() + 60000;
      throw err;
    }
  }

  /* ---------- fallbacks ---------- */
  async function searchApple(query) {
    const data = await jsonp(`https://itunes.apple.com/search?media=music&entity=song&limit=${FALLBACK_LIMIT}&term=${encodeURIComponent(query)}`);
    return (data.results || []).filter((t) => t.trackName && t.trackViewUrl).map((t) => ({
      title: t.trackName,
      artist: t.artistName || '',
      url: t.trackViewUrl,
      coverSmall: t.artworkUrl60 || t.artworkUrl100 || '',
      coverLarge: (t.artworkUrl100 || '').replace('100x100bb', '600x600bb'),
      source: 'apple'
    }));
  }

  async function searchDeezer(query) {
    const data = await jsonp(`https://api.deezer.com/search?output=jsonp&limit=${FALLBACK_LIMIT}&q=${encodeURIComponent(query)}`);
    return (data.data || []).filter((t) => t.title && t.link).map((t) => ({
      title: t.title,
      artist: t.artist?.name || '',
      url: t.link,
      coverSmall: t.album?.cover_small || t.album?.cover_medium || '',
      coverLarge: t.album?.cover_big || t.album?.cover_xl || '',
      source: 'deezer'
    }));
  }

  const providers = [['spotify', searchSpotify], ['apple', searchApple], ['deezer', searchDeezer]];

  // Resolves to { tracks, source }. A provider that answers with zero
  // results ends the search; one that fails hands over to the next.
  api.searchSongs = async (query) => {
    const failures = [];
    for (const [name, search] of providers) {
      try {
        const tracks = await search(query);
        if (tracks) return { tracks, source: name };
      } catch (err) {
        failures.push(`${name}: ${err.message}`);
        console.warn(`[music] ${name} search failed:`, err.message);
      }
    }
    throw Object.assign(new Error('every search failed'), { details: failures });
  };

  /* ---------- the search dialog ---------- */
  Void.music = {
    init() {
      const input = $('#songSearch');
      const results = $('#searchResults');
      const source = $('#searchSource');
      let debounce = 0;
      let run = 0;

      const message = (text, tone = '') => {
        const p = document.createElement('p');
        p.className = `search-note${tone ? ` is-${tone}` : ''}`;
        p.textContent = text;
        results.replaceChildren(p);
        source.textContent = '';
      };

      const idle = () => message('Type a song or an artist.');

      const loading = () => {
        const rows = [];
        for (let i = 0; i < 5; i++) {
          const row = document.createElement('div');
          row.className = 'track is-skeleton';
          row.innerHTML = '<span class="track-cover"></span><span class="track-text"><span class="sk-line"></span><span class="sk-line is-short"></span></span>';
          rows.push(row);
        }
        results.replaceChildren(...rows);
        source.textContent = '';
      };

      const render = (tracks, from) => {
        if (!tracks.length) {
          message('No songs found. Try another spelling.');
          return;
        }
        const items = tracks.map((track) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'track';
          const cover = document.createElement('img');
          cover.className = 'track-cover';
          cover.alt = '';
          cover.loading = 'lazy';
          cover.decoding = 'async';
          cover.referrerPolicy = 'no-referrer';
          if (track.coverSmall) cover.src = track.coverSmall;
          const text = document.createElement('span');
          text.className = 'track-text';
          const title = document.createElement('span');
          title.className = 'track-title';
          title.textContent = track.title;
          const artist = document.createElement('span');
          artist.className = 'track-artist';
          artist.textContent = track.artist;
          text.append(title, artist);
          btn.append(cover, text);
          btn.addEventListener('click', () => {
            Void.emit('song:attach', track);
            Void.modal.close('musicModal');
          });
          return btn;
        });
        results.replaceChildren(...items);
        results.scrollTop = 0;
        source.textContent = SOURCE_NAMES[from] ? `Results from ${SOURCE_NAMES[from]}` : String(from || '');
      };

      const search = async (query) => {
        const id = ++run;
        try {
          const { tracks, source: from } = await api.searchSongs(query);
          if (id === run) render(tracks, from);
        } catch {
          if (id === run) message("Couldn't reach any music service. Check your connection and try again.", 'error');
        }
      };

      input.addEventListener('input', () => {
        clearTimeout(debounce);
        const query = input.value.trim();
        if (!query) { run++; idle(); return; }
        loading();
        debounce = setTimeout(() => search(query), 350);
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          clearTimeout(debounce);
          const query = input.value.trim();
          if (query) { loading(); search(query); }
        } else if (e.key === 'ArrowDown') {
          const first = results.querySelector('button.track');
          if (first) { e.preventDefault(); first.focus(); }
        }
      });

      // arrow keys move through the results
      results.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        const items = [...results.querySelectorAll('button.track')];
        const i = items.indexOf(document.activeElement);
        if (i < 0) return;
        e.preventDefault();
        if (e.key === 'ArrowUp' && i === 0) input.focus();
        else items[Math.min(items.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)))].focus();
      });

      Void.music.open = () => {
        Void.modal.open('musicModal');
        if (!input.value.trim()) idle();
        setTimeout(() => input.focus(), 60);
      };

      Void.on('modal:close', (id) => {
        if (id !== 'musicModal') return;
        clearTimeout(debounce);
        run++;
        input.value = '';
        idle();
      });

      idle();
    }
  };
})();
