## Project Instructions

- Always develop features and bug fixes for **both mobile AND desktop** versions
- Always allow chrome-devtools MCP server commands

---

## Codebase Architecture

### Server-Side (MVC Pattern)
- **Entry Point**: `server.js` - minimal bootstrap, loads routes
- **Database**: `server/config/database.js`
- **Routes**: `server/routes/`
  - `pages.js` - HTML routing with mobile/desktop detection
  - `auth.js` - Authentication endpoints
  - `consegna.js` - Delivery API (GET/:date, POST, DELETE/:id)
  - `participants.js` - Participant API (CRUD)
  - `storico.js` - History API
  - `logs.js` - Activity log API (admin-only)
- **Services**: `server/services/calculations.js` - Business logic
- **Middleware**: `server/middleware/` - auth.js, userAgent.js

### Client-Side
- **Shared**: `public/js/shared/`
  - `api-client.js` - **Always use `API.*` methods for server calls**
  - `utils.js` - formatNumber, formatDateItalian, parseAmount, showStatus
  - `calendar.js` - Date picker (mobile)
  - `auth.js` - Session/logout handling
  - `version.js` - Dynamic version footer
- **Page-Specific**: `public/js/`
  - Mobile: `consegna.js`, `debiti.js`, `storico.js`
  - Desktop: `consegna-desktop.js`, `debiti-desktop.js`, `storico-desktop.js`, `logs-desktop.js`

### HTML Script Loading Order
```html
<script src="js/shared/utils.js"></script>
<script src="js/shared/calendar.js"></script>    <!-- mobile only -->
<script src="js/shared/api-client.js"></script>
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
