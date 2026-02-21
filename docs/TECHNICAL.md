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
GET    /api/participants/:id/transactions - Get movimenti for a participant (own only for non-admins)
GET    /api/consegna/:date            - Retrieve delivery data for specific date
POST   /api/consegna                  - Create or update delivery with movements
DELETE /api/consegna/:id              - Delete delivery and recalculate all balances
GET    /api/storico                   - Retrieve all deliveries (summary)
GET    /api/storico/dettaglio         - Retrieve all deliveries with detailed movements
PUT    /api/participants/:id          - Update participant balance
POST   /api/participants              - Create new participant
DELETE /api/participants/:id          - Delete participant
GET    /api/version                   - Get application version from package.json (public, no auth)
```

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
saldo             REAL DEFAULT 0
ultima_modifica   DATE
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
salda_tutto           BOOLEAN DEFAULT 0
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

#### Table: activity_logs
```sql
id              INTEGER PRIMARY KEY
event_type      TEXT NOT NULL
target_user_id  INTEGER
actor_user_id   INTEGER
details         TEXT
created_at      DATETIME
```

#### Indexes
- `idx_consegne_data` on consegne(data)
- `idx_movimenti_consegna` on movimenti(consegna_id)
- `idx_movimenti_partecipante` on movimenti(partecipante_id)

## Core Algorithms

### 1. Balance Calculation Algorithm

Participant balance is calculated by applying sequential transformations:

```javascript
function applySaldoChanges(currentSaldo, movimento) {
  let newSaldo = currentSaldo;

  // Step 1: Settle everything
  if (movimento.salda_tutto) {
    newSaldo = 0;
  }

  // Step 2: Use credit
  if (movimento.usa_credito > 0) {
    newSaldo -= movimento.usa_credito;
  }

  // Step 3: Settle all debt or partial debt
  if (movimento.salda_debito_totale && newSaldo < 0) {
    newSaldo = 0;
  } else if (movimento.debito_saldato > 0) {
    newSaldo = Math.min(0, newSaldo + movimento.debito_saldato);
  }

  // Step 4: Add new debt
  if (movimento.debito_lasciato > 0) {
    newSaldo -= movimento.debito_lasciato;
  }

  // Step 5: Add new credit
  if (movimento.credito_lasciato > 0) {
    newSaldo += movimento.credito_lasciato;
  }

  return round(newSaldo);
}
```

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

### 3. Dynamic Recalculation Algorithm

When a delivery is deleted or modified, all subsequent balances must be recalculated:

```javascript
function recalculateAllSaldi() {
  // Reset all participant balances to zero
  db.exec("UPDATE partecipanti SET saldo = 0");

  // Get all deliveries in chronological order
  const consegne = db.query("SELECT * FROM consegne ORDER BY data ASC");

  // For each delivery
  for (const consegna of consegne) {
    // Get all movements for this delivery
    const movimenti = db.query(
      "SELECT * FROM movimenti WHERE consegna_id = ?",
      consegna.id
    );

    // Apply each movement to participant balance
    for (const movimento of movimenti) {
      const participant = getParticipant(movimento.partecipante_id);
      const newSaldo = applySaldoChanges(participant.saldo, movimento);
      updateParticipantSaldo(movimento.partecipante_id, newSaldo);
    }
  }
}
```

### 4. Historical Balance Calculation

To calculate balances as of a specific date:

```javascript
function calculateSaldiAtDate(targetDate) {
  const saldi = {};

  // Initialize all participants with zero balance
  const participants = getAllParticipants();
  participants.forEach(p => saldi[p.id] = 0);

  // Get all deliveries up to target date
  const consegne = db.query(
    "SELECT * FROM consegne WHERE data <= ? ORDER BY data ASC",
    targetDate
  );

  // Apply all movements chronologically
  for (const consegna of consegne) {
    const movimenti = getMovimentiForConsegna(consegna.id);
    for (const movimento of movimenti) {
      saldi[movimento.partecipante_id] = applySaldoChanges(
        saldi[movimento.partecipante_id],
        movimento
      );
    }
  }

  return saldi;
}
```

### 5. Precision Handling

All monetary calculations use 0.1€ precision to avoid floating-point errors:

```javascript
function round(value) {
  return Math.round(value * 10) / 10;
}
```

All user inputs are normalized:
```javascript
function parseDecimal(value) {
  return parseFloat(value.replace(',', '.')) || 0;
}
```

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
- Uses `formatNumber()` to hide unnecessary `.00` decimals on whole numbers
- Shows "42" instead of "42.00" for cleaner UI

#### Participant Movements
Each movement tracks:
- `salda_tutto`: Checkbox to settle entire balance to zero
- `conto_produttore`: Total amount owed to producer for goods received
- `importo_saldato`: Amount collected from participant
- `usa_credito`: Use participant's existing credit (system-managed, always disabled, always visible)
- `debito_lasciato`: New debt to carry forward (system-calculated, always disabled)
- `credito_lasciato`: New credit to carry forward (system-calculated, always disabled)
- `salda_debito_totale`: Checkbox to settle all existing debt
- `debito_saldato`: Partial debt settlement amount (system-managed, always disabled, always visible)

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
   - Result: Auto-checks "Salda intero debito", populates "Debito saldato = 7€"
   - If credit >= debt: Full debt settlement
   - If credit < debt: Partial debt settlement with available credit

2. **Creating debt while participant has credit**:
   - Example: Participant has 10€ credit, conto_produttore=18€, importo_saldato=5€
   - Result: Auto-checks "Usa intero credito", populates "Usa credito = 10€", shows "Lascia debito = 3€"
   - If credit >= debt: Full debt offset
   - If credit < debt: Partial debt reduction

**Automatic Recalculation**: Compensation fields recalculate automatically on every input change:
- Changes to `conto_produttore` or `importo_saldato` trigger immediate recalculation
- Fields are reset and repopulated based on current transaction values
- No manual override capability - values are purely system-calculated
- Simple, predictable behavior ensures data integrity

#### Transaction Processing
1. User enters movement data for each participant
2. System calculates new balance using `applySaldoChanges()`
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
- **Desktop**: "Transazioni" button on each row opens a modal with the full movimenti table (`GET /api/participants/:id/transactions`)
- **Mobile**: Expanding a participant card loads and shows transactions inline
- Auth: non-admin users can only view their own transactions (API returns 403 otherwise)
- Non-admin users can now expand cards (previously admin-only)

#### Historical View
- Select any past date
- System recalculates balances as of that date
- Uses `calculateSaldiAtDate()` algorithm

### 3. Storico (Historical Records)

#### Features
- Lists all deliveries in reverse chronological order (newest first)
- Expandable cards showing:
  - **CASSA section**: trovato, pagato, lasciato amounts
  - **MOVIMENTI section**: All participant transactions
- Delete button to remove delivery and recalculate all balances
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
  - Mobile date picker: Resets to current month via `toggleDatePicker()`
  - Desktop modal calendar: Resets to current month via `showCalendarModal()`
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
  // Delete delivery
  db.run("DELETE FROM consegne WHERE id = ?", id);

  // Delete associated movements
  db.run("DELETE FROM movimenti WHERE consegna_id = ?", id);

  // Recalculate all balances
  recalculateAllSaldi();
});

transaction();
```

### Validation Rules
- Date uniqueness: One delivery per date
- Participant name uniqueness
- Non-negative amounts for all monetary fields
- Balance changes require valid movimento records

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

## Error Handling

### Backend
- Database errors return 500 with error message
- Validation errors return 400 with descriptive message
- All endpoints wrapped in try-catch blocks
- Transaction rollback on any error

### Frontend
- Network errors displayed in alert dialogs
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
