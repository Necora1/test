/* ==========================================================
   auth.js — login, logout, profile and the control panel
   Uses the same storage keys as before, so existing sessions stay.
   ========================================================== */
(() => {
  const { $, store, modal } = Void;
  const TOKEN_KEY = 'void_auth_token';
  const USER_KEY = 'void_user';
  const auth = (Void.auth = {});

  // If the token is a JWT with an expiry date, respect it
  function isExpired(token) {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    try {
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      return typeof payload.exp === 'number' && payload.exp * 1000 < Date.now();
    } catch {
      return false;
    }
  }

  auth.token = () => store.raw(TOKEN_KEY);
  auth.user = () => store.get(USER_KEY, null);
  auth.isLoggedIn = () => {
    const token = auth.token();
    return !!token && !isExpired(token);
  };

  function render() {
    const inside = auth.isLoggedIn();
    $('#loginBtn').hidden = inside;
    $('#panelBtn').hidden = !inside;
    $('#profileBtn').hidden = !inside;
    $('#logoutBtn').hidden = !inside;
  }

  auth.logout = () => {
    store.remove(TOKEN_KEY);
    store.remove(USER_KEY);
    render();
    Void.emit('auth', false);
  };

  function wireLogin() {
    const form = $('#loginForm');
    const user = $('#loginUser');
    const pass = $('#loginPass');
    const error = $('#loginError');
    const submit = $('#loginSubmit');

    const showError = (text) => {
      error.textContent = text;
      error.hidden = false;
    };

    $('#loginBtn').addEventListener('click', () => {
      error.hidden = true;
      modal.open('loginModal');
      setTimeout(() => user.focus(), 60);
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = user.value.trim();
      const password = pass.value;
      if (!username || !password) {
        showError('Enter your username and password.');
        (username ? pass : user).focus();
        return;
      }

      error.hidden = true;
      submit.disabled = true;
      submit.classList.add('is-busy');
      Void.buttonLabel(submit, 'CHECKING…');

      try {
        const data = await Void.api.login(username, password);
        const token = data.token || data.accessToken || data.access_token;
        if (!token) throw Object.assign(new Error('no token'), { status: 502 });
        store.setRaw(TOKEN_KEY, token);
        store.set(USER_KEY, data.user || { username });
        form.reset();
        modal.close('loginModal');
        render();
        Void.emit('auth', true);
        Void.nav.go('admin');
      } catch (err) {
        if ([400, 401, 403].includes(err.status)) showError('Wrong username or password.');
        else showError(Void.describeError(err, 'The login server'));
      } finally {
        Void.resetButton(submit);
      }
    });
  }

  function wireSession() {
    $('#logoutBtn').addEventListener('click', () => modal.open('logoutModal'));
    $('#confirmLogoutBtn').addEventListener('click', () => {
      modal.close('logoutModal');
      auth.logout();
    });

    $('#profileBtn').addEventListener('click', () => {
      const user = auth.user() || {};
      const name = String(user.username || user.name || 'entity');
      $('#profileName').textContent = name;
      $('#profileRole').textContent = String(user.role || 'entity');
      $('#profileAvatar').textContent = name.charAt(0).toUpperCase();
      modal.open('profileModal');
    });

    $('#profileLogoutBtn').addEventListener('click', () => {
      modal.close('profileModal');
      auth.logout();
    });
  }

  function wirePanel() {
    const form = $('#createUserForm');
    const status = $('#createUserStatus');
    const list = $('#userList');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = $('#newUsername').value.trim();
      const password = $('#newPassword').value;
      status.dataset.tone = 'error';

      if (username.length < 2 || password.length < 4) {
        status.textContent = 'Use at least 2 characters for the username and 4 for the password.';
        return;
      }

      try {
        await Void.api.createUser(username, password);
        const li = document.createElement('li');
        li.className = 'entity';
        const name = document.createElement('span');
        name.textContent = username;
        li.append(name);
        list.append(li);
        form.reset();
        status.dataset.tone = 'ok';
        status.textContent = `Added ${username}.`;
      } catch (err) {
        status.textContent = err.code === 'not-wired'
          ? "Adding entities isn't connected to the server yet (see api.createUser in js/api.js)."
          : Void.describeError(err, 'The server');
      }
    });
  }

  auth.init = () => {
    // forget sessions whose token has expired
    if (auth.token() && !auth.isLoggedIn()) {
      store.remove(TOKEN_KEY);
      store.remove(USER_KEY);
    }
    render();
    wireLogin();
    wireSession();
    wirePanel();
  };
})();
