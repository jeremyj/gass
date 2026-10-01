# Quota teatro — implementation plan

Mockup: `design/mockups/quota-teatro.html` (A + B). Target version: 2.19.0.

## Decisions

From the user (2026-10-01):
- Semesters January–June (`2026-1`) and July–December (`2026-2`). One quota per GASS user (households included).
- The quota is set per semester and can change over time; an admin can set a reduced quota per person (e.g. 7 € for someone who joined mid-semester).
- In the sheet, `0` means **non dovuto** (sospesi, exempt).
- A payment is one amount spread over the owed semesters, oldest first; an amount above what is owed **overflows** to the next semesters (advance).
- **Anyone** records a payment at a consegna; the quota money goes to a separate cassa teatro, never into the consegna cassa.

Defaults chosen here (to confirm):
- **Who owes a new semester:** when a semester starts (first request in it, like `ensureTurni`), every `attivo` user gets a row "dovuto = quota of the semester". Sospesi and disattivati get none. People who join later are added by an admin (with a reduced quota if needed).
- **Sheet import:** every cell with a number becomes "dovuto = that amount, paid that amount" (so `15` → paid, `7` → reduced quota fully paid, `0` → non dovuto, `-` → no row). Nobody carries arrears from the sheet. The 2nd semester 2026 is not in the sheet: it starts in GASS with 15 € for the attivi.
- **Cassa teatro** starts at 0 € on the go-live day (the sheet's last line: "30/09/26 rimangono zero euro nel bussolotto"). The old log stays in the sheet.
- **Fixing mistakes:** only admins delete a payment or change a dovuto (Teatro page). Everything is in Attività.
- The Teatro page is admin-only; everyone sees their own status in Saldi.

## Data model

```
teatro_semestri  (semestre TEXT PK '2026-2', quota REAL)                      -- default quota per semester
teatro_dovuti    (user_id, semestre, dovuto REAL, nota TEXT, PK(user_id, semestre))  -- 0 = non dovuto
teatro_pagamenti (id, user_id, data, importo REAL, consegna_id NULL, created_by, created_at)
teatro_cassa     (id, data, importo REAL (+ entrata / − uscita), descrizione, created_by, created_at)  -- manual entries
users.teatro_nota TEXT                                                       -- free note per person (sheet's Note column)
```

Derived, never stored: for each user, payments (sum) are allocated FIFO to their dovuti ordered by semester; what is left over is an advance, shown on the next semester row when it is created. "Dovuto ancora" = Σ dovuti − Σ pagamenti (negative = advance). Cassa teatro balance = Σ pagamenti since go-live + Σ teatro_cassa.

## Tasks

1. **Schema + service** (`server/services/teatro.js`, pure allocation in `teatro-calc.js`): semester helpers (`semestreOf(date)`, label "2° sem. 2026"), `ensureSemestre(db, today)`, `statoTeatro(db, userId)` → per-semester rows {semestre, dovuto, pagato} + residuo, `registraPagamento`, admin `setDovuto`, `setQuota`, `deletePagamento`, `addCassa`, `riepilogo` (grid + cassa). Unit tests for FIFO allocation, overflow, reduced quota, non dovuto.
2. **API** `/api/teatro`: `GET /utente/:id` (any user: status for the consegna box), `POST /pagamenti` (any user), `GET /` grid + cassa, `PUT /dovuti`, `PUT /semestri/:s`, `DELETE /pagamenti/:id`, `POST /cassa` (admin). Activity events `teatro_pagamento`, `teatro_modifica`, `teatro_cassa`. `GET /api/participants` adds `teatro_residuo` for Saldi.
3. **Consegna (mobile + desktop)**: "Quota teatro" button in the participant card (only when something is owed, shows the total) → section with owed semesters, live allocation of the typed amount, "Registra quota" with confirmation. Independent of "Salva movimento" (a payment can be made without a movimento). Cassa aside: "Quote teatro oggi: X €", outside the consegna totals. Shared code in `consegna-common.js`.
4. **Saldi (mobile + desktop)**: "Quota teatro" column / line: "in regola", "da pagare 30 €" or "anticipo 5 €"; totals "quote mancanti".
5. **Teatro page (desktop, admins)**: nav item "Teatro"; KPI (bussolotto, quote del semestre, mancanti); grid gassisti × semesters with paid/dovuto per cell, click to set the dovuto (reduced / non dovuto, with confirm), note per person; quota per semester; cassa log with "Aggiungi voce" (entrata/uscita + descrizione); payments of a person with delete.
6. **Sheet import** `manage-teatro.js import <csv>` (`username;2024-1;2024-2;…;nota`, header with semesters) — the user exports the sheet, Claude maps names to usernames as for the turni.
7. **Turni passati (admin)**: "Mostra turni passati" switch on the desktop Turni page; `GET /api/turni?passati=1` (admin) returns past weeks too, shown greyed and read-only.
8. **Docs, version 2.19.0, go-live**: manual, quick guides, TECHNICAL, CLAUDE.md; deploy; import the sheet; check the grid against the sheet's totals (318 / 285 / 270 / 295 / 303).
