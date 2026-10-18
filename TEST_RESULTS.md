# TEST_RESULTS — donation-tracker-bd (run #87, 2026-10-18, 14:00 slot)

## Unit tests — 12/12 blocks PASSED (`node tests/test_logic.js`)

- parseAmount western (1,500.50 -> 150050; Taka sign; whitespace) + Bengali digits
  (1500.50 in Bengali digits -> 150050) + 7 invalid inputs rejected (empty,
  non-numeric, 3 decimals, negative, double dot, over 100,000,000 cap, null)
- formatMoney EN (`৳1,500.50`, `৳0.00`, `৳100,000,000.00`) + BN digits
  (`৳১,৫০০.৫০`, `৳০.০০`)
- isValidDate: 2026-02-29 false, 2024-02-29 true, month 13 false, bad format false
- validateDonation: valid passes; each of the 9 error codes exercised
  (recipient empty/101 chars, future date, bad date, bad category, amount
  0 / fractional paisa, bad method, non-boolean receipt, note 201 chars;
  note 200 chars passes)
- add/update/delete round-trip incl. input-list immutability + not-found update
- summarize hand-verified scenario (3 donations, asof 2026-10-18):
  total 850050, thisYear 750050, thisMonth 750050, Zakat 600000 (share
  70.588%), Sadaqah 250050, top recipient Masjid 600000, monthly[11]
  2026-10 = 750050, monthly[10] 2026-09 = 0, byYear 2026/2025 exact;
  empty list -> zeros, topRecipient null
- filterDonations: category/year/query (case-insensitive, note field),
  amount-asc + date-desc ordering, empty result
- export/import round-trip byte-equal after JSON round-trip
- validateImport: 13 malformed variants rejected (wrong app, wrong version,
  missing/non-array donations, duplicate id, empty id, negative amount,
  future date, bad category, long note, non-boolean receipt, empty
  recipient, null/array/string input); empty list valid

## Headless-Chrome smoke — 30/30 PASSED (raw CDP, file:// + ?asof=2026-10-18)

Title/lang button, starts empty, dashboard zero, add via real form
(1500.50 -> total `৳1,500.50`, count 1, recipient cell, category breakdown),
empty-submit inline errors + no row added, edit mode title + edit to
`৳2,000.00`, search narrows to 0 and restores to 1, BN toggle (title +
`৳২,০০০.০০`), lang persisted in localStorage, reload keeps row + BN,
export envelope app id, erase -> `৳০.০০`, import restores row + success
message, malformed import rejected with data intact, 390px no-overflow on
all three tabs, zero network requests, zero console errors.

## Repairs during testing (2 genuine app bugs)

1. **Bengali digits in English mode** — dashboard counts, dates, and list
   counts called `toBnDigits()` unconditionally. Fixed with a lang-aware
   `num()` helper in `js/app.js`. Found by smoke check "count 1".
2. **390px dashboard overflow (scrollWidth 698-725)** — the global
   `table { min-width: 640px }` rule also applied to the dashboard yearly
   table, stretching its card. Scoped the rule to `.table-wrap table`
   only. Found by smoke check "390px dashboard no overflow" + a CDP
   widest-element debug pass (yearly table + card at 640px).

## Hygiene

- Pure-ASCII sources: `grep -P "[^\x00-\x7F]" js/*.js index.html css/style.css`
  returns zero matches (Bengali as `\uXXXX` escapes in JS; numeric entity
  for the language-toggle label in HTML).
- No secrets in code. No fabricated data — ships empty.
