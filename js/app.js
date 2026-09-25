(function () {
  "use strict";

  var S = window.SITE;
  var TABS = ["about", "blog", "gallery", "contact"];

  function $(sel, root) { return (root || document).querySelector(sel); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function formatDate(iso) {
    var d = new Date(iso + "T00:00:00");
    return isNaN(d) ? iso : d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  }
  function readingTime(html) {
    var words = html.replace(/<[^>]+>/g, " ").trim().split(/\s+/).length;
    return Math.max(1, Math.round(words / 200)) + " min read";
  }

  /* ---------- Theme ---------- */
  var root = document.documentElement;
  try {
    var saved = localStorage.getItem("theme");
    if (saved) root.dataset.theme = saved;
  } catch (e) { /* storage unavailable */ }
  $("#theme-toggle").addEventListener("click", function () {
    var dark = root.dataset.theme
      ? root.dataset.theme === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
    try { localStorage.setItem("theme", root.dataset.theme); } catch (e) { /* ignore */ }
  });

  /* ---------- Header / footer ---------- */
  document.title = S.name;
  $("#site-name").textContent = S.name;
  $("#footer-name").textContent = S.name;
  $("#year").textContent = new Date().getFullYear();
  $("#brand-avatar").src = S.avatar;

  /* ---------- About ---------- */
  $("#about-avatar").src = S.avatar;
  $("#about-avatar").alt = "Photo of " + S.name;
  $("#about-name").textContent = S.name;
  $("#about-tagline").textContent = S.tagline;
  $("#about-bio").innerHTML = S.about.map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("");
  $("#about-facts").innerHTML = S.facts.map(function (f) {
    return "<div><dt>" + esc(f.label) + "</dt><dd>" + esc(f.value) + "</dd></div>";
  }).join("");
  $("#about-links").innerHTML = S.links.map(function (l) {
    var external = /^https?:/.test(l.url);
    return '<li><a href="' + esc(l.url) + '"' + (external ? ' target="_blank" rel="noopener"' : "") + ">" + esc(l.label) + "</a></li>";
  }).join("");

  /* ---------- Blog ---------- */
  var posts = S.posts.slice().sort(function (a, b) { return b.date.localeCompare(a.date); });
  var activeTag = null;

  function renderTags() {
    var tags = [];
    posts.forEach(function (p) { (p.tags || []).forEach(function (t) { if (tags.indexOf(t) < 0) tags.push(t); }); });
    tags.sort();
    var all = [null].concat(tags);
    $("#blog-tags").innerHTML = all.map(function (t) {
      var on = t === activeTag;
      return '<button type="button" class="chip" aria-pressed="' + on + '" data-tag="' + esc(t || "") + '">' + esc(t || "All") + "</button>";
    }).join("");
  }

  function renderList() {
    var shown = posts.filter(function (p) { return !activeTag || (p.tags || []).indexOf(activeTag) >= 0; });
    $("#blog-list").innerHTML = shown.map(function (p) {
      return '<li class="post-item"><a href="#blog/' + esc(p.slug) + '">' +
        '<h2 class="post-item-title">' + esc(p.title) + "</h2>" +
        '<p class="meta"><time datetime="' + esc(p.date) + '">' + esc(formatDate(p.date)) + "</time> · " + readingTime(p.body) + "</p>" +
        "<p>" + esc(p.summary) + "</p></a></li>";
    }).join("") || '<li class="meta">No posts yet.</li>';
  }

  $("#blog-tags").addEventListener("click", function (e) {
    var btn = e.target.closest(".chip");
    if (!btn) return;
    activeTag = btn.dataset.tag || null;
    renderTags();
    renderList();
  });

  function renderBlog(slug) {
    var post = slug && posts.find(function (p) { return p.slug === slug; });
    $("#blog-list-view").hidden = !!post;
    $("#blog-post-view").hidden = !post;
    if (post) {
      $("#post-title").textContent = post.title;
      $("#post-meta").innerHTML = '<time datetime="' + esc(post.date) + '">' + esc(formatDate(post.date)) + "</time> · " +
        readingTime(post.body) + ((post.tags || []).length ? " · " + post.tags.map(esc).join(", ") : "");
      $("#post-body").innerHTML = post.body; // author-provided HTML
      document.title = post.title + " · " + S.name;
      window.scrollTo(0, 0);
    } else {
      renderTags();
      renderList();
    }
  }

  /* ---------- Gallery ---------- */
  var photos = S.gallery;
  var current = 0;
  var lightbox = $("#lightbox");

  $("#gallery-grid").innerHTML = photos.map(function (ph, i) {
    return '<li><button type="button" class="gallery-item" data-index="' + i + '">' +
      '<img src="' + esc(ph.src) + '" alt="' + esc(ph.alt) + '" loading="lazy">' +
      (ph.caption ? '<span class="gallery-caption">' + esc(ph.caption) + "</span>" : "") +
      "</button></li>";
  }).join("") || '<li class="meta">No photos yet.</li>';

  function showPhoto(i) {
    current = (i + photos.length) % photos.length;
    var ph = photos[current];
    $("#lb-img").src = ph.src;
    $("#lb-img").alt = ph.alt;
    $("#lb-caption").textContent = ph.caption || "";
  }

  $("#gallery-grid").addEventListener("click", function (e) {
    var btn = e.target.closest(".gallery-item");
    if (!btn) return;
    showPhoto(Number(btn.dataset.index));
    lightbox.showModal();
  });
  $("#lb-close").addEventListener("click", function () { lightbox.close(); });
  $("#lb-prev").addEventListener("click", function () { showPhoto(current - 1); });
  $("#lb-next").addEventListener("click", function () { showPhoto(current + 1); });
  lightbox.addEventListener("click", function (e) { if (e.target === lightbox) lightbox.close(); });
  lightbox.addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft") showPhoto(current - 1);
    if (e.key === "ArrowRight") showPhoto(current + 1);
  });

  /* ---------- Contact ---------- */
  var C = S.contact;
  var form = $("#contact-form");
  var status = $("#form-status");
  $("#contact-intro").textContent = C.intro;
  if (C.email) {
    $("#contact-direct").innerHTML = 'Prefer email? Write to <a href="mailto:' + esc(C.email) + '">' + esc(C.email) + "</a>.";
  }

  function setStatus(msg, kind) {
    status.textContent = msg;
    status.dataset.kind = kind || "";
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var data = new FormData(form);
    if (data.get("_gotcha")) return; // bot

    var message = String(data.get("message") || "").trim();
    var emailField = form.elements.email;
    var linkField = form.elements.link;
    if (!message) { setStatus("Please write a message first.", "error"); form.elements.message.focus(); return; }
    if (emailField.value && !emailField.checkValidity()) { setStatus("That email address doesn't look right.", "error"); emailField.focus(); return; }
    if (linkField.value && !linkField.checkValidity()) { setStatus("The link should start with http:// or https://", "error"); linkField.focus(); return; }

    var subject = "[" + S.name + " website] " + data.get("kind");

    if (!C.formEndpoint) {
      // No form service configured: hand off to the visitor's email app.
      var body = message +
        (data.get("link") ? "\n\nLink: " + data.get("link") : "") +
        "\n\n— " + (data.get("name") || "Anonymous") + (data.get("email") ? " (" + data.get("email") + ")" : "");
      window.location.href = "mailto:" + encodeURIComponent(C.email) +
        "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
      setStatus("Opening your email app…", "ok");
      return;
    }

    data.append("_subject", subject);
    var btn = $("#contact-submit");
    btn.disabled = true;
    setStatus("Sending…");
    fetch(C.formEndpoint, { method: "POST", body: data, headers: { Accept: "application/json" } })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        form.reset();
        setStatus("Thanks! Your message is on its way.", "ok");
      })
      .catch(function () {
        setStatus("Sorry, that didn't go through. Please try again" + (C.email ? " or email " + C.email : "") + ".", "error");
      })
      .then(function () { btn.disabled = false; });
  });

  /* ---------- Tabs & routing ---------- */
  var tabButtons = Array.prototype.slice.call(document.querySelectorAll('[role="tab"]'));

  var routed = false;
  function route() {
    var parts = location.hash.replace(/^#/, "").split("/");
    var known = TABS.indexOf(parts[0]) >= 0;
    // Ignore in-page anchors like the skip link once a tab is showing.
    if (!known && parts[0] && routed) return;
    routed = true;
    var name = known ? parts[0] : "about";
    tabButtons.forEach(function (b) {
      var on = b.dataset.tab === name;
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
    });
    TABS.forEach(function (t) { $("#panel-" + t).hidden = t !== name; });
    document.title = S.name;
    if (name === "blog") renderBlog(parts[1] ? decodeURIComponent(parts[1]) : null);
  }

  tabButtons.forEach(function (b) {
    b.addEventListener("click", function () {
      if (location.hash === "#" + b.dataset.tab) route();
      else location.hash = b.dataset.tab;
    });
  });

  $(".tabs").addEventListener("keydown", function (e) {
    var i = tabButtons.indexOf(document.activeElement);
    if (i < 0) return;
    var next = null;
    if (e.key === "ArrowRight") next = (i + 1) % tabButtons.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + tabButtons.length) % tabButtons.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabButtons.length - 1;
    if (next === null) return;
    e.preventDefault();
    tabButtons[next].focus();
    tabButtons[next].click();
  });

  window.addEventListener("hashchange", route);
  route();
})();
