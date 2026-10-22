# RouteWise — Project Analysis

> Product name: **RouteWise** (repository name to be decided).

## 1. Purpose

RouteWise is a static portfolio demo of a **sales journey-plan manager** for unit managers.
A unit manager builds weekly journey plans that assign field supervisors to markets (retail outlets)
on fixed days and in a fixed visit order, attaches KPI tasks that must be checked at each visit,
and then follows execution: live check-ins, missed visits, on-time rate, route coverage and KPI
task completion.

There is no backend. All data is fictional mock JSON generated from the data model below.

## 2. Stack

| Layer | Choice |
|---|---|
| Pages | `login.html` (entry) + `index.html` (single-page app, hash routing) |
| Styling | Tailwind CSS Play CDN `3.4.16` + DaisyUI `4.12.24` (custom `routewise` / `routewise-dark` themes in `css/app.css`), Google Font *Manrope* |
| Charts | Chart.js `4.4.7` (lazy-loaded, SRI) |
| Map | Leaflet `1.9.4` (lazy-loaded, SRI) + OpenStreetMap tiles |
| ERD | Mermaid `11.4.1` UMD build (lazy-loaded, SRI) |
| Auth | WebCrypto PBKDF2-SHA256 (310 000 iterations) against hashes in `js/auth-config.js`; session in `sessionStorage` |
| Data | `data/*.json` fetched by `js/data.js`; `js/data.bundle.js` (`window.__DATA__`) fallback for `file://` |
| Tooling | Node 24 scripts in `tools/` (no npm dependencies) |

### File map

```
index.html, login.html, favicon.svg
css/app.css                 design tokens + DaisyUI themes + small component classes
js/theme.js                 light/dark theme (localStorage, prefers-color-scheme default)
js/tw-config.js             Tailwind Play CDN config
js/auth-config.js           generated: salted PBKDF2 hashes only
js/auth.js                  verify / session / page guard
js/login.js                 login form controller
js/data.js                  loader, indices, selectors, validated admin mutations, localStorage edits
js/data.bundle.js           generated data fallback
js/ui.js                    safe DOM builder h(), icons, KPI tile, card, badge, table, drawer, modal, toast
js/charts.js                pinned CDN constants (URL + SRI) and themed Chart.js helper
js/app.js                   shell + hash router
js/views/*.js               one file per screen
data/*.json                 mock dataset (one file per entity)
tools/gen-mock-data.mjs     deterministic dataset generator
tools/build-data-bundle.mjs data/*.json → js/data.bundle.js
tools/make-credentials.mjs  random passwords → hashes (auth-config.js) + CREDENTIALS.md
```

## 3. Screens

| Route | Job / layout | Content |
|---|---|---|
| `login.html` | Sign-in | Brand panel + form; secure-context check; lockout after 5 failures (30 s) |
| `#/dashboard` | Overview (bento) | 4 KPI tiles (active plans, weekly completion, missed, on-time) → 4-week daily trend line (8 col) + plan list (4 col) → supervisor leaderboard (5) + today's schedule table (7) |
| `#/plans` | List (table-first) | Status chips, search + status filters synced to URL, sortable/paged table; admin "New plan" |
| `#/plans/:id` | Detail (header + tabs) | Plan facts, admin Edit/Delete; tabs: **Weekly grid** (SAT–THU columns, FRI off; per-supervisor; admin add/reorder/remove stops), **KPI tasks** (toggle + completion), **Visit logs** |
| `#/markets` | List + map | Leaflet map (red = 2+ missed visits), search/route/frequency filters (URL), table, detail drawer |
| `#/supervisors` | List | Team stats strip, table with completion bars, drawer with stops-per-day, KPI completion, missed visits |
| `#/routes` | Status grid | One tile per route (Healthy / Watch / At risk by completion), drawer with markets |
| `#/visits` | Monitoring board | Today's summary bar, per-supervisor stop grid, check-in timeline, missed in last 7 days; admin "Simulate check-in" |
| `#/reports` | Filter + story | Period 7/14/28 days, route, supervisor (URL-synced) → KPIs with delta vs previous period → stacked daily bars → completion by route → KPI task completion → CSV export |
| `#/kpi` | List | Overall/strongest/weakest tiles, task table; admin create/edit |
| `#/model` | Reference | Mermaid ER diagram + entity list with record counts |

