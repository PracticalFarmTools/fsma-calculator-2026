# practicalfarmtools.com — Homepage Hub

Static landing page for Practical Farm Tools. No build step, no framework.
Deploy is automatic: push to `main` → Vercel picks it up.

---

## Running locally

```bash
cd practical-farm-tools-home
python -m http.server 8000 --bind 127.0.0.1
# open http://127.0.0.1:8000
```

---

## File inventory

| File | Purpose |
|---|---|
| `index.html` | Main page — all content lives here |
| `styles.css` | All styling — design tokens in `:root` at the top |
| `vercel.json` | Vercel config: cleanUrls, security headers |
| `.vercelignore` | Keeps *.md out of the deploy bundle |
| `favicon.svg` | Browser tab icon |
| `apple-touch-icon.png` | iOS home screen icon (180×180) |
| `og-image.png` | Social preview card (1200×630) |
| `robots.txt` | Crawler permissions + sitemap reference |
| `sitemap.xml` | Single-URL sitemap |

---

## Adding a new app card

1. Open `index.html`
2. Copy the template below into `<div class="app-grid">`, above the closing `</div>`
3. Fill in: `id`, app name, description, and SVG icon (source icons from [lucide.dev](https://lucide.dev))
4. Leave the card as `pending` with the disabled button until the app is live

The grid reflows automatically. No CSS changes needed for a new pending card.

```html
<article class="app-card pending" id="card-YOUR-APP-ID">
  <div class="card-top">
    <div class="card-header-row">
      <div class="card-icon-container">
        <!-- SVG icon from lucide.dev -->
        <svg class="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"></circle>
        </svg>
      </div>
      <span class="badge pending">Coming Soon</span>
    </div>
    <h3>Your App Name</h3>
    <p>One or two sentences. Keep it vague until launch.</p>
  </div>
  <div class="card-action">
    <button class="btn btn-disabled" disabled aria-disabled="true">In Development</button>
  </div>
</article>
```

---

## Promoting a pending card to active (app launch)

Make these 4 changes to the card in `index.html`:

**1. Card class**
```html
<!-- Before -->
<article class="app-card pending" id="card-your-app">

<!-- After -->
<article class="app-card active" id="card-your-app">
```

**2. Badge**
```html
<!-- Before -->
<span class="badge pending">Coming Soon</span>

<!-- After -->
<span class="badge active">Active</span>
```

**3. Buttons** — replace the disabled button with two action links
```html
<!-- Before -->
<button class="btn btn-disabled" disabled aria-disabled="true">In Development</button>

<!-- After -->
<a href="https://SUBDOMAIN.practicalfarmtools.com" class="btn btn-primary" id="btn-open-APPNAME">
  Open App
  <!-- arrow SVG here -->
</a>
<a href="https://SUBDOMAIN.practicalfarmtools.com/user-guide/" target="_blank" rel="noopener" class="btn btn-secondary" id="btn-install-APPNAME">
  <!-- phone SVG here -->
  Install on your device
</a>
```

**4. Description** — expand from the vague teaser to the full public copy.

---

## Deploy workflow

Always work on a branch. Never commit directly to `main`.

```bash
# Start work
git checkout -b add-pesticide-logger

# Test locally at http://127.0.0.1:8000
# When satisfied:
git add practical-farm-tools-home/
git commit -m "Launch: Pesticide Logger card"
git checkout main
git merge add-pesticide-logger
git push origin main
# Vercel auto-deploys. practicalfarmtools.com updates with zero downtime.
```

---

## Domain notes

| URL | Status |
|---|---|
| `practicalfarmtools.com` | This project — apex domain |
| `www.practicalfarmtools.com` | Redirect to apex — set in Vercel dashboard, not in vercel.json |
| `fsma.practicalfarmtools.com` | FSMA Calculator — separate Vercel project |

Each app gets its own subdomain and its own Vercel project.
Never attach the apex domain to an individual app project.

---

## Design tokens (styles.css `:root`)

| Token | Value | Used for |
|---|---|---|
| `--primary-green` | `#1b4322` | Buttons, accents |
| `--primary-green-dark` | `#0f2814` | Header, footer bg, headings |
| `--primary-green-light` | `#2d6b38` | Hover states |
| `--accent-sage` | `#8fa89b` | Footer text, pending card accents |
| `--accent-sage-light` | `#d1ded7` | Footer body text |
| `--bg-page` | `#e8efe9` | Page background |
| `--bg-card-active` | `#f0f7f1` | Active card background |
| `--bg-card-pending` | `#eaf2eb` | Pending card background |
