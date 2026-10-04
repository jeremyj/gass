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
GET    /api/participants              - Retrieve all participants with current balances, `teatro_residuo` (owed, negative = advance) and `teatro_dovuto` (current semester quota, 0 = none)
GET    /api/participants/:id/transactions - Ledger (movimenti + rettifiche) with running saldo (any authenticated user)
GET    /api/consegna/apertura         - {data, aperte}: date the Consegna page opens on, all open consegne (declared before /:date)
GET    /api/consegna/:date            - Delivery data for a date; each movimento has `teatro`, plus `teatroExtra` [{user_id, nome, importo}] for quota-only payers
POST   /api/consegna                  - Create or update delivery with movements
DELETE /api/consegna/:id              - Delete delivery and recalculate affected balances (admin)
GET    /api/storico                   - All deliveries newest first, with trovato_in_cassa, num_movimenti, incassato, teatro (Storico index)
PUT    /api/participants/:id          - Set participant balance (stored as a rettifica, admin)
POST   /api/participants              - Create new participant
DELETE /api/participants/:id          - Delete participant (admin; 400 if the user has movimenti, rettifiche or quota teatro payments)
GET    /api/turni                     - Next 26 weeks (writes missing ones), pause list, `auto` (any authenticated user)
PUT    /api/turni/:id                 - Edit a week: turnisti, day, saltata, riunione, nota (any user; 400 on a past consegna)
POST   /api/turni/scambio             - {a: {id, slot}, userId}: userId takes slot a, a's person takes userId's first turno from today (any user, any slot)
POST   /api/turni/lascia              - {a: {id, slot}}: the slot becomes da coprire (any user)
POST   /api/turni/sposta              - {a: {id, slot}, to}: the person moves to a free slot of consegna `to` (any user)
PUT    /api/turni/auto                - {auto}: pause/resume automatic generation (admin)
PUT    /api/turni/note                - {note}: free-text notes shown above the turni, max 5000 chars (admin; GET returns `note`)
GET    /api/turni?passati=1           - Same, plus the last 91 days (`PAST_DAYS`, 3 months; any user)
GET    /api/teatro/utente/:id         - A person's quota teatro: per-semester {dovuto, pagato}, residuo, anticipo (any user)
GET    /api/teatro/consegna/:id       - Quotas paid in that consegna, shown next to its cassa (any user)
POST   /api/teatro/pagamenti          - {userId, importo, consegnaId}: record a payment in an open consegna, dated on it (any user; 400 without one)
GET    /api/teatro                    - Grid, semesters, payments, cassa log, balance (admin)
PUT    /api/teatro/dovuti             - {userId, semestre, dovuto}: owed amount, 0 = non dovuto, null = not in the GASS (admin)
PUT    /api/teatro/semestri/:s        - {quota}: semester quota; people on the old quota follow it (admin)
PUT    /api/teatro/nota               - {userId, nota} (admin); DELETE /api/teatro/pagamenti/:id (admin); POST /api/teatro/cassa {data, importo ±, descrizione} (admin)
POST   /api/turni/pause                - Add a pause (admin); DELETE /api/turni/pause/:id removes it
GET    /api/version                   - Get application version from package.json (public, no auth)
```

**User deletion:** `movimenti` and `rettifiche_saldo` reference `users` with `ON DELETE CASCADE`, so deleting a user with either would erase their history from past consegne; the route refuses it with 400. For any other user, every non-cascading reference to `users` (`activity_logs.target_user_id`/`actor_user_id`, the `*_by` audit columns) is set to NULL in the same transaction as the delete, so log rows stay. The rule lives in `server/services/users.js` (`deleteUser(db, id)`), shared by the route and `manage-users.js delete`. An admin can't delete their own account (400): the `user_deleted` log row would reference a deleted actor.

**User stato** (`users.stato`, replaced `attivo`): `attivo` (default), `sospeso` (shown as "no turni" in the UI: logs in, orders, listed in the consegna "Aggiungi partecipante" select, gets no turni and owes no new teatro semester; not greyed, sorted with attivi) or `disattivato` (the way to remove someone who has history: local login returns 403, OIDC redirects to `/login?error=user_disabled`, `requireAuth` also checks it so an open session ends on its next API call). Set by `PUT /api/users/:id` with `{ stato }` (logged as `user_edited` `stato: a → b`; an admin can't suspend or disable themselves) or `manage-users.js stato <username> <attivo|sospeso|disattivato>`. Leaving `attivo` empties the user's future turni (`freeFutureTurni`: they become "da coprire"); returning to `attivo` sets `turni_dal` to that day, so the turni wait restarts from it (setting `attivo` on an already-attivo user changes nothing). `GET /api/participants` returns everyone (with `stato`), so past consegne and saldi resolve; the pages hide disattivati: the consegna select lists only non-disattivati users (a disattivato user's saved movimento still opens from the day's list), the Saldi list hides them unless an admin ticks **Mostra disattivati** (desktop). The Saldi totals include everyone's saldi.

`GET /comefunziona` serves `public/comefunziona.html`, the first-access video (`public/video/gass-primo-accesso.mp4`); `GET /v2.17` serves `public/v2.17.html`, the turni video (`public/video/gass-turni.mp4`); `GET /admin-video` serves `public/admin-video.html`, the desktop admin video (`public/video/gass-admin.mp4`, not linked from other pages). All public, no auth. The one-page guide `/inbreve` was removed in 2.17.3.

### Frontend Structure

#### Desktop Views
- `consegna-desktop.html/js` (1159 lines) - Delivery entry form
- `debiti-desktop.html/js` (427 lines) - Balance overview with transactions modal
- `storico-desktop.html/js` - Storico index (one table row per consegna)

#### Mobile Views
- `consegna.html/js` (1223 lines) - Delivery entry form
- `debiti.html/js` (416 lines) - Balance overview with inline transaction history
- `storico.html/js` - Storico index (rows grouped by month)

#### Shared Components
- `calendar.js` - Month grid of the date fields (`initDateField`), header date (`setDateDisplay`)
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

#### Tables: quota teatro (v2.19)
```sql
teatro_semestri  (semestre TEXT PK, quota REAL)                 -- '2026-2' = July-December 2026
teatro_dovuti    (user_id FK CASCADE, semestre, dovuto REAL)     -- PK (user_id, semestre); 0 = non dovuto
teatro_pagamenti (id, user_id FK CASCADE, data, importo, consegna_id, fonte, created_by, created_at)  -- fonte 'foglio' = imported
teatro_cassa     (id, data, importo ±, descrizione, created_by, created_at)                         -- manual cassa entries
users.teatro_nota TEXT
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
| Saldo as of date D | `saldoAt()` | dated ≤ D |
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

