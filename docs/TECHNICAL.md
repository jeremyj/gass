# GASS Pagamenti - Technical Documentation

## Documentazione Correlata

- **[README](../README.md)** - Panoramica progetto e quick start
- **[Manuale Utente](MANUALE_UTENTE.md)** - Guida all'utilizzo dell'applicazione
- **[Guida Deploy](../DEPLOYMENT.md)** - Istruzioni per installazione Docker

## Overview

GASS Pagamenti is a financial management system for tracking deliveries, cash movements, and participant balances in a solidarity purchasing group (GAS - Gruppo di Acquisto Solidale). The system records transactions between participants and a producer, calculates balances, and maintains historical records.

## Technical Stack

- **Backend**: Node.js + Express.js
- **Database**: SQLite with better-sqlite3
- **Frontend**: Vanilla JavaScript (ES6+)
- **Deployment**: Docker-compatible, runs on port 3000

## Architecture

### Backend (server.js)

RESTful API with the following endpoints:

```
GET    /api/participants              - Retrieve all participants with current balances
GET    /api/participants?date         - Calculate participant balances as of specific date
GET    /api/participants/:id/transactions - Ledger (movimenti + rettifiche) with running saldo (any authenticated user)
GET    /api/consegna/:date            - Retrieve delivery data for specific date
POST   /api/consegna                  - Create or update delivery with movements
DELETE /api/consegna/:id              - Delete delivery and recalculate affected balances (admin)
GET    /api/storico                   - Retrieve all deliveries (summary)
GET    /api/storico/dettaglio         - Retrieve all deliveries with detailed movements
PUT    /api/participants/:id          - Set participant balance (stored as a rettifica, admin)
POST   /api/participants              - Create new participant
DELETE /api/participants/:id          - Delete participant (admin; 400 if the user has movimenti or rettifiche)
GET    /api/turni                     - Next 12 weeks (generates missing ones), pause list (any authenticated user)
PUT    /api/turni/:id                 - Edit a week: turnisti, day, saltata, riunione, nota (admin)
POST   /api/turni/scambio             - {a: {id, slot}, userId}: userId takes slot a, a's person takes userId's first turno from today (any user for their own slot, admin for any)
POST   /api/turni/pause                - Add a pause (admin); DELETE /api/turni/pause/:id removes it
GET    /api/version                   - Get application version from package.json (public, no auth)
```

**User deletion:** `movimenti` and `rettifiche_saldo` reference `users` with `ON DELETE CASCADE`, so deleting a user with either would erase their history from past consegne; the route refuses it with 400. For any other user, every non-cascading reference to `users` (`activity_logs.target_user_id`/`actor_user_id`, the `*_by` audit columns) is set to NULL in the same transaction as the delete, so log rows stay. The rule lives in `server/services/users.js` (`deleteUser(db, id)`), shared by the route and `manage-users.js delete`. An admin can't delete their own account (400): the `user_deleted` log row would reference a deleted actor.

