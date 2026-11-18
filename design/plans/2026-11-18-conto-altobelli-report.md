# Conto da foglio Altobelli, teatro in Transazioni, report corretto, nomi

Decided with the user 2026-11-18. Done the same day: Saldi says "15 € anticipati per il 1° sem. 2027" instead of "anticipo 15 €" (23cb25e).

## 1. Conto produttore proposed from the Altobelli sheet (mobile + desktop)

- New endpoint for any authenticated user: `GET /api/altobelli/conto?data=&partecipanteId=` → `{ effettivo, approssimativo }` of that person's row (via `altobelli_nomi`), or nothing. Uses the consegna's saved gid like `/confronto`; the sheet is read once per date and cached for a few minutes (one fetch per card would hit Google on every tap).
- Under the Conto field, a button that writes the value into the field on tap (never fills it by itself):
  - effettivo present → green button "Foglio Altobelli: 44 €".
  - only approssimativo → highlighted (warning colour) button with the approssimativo rounded, and a text saying it is an estimate: check the receipt.
  - no row / no sheet / fetch error → today's fixed hint.
- Replaces the static `contoHint_<id>` text in `consegna-common.js`.

## 2. Teatro payments in Transazioni (Saldi, mobile + desktop)

- `GET /api/participants/:id/transactions` adds the person's `teatro_pagamenti` (date, importo, consegna or "foglio").
- Shown as their own block "Quota teatro" under the movimenti: they go in the bussolotto and do not change the saldo, so they stay out of the "saldo dopo" column.

## 3. Report on reclose: only the corrections

- When a reopened consegna is closed again and a snapshot exists (`report_dati`), Telegram/email get: "Report turno 17/11/2026 (corretto)", the `rettifiche` lines, then "In cassa ora: 586,36 €". No full body.
- No snapshot (consegne reported before 2.30) → full report as today.
- Nothing changed → nothing sent (unchanged rule).

## 4. Altobelli names

- Auto-association: a sheet name equal to a GASS display name (case, spaces, "&" = "e" ignored) is saved to `altobelli_nomi` by itself; anything else stays "da associare" on `/altobelli`. First-word matching stays a suggestion only ("simone e sara" would match Simone & Laura).
- Rename GASS display names to the sheet names (login unchanged): list below, to validate by the user before any change in production.

## Suspended

- Dropping the "Salda debito" / "Usa credito" columns from Transazioni: to review later.

## Open questions

- Rounding of the approssimativo in point 1: to the 10 cents, to the euro, or to the cent?
- Rename list: validate each row (table in the conversation of 2026-11-18).