// Lasciato in cassa (cash left); uscite = rows of uscite_cassa (cash taken out by hand, each with a motivo)
lasciato = trovato + incassato - pagato - SUM(uscite_cassa.importo);
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

**Generation is lazy.** Each `GET /api/turni` runs `ensureTurni`, which fills every missing non-pause Tuesday in `[nextTuesday(today), today + HORIZON_DAYS)` (`HORIZON_DAYS = 182`, 26 weeks). Weeks already written are never recomputed. While automatic generation is paused (`settings.turni_auto = '0'`, `isAuto`/`setAuto`, `PUT /api/turni/auto`), new weeks are written with both slots empty for an admin to fill; resuming affects only weeks not yet written. Adding a pause turns the weeks already written inside it into `saltata` and frees their people; deleting it lets the missing weeks regenerate on the next GET, while weeks already `saltata` stay so (restored from "Giorno").

**Pair rule** (`pickPair`): only `attivo` users; the first is the one waiting longest since their last turno (or `turni_dal`); the partner is, among the next `PARTNER_WINDOW = 3` in the queue, the one they have done fewest turni with, ties at random. A `saltata` week frees its pair, who are first in line again.

**Simulation** (10 years, 2026-10-01, k = 3): gaps between turni of 10-12 weeks with 22 people, 9-12 with 21; nearly all partners met; no pair more than 4 times. k = 3 was chosen over 4 and 5 for the more regular gaps.

