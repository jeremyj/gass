- 'close task' means update technical documentation with user facing information, update CLAUDE.md with any useful AI insights, commit changes with meaningfful semantic messages

## Technical Notes

### Password Management (November 2025)
- **Tool**: `update-admin-password.js` - Utility script for updating admin user password
- **Implementation**:
  - Uses bcrypt with 12 rounds for password hashing (consistent with database.js)
  - Connects directly to SQLite database using same path detection logic as main application
  - Updates `password_hash` field in `users` table for admin user
- **Security**:
  - Script excluded from git via `.gitignore` (contains plain-text passwords during execution)
  - Script excluded from Docker builds via `.dockerignore`
  - Database password hashes stored securely using bcrypt
- **Usage**: `node update-admin-password.js` (modify password constant in script before running)
- **Location**: Project root (not in version control or Docker images)

### Historical Saldo Calculation Fix (November 2025)
- **Issue**: When editing past consegne, participant saldo displayed was incorrect - showed sum of historical saldo + all future movements
- **Root Cause**: Backend (`server/routes/consegna.js` GET /:date) calculated `saldoBefore` by taking current saldo from `partecipanti` table and reversing current consegna effects - didn't account for movements after the selected date
- **Solution**: Completely replaced calculation logic to rebuild historical saldo by querying all movements **before** the target date and summing their effects chronologically
- **Implementation Details**:
  - Query: `SELECT m.* FROM movimenti m JOIN consegne c ON m.consegna_id = c.id WHERE m.partecipante_id = ? AND c.data < ? ORDER BY c.data ASC`
  - Sum effects: `credito_lasciato` adds to saldo, `debito_lasciato` subtracts, `usa_credito` subtracts, `debito_saldato` adds
  - Result: Accurate point-in-time saldo for any historical date
- **Code Change**: Lines 48-71 in `server/routes/consegna.js` (reduced from 38 lines to 24 lines of simpler logic)
- **Impact**: Both mobile and desktop versions fixed (shared backend endpoint)
- **Testing**: Verified with real data - Fernanda Fischione 11/11 correctly shows 2€ instead of 9.5€ (previous bug: 2€ historical + 7.5€ from 18/11)
- **Commit**: 0cee7b2

### Codebase Architecture (v1.3 Reorganization - November 2025)

**Server-Side Structure (MVC Pattern)**
- **Entry Point**: `server.js` (30 lines) - minimal bootstrap, loads routes and starts server
- **Database**: `server/config/database.js` - moved from project root
  - Path detection uses `path.join(__dirname, '../..')` to reach project root from nested location
  - Requiring: Use `require('../config/database')` from routes/services, or `require('./server/config/database')` from server.js
- **Routes**: `server/routes/` - Express route handlers separated by domain
  - `pages.js` - HTML page routing with mobile/desktop detection, auth protection
  - `auth.js` - Authentication endpoints (login, logout, session check)
  - `consegna.js` - Delivery API endpoints (GET/:date, POST, DELETE/:id) - protected
  - `participants.js` - Participant API endpoints (GET, POST, PUT/:id, DELETE/:id) - protected
  - `storico.js` - History API endpoints (GET, GET/dettaglio) - protected
- **Services**: `server/services/calculations.js` - Business logic layer
  - Cassa calculations: `calculateTrovatoInCassa()`, `calculateLasciatoInCassa()`
  - Saldo calculations: `applySaldoChanges()`, `processConsegneWithDynamicValues()`
  - Utility: `roundToCents()`
- **Middleware**: `server/middleware/userAgent.js` - Device detection for mobile/desktop routing
  - `auth.js` - Authentication middleware (`requireAuth`, `attachUser`)

**Client-Side Structure**
- **Base**: All JavaScript files in `public/js/` (not `public/` root)
- **Shared Modules**: `public/js/shared/` - Reusable code across all pages
  - **`api-client.js`** (NEW) - **ALWAYS use for server communication**
    - Methods: `API.getConsegna(date)`, `API.saveConsegna(data)`, `API.getParticipants(date?)`, `API.getStorico()`, etc.
    - Provides consistent error handling and standardized request/response format
    - Pattern: Use `API.*` methods instead of direct `fetch()` calls
  - `utils.js` - Formatting (`formatNumber`, `formatDateItalian`), validation (`parseAmount`, `normalizeInputField`), UI (`showStatus`)
  - `calendar.js` - Date picker and calendar functionality (mobile pages only)
  - `auth.js` - Session checking and logout handler for all pages
