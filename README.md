# AWeblo — one-page portfolio site

Custom websites by **Avery Townsend**. A single-page, fully responsive marketing site
built as plain HTML, CSS and JavaScript — **no build step, no dependencies, no framework**.
Open `index.html` and it runs.

```
index.html                 the whole page
assets/css/styles.css      design tokens + all styles
assets/js/main.js          nav, scroll reveals, FAQ, form handling
assets/js/galaxy.js        the 3D galaxy backdrop
assets/img/logo.png        the AWeblo logo  (upload this — see below)
```

## Run it locally

Double-click `index.html`, or serve it:

```bash
python3 -m http.server 8000    # then open http://localhost:8000
```

## The three things to swap before launch

### 1. The logo

Upload your logo to `assets/img/` named exactly **`logo.png`**. Everything picks it up
automatically — header, footer, browser tab icon, phone home-screen icon and the social
share preview.

Upload it straight from GitHub:
<https://github.com/mrwalnutking13-lang/AWeblo/upload/main/assets/img>

(Or: repo → `assets/img` → **Add file** → **Upload files** → drag it in → **Commit changes**.)

Until it's uploaded the logo spot is empty space — the "AWeblo" wordmark beside it still
shows, so nothing looks broken.

### 2. The portfolio dropdowns

Each project is a dropdown: the row shows what the site is for, and opening it reveals the
link. In `index.html`, find the `WORK` section — there's a comment block marking exactly
what to change. Per project:

- **`.work-item__title`** — what the website is for (this is the row you see closed)
- **`href="#"`** — the live site URL
- **link text** — the domain you want displayed

Two placeholders are in there now. To add more, copy a whole `<details class="work-item">`
block and bump the `01` / `02` index.

### 3. The contact form

Out of the box the form validates, then opens the visitor's email app with everything
filled in. That works with zero setup but relies on them having email configured.

To get submissions in your inbox reliably, create a free form at
[formspree.io](https://formspree.io) and paste the endpoint into the form tag:

```html
<form class="form" id="quote-form" data-endpoint="https://formspree.io/f/YOUR_ID" ...>
```

That's the only change needed — the JavaScript posts to it and falls back to the email
app if the request fails.

## Editing content

Phone, email and copy live directly in `index.html`. The phone number appears in the
mobile menu, the contact card, the footer and the structured-data block at the top —
search for `302-353-6328` to catch them all. Same for `averytownsend95@gmail.com`.

Colors, fonts and spacing are all CSS custom properties at the top of `styles.css` under
`:root` — change `--brand` and the whole site follows.

## The galaxy backdrop

The purple-and-black sky behind the page is a spiral galaxy drawn in perspective on a
canvas: a starfield you drift through, a tilted disc that turns, and a nucleus that sits
off to one side of the headline. It parallaxes with the pointer and pans as you scroll.

Everything is in `assets/js/galaxy.js`, and the layers sit behind the content in
`styles.css` under *Galaxy backdrop*:

- `.galaxy__canvas` — the animated sky
- `.galaxy__fallback` — a still CSS version, shown only if the script never runs
- `.galaxy__veil` — the dark wash that keeps text contrast up over the sky

The constants at the top of `galaxy.js` are the dials worth touching: `TILT` (how far the
disc tips), `ARMS` and `SWIRL` (the spiral shape), `SPIN` (rotation speed), and
`GAL_X` / `GAL_Y` (where the core sits, as a fraction of the viewport). If you want the
sky darker or lighter behind the copy, adjust `.galaxy__veil` rather than the script.

Particle counts scale with the window, the pixel ratio is capped, the loop stops while the
tab is in the background, and detail is trimmed automatically if frames start running
long. With `prefers-reduced-motion` set, one still frame is painted and nothing moves.

## Deploying

**GitHub Pages** — repo Settings → Pages → deploy from branch, pick the branch and `/root`.

**Netlify / Vercel / Cloudflare Pages** — drag the folder in, or connect the repo. No build
command, no output directory; it's static files.

## Notes

- Works without JavaScript: all content is in the HTML, and scroll animations only
  enhance. With JS off nothing is hidden.
- Respects `prefers-reduced-motion` — animations are disabled for visitors who ask for it.
- Keyboard accessible throughout, with a skip link and visible focus rings.
- Fonts (Sora, Inter, Instrument Serif) load from Google Fonts and fall back to system
  sans-serif if unavailable.
