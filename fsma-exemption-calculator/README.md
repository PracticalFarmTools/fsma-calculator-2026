# FSMA Exemption Calculator

A free, offline-first tool that helps a farm determine its exemption status under
the FDA FSMA Produce Safety Rule (21 CFR Part 112) and print a signed,
citation-backed record. Part of **Practical Farm Tools**.

## What it runs on

A static, offline-first Progressive Web App — **no server and no database**.

| Layer | Technology |
| --- | --- |
| Interface | HTML + CSS + vanilla JavaScript (no framework, no build step) |
| Offline / install | Service Worker (`sw.js`) + Cache API + Web App Manifest (`manifest.json`) |
| On-device storage | Browser `localStorage` (versioned; see `STATE_VERSION` in `app.js`) |
| Regulatory data | `thresholds.json` (static; read at runtime) |
| Hosting | Vercel static CDN — project `fsma-calculator-2026` |

Because every device runs the app independently from its cache, the same setup
serves 10 users or 10 million with no added compute or database load.

## Project structure

```
index.html          Main app UI
calc.js             Exemption math + decision (single source of truth; shared with tests)
app.js              UI wiring, state, PWA registration (calls calc.js)
styles.css          Styling + print stylesheet for the record
fonts.css           Self-hosted @font-face rules (Inter + Outfit)
fonts/              Self-hosted .woff2 files (no third-party requests)
sw.js               Service worker (offline cache; bump CACHE_NAME on changes)
manifest.json       PWA manifest
thresholds.json     FDA inflation-adjusted thresholds (see refresh below)
icon-192.png        App icons (palette-optimized PNGs)
icon-512.png
update_thresholds.py  Annual FDA threshold refresh tool
test_scenarios.js   Calculation test suite (dev only; not served)
test_thresholds.js  Verifies thresholds.json matches the FDA figures (dev only)
user-guide/         Farmer walkthrough (HTML + screenshots + PDF)
```

## Local development

It's plain static files. Serve the folder over HTTP (service workers don't run
from `file://`):

```bash
cd fsma-exemption-calculator
python -m http.server 8080
# open http://localhost:8080/index.html
```

Run the test suites with Node (no dependencies):

```bash
node test_scenarios.js    # exemption calculation (uses the real calc.js)
node test_thresholds.js   # thresholds.json matches the FDA-published figures
```

## Deploy

Static deploy to Vercel (project is already linked via `.vercel/`):

```bash
npx vercel        # preview deployment
npx vercel --prod # production
```

`vercel.json` keeps `sw.js` and `thresholds.json` uncacheable so updates reach
users immediately, while icons get a short cache.

## Annual threshold refresh (important)

The FDA republishes its inflation-adjusted cut-offs **every spring** (usually
March/April). Refresh the app's numbers once a year after that:

```bash
cd fsma-exemption-calculator
python update_thresholds.py --dry-run   # 1. preview the change, write nothing
python update_thresholds.py             # 2. apply it (backs up + writes thresholds.json)
node test_scenarios.js                  # 3. confirm calculations still pass
node test_thresholds.js                 # 4. confirm values match FDA (update the
                                        #    EXPECTED_* snapshot in this file to the
                                        #    new FDA figures, then re-run until green)
npx vercel --prod                       # 5. redeploy
```

What the updater guarantees:

- **Verified SSL** — it refuses a tampered response (run it on a normal network
  with standard certificate trust; corporate proxies that re-sign TLS will block it).
- **Validation** — every scraped value is range-checked, so a change in the FDA
  page layout fails loudly (non-zero exit) instead of silently corrupting data.
- **Backup** — the previous `thresholds.json` is saved to `thresholds.bak.json`
  (git-ignored) before writing.
- **Diff** — it prints exactly which values changed.

The in-app "FDA Threshold Date" comes from `last_updated` in `thresholds.json`
and updates automatically.

### Automated FDA check (GitHub Actions)

A scheduled workflow (`.github/workflows/fsma-threshold-check.yml`) runs
`python update_thresholds.py --dry-run` every Monday. If the FDA page shows
figures that differ from `thresholds.json`, the job **fails with exit code 2**
so you get an email/notification from GitHub. When that happens, follow the
manual refresh steps above. You can also run the check anytime from the
**Actions → FSMA Threshold Check → Run workflow** button.

> To add a future year, the FDA's "Average 3 Year Value" column drives the
> `assessment_years` entry. The app shows only the newest assessment year; older
> years remain in the file for reference.

## Updating the app icons

`icon-192.png` / `icon-512.png` are flat green/white PNGs flattened to a small
palette (a few KB each). If you replace the artwork, re-flatten to keep them tiny
and **bump `CACHE_NAME` in `sw.js`** so returning users get the new icon.

## Fonts

Inter and Outfit are **self-hosted** in `fonts/` and declared in `fonts.css`, so
the app makes **zero third-party requests** and the fonts work fully offline. We
ship the `latin` and `latin-ext` subsets (English plus accented names, e.g.
French-Canadian/Spanish/Polish); `sw.js` precaches the `latin` files and caches
`latin-ext` on demand. To refresh or add weights/subsets, re-download the
`.woff2` files from Google Fonts, regenerate the `@font-face` rules in
`fonts.css` (keep the `unicode-range` lines), update the precache list and
**bump `CACHE_NAME` in `sw.js`**.

## Notes

- This tool produces a farmer self-assessment record, not an official FDA
  coverage determination. Copy in the app and letter says so.
- Saved entries live only on the user's device; clearing the browser clears them.