- **Page-Specific**: `public/js/` root - One file per page variant
  - Mobile: `consegna.js`, `debiti.js`, `storico.js`
  - Desktop: `consegna-desktop.js`, `debiti-desktop.js`, `storico-desktop.js`
- **Components**: `public/js/components/` - Reserved for future UI component extraction (currently empty)

**HTML Script Loading Order** (CRITICAL)
```html
<script src="js/shared/utils.js"></script>          <!-- Load utilities first -->
<script src="js/shared/calendar.js"></script>       <!-- Calendar (mobile only) -->
<script src="js/shared/api-client.js"></script>     <!-- API client -->
<script src="js/[page-name].js"></script>           <!-- Page-specific code last -->
```

**Development Conventions**
- **Adding Business Logic**: Place in `server/services/` (NOT in routes) - keeps routes thin
- **Adding API Routes**: Create in `server/routes/`, import and mount in `server.js`
- **Adding Shared Client Code**: Place in `public/js/shared/` if used by multiple pages
- **Adding UI Components**: Extract to `public/js/components/` when reused across pages
- **Path Imports**: Always use relative paths from current file location
  - From routes: `require('../config/database')`, `require('../services/calculations')`
  - From server.js: `require('./server/config/database')`, `require('./server/routes/pages')`

**Static File Serving**
- Express serves `public/` as static root
- Browser path `/js/file.js` maps to filesystem `public/js/file.js`
- No `/public/` prefix needed in HTML `<script src>` attributes

### Authentication System (Phase 1 - Implemented)
- **Architecture**: Session-based authentication using express-session with SQLite storage
- **Password Security**: bcrypt hashing with 12 rounds (salt auto-generated)
- **Session Storage**: connect-sqlite3 stores sessions in database `sessions` table
- **Cookie Configuration**:
  - Max age: 7 days (7 * 24 * 60 * 60 * 1000 ms)
  - httpOnly: true (prevents XSS access)
  - secure: true in production (HTTPS only)
  - Secret: Environment variable SESSION_SECRET (fallback: 'gass-secret-change-in-production')
- **Database Schema**:
  - `users` table: id, username (unique), password_hash, display_name, created_at
  - Audit columns added to `consegne` and `movimenti`: user_id, updated_by
  - Default user: username=admin, password=admin (created on first run if no users exist)
- **Middleware**:
  - `requireAuth`: Protects routes, returns 401 if not authenticated
  - `attachUser`: Attaches user info to req.user for authenticated requests
  - `requireAuthForPages`: Redirects unauthenticated users to /login for page routes
  - `getAuditFields(req, operation)`: Helper function to generate audit fields for database operations (v1.4+)
- **API Endpoints**:
  - POST /api/auth/login - Authenticates user, creates session
  - POST /api/auth/logout - Destroys session
  - GET /api/auth/session - Checks authentication status, returns user info
- **Client-Side**:
  - `public/js/shared/auth.js`: checkSession(), handleLogout() functions
  - `public/js/shared/api-client.js`: Automatic redirect to /login on 401 responses
  - `public/login.html`: Login page with username/password form
  - All pages show username and logout button in header (mobile) or nav (desktop)
