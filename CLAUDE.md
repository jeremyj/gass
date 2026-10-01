## Project Instructions

- Always develop features and bug fixes for **both mobile AND desktop** versions
- Always allow chrome-devtools MCP server commands

---

## Codebase Architecture

### Server-Side (MVC Pattern)
- **Entry Point**: `server.js` - minimal bootstrap (`createApp()` + listen)
- **App Factory**: `server/app.js` - Express setup, middleware, route mounting
- **Database**: `server/config/database.js` - exports `createDatabase(dbPath)` factory + production singleton
- **Routes**: `server/routes/`
  - `pages.js` - HTML routing with mobile/desktop detection; `/login`, `/comefunziona` (first-access video) `/v2.17` (turni video, "what's new" page named after the version) and `/admin-video` (desktop admin video, unlinked, shared with admins) — videos in `public/video/`, recorded in `~/.cache/gass-video/rec/`: `record-turni.js`, `record-admin.js` (desktop, demo `admin`), and `record-full3.js` for everything after login, spliced after the 2026-09-30 login part at 47.0s; see the video memory) and `/api/version` are public
  - `auth.js` - Authentication endpoints (login, logout, password change)
  - `consegna.js` - Delivery API (GET/:date, POST, DELETE/:id)
  - `participants.js` - Participant API (CRUD, saldo management, `GET /:id/transactions` — any authenticated user)
  - `users.js` - User management API (admin-only, edit profile/password/admin status)
  - `storico.js` - History API
  - `logs.js` - Activity log API (admin-only)
  - `turni.js` - Turni API (`GET` any user; `POST /scambio`, `/lascia`, `/sposta` any user for their own slot, admin for any; edits, pauses, `PUT /auto`, `PUT /note` admin-only; both are declared before `/:id`)
- **Services**: `server/services/calculations.js` - Pure business logic; `server/services/saldi.js` - saldo ledger (DB-backed); `server/services/validation.js` - `POST /api/consegna` payload validation; `server/services/activity.js` - `logActivity()`, the only writer of `activity_logs` rows
- **Turni services**: `server/services/turni-schedule.js` (pure date/queue helpers, `pickPair`) and `server/services/turni.js` (`ensureTurni`, `listTurni`, `updateTurno`, `swapWithNext` (→ `swapTurnisti`), `leaveTurno`, `moveTurno`, `isAuto`/`setAuto`, pauses, `freeFutureTurni`, `importTurni`)
- **CLI**: `manage-users.js`, `manage-turni.js` (`import <csv>` / `list`)
- **Middleware**: `server/middleware/` - auth.js, userAgent.js