Roles: **admin** can create/edit/delete plans, edit weekly templates, link KPI tasks and create/edit
KPI tasks (in memory, persisted to `localStorage` key `rw.edits.v1`, "Reset demo edits" in the user menu).
**viewer** is read-only: admin controls are not rendered and every mutation in `js/data.js` also
re-checks the role.

## 4. Data model (ERD)

```
UnitManager(Id, Name, Email, PasswordHash)
Supervisor(Id, Name, Email, PasswordHash, Phone)
Route(Id, Name, Description, CreatedByManagerId → UnitManager)          + demo field Code (RT-101…)
Market(Id, Name, Location, Latitude, Longitude, VisitFrequency, RouteId → Route)  + demo field Code (MK-1001…)
JourneyPlan(Id, Name, Status, CreatedByManagerId → UnitManager, CreatedAt, UpdatedAt)
JourneyPlanSupervisor(Id, JourneyPlanId, SupervisorId)
WeeklyTemplate(Id, JourneyPlanId, SupervisorId, DayOfWeek, MarketId, OrderInDay)
KPITask(Id, Title, Description, CreatedByManagerId)
JourneyPlanKPITask(Id, JourneyPlanId, KPITaskId)
VisitLog(Id, WeeklyTemplateId, SupervisorId, VisitDate, CheckInTime, CheckInLat, CheckInLng, Status, IsOnTime, Notes, CreatedAt)
TaskCompletion(Id, VisitLogId, KPITaskId, IsCompleted, Notes)
```

Relationships: a manager creates routes, plans and KPI tasks; a route contains markets; a plan assigns
supervisors and KPI tasks; weekly templates place a market on a day/order for a supervisor within a plan;
each template generates visit logs; each visited log records task completions.

Mock dataset (`node tools/gen-mock-data.mjs --anchor 2026-10-22`): 2 unit managers, 8 supervisors,
10 routes (RT-101…RT-110), 120 markets (MK-1001…, fictional names, random coordinates in a box for the
fictional city "Northbridge"), 6 journey plans (4 Active, 1 Draft, 1 Completed), ~180 weekly-template
stops, 8 KPI tasks, ~430 visit logs over the last 4 weeks (Visited / Missed, today Pending) and ~1 300
task completions. `PasswordHash` is `null` in the mock data (demo login uses `js/auth-config.js`).
Emails use `@routewise.example`, phones use the fictional `+1-555-01xx` range. The "anchor date" in
`data/meta.json` is treated as "today" by the UI.

## 5. BEFORE — findings on the original folder

The folder originally contained two hand-written mockups plus supporting files:

1. `journey_plan_portal.html` (382 lines) — a static, non-functional HTML/CSS mockup (no JS): dark
   "control tower" look (DM Mono / Syne fonts), sidebar, topbar, four stat cards, a plan list,
   a salesman KPI list and a visit-schedule table.
   - Carried a **former-employer brand name** as the logo text and a "control tower" subtitle.
   - Used **real-looking operational identifiers**: branch/route codes, salesman numbers, customer
     numbers and real-scale headcounts (branches / salesmen) copied from production context.
   - Hard-coded inline styles and colours, repeated markup per row, no data model, no interactivity,
     nothing clickable, no auth.
2. `journey_plan_erd_schema.html` (142 lines) — an HTML *fragment* (no `<html>`/`<head>`) rendering
   a Mermaid ER diagram, importing an **unpinned** `mermaid@11` ES module from a third-party CDN,
   using a proprietary font name not available to the page, writing the SVG through an HTML-string DOM sink, and
   containing commented-out dead code.
3. **Real-data exports and recordings** (spreadsheets, documents, JSON exports and screen recordings)
   were present and have been **removed** before this transformation. They must never be re-added.

Security/quality issues: no CSP, no SRI, unpinned dependency, HTML-string DOM sink, no separation of
data and markup, no responsive layout, no light theme, no accessibility affordances (status by colour
only, no labels on icon controls).

## 6. Transformation (completed)

