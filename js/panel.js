/* ==========================================================
   panel.js — renn's door (panel.html)
   Signing in against the login server (api.login in api.js),
   and the little control panel behind it. Kept from the old
   version of the site; the room itself never needs it.
   ========================================================== */
(() => {
  const Void = window.Void;
  const { $, store } = Void;
  const TOKEN_KEY = 'void_auth_token';
  const USER_KEY = 'void_user';

  // a JWT with an expiry date is respected
  function expired(token) {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    try {
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      return typeof payload.exp === 'number' && payload.exp * 1000 < Date.now();
    } catch {
      return false;
    }
  }

  const token = () => store.raw(TOKEN_KEY);
  const signedIn = () => !!token() && !expired(token());

  function render() {
    const inside = signedIn();
    $('#loginForm').hidden = inside;
    $('#panel').hidden = !inside;
    if (inside) {
      const user = store.get(USER_KEY, {}) || {};
      $('#who').textContent = String(user.username || user.name || 'renn');
    }
  }

  function signOut() {
    store.remove(TOKEN_KEY);
    store.remove(USER_KEY);
    render();
  }

  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = $('#loginStatus');
    const submit = $('#loginSubmit');
    const username = $('#loginUser').value.trim();
    const password = $('#loginPass').value;
    const say = (text) => { status.textContent = text; status.hidden = false; };
    if (!username || !password) { say('enter your username and password.'); return; }
    status.hidden = true;
    submit.disabled = true;
    Void.buttonLabel(submit, 'checking…');
    try {
      const data = await Void.api.login(username, password);
      const t = data.token || data.accessToken || data.access_token;
      if (!t) throw Object.assign(new Error('no token'), { status: 502 });
      store.setRaw(TOKEN_KEY, t);
      store.set(USER_KEY, data.user || { username });
      e.target.reset();
      render();
    } catch (err) {
      say([400, 401, 403].includes(err.status) ? 'wrong username or password.' : Void.describeError(err, 'the login server'));
    } finally {
      Void.resetButton(submit);
    }
  });

  $('#createUserForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = $('#createUserStatus');
    const username = $('#newUsername').value.trim();
    const password = $('#newPassword').value;
    status.dataset.tone = 'error';
    if (username.length < 2 || password.length < 4) {
      status.textContent = 'use at least 2 characters for the username and 4 for the password.';
      return;
    }
    try {
      await Void.api.createUser(username, password);
      const li = document.createElement('li');
      li.textContent = username;
      $('#userList').append(li);
      e.target.reset();
      status.dataset.tone = 'ok';
      status.textContent = `added ${username}.`;
    } catch (err) {
      status.textContent = err.code === 'not-wired'
        ? "adding people isn't connected to the server yet (api.createUser in js/api.js)."
        : Void.describeError(err, 'the server');
    }
  });

  $('#logoutBtn').addEventListener('click', signOut);
  if (token() && !signedIn()) signOut();
  render();
})();