- **User Tracking**: All consegna and movimenti saves record user_id and updated_by
- **Protected Routes**: All API endpoints and page routes except /login and /api/auth/*
- **Files**:
  - Backend: `server/config/database.js`, `server/middleware/auth.js`, `server/routes/auth.js`, `server.js`
  - Frontend: `public/login.html`, `public/js/login.js`, `public/js/shared/auth.js`
  - Modified: All 6 HTML pages, all route files for protection and user tracking

### Audit Tracking System (v1.4 - Implemented November 2025)
- **Purpose**: Track who created/modified every database record and when
- **Architecture**: Standardized audit columns across all tables with helper function for consistent implementation
- **Database Schema**:
  - **users** table: `created_by`, `created_at`, `updated_by`, `updated_at`
  - **partecipanti** table: `created_by`, `created_at`, `updated_by`, `updated_at`
  - **consegne** table: `created_by`, `created_at`, `updated_by`, `updated_at` (migrated from `user_id`)
  - **movimenti** table: `created_by`, `created_at`, `updated_by`, `updated_at` (migrated from `user_id`)
  - All audit columns are nullable INTEGER/DATETIME (NULL for system operations or pre-migration data)
- **Performance**:
  - Indexes created on all audit columns for efficient reporting queries
  - `idx_consegne_created_by`, `idx_consegne_updated_by`, `idx_movimenti_created_by`, `idx_movimenti_updated_by`, `idx_partecipanti_updated_by`
- **Migration Strategy**:
  - v1.3 → v1.4: Automatic migration on startup via `database.js`
  - Existing `user_id` values copied to new `created_by` columns (consegne: 2 records, movimenti: 8 records)
  - Legacy `user_id` columns kept for backward compatibility, new code uses `created_by`
  - All new records get complete audit tracking, existing records have partial data (acceptable)
- **Implementation**:
  - **Helper Function** (`server/middleware/auth.js:getAuditFields()`):
    - `getAuditFields(req, 'create')` → `{created_by, created_at, updated_by, updated_at}`
    - `getAuditFields(req, 'update')` → `{updated_by, updated_at}`
    - Extracts user ID from session, generates ISO timestamp
  - **Updated Routes**:
    - `server/routes/consegna.js`: 11 INSERT/UPDATE operations updated
    - `server/routes/participants.js`: 2 INSERT/UPDATE operations updated
  - **Pattern**: All database writes now include audit fields via spread operator
    ```javascript
    const audit = getAuditFields(req, 'create');
    db.prepare('INSERT INTO table (..., created_by, created_at, updated_by, updated_at) VALUES (..., ?, ?, ?, ?)')
      .run(...data, audit.created_by, audit.created_at, audit.updated_by, audit.updated_at);
    ```
- **Benefits**:
  - Complete audit trail for compliance and debugging
  - Consistent implementation across all database operations
  - Supports future user management and reporting features
  - No breaking changes to existing functionality
- **Tag**: Pre-migration state tagged as `v1.4` (2025-11-23)

### Mobile Responsive Layout Fixes
- **Problem #1 - Header Layout Broken**:
  - Issue: `.page-header` had horizontal flex causing elements to overlap on one line
  - Solution: Changed to vertical flex (`flex-direction: column`) with `gap: 10px`
  - Impact: Header now properly displays title/user controls on first line, date section on second line
- **Problem #2 - Horizontal Scrolling on Small Screens**:
  - Issue: Excessive padding (container 15px + header 25px = 80px total) caused overflow
  - Solutions:
    - Reduced `.container` padding from 15px to 10px
    - Reduced `.page-header` padding from "15px 25px" to "15px" uniformly
    - Added `overflow-x: hidden` and `width: 100%` to body element
  - Impact: No horizontal scrolling on any viewport width, including 412px mobile screens
- **CSS Changes** (`public/style.css`):
  - Line 11-12: Added `overflow-x: hidden; width: 100%;` to body
  - Line 54: Changed `.container` padding to 10px
  - Line 61: Changed `.page-header` padding to 15px (was 15px 25px)
  - Line 65-66: Added `flex-direction: column; gap: 10px;` to `.page-header`
- **Testing Verified**:
  - No horizontal scroll on desktop (1920px) or mobile (412px) viewports
  - User controls properly positioned and responsive across all pages
  - Desktop version unaffected (uses different CSS)
- **Pages Fixed**: All 3 mobile HTML pages (consegna, debiti, storico)

### Database Storage Architecture
- **Database Engine**: SQLite3 via `better-sqlite3` npm package
- **File Location**:
  - **Docker**: `/app/data/gass.db` (bind-mounted to host `./data/`)
  - **Local Dev**: `./gass.db` (project root)
- **Path Detection**: `database.js` automatically detects environment
  - Checks if `/app/data` exists → uses Docker path
  - Otherwise → uses local development path (`__dirname`)
- **Docker Configuration**:
  - `docker-compose.yml`: Bind mount `./data:/app/data`
  - `Dockerfile`: Creates `/app/data` with correct ownership (gass:gass user)
  - Database persists on host filesystem for easy backup and portability
- **Startup Logging**: Logs database path on initialization for verification
- **Gitignore**: `/data/` directory excluded, only `.gitkeep` tracked for structure

### Cassa Field Architecture (Current Implementation)
- **Design Decision**: Cassa fields (trovato, pagato, lasciato) are **readonly calculated values only**
- **No Manual Override**: Previous SmartInputManager-based override system has been completely removed from both mobile and desktop
- **Calculation Logic**:
  - `trovato_in_cassa`: Populated from previous consegna's `lasciato_in_cassa` value
  - `pagato_produttore`: Auto-calculated sum from all movement records for the day (`Σ conto_produttore`)
  - `lasciato_in_cassa`: Auto-calculated as `trovato + incassato - pagato`
- **Implementation Files**:
  - **Mobile**: `public/js/consegna.js`, `public/consegna.html`
    - Functions: `calculatePagatoProduttore()`, `calculateLasciatoInCassa()`, `updatePagatoProduttore()`, `updateLasciatoInCassa()`
    - All cassa input fields have `readonly` attribute with disabled styling
  - **Desktop**: `public/js/consegna-desktop.js`, `public/consegna-desktop.html`
    - Same calculation functions as mobile
    - Inline styles: `readonly`, `cursor: not-allowed`, `background: #f0f0f0`
    - No AUTO badges, no click hints, no SmartInputManager dependency
    - Removed smart-input.js script reference (commit b1c6aa6)
- **Display Formatting**: Uses `formatNumber()` to hide unnecessary `.00` decimals on whole numbers
- **New Consegna Initialization**:
  - `trovato` = previous `lasciato` value (or 0 if first consegna)
  - `pagato` = 0
  - `lasciato` = `trovato` (no movements yet)
  - `existingConsegnaMovimenti = []` (empty array, not null)
- **Database**: Always saves with `discrepanza_cassa=0`, `discrepanza_trovata=0`, `discrepanza_pagato=0`
- **Rationale**: Simplifies UX and ensures data integrity by preventing manual adjustments that could cause calculation mismatches. Consistent behavior across mobile and desktop platforms.

### Date Persistence Implementation
- **Challenge**: Selected date was resetting to default when switching between mobile tabs (Consegna/Saldi/Storico)
- **Solution**: Implemented localStorage-based persistence using key `gass_selected_date`
- **Implementation Details**:
  - `public/js/shared/calendar.js`: Added `restoreDateFromStorage()` function and localStorage writes in `selectPickerDate()` and `setDateDisplay()`
  - `public/js/debiti.js`: Modified initialization to call `restoreDateFromStorage()` instead of defaulting to today
  - `public/js/consegna.js`: Modified initialization to prioritize localStorage over default "last consegna" date
  - All three pages now maintain consistent date context across navigation
- **Benefits**: Improved UX in mobile view where tab switching is primary navigation method
- **Empty Database Handling**: When database is empty, system ignores localStorage and defaults to today's date to prevent stale date selection (consegna.js:917-941)

### Currency Formatting Strategy
- **Design**: `formatNumber()` utility function hides unnecessary `.00` decimals while preserving actual decimal values
- **Logic**: Uses modulo operation (`num % 1 === 0`) to detect whole numbers
  - Whole numbers: Display without decimals (e.g., "42" not "42.00")
  - Decimal values: Display with 2 decimal places (e.g., "42.50")
- **Implementation**: `public/utils.js:67-73`
- **Coverage**: Applied consistently across all views (consegna, storico, debiti) in both mobile and desktop layouts
- **Implementation**: `public/js/shared/utils.js:formatNumber()`
- **Rationale**: Cleaner UI presentation, reduces visual noise while maintaining precision where needed

### Mobile UI Button Architecture (Consegna Page)
- **Pattern**: Each participant form contains its own action buttons (Save/Close) embedded within the form
- **Location**: Buttons rendered at bottom of participant form in `buildParticipantForm()` function
- **Global Buttons**: Avoid adding global action buttons outside participant forms - leads to duplicate/confusing UI
- **Key Finding**: Previous implementation had redundant global "Salva Movimenti" button controlled by `updateSaveButtonVisibility()` - removed in commit c0915c5

### Conto Produttore Field Implementation
- **Purpose**: "Conto Produttore" is the total amount owed to the producer for goods received, independent of payment
- **Database**: Added `conto_produttore` column to `movimenti` table (database.js:83-91)
- **Persistence**: Field value is now saved and restored when switching tabs or reloading data
- **Auto-calculation**: System auto-fills "Lascia credito" or "Lascia debito" based on formula:
  ```
  diff = importo_saldato + usa_credito - debito_saldato - conto_produttore
  if diff > 0: credito_lasciato = diff
  if diff < 0: debito_lasciato = abs(diff)
  ```
- **Pagato Produttore Calculation**: Changed from complex formula to simple sum of all `conto_produttore` values
  - Old formula: `importo_saldato + usa_credito + debito_lasciato - credito_lasciato - debito_saldato`
  - New formula: `Σ conto_produttore` for all movements
  - Files updated: `public/consegna.js:31-40`, `public/consegna-desktop.js:754-763`, `server.js:348-357`
- **Key Bug Fix #1**: Removed call to `handleCreditoDebitoInput()` at end of `handleContoProduttoreInput()` which was disabling auto-filled fields
  - Issue: Field disable logic conflicted with auto-fill, preventing credito/debito from being populated
  - Solution: Auto-fill logic already handles field states correctly, extra validation call was causing conflicts
  - Files: `consegna.js:653-655`, `consegna-desktop.js:935-937`
- **Key Bug Fix #2**: Checkbox toggles not triggering auto-calculation (commit 394ff77)
  - Issue: `toggleUsaInteroCredito()` and `toggleSaldaDebito()` set field values programmatically but didn't trigger `handleContoProduttoreInput()`
  - Effect: Programmatic value changes don't fire `oninput` events, so auto-calculation never ran with new values
  - Symptom: "Lascia debito/credito" fields showed stale/incorrect values when using checkboxes
  - Solution: Added explicit call to `handleContoProduttoreInput()` before `handleCreditoDebitoInput()` in both toggle functions
  - Files: `consegna.js:473-490,503-525`, `consegna-desktop.js:692-709,711-733`
- **Key Enhancement #1**: Credit/Debt Fields Always Disabled
  - **Design Decision**: "Lascia credito" and "Lascia debito" fields are now **always disabled** as they are calculated values only
  - **Implementation**:
    - Added `disabled` attribute to form HTML templates: `consegna.js:382,388`, `consegna-desktop.js:611,617`
    - Modified `handleContoProduttoreInput()` to always set `disabled=true` when populating fields: `consegna.js:618-649`, `consegna-desktop.js:906-937`
    - Simplified `handleCreditoDebitoInput()` to enforce disabled state and only manage `debitoSaldato` field: `consegna.js:527-560`, `consegna-desktop.js:817-843`
  - **Rationale**: These fields are derived values from the formula, never user input. Disabling prevents confusion and ensures data integrity.
- **Key Enhancement #2**: Bidirectional Automatic Credit/Debt Compensation
  - **Problem**: System didn't automatically offset credits and debts in either direction
  - **Solution**: Implemented bidirectional auto-compensation that works in both scenarios:

  **Case 1: Creating credit while participant has existing debt**
  - **Example**: Participant has 7€ debt, conto_produttore=15€, importo_saldato=22€
    - Old: Shows "Lascia credito = 7€" (incorrect)
    - New: Auto-checks "Salda intero debito", populates "Debito saldato = 7€", shows "in pari"
  - **Logic**:
    - If credit >= debt: Auto-checks "Salda intero debito", uses credit to fully pay debt
    - If credit < debt: Populates partial debt payment with available credit

  **Case 2: Creating debt while participant has existing credit**
  - **Example**: Participant has 10€ credit, conto_produttore=18€, importo_saldato=5€
    - Calculation: 5 - 18 = -13€ (would create 13€ debt)
    - Old: Shows "Lascia debito = 13€" (incorrect - ignores existing credit)
    - New: Auto-checks "Usa intero credito", populates "Usa credito = 10€", shows "Lascia debito = 3€"
  - **Logic**:
    - If credit >= new debt: Auto-checks "Usa intero credito", fully offsets debt
    - If credit < new debt: Populates partial credit usage, reduces debt amount

  - **Trigger Conditions**:
    1. Requires only `conto_produttore > 0` to trigger auto-compensation
       - **Why**: Allows compensation even when `importo_saldato = 0` (e.g., using existing credit to offset goods received with no cash payment)
       - **Examples**:
         - Credit=20€, Conto=15€, Importo=0€ → Auto-uses 15€ credit, leaves 5€ credit
         - Debt=10€, Conto=15€, Importo=0€ → Creates 15€ debt (no compensation without payment)
    2. Checkboxes checked/fields disabled only when using/paying ALL available amount
       - "Usa intero credito": checked when creditoUsato === creditoPreesistente
       - "Salda intero debito": checked when debitoSaldato === debitoPreesistente

  - **Compensation Fields Architecture** (Refactored):
    - **Design Decision**: Compensation fields (`usa_credito`, `debito_saldato`) are **always disabled** - system-managed only, never user-modifiable
    - **Simplified Logic**: Removed all manual/auto tracking complexity (`dataset.autoPopulated`, `isManuallySet`, etc.)
    - **Clean Diff Calculation**: Simplified from complex formula to just `importoSaldato - contoProduttore`
      - Old: `importoSaldato + usaCreditoForCalc - debitoSaldatoForCalc - contoProduttore` (with manual tracking)
      - New: `importoSaldato - contoProduttore` (compensation values calculated after, not included in diff)
    - **Implementation**:
      - Added `disabled` attribute to HTML templates: `consegna.js:425,445`, `consegna-desktop.js:649,669`
      - Simplified `handleCreditoDebitoInput()`: Now only enforces disabled state on all 4 fields
      - Simplified `handleContoProduttoreInput()`: Removed all tracking logic, always recalculates compensation
      - Database load: Simply sets `.disabled = true`, no flag tracking needed
    - **Code Reduction**: Removed 114 lines of complex tracking code, added 36 lines of simple enforcement
    - **Benefits**:
      - Clearer UX: users see fields are system-calculated
      - Simpler code: no complex state tracking
      - Prevents errors: impossible to create inconsistent states
      - Always recalculates: compensation always reflects current transaction values

  - **Files**: `consegna.js:309,331,425,445,538-544,596-638`, `consegna-desktop.js:531,649,669,821-827,836-878`
  - **Rationale**: Compensation should be fully automatic and transparent, with no manual override capability to ensure data integrity

  - **Key Bug Fix #3**: Compensation fields not appearing when saldoBefore=0 (commit 044e960)
    - **Root Cause**: Compensation sections (buildCreditoSection/buildDebitoSection) were conditionally rendered based on `haCredito` and `haDebito` flags
    - **Problem**: When participant's `saldoBefore` was 0 (started day with zero balance), both flags were false, causing hidden fields to be added instead of visible disabled inputs
    - **Symptom**: Compensation fields completely missing from UI, preventing users from seeing automatic compensation calculations
    - **Investigation**: API correctly calculates `saldoBefore` by reversing current day's movements from DB saldo
      - Example: Giovanni DB saldo = -20, movement has debito_lasciato=20, so saldoBefore = -20 + 20 = 0 ✓
      - All participants started today at 0 balance, current saldi (-20, 10, 20, -10) are results of today's movements
    - **Solution**:
      - Removed conditional rendering: Always call `buildCreditoSection()` and `buildDebitoSection()`
      - Removed `addHiddenFields()` calls from both mobile and desktop versions
      - Fields now always appear in form (disabled) regardless of participant's starting balance
    - **Files**: `consegna.js:375-376,274`, `consegna-desktop.js:606-608,518`
    - **Benefit**: Users can now always see compensation calculations updating in real-time as they enter transaction values

### Note Field Save Button Implementation
- **Problem**: Users couldn't save notes without also saving participant data
- **Solution**: Added dedicated save button that appears when noteGiornata field is edited
- **Implementation**:
  - **Mobile**: New "Salva Note" button in DATI GIORNATA section, hidden by default
  - **Desktop**: Reuses existing save-btn-cassa button, shows when note modified
  - Track original note value (`originalNoteGiornata`) for change detection
  - `oninput` listener on noteGiornata field triggers visibility update
  - Button hidden when note matches original or after successful save
- **Files**: `consegna.html:78,82-84`, `consegna.js:11-12,149-151,173-176,187-253`, `consegna-desktop.html:49`, `consegna-desktop.js:6-7,322-324,347-350,1042-1046,1056-1065`
- **Benefit**: Users can save daily notes independently of participant transactions

### Conditional Rendering of Credit/Debt Sections (Current Implementation)
- **Problem**: Commit 044e960 made both CREDITO and DEBITO sections always visible, creating UI clutter
- **Solution**: Restored conditional rendering while preserving fix for saldoBefore=0 case
- **Logic**:
  - `saldo > 0`: Show CREDITO section only, add hidden fields for DEBITO
  - `saldo < 0`: Show DEBITO section only, add hidden fields for CREDITO
  - `saldo = 0`: Hide both sections, add hidden fields for both
- **Implementation**:
  - Template uses ternary operators: `${haCredito ? buildCreditoSection(...) : ''}`
  - Restored `addHiddenFields(card, nome, haCredito, haDebito)` calls in `renderParticipant()`
  - Function `addHiddenFields()` creates hidden inputs for non-visible compensation fields
- **Files**: `consegna.js:273-274,373-374`, `consegna-desktop.js:518,604-606`
- **Benefit**: Cleaner UI showing only relevant sections while maintaining form data integrity

### Calendar Component UX Improvements
- **Always Open to Current Month**: Calendar (both mobile date picker and desktop modal) now resets to today's month when opened
  - **Mobile**: `toggleDatePicker()` resets `pickerYear` and `pickerMonth` to current date
  - **Desktop**: `showCalendarModal()` resets `currentCalendarYear` and `currentCalendarMonth` to current date
  - **Rationale**: Most common use case is selecting today or nearby dates, navigating from last-viewed month was confusing
- **Simplified Legend**: Removed "Senza consegna" legend item
  - Only shows "Con consegna" indicator (green background)
  - Dates without deliveries appear in standard white background
  - **Rationale**: Redundant legend item added visual noise without providing useful information
- **Dynamic Participant Data on Date Change**: When changing date with a participant form open, system automatically reloads participant's data for new date
  - **Implementation**: `checkDateData()` remembers current participant selection, reloads consegna data, then re-renders same participant
  - **Behavior**: Preserves participant selection across date changes, updates all transaction fields, balances, and movements to reflect new date
  - **Files**: `public/js/consegna.js:115-160`
  - **Benefit**: Users can quickly compare same participant's transactions across different dates without closing/reopening form

### Code Cleanup (2025-11-22)
- **Removed Unused Files**:
  - `public/smart-input.js` (409 lines) - SmartInputManager system completely removed per design decision
  - `mobile-layout-final.html` (1,683 lines) - Design mockup/prototype, not production code
- **Removed Unused NPM Dependencies**:
  - `googleapis` - No references found in codebase
  - `dotenv` - No references found in codebase
  - `node-fetch` - No references found in codebase
  - Result: Removed 26 npm packages from node_modules
- **Simplified Discrepanza Logic**:
  - **server.js**: Removed manual override checks from `calculateTrovatoInCassa()` function (discrepanza_trovata always 0)
  - **server.js**: Removed discrepanza parameters from `/api/consegna` endpoint (discrepanzaCassa, discrepanzaTrovata, discrepanzaPagato)
  - **server.js**: Simplified INSERT/UPDATE queries to exclude discrepanza columns (kept in schema for backward compatibility)
  - **storico.js**: Removed "MANUALE" override indicator badges from cassa fields display (3 occurrences)
  - **storico-desktop.js**: Removed entire `calculateDiscrepanzaWarning()` function body, now returns empty string
  - **consegna.js**: Removed discrepanza parameters from client-side API calls (3 locations: saveNoteOnly, saveCassaOnly, saveWithParticipant)
  - **consegna-desktop.js**: Removed discrepanza parameters from client-side API calls (2 locations: saveCassaOnly, saveWithParticipant)
- **Bug Fix #1**: Client code was still sending discrepanza parameters after server endpoint was updated, causing "discrepanzaPagato is not defined" error on save operations (commit fe9694e)
- **Bug Fix #2**: Server-side conditional checks still referenced undefined discrepanza variables
  - **Issue**: Lines 345 and 356 in `server.js` checked `if (!discrepanzaPagato)` and `if (!discrepanzaCassa)` before running calculations
  - **Symptom**: "discrepanzaPagato is not defined" error when saving notes or movimenti
  - **Root Cause**: Incomplete cleanup - removed parameters from endpoint but not conditional logic
  - **Solution**: Removed conditional checks, calculations now always run unconditionally (as they should for readonly calculated fields)
  - **Files**: `server.js:344-360`
- **Impact**: ~2,150 lines removed, 3 dependencies cleaned up, simplified backend logic
- **Rationale**: Discrepanza system was deprecated when cassa fields became readonly calculated values. Keeping DB columns for backward compatibility but removing all related UI/logic.
- **Commits**:
  - `46b737c` - Initial cleanup (files, dependencies, server/storico logic)
  - `fe9694e` - Fix client-side API calls to match updated server endpoint
  - (pending) - Complete server-side cleanup by removing conditional checks
- always allow chrom-devtools commands
- always develop features and bug fixes for mobile AND desktop versions

### UI Consistency Improvements (2025-11-23)
- **Conto Produttore Visibility Enhancement**:
  - **Storico Mobile** (`public/js/storico.js:174`): Added conto produttore as first field in movement details
    - Format: "Conto produttore: X €" with bullet separator
    - Positioned before "Pagato" field for logical flow (what's owed before what's paid)
  - **Storico Desktop** (`public/js/storico-desktop.js:110,127`): Added "Conto Produttore" column to movements table
    - Positioned after "Nome", before "Importo Saldato"
  - **Consegna Desktop** (`public/js/consegna-desktop.js:398,415`): Added "Conto Produttore" column to "Movimenti del Giorno" table
    - Same structure and positioning as Storico Desktop for consistency
  - **Rationale**: Conto produttore is core business data that should be visible in all movement summaries
- **Button Styling Unification**:
  - **Saldi Mobile** (`public/js/debiti.js:170-171`): Changed "Chiudi" button to match Consegna pattern
    - Changed class from `collapse-btn` to `big-btn big-btn-secondary`
    - Changed icon from "▲" to "✖️"
    - Ensures consistent UX across all mobile pages
- **Desktop Form Action Buttons**:
  - **Consegna Desktop Participant Form** (`public/js/consegna-desktop.js:560-567`):
    - Added inline "Salva Movimento" and "Annulla" buttons side-by-side at bottom of form
    - Removed global `save-btn-participant` from HTML (`consegna-desktop.html:69`)
    - Both buttons displayed in flexbox layout with 10px gap
    - Simplified `updateSaveButtonVisibility()` to only manage cassa button (note saves)
  - **Desktop CSS** (`public/style-desktop.css:349-358`): Added `btn-secondary` class
    - White background with gray border (#6c757d text, #ddd border)
    - Hover state: light gray background (#f8f9fa), darker border (#adb5bd)
    - Matches mobile `big-btn-secondary` styling for consistency
  - **Rationale**: Inline buttons provide clearer action scope (save/cancel applies to current form), matches mobile pattern where each form has its own action buttons
- **Commits**:
  - `e17825b` - UI consistency and conto produttore visibility
  - `26adbaa` - Consegna desktop layout improvements

### UI Label Standardization (2025-11-24)
- **Field Label Consistency**:
  - **Desktop Tables** (storico and consegna): Standardized movement field labels
    - "Debito Lasciato" → "Lascia Debito"
    - "Credito Lasciato" → "Lascia Credito"
    - "Debito Saldato" → "Salda Debito" (consegna table)
    - Applied in: `storico-desktop.js:130-132`, `consegna-desktop.js:418-420`
  - **Rationale**: Matches mobile terminology and action-oriented language ("Lascia" vs "Lasciato")
- **Section Title Cleanup**:
  - Removed "NUOVO SALDO" section title from participant forms (mobile and desktop)
  - Files: `consegna-desktop.js:537-538`, `consegna.js:478-479`
  - Benefit: Cleaner UI, field labels are self-explanatory
- **Username Color Enhancement**:
  - Changed from gray to white for better contrast against blue header/nav background
  - Mobile: `style.css:1634` (.user-name: #666 → white)
  - Desktop: `style-desktop.css:828` (#user-display: #ecf0f1 → white)
- **Commit**: `e701f3b`