| Area | Result |
|---|---|
| Branding | Renamed to **RouteWise**; all former-employer text, "control tower" wording, real route/branch/salesman/customer codes and headcounts removed. New inline SVG logo (dotted route + amber pin) and `favicon.svg`. Folder name kept, no folder-name text in content. |
| Legacy files | `journey_plan_portal.html` and `journey_plan_erd_schema.html` removed — replaced by `index.html` (all portal screens) and the `#/model` page (restyled ERD). |
| Data | 12 JSON files generated deterministically from the ERD (`tools/gen-mock-data.mjs`, seeded PRNG; it refuses to emit digit runs matching the purged codes). `js/data.bundle.js` regenerated by `tools/build-data-bundle.mjs`. |
| App | Real multi-view SPA with hash routing, 10 screens, URL-synced filters, sortable/paged tables, drawers, modals, toasts, skeleton/empty/error states, admin CRUD for plans, weekly templates and KPI tasks, CSV export. |
| UI | 100 % new design: Tailwind + DaisyUI custom themes — deep indigo/plum with amber accent, light + dark toggle (remembered, defaults to OS), Manrope font, gradient plum sidebar, bento dashboard, varied page templates per job (table-first, status board, status grid, filter + story). Status always text + colour. Responsive (DaisyUI drawer on mobile). |
| Font | The proprietary font reference was replaced with Manrope (Google Fonts) everywhere, including the ERD. |
| Auth | `login.html` entry; accounts `admin` / `viewer`; 14-char random passwords from `node:crypto`; only salt + PBKDF2-SHA256 (310 000 it.) hashes in `js/auth-config.js`; WebCrypto verification with constant-time compare and dummy derivation for unknown users; 5-failure lockout; session (username + expiry, 60 min sliding) in `sessionStorage`; role always re-read from config, never trusted from storage; guard on every page; friendly message when WebCrypto/secure context is missing. Plain passwords only in git-ignored `CREDENTIALS.md`. |
| Security | CSP meta on both pages (`script-src 'self'` + jsDelivr + Tailwind CDN only; `object-src 'none'`, `base-uri 'none'`, `form-action 'self'`, `connect-src 'self'`, images only self/data/OSM tiles); all CDN assets pinned to exact versions; SRI + `crossorigin` on DaisyUI, Chart.js, Leaflet JS/CSS, Mermaid; no inline scripts or inline handlers; all data rendered with `createElement`/`textContent` through `RW.ui.h()` which rejects `on*` attributes and filters URL schemes; Leaflet popups receive DOM nodes; Mermaid output parsed with `DOMParser` from a constant diagram (no HTML-string sinks anywhere); form inputs validated client-side (length, whitelist of statuses/ids, duplicates, control-character stripping); localStorage edits re-validated against field whitelists on load; CSV export neutralises formula injection; `referrer` = `no-referrer`. |
| Docs | This file; `CREDENTIALS.md` (git-ignored); `.gitignore` (`CREDENTIALS.md`, `node_modules/`). |

### Known limitations

- **Demo gate, not security.** Hashes and all logic ship to the browser; anyone can read the data files.
- Tailwind Play CDN compiles CSS at runtime (it logs a "not for production" warning) and its host sends
  no CORS header, so it is the one script without SRI; CSP therefore also needs `style-src 'unsafe-inline'`
  (also required by Mermaid/Leaflet inline styles). A production build would precompile Tailwind.
- CSP is delivered by `<meta>`; `frame-ancestors`, HSTS etc. need real HTTP headers from the host.
- The map needs internet access to OpenStreetMap tiles; coordinates are random points that happen to
  fall on a real map area — the city name and all addresses are fictional.
- Edits persist only in the current browser (`localStorage`); visit logs are generated history and are
  not affected by template edits ("Simulate check-in" is memory-only).

## 7. How to run

```bash
cd <project-folder>
npx serve .            # then open http://localhost:3000/login.html
```

WebCrypto needs a secure context: `http://localhost` or HTTPS work; a plain-http LAN IP does not.
Opening `login.html` directly from disk works in Chromium-based browsers (data comes from
`js/data.bundle.js`), but serving the folder is recommended.

Regenerate assets:

```bash
node tools/gen-mock-data.mjs --anchor 2026-10-22   # data/*.json (omit --anchor for today)
node tools/build-data-bundle.mjs                  # js/data.bundle.js
node tools/make-credentials.mjs                   # rotate passwords → js/auth-config.js + CREDENTIALS.md
```

## 8. Verification log

- `node --check` passes for every `js/**/*.js` and `tools/*.mjs`.
- Headless Chrome run (served via `npx serve`, light + dark, admin + viewer, and `file://`):
  all 13 route variants render, charts/map/ERD load with SRI, **no CSP violations or JS errors**
  (only Tailwind's Play-CDN production warning). Admin mutation persists to `localStorage`;
  the same call as viewer is rejected ("Read-only account").
- Brand/code grep (the CLAUDE.md pattern plus every purged route/salesman/customer code, the old font name,
  HTML-string sinks and inline `on…=` handlers) returns no matches anywhere in the project.
