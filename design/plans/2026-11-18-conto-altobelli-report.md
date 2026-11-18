# Conto da foglio Altobelli, teatro in Transazioni, report corretto, nomi

Decided with the user 2026-11-18. Points 1–3 and the auto-association of 4 implemented the same day (tried locally before deploy); the rename is a SQL run at deploy, kept out of the repo (members' names, public repo). Also done: Saldi says "15 € anticipati per il 1° sem. 2027" instead of "anticipo 15 €" (23cb25e).

## 1. Conto produttore proposed from the Altobelli sheet (mobile + desktop)

- New endpoint for any authenticated user: `GET /api/altobelli/conto?data=&partecipanteId=` → `{ effettivo, approssimativo }` of that person's row (via `altobelli_nomi`), or nothing. Uses the consegna's saved gid like `/confronto`; the sheet is read once per date and cached for a few minutes (one fetch per card would hit Google on every tap).
- Under the Conto field, a button that writes the value into the field on tap (never fills it by itself):
  - effettivo present → green button "Foglio Altobelli: 44 €".
  - no effettivo → amber button with the typed receipt rounded to the 10 cents, a 5 upwards (user decision, see the sheet check below).
  - no row / no sheet / fetch error → today's fixed hint.
- Replaces the static `contoHint_<id>` text in `consegna-common.js`.

## 2. Teatro payments in Transazioni (Saldi, mobile + desktop)

- `GET /api/participants/:id/transactions` adds the person's `teatro_pagamenti` (date, importo, consegna or "foglio").
- Shown as their own block "Quota teatro" under the movimenti: they go in the bussolotto and do not change the saldo, so they stay out of the "saldo dopo" column.

## 3. Report on reclose: only the corrections

- When a reopened consegna is closed again and a snapshot exists (`report_dati`), Telegram/email get: "Report turno 17/11/2026 (corretto)", the `rettifiche` lines, then "In cassa ora: 586,36 €". No full body.
- No snapshot (consegne reported before 2.30) → full report as today.
- Snapshot but no rettifiche lines (no amount changed) → nothing sent (user decision, same day).
- Nothing changed → nothing sent (unchanged rule).

## 4. Altobelli names

- Auto-association: a sheet name equal to a GASS display name (case, spaces, "&" = "e" ignored) is saved to `altobelli_nomi` by itself; anything else stays "da associare" on `/altobelli`. First-word matching stays a suggestion only ("simone e sara" would match Simone & Laura).
- Rename GASS display names to the sheet names (login unchanged): list below, to validate by the user before any change in production.

## Suspended

- Dropping the "Salda debito" / "Usa credito" columns from Transazioni: to review later.

## Open questions

- Rounding in point 1. Checked on the sheet 2026-11-18 (214 effettivi in 31 tabs): since 21 luglio 2026 every effettivo is a multiple of 10 cents (before, 41 had cents). Where GASS holds the receipt total, the effettivo is that total rounded to the 10 cents (20,82 → 20,80; 21,08 → 21,10; 37,07 → 37,10; 26,14 → 26,10). The only tie seen, 21,05 (Paola Mazza 17/11), went to 21,00: one case, not enough to say how Leonardo rounds a 5. The approssimativo is not a rounded effettivo (17/11: Polly 40,60 vs 50,40; Riccardo e Camille 37,70 vs 44): proposing it as the conto is unreliable. To confirm with the user: without an effettivo, the warning button proposes the typed receipt total rounded to the 10 cents, not the approssimativo.
- Rename list: validated by the user 2026-11-18 ("frankkie" → Frankkie, as in the sheet).