**Import:** `manage-turni.js import <file.csv>`, lines `yyyy-mm-dd;username1;username2;nota` (blank lines, `#` comments and a `data` header are skipped; a nota containing "riunione" sets `riunione`). It replaces every week from the first imported date. `manage-turni.js list` prints the next 24 weeks.

Activity events: `turno_modificato`, `turno_scambio`, `pausa_aggiunta`, `pausa_eliminata`. `leaveTurno`/`moveTurno` log as `turno_modificato`. Pages: `turni.html` (mobile agenda; own turno: swap, move, leave) and `turni-desktop.html` (everyone picks every name from a menu and edits the day; pauses, auto and notes admin-only). Shared client logic: `public/js/shared/turni-common.js`.

## Quota teatro

Pure helpers in `server/services/teatro-calc.js` (`semestreOf`, `semestreLabel`, `allocate`); DB-backed in `server/services/teatro.js`.

**Allocation is derived, never stored.** A person's payments are summed and `allocate` spreads the total over their `teatro_dovuti` rows ordered by semester; what exceeds them is an advance (`anticipo`) that the next semester's row absorbs once it exists. Deleting a payment or changing a dovuto just changes the inputs.

**Semesters open lazily.** `ensureSemestre(today)` (on `GET /api/teatro*`, `POST /pagamenti`, `GET /api/participants`) creates the current semester once, with the previous semester's quota (15 € if none), and a dovuto row for every `attivo` user. After that the current semester follows stato changes (`syncDovutoCorrente`, called by `setStato`): becoming `attivo` adds the full quota if missing; leaving `attivo` deletes the row only if it is the full quota and nothing was paid on it (reduced / non dovuto set by hand and paid quotas stay). Past semesters never change.

