# Personal website

A small, dependency-free personal site with four tabs:

- **About**: photo, bio, links and quick facts
- **Blog**: posts with tag filtering and shareable links (`#blog/<slug>`)
- **Gallery**: photo grid with a full-screen viewer (arrow keys / swipe buttons, Esc to close)
- **Contact**: a "send me something" form visitors can use to message you directly

The top of the page is an animated sunset drawn entirely in code (`js/sky.js`, a single `<canvas>`, no images). It includes a glowing sun with turning light rays, drifting clouds lit from below, layered mountains with haze, birds, and floating light specks. Everything moves with parallax as you move the mouse or scroll, and scrolling sinks the sun behind the mountains. Switching to dark mode sets the sun, turns the sky to night, raises the moon, and brings out twinkling stars, shooting stars and fireflies. Visitors who have "reduce motion" turned on get a still picture instead.

It's plain HTML, CSS and JavaScript: no build step, no frameworks. It has light and dark themes, works on phones, and is keyboard accessible.

## Make it yours

Everything you'll want to change is in **`js/content.js`**:

| Section    | What to edit                                                                 |
|------------|------------------------------------------------------------------------------|
| Profile    | `name`, `tagline`, `avatar`                                                  |
| About      | `about` (paragraphs), `facts`, `links`                                       |
| Blog       | `posts`: add an object with `slug`, `title`, `date` (YYYY-MM-DD), `tags`, `summary`, `body` (HTML) |
| Gallery    | Put your images in `images/` and add `{ src, alt, caption }` entries to `gallery` |
| Contact    | `contact.email`, `contact.formEndpoint`, `contact.intro`                     |

Replace the placeholder `images/avatar.svg` and `images/gallery-*.svg` with your own photos (JPG/PNG/WebP all work).

## Receiving messages from visitors

The Contact tab works in two modes:

1. **Direct to your inbox (recommended).** Create a free form at [formspree.io](https://formspree.io), copy its endpoint (looks like `https://formspree.io/f/abcdwxyz`), and paste it into `contact.formEndpoint`. Visitors click **Send** and the message is emailed to you without them leaving the page. If they give an email address, you can reply to it directly. A hidden honeypot field filters out basic spam bots.
2. **Fallback.** If `formEndpoint` is empty, pressing **Send** opens the visitor's own email app with a message to `contact.email` already filled in.

Visitors can include a name, an optional reply email, a category, an optional link (to a photo, file, song, article…), and a message.

## Preview locally

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

(Opening `index.html` straight from disk also works.)

## Publish on GitHub Pages

1. Push this repo to GitHub.
2. Go to **Settings → Pages**, set **Source** to *Deploy from a branch*, and pick your branch with the `/ (root)` folder.
3. Your site will be live at `https://<username>.github.io/<repo>/` within a minute or two.