**User stato** (`users.stato`, replaced `attivo`): `attivo` (default), `sospeso` (logs in, sees saldi, listed in the consegna "Aggiungi partecipante" select, gets no turni) or `disattivato` (the way to remove someone who has history: local login returns 403, OIDC redirects to `/login?error=user_disabled`, `requireAuth` also checks it so an open session ends on its next API call). Set by `PUT /api/users/:id` with `{ stato }` (logged as `user_edited` `stato: a → b`; an admin can't suspend or disable themselves) or `manage-users.js stato <username> <attivo|sospeso|disattivato>`. Leaving `attivo` empties the user's future turni (`freeFutureTurni`: they become "da coprire"); returning to `attivo` sets `turni_dal` to that day, so the turni wait restarts from it (setting `attivo` on an already-attivo user changes nothing). `GET /api/participants` returns everyone (with `stato`), so past consegne and saldi resolve; the pages hide disattivati: the consegna select lists only non-disattivati users (a disattivato user's saved movimento still opens from the day's list), the Saldi list hides them unless an admin ticks **Mostra disattivati** (desktop). The Saldi totals include everyone's saldi.

`GET /comefunziona` serves `public/comefunziona.html`, the first-access video (`public/video/gass-primo-accesso.mp4`); `GET /v2.17` serves `public/v2.17.html`, the turni video (`public/video/gass-turni.mp4`). Both public, no auth. The one-page guide `/inbreve` was removed in 2.17.3.

### Frontend Structure

#### Desktop Views
- `consegna-desktop.html/js` (1159 lines) - Delivery entry form
- `debiti-desktop.html/js` (427 lines) - Balance overview with transactions modal
- `storico-desktop.html/js` (193 lines) - Historical records

#### Mobile Views
- `consegna.html/js` (1223 lines) - Delivery entry form
- `debiti.html/js` (416 lines) - Balance overview with inline transaction history
- `storico.html/js` (239 lines) - Historical records

#### Shared Components
- `calendar.js` (363 lines) - Date picker with delivery indicators and localStorage persistence
- `utils.js` (67 lines) - Formatting and parsing utilities
- `version.js` - Dynamic version display from package.json
- `api-client.js` - Centralized API communication layer
- `auth.js` - Session management and authentication checks

## Data Models

### Database Schema

#### Table: users (unified user + participant table, v2.0+)
```sql
id                INTEGER PRIMARY KEY
username          TEXT UNIQUE NOT NULL
password_hash     TEXT NOT NULL
display_name      TEXT NOT NULL          -- shown as "nome" in API
is_admin          INTEGER DEFAULT 0
stato             TEXT NOT NULL DEFAULT 'attivo'  -- attivo | sospeso | disattivato
turni_dal         DATE                -- start of the turni wait (set when returning to attivo)
saldo             REAL DEFAULT 0      -- cache, derived from the ledger
ultima_modifica   DATE                -- date of the last ledger event
created_by        TEXT, created_at DATETIME
updated_by        TEXT, updated_at DATETIME
```

#### Table: consegne
```sql
id                    INTEGER PRIMARY KEY
data                  DATE UNIQUE NOT NULL
trovato_in_cassa      REAL
pagato_produttore     REAL
lasciato_in_cassa     REAL
note                  TEXT
chiusa                INTEGER DEFAULT 0
chiusa_by             TEXT, chiusa_at DATETIME
riaperta_by           TEXT, riaperta_at DATETIME
created_by            TEXT, created_at DATETIME
updated_by            TEXT, updated_at DATETIME
```

#### Table: movimenti
```sql
id                    INTEGER PRIMARY KEY
consegna_id           INTEGER NOT NULL REFERENCES consegne(id)
partecipante_id       INTEGER NOT NULL REFERENCES users(id)
importo_saldato       REAL DEFAULT 0
usa_credito           REAL DEFAULT 0
debito_lasciato       REAL DEFAULT 0
credito_lasciato      REAL DEFAULT 0
salda_debito_totale   BOOLEAN DEFAULT 0
debito_saldato        REAL DEFAULT 0
conto_produttore      REAL DEFAULT 0
note                  TEXT
created_by            TEXT, created_at DATETIME
updated_by            TEXT, updated_at DATETIME
```

#### Table: rettifiche_saldo
Manual saldo corrections (admin edits), one row per edit.
```sql
id                INTEGER PRIMARY KEY
partecipante_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
data              DATE NOT NULL
importo           REAL NOT NULL       -- signed difference applied to the saldo
note              TEXT
created_by        INTEGER, created_at DATETIME
```

#### Table: activity_logs
```sql
id              INTEGER PRIMARY KEY
event_type      TEXT NOT NULL
target_user_id  INTEGER
actor_user_id   INTEGER
details         TEXT
consegna_id     INTEGER
created_at      DATETIME
```

#### Table: turni
```sql
id            INTEGER PRIMARY KEY
settimana     DATE NOT NULL UNIQUE  -- the week's Tuesday (key)
data          DATE NOT NULL         -- real day, Mon-Sun of that week
turnista1_id  INTEGER, turnista2_id INTEGER  -- FK users, NULL = da coprire
saltata       INTEGER DEFAULT 0     -- niente consegna
riunione      INTEGER DEFAULT 0
nota          TEXT
created_by, created_at, updated_by, updated_at  -- audit
```

#### Table: turni_pause
```sql
id INTEGER PRIMARY KEY, dal DATE, al DATE, nota TEXT, created_by, created_at
```

#### Indexes
- `idx_consegne_data` on consegne(data)
- `idx_movimenti_consegna` on movimenti(consegna_id)
- `idx_movimenti_partecipante` on movimenti(partecipante_id)
- `idx_rettifiche_partecipante` on rettifiche_saldo(partecipante_id)

## Core Algorithms

### 1. Saldo Ledger

A participant's saldo is **derived**: replay their ledger from 0, oldest first. `users.saldo` and `users.ultima_modifica` are a cache, rebuilt with `recalculateSaldo()` whenever a movimento or rettifica of that participant changes (`server/services/saldi.js`).

Ledger events:

| Event | Source | Effect on saldo |
|-------|--------|-----------------|
| movimento | `movimenti` row, dated by its consegna | `applySaldoChanges()` below |
| rettifica | `rettifiche_saldo` row (admin manual edit) | `saldo += importo` |

Order: by date, then by `created_at` within the same date.

```javascript
function applySaldoChanges(saldo, movimento) {
  if (movimento.usa_credito > 0) saldo -= movimento.usa_credito;
  if (movimento.salda_debito_totale && saldo < 0) saldo = 0;
  else if (movimento.debito_saldato > 0 && saldo < 0) saldo = Math.min(0, saldo + movimento.debito_saldato);
  if (movimento.debito_lasciato > 0) saldo -= movimento.debito_lasciato;
  if (movimento.credito_lasciato > 0) saldo += movimento.credito_lasciato;
  return roundToCents(saldo);
}
```

| Question | Function | Events replayed |
|----------|----------|-----------------|
| Current saldo | `recalculateSaldo()` | all |
| Saldo as of date D (`GET /api/participants?date=D`) | `saldoAt()` | dated ≤ D |
| Starting saldo of the consegna form for D (`saldiBefore`) | `saldoBeforeConsegna()` | before the participant's movimento on D (same-day rettifiche entered earlier count) |
| Transaction history with running saldo (`saldo_dopo`) | `getTransactions()` | all, returned newest first |

Deleting a consegna recalculates only the participants that had a movimento in it; rettifiche are never touched.

**Manual saldo edit** (`PUT /api/participants/:id`, admin): the admin sets the target saldo; the server stores the difference from the ledger saldo as a rettifica dated today (local date) and logs `saldo_updated`.

### 2. Cash Calculation Algorithm

Cash flow calculation for each delivery (readonly, no manual overrides):

```javascript
// Trovato in cassa (cash found)
trovato = previous_lasciato_in_cassa || 0;

// Pagato produttore (paid to producer)
// Simplified to just sum of conto_produttore values
pagato = SUM(conto_produttore);

// Lasciato in cassa (cash left)
lasciato = trovato + incassato - pagato;
```

Where `incassato` (cash collected) is:
```javascript
incassato = SUM(importo_saldato);
```

### 3. Precision Handling

All monetary results are rounded to cents with `roundToCents()` (`server/services/calculations.js`):

```javascript
const roundToCents = (num) => Math.round(num * 100) / 100;
```

The client uses the same formula under the same name (`public/js/shared/utils.js`).

All user inputs are normalized:
```javascript
function parseDecimal(value) {
  return parseFloat(value.replace(',', '.')) || 0;
}
```

## Turni

Pure date/queue logic in `server/services/turni-schedule.js` (`addDays`, `tuesdayOf`, `nextTuesday`, `inPause`, `isDateString`, `pickPair`); DB-backed in `server/services/turni.js`.

**Generation is lazy.** Each `GET /api/turni` runs `ensureTurni`, which fills every missing non-pause Tuesday in `[nextTuesday(today), today + HORIZON_DAYS)` (`HORIZON_DAYS = 84`). Weeks already written are never recomputed. Adding a pause turns the weeks already written inside it into `saltata` and frees their people; deleting it lets the missing weeks regenerate on the next GET, while weeks already `saltata` stay so (restored from "Giorno").

**Pair rule** (`pickPair`): only `attivo` users; the first is the one waiting longest since their last turno (or `turni_dal`); the partner is, among the next `PARTNER_WINDOW = 3` in the queue, the one they have done fewest turni with, ties at random. A `saltata` week frees its pair, who are first in line again.

**Simulation** (10 years, 2026-10-01, k = 3): gaps between turni of 10-12 weeks with 22 people, 9-12 with 21; nearly all partners met; no pair more than 4 times. k = 3 was chosen over 4 and 5 for the more regular gaps.

**Import:** `manage-turni.js import <file.csv>`, lines `yyyy-mm-dd;username1;username2;nota` (blank lines, `#` comments and a `data` header are skipped; a nota containing "riunione" sets `riunione`). It replaces every week from the first imported date. `manage-turni.js list` prints the next 12 weeks.

Activity events: `turno_modificato`, `turno_scambio`, `pausa_aggiunta`, `pausa_eliminata`. Pages: `turni.html` (mobile agenda, self swap) and `turni-desktop.html` (self swap; admin editing). Shared client swap logic: `public/js/shared/turni-common.js`.

## Features

### 1. Consegna (Delivery Entry)

#### Cash Fields (Cassa) - Readonly Architecture

Cash fields are **always readonly** - no manual override capability in mobile or desktop versions.

**Fields:**
- `trovato_in_cassa`: Cash found (from previous delivery's lasciato)
- `pagato_produttore`: Total paid to producer (sum of all conto_produttore values)
- `lasciato_in_cassa`: Cash left (trovato + incassato - pagato)

**Implementation:**
- **Mobile** (`consegna.js`, `consegna.html`):
  - Fields have `readonly` attribute with disabled styling
  - Functions: `calculatePagatoProduttore()`, `calculateLasciatoInCassa()`, `updatePagatoProduttore()`, `updateLasciatoInCassa()`

- **Desktop** (`consegna-desktop.js`, `consegna-desktop.html`):
  - Same calculation functions as mobile
  - Inline styles: `readonly`, `cursor: not-allowed`, `background: #f0f0f0`
  - No SmartInputManager dependency
  - No AUTO badges or click hints

**Calculation Logic:**
- `trovato_in_cassa`: Previous delivery's `lasciato_in_cassa` value (or 0 if first)
- `pagato_produttore`: `Σ conto_produttore` from all movements
- `lasciato_in_cassa`: `trovato + incassato - pagato`
  - `incassato = Σ importo_saldato` from all movements

**Display Formatting:**
- Italian format since 2.11.0: `formatNumber()` gives `11,50` and hides `,00` on whole numbers (`42`); it rounds to cents first, so float drift like `20.000000000000004` shows as `20`. `formatEuro()` adds ` €`, `formatSigned()` gives `+6 €` / `−1,50 €` for credit/debt
- Typed amounts accept comma or dot (`normalizeInputField` shows a comma); `parseAmount()` reads both, so values written back into readonly fields round-trip

#### Participant Movements
Each movement tracks:
- `conto_produttore`: Total amount owed to producer for goods received
- `importo_saldato`: Amount collected from participant
- `usa_credito`: Use participant's existing credit (system-managed, always disabled, always visible)
- `debito_lasciato`: New debt to carry forward (system-calculated, always disabled)
- `credito_lasciato`: New credit to carry forward (system-calculated, always disabled)
- `salda_debito_totale`: set when the whole prior debt is paid off (client derives it from the auto-compensation, no checkbox since 2.9.0)
- `debito_saldato`: Partial debt settlement amount (system-managed, always disabled, always visible). On a partial payoff it stores the **whole prior debt** and `debito_lasciato` the part still owed, so the ledger replay (`min(0, saldo + debito_saldato) - debito_lasciato`) is right. The UI never shows the raw pair: `debitoPagato(m)` / `debitoNuovo(m)` in `utils.js` split it into amount paid and genuinely new debt

**Auto-Calculation**: The `credito_lasciato` and `debito_lasciato` fields are calculated values based on the formula:
```
diff = importo_saldato - conto_produttore
// Compensation (usa_credito, debito_saldato) applied before final balance calculation
if diff > 0: credito_lasciato = diff
if diff < 0: debito_lasciato = abs(diff)
```
These fields are always disabled to prevent manual editing and ensure data integrity.

**Compensation Fields Architecture**: The `usa_credito` and `debito_saldato` fields are **always disabled and always visible** regardless of participant's existing balance. They are system-managed only with no manual override capability:
- Fields appear in every transaction form (disabled state)
- System automatically populates values when compensation is applicable
- Values update in real-time as user enters transaction details
- Transparency: users can always see when and how compensation is applied

**Bidirectional Auto-Compensation**: The system automatically offsets credits and debts in both directions:

1. **Creating credit while participant has debt**:
   - Example: Participant has 7€ debt, conto_produttore=15€, importo_saldato=22€
   - Result: the participant form shows the note "Debito saldato per intero"
   - If credit >= debt: Full debt settlement
   - If credit < debt: Partial debt settlement with available credit

2. **Creating debt while participant has credit**:
   - Example: Participant has 10€ credit, conto_produttore=18€, importo_saldato=5€
   - Result: the form shows the note "Credito usato per intero" and the result box "Lascia debito 3 €"
   - If credit >= debt: Full debt offset
   - If credit < debt: Partial debt reduction

**Automatic Recalculation**: Compensation fields recalculate automatically on every input change:
- Changes to `conto_produttore` or `importo_saldato` trigger immediate recalculation
- Fields are reset and repopulated based on current transaction values
- No manual override capability - values are purely system-calculated
- Simple, predictable behavior ensures data integrity

#### Transaction Processing
1. User enters movement data for each participant
2. System rebuilds each participant's saldo from the ledger (see Saldo Ledger)
3. System recalculates `pagato_produttore` from all movements
4. System calculates `lasciato_in_cassa`
5. On save: Transaction commits all changes atomically

### 2. Debiti (Balance Overview)

#### Features
- Displays all participants with current balances
- Color coding:
  - Red: Negative balance (debt)
  - Green: Positive balance (credit)
  - Gray: Zero balance
- Shows last modification date for each participant
- Date picker to view historical balances

#### Transaction History
- **Desktop**: "Transazioni" button on each row opens a modal with the full ledger (`GET /api/participants/:id/transactions`)
- **Mobile**: Expanding a participant card loads and shows transactions inline
- Manual edits appear as "Rettifica manuale" rows
- Any authenticated user can view any participant's transactions

#### Historical View
- Select any past date
- System replays each ledger up to that date (`saldoAt()`)

### 3. Storico (Historical Records)

#### Features
- Lists all deliveries in reverse chronological order (newest first)
- Expandable cards showing:
  - **CASSA section**: trovato, pagato, lasciato amounts
  - **MOVIMENTI section**: All participant transactions
- Delete button to remove delivery and recalculate affected balances
- Visual indicators for manual overrides (discrepanze)

### 4. Calendar Component

#### Features
- Month navigation (previous/next)
- Visual indicators:
  - Highlighted dates with saved deliveries
  - Today marker
  - Selected date highlight
- Quick date selection for all views
- Shared component across mobile and desktop
- Date persistence across tab navigation using localStorage

#### Calendar Behavior
- **Opens to Current Month**: Calendar always opens showing today's month
  - Date picker (mobile + desktop): Resets to current month via `toggleDatePicker()`
- **Simplified Legend**: Shows only "Con consegna" indicator
  - Removed redundant "Senza consegna" legend item for cleaner UI
  - All dates without deliveries appear in standard styling (white background)

#### Date Persistence
The calendar component maintains the selected date across page navigation:
- Selected dates are stored in `localStorage` with key `gass_selected_date`
- On page load, the system checks for a saved date before defaulting
- Ensures consistent date context when switching between tabs (Consegna, Saldi, Storico)
- Falls back to page-specific defaults if no saved date exists

#### Dynamic Participant Updates
When a participant is open in the Consegna form:
- Date changes automatically reload the participant's data for the new date
- System preserves the selected participant across date changes
- Ensures transaction data, balances, and movements reflect the newly selected date
- Implementation: `checkDateData()` in `consegna.js` remembers and re-renders current participant after loading new date data

### 5. Responsive Design

#### Detection Logic
```javascript
function isMobile() {
  const userAgent = navigator.userAgent.toLowerCase();
  const mobileKeywords = ['mobile', 'android', 'iphone', 'ipad'];
  return mobileKeywords.some(keyword => userAgent.includes(keyword));
}
```

#### Override Mechanism
Cookie-based override for testing:
```javascript
document.cookie = "force_mobile=true";
```

#### Layout Differences
- **Mobile**: Bottom navigation bar, vertical layout
- **Desktop**: Top navigation menu, horizontal layout

## Data Integrity

### Transaction Management
All database operations that modify multiple tables use transactions:

```javascript
const transaction = db.transaction(() => {
  // Delete delivery (movimenti cascade)
  db.prepare('DELETE FROM consegne WHERE id = ?').run(id);

  // Rebuild the saldo of each participant that had a movimento in it
  movimenti.forEach(m => recalculateSaldo(m.partecipante_id, audit));
});

transaction();
```

### Validation Rules
- Date uniqueness: One delivery per date
- Participant name uniqueness
- Balance changes require a movimento or a rettifica
- `POST /api/consegna` is checked by `server/services/validation.js` before anything is written; failures return 400 with an Italian message:
  - `data` is `YYYY-MM-DD`, `partecipanti` is an array, `partecipante_id` is an integer
  - movimento amounts are numbers (or null), finite and ≥ 0; cassa amounts are finite (trovato may be negative)
  - not both `creditoLasciato` and `debitoLasciato` > 0
  - `usaCredito` ≤ available credit and `debitoSaldato` ≤ existing debt, both against `saldoBeforeConsegna` (ledger, not the `users.saldo` cache)
- Stored movimento amounts are rounded to cents

## Initialization

### Database Setup
On startup, the application:
1. Creates database file if not exists
2. Creates all tables with indexes
3. Adds missing columns via `ALTER TABLE` for schema upgrades
4. Populates default participants if table is empty:
   - Renzo
   - Livia
   - Jeremy
   - Giovanni

### Configuration
Environment variables:
- `PORT`: Server port (default: 3000)
- `DB_PATH`: Database file path (default: `./gass.db`)
- OIDC/Authentik variables — see [Authentication](#authentication-oidc--authentik) below

## Authentication (OIDC / Authentik)

GASS supports OIDC single sign-on via a self-hosted Authentik instance, active only when `OIDC_ISSUER` is set (`server/routes/oidc.js`). Without it, local username/password login behaves exactly as before.

**Environment variables:**
- `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_REDIRECT_URI`
- `OIDC_ADMIN_GROUP` (default `gass-admin`) — Authentik group whose members get `is_admin` synced on each login
- `AUTHENTIK_API_URL`, `AUTHENTIK_API_TOKEN` — used for the first-login forced-password-change flow (`POST /auth/oidc/change-password`), which calls Authentik's Admin API directly

**User matching:** on callback, GASS looks up `SELECT * FROM users WHERE username = ?` using the token's `preferred_username` claim verbatim — there is no normalization or suffix-stripping. This means **Authentik's `username` field for each account must exactly equal the corresponding row in GASS's local `users.username` column** (case-sensitive, no domain suffix). If an Authentik-side migration or bulk edit changes account usernames (e.g. to a namespaced `user@domain` form), OIDC logins will silently start failing with "user not found" while local admin login keeps working — the mismatch went undetected for ~2 months (2026-07-15 to 2026-09-14) for exactly this reason. When diagnosing OIDC login failures, check `docker logs gass | grep OIDC` for the `Login rejected: username '<x>' not found` line and compare it against `users.username`.

**Admin sync:** admin status is re-derived from the `OIDC_ADMIN_GROUP` claim on every OIDC login and written to `users.is_admin` — it is not editable from GASS's UI/API when OIDC is enabled (see Admin Role System below).

**Passwords and recovery:** account emails in Authentik are placeholders (`<username>@gass.local`), so password recovery by email cannot work; a forgotten password is reset by an admin in Authentik. The 29 `gass-users` accounts that had never logged in were given one shared temporary password on 2026-09-30, with `settings.requirePasswordChange` still on, so each member sets their own at first login (verified via `ak shell` on host `personal` 2026-09-30).

## Deployment

### Local Development
```bash
npm install
npm run dev  # Auto-restart on file changes
```

### Production
```bash
npm install
npm start
```

### Docker
```bash
docker build -t gass-pagamenti .
docker run -p 3000:3000 -v $(pwd)/data:/app/data gass-pagamenti
```

Database persisted in `/app/data/gass.db` volume.

Back up `gass.db` before upgrading to 2.17.0: its migration drops `users.attivo`, so rolling back to 2.16.x without restoring the copy would re-enable every disattivato user.

The image sets `TZ=Europe/Rome` (with `tzdata`); all calendar dates are local. Override with `-e TZ=...` if needed.

## Error Handling

### Backend
- Database errors return 500 with error message
- Validation errors return 400 with descriptive message
- All endpoints wrapped in try-catch blocks
- Transaction rollback on any error

### Frontend
- Network errors displayed via `showStatus`
- Confirmations use `confirmDialog()` (`utils.js`, Promise-based modal with optional detail rows), never `window.confirm()`
- A negative lasciato in cassa is flagged live on the consegna page (`updateCassaWarning()` in `consegna-common.js`)
- Form validation before submission
- Graceful degradation for missing data
- User feedback for all operations (success/failure)

## Performance Considerations

### Database Optimization
- Indexed foreign keys for fast joins
- Single database connection reused across requests
- Prepared statements for repeated queries
- Transaction batching for multi-table operations

### Frontend Optimization
- Minimal external dependencies
- Event delegation for dynamic elements
- Debounced recalculation on rapid input
- Conditional rendering based on data availability

## Recent Technical Changes

### Commit: 044e960
**Bugfix**: Always show compensation fields regardless of existing balance

Fixed issue where compensation fields (usa_credito, debito_saldato) were missing from UI when participant's saldoBefore was 0.

**Problem**: Compensation sections were conditionally rendered based on haCredito/haDebito flags. When participant started the day with zero balance, hidden fields were added instead of visible disabled inputs.

**Solution**:
- Removed conditional rendering - always include buildCreditoSection() and buildDebitoSection()
- Removed addHiddenFields() calls
- Fields now always appear (disabled) and update in real-time

**Impact**: Users can now always see compensation calculations, improving transparency.

**Files Modified**: `consegna.js`, `consegna-desktop.js`

### Commits: 4717827, e76b48d
**Refactor**: Simplified compensation fields to always-disabled system-managed architecture

Removed complex manual/auto tracking system in favor of simple always-disabled fields:

**Changes**:
- Removed dataset.autoPopulated tracking (114 lines of complex code)
- Compensation fields now always disabled with no manual override
- Simplified diff calculation from complex formula to just `importo_saldato - conto_produttore`
- Added field reset logic to ensure clean recalculation on every input change

**Benefits**:
- Clearer UX: users know fields are system-calculated
- Simpler code: no state tracking needed
- Better data integrity: impossible to create inconsistent states
- Predictable behavior: always recalculates based on current values

**Files Modified**: `consegna.js`, `consegna-desktop.js`

### Commits: aa1c516 through 3a95cc9
**Feature**: Bidirectional automatic credit/debt compensation

Implemented comprehensive auto-compensation system that automatically offsets credits and debts:

**Cases**:
- **Debt → Credit compensation**: Transaction creates credit but participant has existing debt
- **Credit → Debt compensation**: Transaction creates debt but participant has existing credit

**Trigger conditions**: Compensation activates when BOTH `conto_produttore > 0` AND `importo_saldato > 0`

**Files Modified**: `consegna.js`, `consegna-desktop.js`

### Commit: ec1527d
**Feature**: Calculate credit/debit even without producer account
- Modified balance calculation to work when `pagato_produttore` is not set
- Enables partial delivery entry workflow

### Commit: 9faa029
**Refactoring**: Remove participant name from movement card header
- Simplified UI by removing redundant information
- Name already visible in movement form

### Commit: 9d75a84
**Bugfix**: Correct checkbox behavior for 'Salda intero debito'
- Fixed field name from `salda_tutto_debito` to `salda_debito_totale`
- Ensures proper debt settlement flag storage

### Commit: adeea37
**UI Improvement**: Repositioned CASSA info-badge
- Moved cash summary badge for better visibility
- Removed duplicate `renderSaldiSummary` function

### Commit: 62b9414
**Consistency**: Uniformed mobile header and info-badge interface
- Aligned mobile and desktop UI components
- Improved visual consistency across views

### Commit: c0915c5
**Bugfix**: Remove duplicate save button in mobile movimenti section
- Removed redundant global "Salva Movimenti" button appearing outside participant forms
- Each participant form already contains its own save button
- Eliminated `updateSaveButtonVisibility()` function and all references

### Commit: 80939c8
**Bugfix**: Improve empty database UX - default to today and format zero values
- Empty database now defaults to today's date instead of stale localStorage date
- Format `trovato_in_cassa` with `formatNumber()` to show "0" instead of "0.00"
- Ensures clean initial state for new installations with consistent formatting

### Commit: c5846be
**Bugfix**: Conditional rendering of credit/debt sections
- Fixed UI issue where both CREDITO and DEBITO sections were always visible
- Implemented conditional rendering based on participant's existing balance:
  - `saldo > 0`: Show only CREDITO section
  - `saldo < 0`: Show only DEBITO section
  - `saldo = 0`: Hide both sections
- Added hidden input fields for non-visible sections to ensure form data integrity
- Reverts unconditional rendering from commit 044e960 while preserving fix for saldoBefore=0 case
- **Files Modified**: `consegna.js:273-274,373-374`, `consegna-desktop.js:518,604-606`

### Commit: b1c6aa6
**Refactor**: Align desktop cassa fields with mobile readonly implementation
- Removed SmartInputManager dependency from desktop version
- Made all cassa fields permanently readonly with inline styles
- Removed AUTO badges and manual override hints from UI
- Simplified cassa calculations with dedicated functions (matching mobile)
- Fixed cassa values display on new consegna initialization
- Always save `discrepanze=0` (no manual overrides allowed)
- Reduced code complexity: -150 lines of SmartInputManager integration code
- **Benefits**:
  - Consistent UX between mobile and desktop
  - Simpler codebase with less state management
  - Better data integrity (impossible to create discrepancies)
  - Cleaner UI without confusing override hints
- **Files Modified**: `consegna-desktop.html`, `consegna-desktop.js`
