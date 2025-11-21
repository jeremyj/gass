- 'close task' means update technical documentation with user facing information, update CLAUDE.md with any useful AI insights, commit changes with meaningfful semantic messages

## Technical Notes

### Cassa Field Architecture (Current Implementation)
- **Design Decision**: Cassa fields (trovato, pagato, lasciato) are **readonly calculated values only**
- **No Manual Override**: Previous SmartInputManager-based override system has been removed
- **Calculation Logic**:
  - `trovato_in_cassa`: Populated from previous consegna's `lasciato_in_cassa` value
  - `pagato_produttore`: Auto-calculated sum from all movement records for the day
  - `lasciato_in_cassa`: Auto-calculated as `trovato + incassato - pagato`
- **Implementation Files**:
  - `consegna.js`: Functions `calculatePagatoProduttore()`, `calculateLasciatoInCassa()`, `updatePagatoProduttore()`, `updateLasciatoInCassa()`
  - `consegna.html`: All cassa input fields have `readonly` attribute with disabled styling
- **Database**: Always saves with `discrepanza_cassa=0`, `discrepanza_trovata=0`, `discrepanza_pagato=0`
- **Rationale**: Simplifies UX and ensures data integrity by preventing manual adjustments that could cause calculation mismatches

### Date Persistence Implementation
- **Challenge**: Selected date was resetting to default when switching between mobile tabs (Consegna/Saldi/Storico)
- **Solution**: Implemented localStorage-based persistence using key `gass_selected_date`
- **Implementation Details**:
  - `calendar.js`: Added `restoreDateFromStorage()` function and localStorage writes in `selectPickerDate()` and `setDateDisplay()`
  - `debiti.js`: Modified initialization to call `restoreDateFromStorage()` instead of defaulting to today
  - `consegna.js`: Modified initialization to prioritize localStorage over default "last consegna" date
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

  - **Implementation** (in `handleContoProduttoreInput()`):
    ```javascript
    // Case 1: Creating credit + existing debt
    if (diff > 0 && debitoPreesistente > 0) {
      // Use credit to pay debt, adjust diff
    }
    // Case 2: Creating debt + existing credit
    if (diff < 0 && creditoPreesistente > 0) {
      // Use credit to offset debt, adjust diff
    }
    ```
  - **Files**: `consegna.js:604-670`, `consegna-desktop.js:887-953`
  - **Trigger Conditions**:
    1. Auto-compensation only activates when `importo_saldato > 0` (user has entered payment amount)
       - **Why**: Prevents premature compensation when user is still filling out the form
       - **Example**: Entering only `conto_produttore=30€` won't trigger compensation until `importo_saldato` is also entered
    2. Auto-population only occurs if target field is empty (value = 0)
       - **Why**: Respects user's manual edits or clearing of auto-populated values
       - **Example**: If system auto-populates "Usa credito = 5€", user can clear it and system won't re-populate
       - Prevents "sticky" fields that can't be cleared
  - **Rationale**: Credits and debts should automatically offset in both directions - this matches expected financial behavior and prevents confusion