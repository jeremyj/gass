# GASS Pagamenti - Technical Documentation

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
GET    /api/participants        - Retrieve all participants with current balances
GET    /api/participants?date   - Calculate participant balances as of specific date
GET    /api/consegna/:date      - Retrieve delivery data for specific date
POST   /api/consegna            - Create or update delivery with movements
DELETE /api/consegna/:id        - Delete delivery and recalculate all balances
GET    /api/storico             - Retrieve all deliveries (summary)
GET    /api/storico/dettaglio   - Retrieve all deliveries with detailed movements
PUT    /api/participants/:id    - Update participant balance
POST   /api/participants        - Create new participant
DELETE /api/participants/:id    - Delete participant
```

### Frontend Structure

#### Desktop Views
- `consegna-desktop.html/js` (1159 lines) - Delivery entry form
- `debiti-desktop.html/js` (363 lines) - Balance overview
- `storico-desktop.html/js` (193 lines) - Historical records

#### Mobile Views
- `consegna.html/js` (1223 lines) - Delivery entry form
- `debiti.html/js` (345 lines) - Balance overview
- `storico.html/js` (239 lines) - Historical records

#### Shared Components
- `calendar.js` (363 lines) - Date picker with delivery indicators and localStorage persistence
- `utils.js` (67 lines) - Formatting and parsing utilities

## Data Models

### Database Schema

#### Table: partecipanti
```sql
id                INTEGER PRIMARY KEY
nome              TEXT UNIQUE NOT NULL
saldo             REAL DEFAULT 0
ultima_modifica   DATE
```

#### Table: consegne
```sql
id                    INTEGER PRIMARY KEY
data                  DATE UNIQUE NOT NULL
trovato_in_cassa      REAL
pagato_produttore     REAL
lasciato_in_cassa     REAL
discrepanza_cassa     BOOLEAN DEFAULT 0
discrepanza_trovata   BOOLEAN DEFAULT 0
discrepanza_pagato    BOOLEAN DEFAULT 0
note                  TEXT
created_at            DATETIME DEFAULT CURRENT_TIMESTAMP
```

#### Table: movimenti
```sql
id                    INTEGER PRIMARY KEY
consegna_id           INTEGER NOT NULL
partecipante_id       INTEGER NOT NULL
salda_tutto           BOOLEAN DEFAULT 0
importo_saldato       REAL DEFAULT 0
usa_credito           REAL DEFAULT 0
debito_lasciato       REAL DEFAULT 0
credito_lasciato      REAL DEFAULT 0
salda_debito_totale   BOOLEAN DEFAULT 0
debito_saldato        REAL DEFAULT 0
note                  TEXT
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

Cash flow calculation for each delivery:

```javascript
// Trovato in cassa (cash found)
if (discrepanza_trovata) {
  trovato = manual_trovato_value;
} else {
  trovato = previous_lasciato_in_cassa || 0;
}

// Pagato produttore (paid to producer)
if (discrepanza_pagato) {
  pagato = manual_pagato_value;
} else {
  pagato = SUM(
    importo_saldato +
    usa_credito +
    debito_lasciato -
    credito_lasciato -
    debito_saldato
  );
}

// Lasciato in cassa (cash left)
if (discrepanza_cassa) {
  lasciato = manual_lasciato_value;
} else {
  lasciato = trovato + incassato - pagato;
}
```

Where `incassato` (cash collected) is:
```javascript
incassato = SUM(importo_saldato + debito_saldato)
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

#### Smart Input System
Implemented via `SmartInputManager` class in `public/smart-input.js`.

**Architecture:**
- Event-driven state management with custom events
- Single source of truth for field state
- Debounced blur handling (150ms) prevents save button race conditions
- Shared module used by both mobile and desktop versions

**Modes:**
- **AUTO mode**: Fields are read-only and display auto-calculated values
- **MANUALE mode**: User clicks field to enable editing and override calculations

**Features:**
- Visual badge indicators (AUTO/MANUALE) show current mode
- Fields automatically revert to AUTO when:
  - Value is cleared (empty)
  - Value matches the calculated value (within 0.01€ threshold)
- Calculation functions provided per field during initialization
- Recalculation triggered by state changes or explicit calls

**State Management:**
```javascript
smartInputManager.initField(fieldId, element, calculationFn);
smartInputManager.updateField(fieldId);  // Recalculate
smartInputManager.resetAll();            // Reset all to AUTO
smartInputManager.getManualOverrides();  // Get override status
```

#### Auto-Calculation Logic
- `trovato_in_cassa`: Automatically set from previous delivery's `lasciato_in_cassa`
- `pagato_produttore`: Sum of all participant transactions
- `lasciato_in_cassa`: `trovato + incassato - pagato`
- Recalculates on any movement change

#### Participant Movements
Each movement tracks:
- `salda_tutto`: Checkbox to settle entire balance to zero
- `importo_saldato`: Amount collected from participant
- `usa_credito`: Use participant's existing credit
- `debito_lasciato`: New debt to carry forward
- `credito_lasciato`: New credit to carry forward
- `salda_debito_totale`: Checkbox to settle all existing debt
- `debito_saldato`: Partial debt settlement amount

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

#### Date Persistence
The calendar component maintains the selected date across page navigation:
- Selected dates are stored in `localStorage` with key `gass_selected_date`
- On page load, the system checks for a saved date before defaulting
- Ensures consistent date context when switching between tabs (Consegna, Saldi, Storico)
- Falls back to page-specific defaults if no saved date exists

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
