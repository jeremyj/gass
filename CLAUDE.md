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
  - `pages.js` - HTML routing with mobile/desktop detection
  - `auth.js` - Authentication endpoints (login, logout, password change)
  - `consegna.js` - Delivery API (GET/:date, POST, DELETE/:id)
  - `participants.js` - Participant API (CRUD, saldo management)
  - `users.js` - User management API (admin-only, edit profile/password/admin status)
  - `storico.js` - History API
  - `logs.js` - Activity log API (admin-only)
- **Services**: `server/services/calculations.js` - Business logic
- **Middleware**: `server/middleware/` - auth.js, userAgent.js

### Client-Side
- **Shared**: `public/js/shared/`
  - `api-client.js` - **Always use `API.*` methods for server calls**
  - `utils.js` - formatNumber, formatDateItalian, parseAmount, showStatus
  - `calendar.js` - Date picker (mobile + desktop)
  - `consegna-common.js` - Shared consegna business logic (mobile + desktop)
  - `debiti-common.js` - Shared debiti loading and helpers (mobile + desktop)
  - `auth.js` - Session/logout handling
  - `version.js` - Dynamic version footer
- **Page-Specific**: `public/js/`
  - Mobile: `consegna.js`, `debiti.js`, `storico.js`
  - Desktop: `consegna-desktop.js`, `debiti-desktop.js`, `storico-desktop.js`, `logs-desktop.js`

### HTML Script Loading Order
```html
<script src="js/shared/utils.js"></script>
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

### User/Participant Model (v2.0)
Every user is a participant with a saldo. The `partecipanti` table was merged into `users`:
- `display_name` = participant name shown in UI
- `saldo` = current credit/debt balance
- `ultima_modifica` = last balance change date
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
- Default user: admin/admin (first run only, auto-set as admin)

### Admin Role System
- `is_admin` column in users table (first user auto-promoted)
- `isAdmin()` helper in `auth.js` for frontend checks
- `req.session.isAdmin` for backend checks
- Manage users: `node manage-users.js admin <username> <on|off>`

### User Management
- **Self password change**: All users can change their own password via 🔑 button in header
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

### Historical Saldo Calculation
Query all movements **before** target date, sum effects:
- `credito_lasciato` adds, `debito_lasciato` subtracts
- `usa_credito` subtracts, `debito_saldato` adds

### Credit/Debt Auto-Compensation
All compensation fields are disabled (system-managed):
```
diff = importo_saldato - conto_produttore
if diff > 0 && has_debt: auto-apply to debito_saldato
if diff < 0 && has_credit: auto-apply to usa_credito
```

### Conditional Section Rendering
- `saldo > 0`: Show CREDITO section, hidden fields for DEBITO
- `saldo < 0`: Show DEBITO section, hidden fields for CREDITO
- `saldo = 0`: Hidden fields for both

---

## UI Patterns

### Mobile
- Each participant form has embedded Save/Close buttons
- Cassa accordion open by default
- Calendar opens to current month

### Desktop
- Inline form buttons (Salva Movimento / Annulla)
- Table column order: Conto Produttore, Importo Saldato, Lascia Credito, Lascia Debito, Usa Credito, Salda Debito

### Date Selection
- Date persisted in `sessionStorage` (`gass_selected_date`)
- Page reload → today's date
- Tab navigation → preserved date
- Uses `performance.getEntriesByType('navigation')` to detect reload vs navigation

### Visibility Sync
`syncDebitoCreditoVisibility(id)` in `consegna-common.js` syncs both debito and credito control visibility. Always call this instead of `syncDebitoVisibility` alone. Rules:
- No importo → hide all debito/credito controls
- Importo present but nothing being paid → hide controls
- Mutual exclusivity: checkbox hidden when partial field has value (and vice versa)

### CSS .initially-hidden pattern
`.initially-hidden { display: none }` (no `!important`) — JS `element.style.display = 'block/flex'` must be able to override it. Use CSS specificity for modals (`.modal.initially-hidden` 0-2-0 beats `.modal` 0-1-0) rather than `!important`, since `!important` would also block inline style overrides.

### Consegna Locking
- "Chiudi Consegna" button in Cassa section (any user can close)
- "Riapri Consegna" button visible only to admins
- When closed: all inputs disabled, movimenti section hidden (mobile)
- Admin must reopen to edit a closed consegna

### Admin-Only Features
- Edit saldi (debiti page, only for today's date - historical saldi are read-only)
- Reopen closed consegne
- Add participants (desktop) - creates a full user account with username/password
- Activity logs page (desktop only)

### Currency Display
`formatNumber()` hides `.00` on whole numbers, shows 2 decimals otherwise

---

## Activity Logging

### Event Types (activity_logs table)
- `movimento_changed` - Manual field changes (conto_produttore, importo_saldato only)
- `saldo_updated` - Direct saldo modifications by admin
- `user_created`, `user_edited`, `user_deleted` - User management events
- `password_changed` - Password resets

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
npm test                    # all 162 tests
npm run test:unit           # pure function tests (no DB/HTTP)
npm run test:integration    # API tests with in-memory SQLite
npm run test:coverage       # with coverage report
```

### Architecture
- `test/helpers/setup-test-db.js` — creates in-memory DB, patches `require.cache` for DB isolation
- `test/helpers/setup-app.js` — creates supertest agent wrapping `createApp()`
- `test/helpers/seed.js` — `createUser`, `createConsegna`, `createMovimento`, `loginAs`, `clearConsegne`, `clearNonAdminUsers`
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