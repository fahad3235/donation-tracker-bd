# Donation Tracker BD

Offline, bilingual (English / Bangla) charitable-donation tracker for Bangladesh.
Log what you gave, to whom, and when — Zakat, Sadaqah, Fitrana, Qurbani, or
anything else — and see totals by category, month, and year. Everything runs
locally in the browser; there is no server and no account.

> Personal record-keeping tool. It records donations you already made; it does
> **not** compute how much Zakat you owe (use a Zakat calculator for that).
> It is not affiliated with any religious or tax authority.

## Features

1. **Donation log (CRUD)** — date, recipient/organisation, category
   (Zakat / Sadaqah / Fitrana / Qurbani / General / Other), amount, method
   (Cash, bKash, Nagad, Rocket, bank transfer, card), receipt flag, and an
   optional note. Inline validation: future dates rejected, amount must be
   > 0 (max 100,000,000 BDT), recipient max 100 chars, note max 200 chars.
   Edit in place, delete with confirmation.
2. **Dashboard** — all-time total, this-year total, this-month total,
   donation count, per-category totals with % shares, top recipient,
   yearly summary table, and a last-12-months bar chart.
3. **Search & filter** — text search across recipient/note/category,
   category filter, year filter, and 4 sorts (date/amount, asc/desc).
4. **Export / import** — download the full log as JSON; import only files
   this app exported (strict validation: wrong app id, wrong version,
   duplicate ids, or any invalid donation rejects the whole file and leaves
   existing data untouched).
5. **Erase** — type `DELETE` to permanently wipe all data.
6. **Bilingual UI** — English / Bangla toggle, persisted, with Bengali
   digits in Bangla mode. Language choice and data persist in localStorage.
7. **Offline & private** — zero network requests; data never leaves the
   browser. Works on desktop and 390px mobile.

## Stack

Vanilla HTML + CSS + JavaScript. No frameworks, no build step, no
dependencies. Money is integer paisa (1 BDT = 100 paisa), so totals have no
floating-point error. Dates are ISO `YYYY-MM-DD` strings compared
lexicographically (UTC-safe).

## Prerequisites

Any modern browser (Chrome, Firefox, Edge, Safari). For tests: Node.js 18+.

## Run

Open `index.html` in a browser — or serve the folder:

```sh
npx serve .
# or
python3 -m http.server 8000
```

For deterministic testing, append `?asof=YYYY-MM-DD` to freeze "today"
(e.g. `index.html?asof=2026-10-18`).

## Tests

```sh
node tests/test_logic.js   # 12 unit-test blocks (pure logic)
node /tmp/smoke_dt.js      # 30 headless-Chrome smoke checks (not shipped; run from a local copy)
```

Smoke checks cover: add/edit/delete via the real form, inline validation,
search filter, Bangla toggle + persistence across reload, export envelope,
erase, JSON import round-trip, malformed-import rejection with data intact,
390px no-overflow on all three tabs, zero network requests, zero console
errors.

## Deployment

Static site — copy the folder to any static host (GitHub Pages, Netlify,
etc.). Live demo: https://fahad3235.github.io/donation-tracker-bd/

## Limitations

- Single-browser storage: data lives in this browser's localStorage only;
  clearing site data deletes the log (export a backup first).
- Categories and methods are fixed lists; custom categories are not
  supported.
- Amounts are recorded as entered — the app does not fetch prices, rates,
  or verify recipients.
- The 12-month chart uses calendar months ending in the current month.

## Status

MVP complete. Tests: 12/12 unit blocks + 30/30 headless-Chrome smoke
checks, 0 console errors. Two genuine bugs were found and fixed during
testing (Bengali digits applied in English mode; a global table
`min-width` broke the 390px dashboard layout).
