/* ==========================================================
   messages.js — the "send me something" page: write / draw
   tabs and the anonymous text message
   ========================================================== */
(() => {
  const { $, $$, config, store } = Void;
  const DRAFT_KEY = 'void_draft';

  function wireTabs() {
    const tablist = $('#sendTabs');
    const tabs = $$('[role="tab"]', tablist);

    const select = (tab, focus = false) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        $(`#${t.getAttribute('aria-controls')}`).hidden = !on;
      });
      tablist.dataset.active = tab.dataset.tab;
      if (focus) tab.focus();
      Void.emit('send:tab', tab.dataset.tab);
    };

    tabs.forEach((tab) => tab.addEventListener('click', () => select(tab)));
    tablist.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      e.preventDefault();
      select(tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length], true);
    });
  }

  function wireMessage() {
    const text = $('#messageText');
    const count = $('#charCount');
    const button = $('#sendMessageBtn');
    const status = $('#messageStatus');
    const attach = $('#openMusicBtn');
    const chip = $('#songChip');
    const max = config.messageMaxLength;
    let song = null;

    text.maxLength = max;

    const updateCount = () => {
      const n = text.value.length;
      count.textContent = `${n} / ${max}`;
      count.classList.toggle('is-near', n > max * 0.9 && n < max);
      count.classList.toggle('is-full', n >= max);
    };

    const grow = () => {
      if (!text.offsetParent) return; // hidden: nothing to measure
      text.style.height = 'auto';
      text.style.height = `${Math.min(text.scrollHeight + 2, 420)}px`;
    };

    const setSong = (track) => {
      song = track;
      chip.hidden = !track;
      attach.hidden = !!track;
      if (!track) return;
      const cover = $('#songChipCover');
      cover.hidden = !track.coverSmall;
      if (track.coverSmall) cover.src = track.coverSmall;
      $('#songChipTitle').textContent = track.title;
      $('#songChipArtist').textContent = track.artist;
    };

    const say = (msg, tone = '') => {
      status.textContent = msg;
      status.dataset.tone = tone;
    };

    // keep an unsent draft if the page is closed
    text.value = store.get(DRAFT_KEY, '') || '';
    updateCount();

    text.addEventListener('input', () => {
      updateCount();
      grow();
      store.set(DRAFT_KEY, text.value);
      if (status.dataset.tone === 'error') say('');
    });
    text.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        send();
      }
    });

    attach.addEventListener('click', () => Void.music.open());
    $('#songChipChange').addEventListener('click', () => Void.music.open());
    $('#songChipRemove').addEventListener('click', () => {
      setSong(null);
      attach.focus();
    });
    Void.on('song:attach', (track) => {
      setSong(track);
      say('');
    });
    Void.on('modal:close', (id) => {
      if (id === 'musicModal' && song) $('#songChipChange').focus({ preventScroll: true });
    });

    async function send() {
      if (Void.sending) return;
      const message = text.value.trim();
      if (!message && !song) {
        say('Write something or add a song first.', 'error');
        text.focus();
        return;
      }

      Void.sending = true;
      say('');
      button.disabled = true;
      button.classList.add('is-busy');
      Void.buttonLabel(button, 'Sending…');

      try {
        await Void.api.sendText({ text: message, song });
        text.value = '';
        store.remove(DRAFT_KEY);
        setSong(null);
        updateCount();
        grow();
        button.classList.remove('is-busy');
        button.classList.add('is-done');
        Void.buttonLabel(button, 'Sent! ✍️✨');
        if (config.preview) say('Preview: nothing was actually sent.', 'ok');
        await Promise.all([Void.warp.start('send'), Void.wait(1800)]);
      } catch (err) {
        button.classList.remove('is-busy');
        button.classList.add('is-error');
        Void.buttonLabel(button, 'Failed to send ❌');
        say(Void.describeError(err, 'Discord'), 'error');
        await Void.wait(1600);
      } finally {
        Void.resetButton(button);
        Void.sending = false;
      }
    }

    button.addEventListener('click', send);
    Void.on('page:shown', (id) => { if (id === 'send') requestAnimationFrame(grow); });
    Void.on('send:tab', (tab) => { if (tab === 'write') requestAnimationFrame(grow); });
  }

  Void.messages = {
    init() {
      wireTabs();
      wireMessage();
    }
  };
})();
