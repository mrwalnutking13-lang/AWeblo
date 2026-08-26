# AWeblo — one-page portfolio site

Custom websites by **Avery Townsend**. A single-page, fully responsive marketing site
built as plain HTML, CSS and JavaScript — **no build step, no dependencies, no framework**.
Open `index.html` and it runs.

```
index.html                 the whole page
assets/css/styles.css      design tokens + all styles
assets/js/main.js          nav, scroll reveals, FAQ, form handling
assets/img/logo.svg        AW monogram  (placeholder — swap for the real one)
assets/img/work-01.svg     project 1 preview (placeholder)
assets/img/work-02.svg     project 2 preview (placeholder)
```

## Run it locally

Double-click `index.html`, or serve it:

```bash
python3 -m http.server 8000    # then open http://localhost:8000
```

## The three things to swap before launch

### 1. The logo

Replace `assets/img/logo.svg` with the real AW logo, keeping the same filename — it's
referenced in six places (header, hero card, footer, favicon, apple-touch icon, social
preview) and they'll all pick it up automatically.

Using a PNG instead? Drop it in `assets/img/` and find-and-replace `assets/img/logo.svg`
with your filename in `index.html`. A square image works best.

### 2. The two portfolio projects

In `index.html`, find the `WORK` section — there's a comment block marking exactly what to
change. For each project:

- **Screenshot** — take a screenshot of the live site, save it to `assets/img/`, and point
  the `<img src>` at it. Any wide-ish image works; it's cropped to 16:11.
- **Links** — replace both `href="#"` links with the real site URL.
- **Text** — update the domain in `<span class="url">`, the `<h3>`, the description and the tags.

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
