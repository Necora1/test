/*
 * Everything on the site comes from this file. Edit it to make the site yours.
 * No build step: save, refresh the page.
 */
window.SITE = {
  name: "Alex Doe",
  tagline: "Developer, photographer, and occasional writer.",
  avatar: "images/avatar.svg",

  // ABOUT ---------------------------------------------------------------
  about: [
    "Hi! I'm Alex. I build things for the web, take a lot of photos on long walks, and write here when something is worth writing down.",
    "This site is my little corner of the internet: a few thoughts on the blog, some favourite pictures in the gallery, and a way to reach me if you want to say hello.",
    "Currently I'm interested in small, fast websites, film photography, and learning to cook something new every week."
  ],
  facts: [
    { label: "Based in", value: "Somewhere nice" },
    { label: "Working on", value: "This website" },
    { label: "Reading", value: "A good book" },
    { label: "Favourite tool", value: "A pencil" }
  ],
  links: [
    { label: "GitHub", url: "https://github.com/" },
    { label: "Instagram", url: "https://instagram.com/" },
    { label: "Email", url: "mailto:you@example.com" }
  ],

  // BLOG ----------------------------------------------------------------
  // `body` is HTML. Posts are sorted newest first automatically.
  posts: [
    {
      slug: "hello-world",
      title: "Hello, world",
      date: "2026-09-20",
      tags: ["meta"],
      summary: "Why I finally made a personal website, and what you'll find here.",
      body: `
        <p>I've been meaning to put this site together for years. It's finally here.</p>
        <p>The plan is simple: write when I have something to say, share photos I like, and keep the whole thing small and fast. No trackers, no frameworks, just HTML, CSS and a little JavaScript.</p>
        <h2>What's here</h2>
        <ul>
          <li><strong>About</strong>: who I am.</li>
          <li><strong>Blog</strong>: posts like this one.</li>
          <li><strong>Gallery</strong>: photos from walks and trips.</li>
          <li><strong>Contact</strong>: send me a message, a link, or anything else.</li>
        </ul>
        <p>Thanks for stopping by.</p>`
    },
    {
      slug: "walking-with-a-camera",
      title: "Walking with a camera",
      date: "2026-09-12",
      tags: ["photography"],
      summary: "Notes on slowing down and noticing things.",
      body: `
        <p>Carrying a camera changes how I walk. I stop more often, look up more often, and notice how light falls across a street at different times of day.</p>
        <p>Most of the photos in the gallery came from walks with no destination. The trick is to leave the phone in the pocket and let the camera be the only screen.</p>
        <blockquote>The best camera is the one you actually bring with you.</blockquote>`
    },
    {
      slug: "small-websites",
      title: "In praise of small websites",
      date: "2026-08-30",
      tags: ["web", "meta"],
      summary: "A personal site doesn't need a framework. Here's how this one works.",
      body: `
        <p>This site is three files: an HTML page, a stylesheet, and a script that reads content from a single JavaScript file. That's it.</p>
        <p>Adding a post means adding an entry to a list. Adding a photo means dropping a file in a folder and adding one line. It loads instantly and will keep working for years.</p>`
    }
  ],

  // GALLERY -------------------------------------------------------------
  // Put images in /images and list them here.
  gallery: [
    { src: "images/gallery-1.svg", alt: "Orange sunset over layered mountains", caption: "Evening in the hills" },
    { src: "images/gallery-2.svg", alt: "Blue lake beneath snowy peaks", caption: "Still water" },
    { src: "images/gallery-3.svg", alt: "Pink dawn sky over a quiet ridge", caption: "First light" },
    { src: "images/gallery-4.svg", alt: "Green rolling hills under a pale sky", caption: "Spring walk" },
    { src: "images/gallery-5.svg", alt: "Night sky with a crescent moon over dark hills", caption: "Late night" },
    { src: "images/gallery-6.svg", alt: "Golden desert dunes under a clear sky", caption: "Dunes" }
  ],

  // CONTACT -------------------------------------------------------------
  contact: {
    intro: "Got a question, a link I'd like, feedback on a post, or just want to say hi? Send it here and it lands straight in my inbox.",
    // Paste your Formspree endpoint (https://formspree.io/f/xxxxxxx) to receive
    // messages by email without anyone leaving the page. Leave empty to fall
    // back to opening the visitor's email app addressed to `email` below.
    formEndpoint: "",
    email: "you@example.com"
  }
};