**Cassa teatro** balance = payments without `fonte` + `teatro_cassa` entries. Payments imported from the old sheet (`manage-teatro.js import`, `fonte = 'foglio'`, dated at the semester's end) are history only. A payment is always recorded in an open consegna and takes its date; the client saves a new consegna (cassa only) before the first quota. `DELETE /api/consegna/:id` deletes that consegna's payments too (logged as `teatro_modifica`). A user with quota payments cannot be deleted (`deleteUser`).

**Import:** `manage-teatro.js import <file.csv>`, header `username;2024-1;2024-2;…;nota`; a number n = owed n and paid n (0 = non dovuto), `-` or empty = no row. Re-importing a person replaces their imported rows. `manage-teatro.js list` prints the grid.

Activity events: `teatro_pagamento`, `teatro_modifica`, `teatro_cassa`. Pages: the box in the consegna card (`consegna-common.js`), Saldi column/line (`teatroLabel` in `debiti-common.js`), `teatro-desktop.html` (admin).

## Features

### 1. Consegna (Delivery Entry)

#### Cash Fields (Cassa) - Readonly Architecture

Cash fields are **always readonly** - no manual override capability in mobile or desktop versions.

**Fields:**
- `trovato_in_cassa`: Cash found (from previous delivery's lasciato)
- `pagato_produttore`: Total paid to producer (sum of all conto_produttore values)
- `lasciato_in_cassa`: Cash left (trovato + incassato - pagato - uscite); uscite are rows of table `uscite_cassa` (`consegna_id` CASCADE, `importo` > 0, `motivo` required)

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
- `lasciato_in_cassa`: `trovato + incassato - pagato - Σ uscite_cassa.importo`
  - `incassato = Σ importo_saldato` from all movements
  - `POST /api/consegna` takes `uscite: [{importo, motivo}]` and replaces the consegna's rows (`server/services/uscite.js`); a payload without `uscite` keeps them. `GET /api/consegna/:date` returns `uscite`

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
- Always today's saldi; a person's history is in their transactions

#### Transaction History
- **Desktop**: "Transazioni" button on each row opens a modal with the full ledger (`GET /api/participants/:id/transactions`)
- **Mobile**: Expanding a participant card loads and shows transactions inline
- Manual edits appear as "Rettifica manuale" rows
- Any authenticated user can view any participant's transactions

### 3. Storico (Historical Records)

An index: one row per consegna, newest first (`GET /api/storico`). Mobile groups rows by month; desktop is one table with the whole cassa (trovato, incassato, pagato, in cassa) and the quota teatro total. A row opens the consegna on the Consegna page via `openConsegnaOn(date)` → `consegnaHref(date)` = `/consegna?data=yyyy-mm-dd`. The date is a real link to that URL (`storicoDateLink`, `.row-link`: keyboard, new tab; the `<tr>`/`<li>` onclick is only a pointer shortcut). No per-row actions since 2.24.1: reopening is done on the Consegna page; `storicoHint` writes the instruction above the list ("o riaprirla" for admins). Negative cassa amounts use `formatCassa` (typographic minus) and the `db` class.

### 4. Consegna page date

No date picker. `dataIniziale()` (`consegna-common.js`) takes `?data=` when it is a valid `yyyy-mm-dd`, else asks `GET /api/consegna/apertura` (`server/services/apertura.js`):

| Last turno ≤ today (`turni.data`, `saltata = 0`) | Opens |
|---|---|
| no consegna, or an open one | that day |
| consegna closed, or no turno | today |

`renderAvvisoAperte()` (called at the end of `checkDateData()`) lists every other open consegna in `#avviso-aperte` as one sentence, each date a link (`consegnaHref`). No date is kept in `sessionStorage`: the Consegna menu link always applies the rule, Saldi is always today.

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
- `TELEGRAM_*`, `SMTP_*`, `REPORT_EMAIL_*` — consegna report on close, see [Consegna report](#consegna-report)

### Consegna report

Closing a consegna can send a report to a Telegram group/channel and by email (`server/services/report.js`), laid out like the turno report emails: turnisti, trovato, pagato al produttore, debiti saldati/lasciati, crediti lasciati/usati, quota teatro, lasciato in cassa and the link to the consegna (built from the request host). Each channel is on only when its variables are set:

| Channel | Required | Optional |
|---|---|---|
| Telegram | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | `TELEGRAM_THREAD_ID` (topic of a forum group; without it the report goes to General) |
| Email | `SMTP_HOST`, `REPORT_EMAIL_TO` | `SMTP_PORT` (default 587, 465 = implicit TLS), `SMTP_USER`, `SMTP_PASS`, `REPORT_EMAIL_FROM` (default `SMTP_USER`) |

`GET /api/consegna/report-canali` lists the active channels; the close confirmation shows one checkbox per channel (ticked) and `POST /api/consegna/:id/close` sends only the ones in its `report` array. The text sent is stored per channel (`consegne.report_telegram`, `report_email`): closing again after a reopen sends a new report titled "(corretto)" only if the text changed. Sends run after the response; an error is only logged (`<canale> report for consegna … failed`) and retried at the next close.

Telegram setup: create the bot with @BotFather, add it to the group (or as admin to the channel), and take the chat id from `https://api.telegram.org/bot<token>/getUpdates` after posting a message there (a public channel also takes `@channelname`). In a group the bot must be addressed (`/start@<bot>`) while its privacy mode is on, or the message never reaches it; for a topic, `message_thread_id` of that update is `TELEGRAM_THREAD_ID`. For a mailing list, the sender address must be allowed to post, or the message waits for moderation.

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
docker buildx build --platform linux/amd64,linux/arm64 -t jeremyjrossi/gass:<version> -t jeremyjrossi/gass:latest --push .
```

Database persisted in `/app/data/gass.db` volume.

The images on Docker Hub are public. The build context is the whole working copy, so `.dockerignore` must exclude every local folder that is not app code (members' data, videos, handoff notes). Before a build, check `git status --short` for new untracked paths and add them to `.dockerignore`; after it, check the image with `docker run --rm --entrypoint ls jeremyjrossi/gass:<version> /app`. On 2026-10-03 `storico-consegne-cassa/` was found in the public images 2.24.0–2.24.2 (verified via `ls /app` in the pulled images 2026-10-03); it is excluded since 16b55a2 and those tags were deleted from Docker Hub.

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
