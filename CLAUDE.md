- 'close task' means update technical documentation with user facing information, update CLAUDE.md with any useful AI insights, commit changes with meaningfful semantic messages

## Technical Notes

### Date Persistence Implementation
- **Challenge**: Selected date was resetting to default when switching between mobile tabs (Consegna/Saldi/Storico)
- **Solution**: Implemented localStorage-based persistence using key `gass_selected_date`
- **Implementation Details**:
  - `calendar.js`: Added `restoreDateFromStorage()` function and localStorage writes in `selectPickerDate()` and `setDateDisplay()`
  - `debiti.js`: Modified initialization to call `restoreDateFromStorage()` instead of defaulting to today
  - `consegna.js`: Modified initialization to prioritize localStorage over default "last consegna" date
  - All three pages now maintain consistent date context across navigation
- **Benefits**: Improved UX in mobile view where tab switching is primary navigation method