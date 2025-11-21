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
- **Key Bug Fix**: Removed call to `handleCreditoDebitoInput()` at end of `handleContoProduttoreInput()` which was disabling auto-filled fields
  - Issue: Field disable logic conflicted with auto-fill, preventing credito/debito from being populated
  - Solution: Auto-fill logic already handles field states correctly, extra validation call was causing conflicts
  - Files: `consegna.js:653-655`, `consegna-desktop.js:935-937`