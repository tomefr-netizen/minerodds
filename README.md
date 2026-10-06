# MinerOdds

English SHA-256d mining comparison MVP. PHP 8.2+ with cURL; no database or frontend build step.

- Solo block probabilities for a day, week, month and year, plus mean waiting time.
- Pool revenue and net earnings after electricity and pool fees.
- Block values, saved display currency, dark/light themes and CSV export.
- Shared server-side caches limit upstream refresh attempts to once per 24 hours.

## Run

```sh
php -S 0.0.0.0:8080 router.php
```

Open http://localhost:8080. For Apache, point the document root here and enable the root `.htaccess` and `var/.htaccess` access rules. For Nginx, deny access to `/var/`, `/tests/`, `/.git/` and `.env` files. The PHP server router already denies these paths. The server user needs write access to `var/cache`, or set `MINERODDS_CACHE_DIR` to a writable directory outside the document root (recommended for deployment).

## Data

- Eight curated chains: BTC, BCH, DGB SHA-256d, XEC, BC2, BCH2, PPC and NMC. This is an initial catalog, not an exhaustive list of all SHA-256 currencies.
- SoloFury node API provides difficulty and observed gross rewards for six chains. BCMonster provides a fallback and PoW difficulty for Peercoin / Namecoin. BackPoW provides USD prices and a reward fallback.
- One refresh attempt per rolling 24 hours, triggered by a page visit. All clients share the server cache. An exclusive filesystem lock prevents duplicate refreshes. Failed sources keep the last good values with separate timestamps. Failed attempts also wait 24 hours. No force-refresh endpoint is exposed.
- Retrieval time means the time we fetched a provider, not a guarantee of the provider's own data freshness. Difficulty is a snapshot, particularly volatile for small chains.
- Missing prices or rewards stay unavailable. eCash, BCH2 and Namecoin may not have market coverage from this provider. Pool income is a theoretical proportional estimate, not proof a particular pool accepts the coin or pays out at that rate.
- Currency conversion uses [Frankfurter's ECB reference rates](https://frankfurter.dev/) with USD as the base. A separate locked daily cache supports SEK, EUR, GBP and the other returned currencies without refreshing mining data. Failed attempts keep the last good rates and retrieval date. USD remains available if exchange data fails.
- Display currency is saved locally. All monetary values and CSV amounts use it. Changing currency converts the electricity input to preserve its economic cost; saved electricity settings remain in USD. Reference-rate dates are displayed separately from retrieval times and may precede weekends or holidays.
- Block value appears in both tables and coin details: observed block reward times coin price, before pool fees and electricity. Observed rewards include transaction fees received by miners; this is not a subsidy-only value.
- Namecoin needs compatible merged-mining infrastructure. DigiByte calculations use SHA-256d difficulty. Peercoin uses PoW difficulty only.

## Math

`rate = TH/s * 10^12 * uptime / 100 / (difficulty * 2^32)`

`P(at least one block by t) = -expm1(-rate * seconds)`

`mean wait = 1 / rate`

One week is 7 days, one month 30 days, one year 365 days. At the mean wait, the chance is about 63.2%, with no guaranteed block. Calculations hold difficulty, price and rewards constant. Effective hashrate assumes accepted work; rejects and orphan blocks are not modeled.

Pool revenue uses expected daily blocks times observed reward times USD price, less the entered pool fee. Electricity uses watts, price per kWh and uptime. Net excludes equipment costs, taxes, payout limits and pool-specific variance. Revenue for merge-mined chains is shown separately and is not automatically added to Bitcoin.

## Verification

```sh
php tests/cache.php
node tests/math.mjs
PLAYWRIGHT_MODULE=/path/to/playwright node tests/browser.cjs
```

Browser checks use installed Chromium, a running server on 8080, and Playwright. Screenshots are written to `/tmp/minerodds-*.png`.

## Assets

Lucide 0.468.0 (ISC) is served locally. Coin icons are from [cryptocurrency-icons](https://github.com/spothq/cryptocurrency-icons), CC0; license included in `assets/coins/LICENSE.md`. No visitor requests to external APIs, fonts, or icon CDNs are required.