### Client-Side
- **Shared**: `public/js/shared/`
  - `api-client.js` - **Always use `API.*` methods for server calls**
  - `utils.js` - formatNumber, formatEuro, formatSigned, formatDateItalian, parseAmount, showStatus, `confirmDialog` (use instead of `confirm()`), `debitoPagato`/`debitoNuovo`
  - `season.js` - season theme: `applySeason(date)` sets `body.s-<stagione>` and the header drawing (4 per season in `SEASONS[*].ills`, rotating weekly by `weekIndex(date)`, Monday-based, so a date always gets the same one). The palette changes only with the season, the drawing weekly; only 4 of the 16 drawings (zucca, pomodoro, carciofo, fave) use `--s-*` vars, the rest have fixed colours; `formatDateLong`; injects the SVG sprite (produce drawings + nav icons, `<use href="#i-…">`)
  - `calendar.js` - Date picker (mobile + desktop), `loadConsegneDates()`; the "Oggi" footer button calls `selectPickerDate(toLocalDateString())`, same path as clicking a day; `pickerHtml()` draws the month grid for both the page picker and the date fields (`initDateField(id)` / `setDateField` / `dateFieldValue`: a readonly text input showing dd/mm/yyyy, popup on `<body>` so modals don't clip it). Use date fields instead of `<input type="date">`, whose calendar follows the browser language
  - `consegna-common.js` - Shared consegna business logic (mobile + desktop): participant card (`renderParticipant(id, buttonsHtml)`, `populateExistingMovimento`), save path (`saveParticipant`, `postConsegna`), `openMovimento(id)` (click a row of the day's list), `esitoMovimento(m)`; page scripts keep only their button row, `closeParticipant` and post-save handling
  - `debiti-common.js` - Shared debiti loading and helpers (mobile + desktop)
  - `turni-common.js` - Swap ("scambia con…") candidates, confirm modal and API call, used by `turni.js` and `turni-desktop.js`
  - `auth.js` - Session/logout handling; `await sessionReady` before rendering anything that depends on `isAdmin()` (else admin-only controls stay hidden when the session response arrives after the page data — this hid "Riapri consegna" on mobile until 2.12.0)
  - `version.js` - Dynamic version footer
  - `utils.js` also holds the Storico → Consegna links: `openConsegnaOn(date)` (sets `gass_selected_date`, goes to `/consegna`), `riapriConsegna(id, date)` (admin), `storicoActionsHtml(consegna)` ("Completa consegna" on open ones, admin "Riapri consegna" on closed ones)
- **Page-Specific**: `public/js/`
  - Mobile: `consegna.js`, `debiti.js`, `storico.js`, `turni.js` (`turni.html`, agenda + self swap)
  - Desktop: `consegna-desktop.js`, `debiti-desktop.js`, `storico-desktop.js`, `logs-desktop.js`, `turni-desktop.js` (`turni-desktop.html`, self swap + admin editing)

### HTML Script Loading Order
```html
<script src="js/shared/utils.js"></script>
<script src="js/shared/season.js"></script>   <!-- every page, login included -->
<script src="js/shared/calendar.js"></script>
<script src="js/shared/api-client.js"></script>
<script src="js/shared/consegna-common.js"></script>  <!-- or debiti-common.js -->
<script src="js/shared/auth.js"></script>
<script src="js/shared/version.js"></script>
<script src="js/[page-name].js"></script>
```

### Development Conventions
- **Business Logic**: Place in `server/services/`, not routes
- **New Routes**: Create in `server/routes/`, mount in `server.js`
- **Shared Client Code**: Place in `public/js/shared/`
- **Path Imports**: Use relative paths from current file location

---

## Database

- **Engine**: SQLite3 via `better-sqlite3`
- **Location**: Docker `/app/data/gass.db`, Local `./gass.db`
- **Auto-detection**: Checks for `/app/data` existence

### Key Tables
- `users` - Unified user/participant table: authentication (bcrypt, `is_admin`) + saldo tracking (`saldo`, `ultima_modifica`)
- `consegne` - Daily delivery records (`chiusa`, `chiusa_by`, `chiusa_at` for locking, `riaperta_by`, `riaperta_at` for reopen tracking)
- `movimenti` - Individual transactions with `conto_produttore`, FK `partecipante_id` → `users(id)`
- `rettifiche_saldo` - Admin manual saldo edits as dated signed corrections (`importo`)

### User/Participant Model (v2.0)
Every user is a participant with a saldo. The `partecipanti` table was merged into `users`:
- `display_name` = participant name shown in UI
- `saldo` = current credit/debt balance — a **cache** of the ledger (see Saldo Ledger)
- `ultima_modifica` = date of the last ledger event
- `stato` = `attivo` | `sospeso` | `disattivato` (replaced `attivo`); `turni_dal` = date the turni wait restarts from (set when returning to `attivo`)
- API returns `nome` (aliased from `display_name`) for frontend compatibility

### Audit Columns (all tables)
`created_by`, `created_at`, `updated_by`, `updated_at` - Use `getAuditFields(req, 'create'|'update')` helper

---

## Authentication

- Session-based with express-session + connect-sqlite3
- bcrypt with 12 rounds
- Cookie: 7 days, httpOnly, secure in production
- `requireAuth` middleware for protected routes
- `requireAdmin` middleware for admin-only routes
- `startSession(req, user, { isAdmin, authMethod })` (`middleware/auth.js`) regenerates the session and sets its fields — used by local login and OIDC callback
- Default user: admin/admin (first run only, auto-set as admin)

### OIDC / Authentik
- `server/routes/oidc.js` matches Authentik's `preferred_username` claim **verbatim, no normalization** against local `users.username`. Authentik's account usernames must exactly equal GASS's (no domain suffix, no case difference).
- 2026-09-14 incident: a 2026-07-15 Authentik-side bulk rename to `<name>@gass.local` (via `authentik-shell`, undocumented in GASS, only recorded in the personal llm-wiki) silently broke all OIDC logins for ~2 months — local admin login still worked, masking it. Fixed by renaming the 30 Authentik accounts back to bare usernames via the Admin API; GASS code was not changed. See `docs/TECHNICAL.md#authentication-oidc--authentik` for the full write-up and the log-grep to diagnose a recurrence.
- `AUTHENTIK_API_TOKEN` (used only by the first-login password-change flow) has no monitoring/alerting — it silently expired once already (found invalid 2026-09-14, replaced with non-expiring `gass-api-token-v2`). No code fix applied; just a rotated token in Authentik + redeployed env var.

### Admin Role System
- `is_admin` column in users table (first user auto-promoted)
- `isAdmin()` helper in `auth.js` for frontend checks
- `req.session.isAdmin` for backend checks
- Manage users: `node manage-users.js admin <username> <on|off>`

### User Management
- **Self password change**: key icon in the mobile header / "Cambia password" link in the desktop nav (injected by `auth.js`), local-auth accounts only (OIDC users get no button and a 403: they change it in Authentik's user settings, `default-password-change` flow). First OIDC login with Authentik attribute `settings.requirePasswordChange=true` redirects to `/cambia-password`, which sets the new password via the Authentik API and clears the flag (29 of 32 `gass-users` still had it on 2026-09-30, never logged in; that day they got one shared temporary password, kept only in `~/.cache/gass-video/default.pw`. Emails are placeholders `<username>@gass.local`: no email recovery)
- **Admin user management**: Admins can edit any user via debiti-desktop page
  - Edit display name
  - Reset password (no current password required)
  - Toggle admin status
  - Username is immutable
- API: `POST /api/auth/change-password` (self), `PUT /api/users/:id` (admin)

### Production: Trust Proxy
Required for deployment behind nginx-proxy:
```javascript
app.set('trust proxy', 1)  // server.js
```

---

## Business Logic

### Cassa Fields (readonly, auto-calculated)
- `trovato_in_cassa` = previous day's `lasciato_in_cassa`
- `pagato_produttore` = `Σ conto_produttore` for all movements
- `lasciato_in_cassa` = `trovato + incassato - pagato`

### Saldo Ledger (v2.7)
Saldo = replay from 0 of the participant's movimenti (via `applySaldoChanges`) + rettifiche (`saldo += importo`), ordered by date then `created_at`. All reads go through `server/services/saldi.js`:
- `recalculateSaldo(id, audit)` — rebuild the `users.saldo` cache; call it after any movimento/rettifica change for that participant. **Never write `users.saldo` directly.**
- `saldoAt(id, date)` — historical saldo (events ≤ date)
- `saldoBeforeConsegna(id, date)` — consegna form start (events before that date's movimento)
- `getTransactions(id)` — ledger newest-first with `saldo_dopo`
- `PUT /api/participants/:id` stores `target − ledger saldo` as a rettifica dated today (local)
- Deleting a consegna recalculates only participants that had a movimento in it
- Don't reintroduce flat SQL sums of movimenti for saldi: they ignore the `debito_saldato` clamp and rettifiche
- `POST /api/consegna` rejects (400) non-numeric/negative amounts, `usaCredito` above credit and `debitoSaldato` above debt, measured with `saldoBeforeConsegna` — so a stale `users.saldo` cache (e.g. the local dev DB) makes client-computed payoffs fail validation; the ledger is what counts
- Movimento amounts are stored rounded to cents. Rounding is `Math.round(x*100)/100` (`roundToCents`, same name server and client); `formatNumber` rounds before deciding whether to hide `,00`. Consegne saved before a34ea39 still hold float drift in the cassa columns; no cleanup planned (decided 2026-10-01: the planned data reset removes those rows)
- `salda_tutto` was removed in v2.7 (no UI since 2025-10, 0 rows set in production); the legacy FK-fix migration in `database.js` still names it because it runs before the column drop

### Credit/Debt Auto-Compensation
All compensation fields are disabled (system-managed):
```
diff = importo_saldato - conto_produttore
if diff > 0 && has_debt: auto-apply to debito_saldato
if diff < 0 && has_credit: auto-apply to usa_credito
```

### debito_saldato Display
On a partial payoff `debito_saldato` holds the **whole prior debt** and `debito_lasciato` the remainder (the client sends `debitoSaldato` from `dataset.submitValue`; the field shows only the part paid now). Never render the raw columns: tables use `debitoPagato(m)` (= saldato − lasciato) and `debitoNuovo(m)` (0 when a debt was being paid). Build the submitted movimento with `readMovimentoForm(id)` (`consegna-common.js`); the mobile unsaved-changes check compares its JSON so it matches the save exactly.

### Conditional Section Rendering
- `saldo > 0`: Show CREDITO section, hidden fields for DEBITO
- `saldo < 0`: Show DEBITO section, hidden fields for CREDITO
- `saldo = 0`: Hidden fields for both

---

## UI Patterns

### Design ("Stagioni")
- Mockups of the chosen direction and the alternatives: `design/mockups/` (stagioni = implemented)
- Season accents are CSS vars `--s-deep/--s-acc/--s-alt/--s-tint/--s-on/--s-prod` overridden by `body.s-inverno|primavera|estate` (autunno is the `:root` default). Credit/debt use `--credito`/`--debito`, never a season colour, and always with a sign and a word (`formatSigned` + "credito"/"debito")
- Fonts are self-hosted in `public/fonts/` (Alegreya, Alegreya Sans, OFL); no third-party requests
- Minimum text size is 16px, body 18px. Users asked twice (2.12.0, 2.13.0) for bigger text, so don't go below that
- No emoji in labels or nav (the activity log keeps its event icons)
- Bump `?v=` on changed CSS/JS: static files are cached 7 days

### Mobile
- Cassa is one row (`.conto`): Trovato + Incassato − Pagato = In cassa. All four cassa values (mobile and desktop) are display-only `<output>`s, read and written through `.value` like inputs; `#incassatoCassa` is filled by `updateIncassato()`
- The day's movimenti are listed ("Chi ha ritirato"); tapping a row opens it
- The participant card becomes a full-screen entry at ≤ 768px (pure CSS on `.participant-card-flow`); `#status` is a fixed toast above it
- Calendar opens to current month
- Saldi card (mobile) opens on Transazioni; the admin saldo form is behind a "Modifica saldo" button (`showSaldoEdit`/`hideSaldoEdit` in `debiti.js`). The user disliked the form opening (and the keyboard popping up) on every tap of a name

### Desktop
- Form card below the table, buttons Annulla / Salva movimento
- Table column order: Conto Produttore, Importo Saldato, Lascia Credito, Lascia Debito, Usa Credito, Salda Debito

### Date Selection
- Date persisted in `sessionStorage` (`gass_selected_date`)
- Page reload → today's date
- Tab navigation → preserved date
- Uses `performance.getEntriesByType('navigation')` to detect reload vs navigation

### Visibility Sync
`syncDebitoCreditoVisibility(id)` in `consegna-common.js` shows the computed partial lines (`debitoSaldato_`, `usaCredito_`) only when part of the debt/credit is used, the result line `credito_`/`debito_` only when > 0 (else `pari_`), and hides the `passi_` box when empty. Computed amounts are disabled inputs styled as text lines (`.computed`): their values are what `readMovimentoForm` submits, so keep them as inputs. A full payoff shows only as a note (`remainingDebt_`: "Debito saldato per intero" / `remainingCredit_`: "Credito usato per intero") and is flagged with `dataset.full` on the field, which `readMovimentoForm` sends as `saldaDebitoTotale`. The "Salda intero debito" / "Usa intero credito" checkboxes were removed in 2.9.0: the auto-compensation unchecked them on every recalculation, so they only repeated the title.

### CSS .initially-hidden pattern
`.initially-hidden { display: none }` (no `!important`) — JS `element.style.display = 'block/flex'` must be able to override it. Setting `style.display = ''` does NOT show an element that still has the class: set an explicit value or toggle the class (the admin "Attività" nav item uses `classList.toggle('initially-hidden')`). Use CSS specificity for modals (`.modal.initially-hidden` 0-2-0 beats `.modal` 0-1-0) rather than `!important`, since `!important` would also block inline style overrides.

### Consegna Locking
- "Chiudi Consegna" button in Cassa section (any user can close)
- "Riapri Consegna" button visible only to admins
- When closed: all inputs disabled; `.consegna-closed` hides the add select and makes the list rows inert (the day's list stays visible, read-only)
- Admin must reopen to edit a closed consegna: from the Consegna page or from Storico ("Riapri consegna" on closed ones reopens and opens it on the Consegna page). The user did not find the Consegna-page link alone, so keep the Storico one
- Negative `lasciatoInCassa` is flagged live (`updateCassaWarning()`, call it after setting the field); close/annulla confirmations show a summary via `consegnaSummaryDetails()`

### Admin-Only Features
- Delete a saved consegna (`DELETE /api/consegna/:id` has `requireAdmin`; "Annulla Consegna" is hidden for others once the consegna exists)
- Edit saldi (debiti page, only for today's date - historical saldi are read-only)
- Reopen closed consegne
- Add participants (desktop) - creates a full user account with username/password
- Delete users (desktop, Modifica Utente) - `deleteUser(db, id)` in `server/services/users.js`, shared with `manage-users.js delete`: refused if last user or the user has movimenti or rettifiche (they would CASCADE away); otherwise every non-cascading FK to `users` (activity logs, audit `*_by` columns) is set to NULL first, found dynamically via `pragma_foreign_key_list`. The route also refuses deleting yourself (the `user_deleted` log's actor FK would fail)
- User `stato` (2.17.0, replaced `attivo` from 2.16.0): `PUT /api/users/:id {stato}` or `manage-users.js stato <u> <attivo|sospeso|disattivato>`. `disattivato` is for leavers with history: blocked at local login, OIDC callback and `requireAuth`. `sospeso` logs in, keeps its saldo and stays in the consegna select, but gets no turni. Leaving `attivo` calls `freeFutureTurni` (future slots become da coprire); returning sets `turni_dal` (a no-op for an already-attivo user). `GET /api/participants` returns everyone; filtering is client-side: `visibleParticipants()` (`debiti-common.js`, "Mostra disattivati" on desktop) and `renderParticipantSelect` (hides only disattivati; `openMovimento` adds the option on the fly for a disattivato user's saved movimento). Saldi totals count everyone. Non-attivo rows are greyed (`.off`) with a stato badge next to the name, for every user, on mobile and desktop; `visibleParticipants()` orders attivi, sospesi, disattivati, each by `localeCompare(…, 'it')` (the server's `ORDER BY display_name` is case-sensitive)
- Turni editing (desktop `turni-desktop.js`): swap any name ("scambia con…": the chosen person takes the slot, the picked one takes their first turno from today; recorded only in the activity log, confirmed in a modal like replacements; non-admins can swap only their own slot, desktop and mobile), replace/assign, "Giorno" modal, pauses; routes `PUT /api/turni/:id`, `POST /api/turni/scambio`, `POST/DELETE /api/turni/pause`
- Activity logs page (desktop only)

### Turni
Queue rule in `turni-schedule.js` `pickPair`: first = waiting longest since their last turno (or `turni_dal`); partner = among the next `PARTNER_WINDOW = 3` in line, the one with fewest shared turni, ties random. Consegne are Tuesdays; `turni.settimana` is the week's Tuesday, `data` the real day. `ensureTurni` (every `GET /api/turni`) only fills missing non-pause Tuesdays in `[nextTuesday(today), today + HORIZON_DAYS)`, `HORIZON_DAYS = 168` (24 weeks); existing weeks never change by themselves. Automatic generation can be paused (`settings` table, key `turni_auto`, admin checkbox on the desktop page): new weeks are then written empty and an admin picks the names from per-slot menus (decided 2026-10-01: Paola, who ran the turni by hand, keeps composing them). Users can swap, move to a free slot (`moveTurno`) or leave (`leaveTurno`) their own turno; filling an empty slot from the admin menu needs no confirmation, replacing or clearing does. `settings.turni_note` holds free-text notes (admin writes on desktop, everyone reads, mobile too). While paused the desktop hides the "primi in fila" hints (`autoOn`), since the queue no longer matters. `saltata` frees the pair (first in line again). 10-year simulation (2026-10-01): 22 people gaps 10-12 weeks, 21 people 9-12, no pair more than 4 times; k = 3 chosen over 4/5 for regularity. Details in `docs/TECHNICAL.md#turni`.

### Dates are local
Calendar dates (`data`, `ultima_modifica`, "today") are always the **local** date: use `toLocalDateString()` (`utils.js` client-side, `calculations.js` server-side). Never `toISOString().split('T')[0]` or SQLite `DATE()` — both give the UTC date, which is yesterday between 00:00 and 01:00/02:00 in Italy. The image sets `TZ=Europe/Rome` (+ `tzdata`, Alpine has none). Audit timestamps (`created_at`, `updated_at`) stay ISO UTC with `Z`. Exception on purpose: `turni-schedule.js` does date arithmetic on UTC midnights of the `yyyy-mm-dd` strings (`addDays`, `tuesdayOf`), which is DST-safe because no local time is involved; "today" is still passed in as the local date.

### Currency Display
Italian format: `formatNumber()` → `11,50` / `8` (hides `,00`); `formatEuro()` → `11,50 €`; `formatSigned()` → `+6 €` / `−1,50 €` (typographic minus, display only). `formatNumber` output is also written into readonly/computed inputs and read back with `parseAmount`, which accepts comma or dot, so never write `formatSigned`/`formatEuro` into an input. `normalizeInputField` turns a typed dot into a comma.

---

## Activity Logging

### Event Types (activity_logs table)
- `consegna_created` - New consegna created (with `consegna_id`)
- `movimento_changed` - Manual field changes (conto_produttore, importo_saldato only)
- `saldo_updated` - Direct saldo modifications by admin
- `user_created`, `user_edited`, `user_deleted` - User management events
- `password_changed` - Password resets

### `consegna_id` Column
`activity_logs.consegna_id` links events to a consegna (no FK constraint — consegna may be deleted). The frontend regex fallback (parsing date from `details`) handles old rows without `consegna_id` and orphaned references.

### Virtual Events (computed from other tables)
- `movimento_created` - From movimenti with `created_at` (audit tracked)
- `movimento_historical` - From movimenti without `created_at` (pre-audit data)
- `movimento_updated` - From movimenti with different `updated_at` (no duplicate if `movimento_changed` exists)
- `consegna_closed`, `consegna_reopened` - From consegne timestamps

### Change Tracking
Only **manual fields** are tracked for movimento changes:
- `conto_produttore` - Producer invoice amount
- `importo_saldato` - Amount paid

Auto-calculated fields (credito_lasciato, debito_lasciato, usa_credito, debito_saldato) are NOT logged as changes since they derive from manual inputs.

---

## Testing

**Stack**: Vitest + supertest, `pool: forks` (each test file = isolated Node process)

```bash
npm test                    # all 268 tests
npm run test:unit           # pure function tests (no DB/HTTP)
npm run test:integration    # API tests with in-memory SQLite
npm run test:coverage       # with coverage report
```

### Architecture
- `test/helpers/setup-test-db.js` — creates in-memory DB, patches `require.cache` for DB isolation
- `test/helpers/setup-app.js` — creates supertest agent wrapping `createApp()`
- `test/helpers/seed.js` — `createUser`, `createConsegna`, `createMovimento`, `createRettifica`, `loginAs`, `clearConsegne`, `clearNonAdminUsers`
- `createUser({ saldo })` only seeds the cache; a saldo the ledger should know about needs a matching `createRettifica`
- Call `setupTestDb()` **before** any `require('../../server/app')` in test files

### Key gotchas
- `database.js` creates no production singleton when `NODE_ENV=test`; test files must call `setupTestDb()` first to patch the require cache before loading app
- API routes are mounted before the pages router so unauthenticated API calls return 401 (not 302)
- `clearNonAdminUsers` deletes all users except `username='admin'` and resets admin's `is_admin=1`; cleans FK-dependent `activity_logs` rows first

### Dev testing tip
Set `force_mobile=true` cookie in browser to force mobile view regardless of user agent. Clear it to restore desktop view for admin users.

---

## Docker Build

Build and push multi-platform images:
```bash
docker buildx build --platform linux/amd64,linux/arm64 -t jeremyjrossi/gass:<version> --push .
docker buildx build --platform linux/amd64,linux/arm64 -t jeremyjrossi/gass:latest --push .
```
- don't update container images after docker builds