# Storico come indice — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Storico becomes an index of consegne that opens each one on the Consegna page; the Consegna page becomes the only detail view, opens by itself on the right day (no date picker), warns about other open consegne and shows quota teatro per person; Saldi loses its date picker.

**Architecture:** Server: `GET /api/storico` returns per-consegna summaries (incassato, teatro), `/dettaglio` goes away; `GET /api/consegna/:date` adds quota teatro per person; a new `GET /api/consegna/apertura` (service `server/services/apertura.js`) says which date to open and lists open consegne. Client: the date reaches the Consegna page only as `?data=yyyy-mm-dd` (from Storico); without it the page asks `/apertura`. The shared `gass_selected_date` and the page date pickers are removed from `calendar.js`; its `pickerHtml` and date fields stay.

**Tech Stack:** Node/Express, better-sqlite3, vanilla JS, Vitest + supertest.

**Spec:** `design/mockups/storico-indice.html` (decisions in its "Deciso" box).

## Global Constraints

- Every change ships on **mobile and desktop** (`*.html` + `*-desktop.html`, `js/<page>.js` + `js/<page>-desktop.js`).
- UI text in Italian; minimum text size 16px; no emoji in labels.
- Calendar dates are local: `toLocalDateString()` (never `toISOString().split('T')[0]` or SQLite `DATE()`).
- Bump `?v=` on every changed CSS/JS reference in the HTML files (static files are cached 7 days).
- Pages that show admin-only controls `await sessionReady` before rendering them.
- Never write `users.saldo`; nothing in this plan touches saldi computation.
- Commits: semantic messages, ending with the session attribution lines.

## Opening rule (from the spec)

T = last `turni.data` ≤ today with `saltata = 0`.
- T has no consegna, or its consegna is open → open **T**.
- T's consegna is closed, or there is no T → open **today**.
- Always: a warning on the Consegna page for every open consegna other than the one shown, linking to it. Storico shows only its "aperta" badge (no warning).

## Review Focus

1. A `?data=` that isn't `yyyy-mm-dd` (hand-edited URL) must not open a consegna on a garbage date → fall back to the opening rule (Task 4, `dataIniziale`).
2. A turno moved off Tuesday (`data` ≠ `settimana`) opens on the real day `data` (Task 3 test).
3. A week in a pause or marked "niente consegna" (`saltata = 1`) is never T (Task 3 test).
4. A consegna with quota teatro payments but no movimenti still lists those people on desktop (the current early return on empty movimenti hides them) (Task 4).
5. Paying a quota teatro inside an open consegna shows it in the day's list right away, without reload (Task 4, `addTeatroToList`).

---

### Task 1: `GET /api/storico` returns the index summary; drop `/dettaglio`

**Files:**
- Modify: `server/routes/storico.js`
- Test: `test/integration/storico.test.js`

**Interfaces:**
- Produces: `GET /api/storico` → `{ success, consegne: [{ id, data, chiusa (0|1), trovato_in_cassa, pagato_produttore, lasciato_in_cassa, note, num_movimenti, incassato, teatro }] }`, newest first. `incassato` = Σ `movimenti.importo_saldato`, `teatro` = Σ `teatro_pagamenti.importo` of that consegna, both rounded to cents.

- [ ] **Step 1: Replace the `/dettaglio` test with failing tests for the new fields**

In `test/integration/storico.test.js`, delete the whole `describe('GET /api/storico/dettaglio quote teatro', …)` block and add inside `describe('GET /api/storico', …)`:

```js
  it('sums incassato and quota teatro per consegna', async () => {
    const a = createUser(db, { username: 'ta', displayName: 'Anna' });
    const b = createUser(db, { username: 'tb', displayName: 'Bruno' });
    const c = createConsegna(db, { data: '2026-03-03' });
    createConsegna(db, { data: '2026-03-10' });
    createMovimento(db, { consegnaId: c, partecipanteId: a, importoSaldato: 10.1 });
    createMovimento(db, { consegnaId: c, partecipanteId: b, importoSaldato: 0.2 });
    const pay = db.prepare('INSERT INTO teatro_pagamenti (user_id, data, importo, consegna_id) VALUES (?, ?, ?, ?)');
    pay.run(a, '2026-03-03', 10, c);
    pay.run(b, '2026-03-03', 5, c);

    const res = await adminAgent.get('/api/storico');
    const [vuota, piena] = res.body.consegne;
    expect(piena.incassato).toBe(10.3);
    expect(piena.teatro).toBe(15);
    expect(vuota.incassato).toBe(0);
    expect(vuota.teatro).toBe(0);
  });

  it('no longer serves /dettaglio', async () => {
    const res = await adminAgent.get('/api/storico/dettaglio');
    expect(res.status).toBe(404);
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run test/integration/storico.test.js`
Expected: FAIL (`incassato` undefined; `/dettaglio` returns 200).

- [ ] **Step 3: Implement**

In `server/routes/storico.js`: import `roundToCents` next to `processConsegneWithDynamicValues` from `../services/calculations`; replace the `GET /` query and response with:

```js
    const consegne = db.prepare(`
      SELECT c.*,
        (SELECT COUNT(*) FROM movimenti WHERE consegna_id = c.id) AS num_movimenti,
        (SELECT COALESCE(SUM(importo_saldato), 0) FROM movimenti WHERE consegna_id = c.id) AS incassato,
        (SELECT COALESCE(SUM(importo), 0) FROM teatro_pagamenti WHERE consegna_id = c.id) AS teatro
      FROM consegne c
      ORDER BY c.data DESC
    `).all();

    console.log(`[STORICO] ${timestamp} - Retrieved ${consegne.length} consegne`);

    const processed = processConsegneWithDynamicValues(consegne)
      .map(c => ({ ...c, incassato: roundToCents(c.incassato), teatro: roundToCents(c.teatro) }));
    res.json({ success: true, consegne: processed });
```

Delete the whole `router.get('/dettaglio', …)` handler.

- [ ] **Step 4: Run tests**

Run: `npx vitest run test/integration/storico.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/routes/storico.js test/integration/storico.test.js
git commit -m "feat(storico): summary per consegna (incassato, teatro), drop /dettaglio"
```

---

### Task 2: Quota teatro per person in `GET /api/consegna/:date`

**Files:**
- Modify: `server/services/teatro.js` (new `quotePerPersona`, exported)
- Modify: `server/routes/consegna.js` (GET `/:date`)
- Test: `test/integration/consegna.test.js`

**Interfaces:**
- Produces: `quotePerPersona(db, consegnaId)` → `[{ user_id, nome, importo }]` ordered by name.
- Produces: `GET /api/consegna/:date` (found) → each `movimenti[i].teatro` (number, 0 if none) and `teatroExtra: [{ user_id, nome, importo }]` (people who paid a quota in that consegna but have no movimento). Not-found response unchanged.

- [ ] **Step 1: Failing test**

Append to `test/integration/consegna.test.js` (the file already imports `createUser`, `createConsegna`, `createMovimento`):

```js
describe('GET /api/consegna/:date quote teatro', () => {
  it('puts each quota on the payer movimento, or in teatroExtra without one', async () => {
    const a = createUser(db, { username: 'ta', displayName: 'Anna' });
    const b = createUser(db, { username: 'tb', displayName: 'Bruno' });
    const c = createConsegna(db, { data: '2026-03-03' });
    createMovimento(db, { consegnaId: c, partecipanteId: a });
    const pay = db.prepare('INSERT INTO teatro_pagamenti (user_id, data, importo, consegna_id) VALUES (?, ?, ?, ?)');
    pay.run(a, '2026-03-03', 10, c);
    pay.run(a, '2026-03-03', 5, c);
    pay.run(b, '2026-03-03', 15, c);

    const res = await adminAgent.get('/api/consegna/2026-03-03');
    expect(res.body.movimenti[0].teatro).toBe(15);
    expect(res.body.teatroExtra).toEqual([{ user_id: b, nome: 'Bruno', importo: 15 }]);
  });

  it('gives teatro 0 and an empty teatroExtra without payments', async () => {
    const a = createUser(db, { username: 'ta', displayName: 'Anna' });
    const c = createConsegna(db, { data: '2026-03-03' });
    createMovimento(db, { consegnaId: c, partecipanteId: a });

    const res = await adminAgent.get('/api/consegna/2026-03-03');
    expect(res.body.movimenti[0].teatro).toBe(0);
    expect(res.body.teatroExtra).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run test/integration/consegna.test.js -t "quote teatro"`
Expected: FAIL (`teatro` undefined).

- [ ] **Step 3: Implement**

`server/services/teatro.js`, next to `quoteDellaConsegna`:

```js
// Quotas paid in a consegna, one row per person
function quotePerPersona(db, consegnaId) {
  return db.prepare(`
    SELECT t.user_id, u.display_name AS nome, ROUND(SUM(t.importo), 2) AS importo
    FROM teatro_pagamenti t JOIN users u ON u.id = t.user_id
    WHERE t.consegna_id = ?
    GROUP BY t.user_id
    ORDER BY u.display_name
  `).all(consegnaId);
}
```

Add `quotePerPersona` to `module.exports`.

`server/routes/consegna.js`: add `const { quotePerPersona } = require('../services/teatro');` with the other requires. In `GET /:date`, after the `movimenti` query:

```js
    // Quota teatro paid in this consegna: on the payer's movimento, or as a row of its own
    const quote = quotePerPersona(db, consegna.id);
    movimenti.forEach(m => { m.teatro = quote.find(q => q.user_id === m.partecipante_id)?.importo || 0; });
    const teatroExtra = quote.filter(q => !movimenti.some(m => m.partecipante_id === q.user_id));
```

and add `teatroExtra,` to the found response object (after `movimenti,`).

- [ ] **Step 4: Run the suite**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add server/services/teatro.js server/routes/consegna.js test/integration/consegna.test.js
git commit -m "feat(consegna): quota teatro per person in GET /api/consegna/:date"
```

---

### Task 3: `GET /api/consegna/apertura` — which date the Consegna page opens on

**Files:**
- Create: `server/services/apertura.js`
- Modify: `server/routes/consegna.js` (route declared **before** `router.get('/:date', …)`)
- Test: `test/integration/apertura.test.js` (create)

**Interfaces:**
- Produces: `apertura(db, today)` → `{ data: 'yyyy-mm-dd', aperte: [{ id, data }] }`; `aperte` = **all** open consegne, oldest first (the client drops the one it shows).
- Produces: `GET /api/consegna/apertura` → `{ success: true, data, aperte }` with `today = toLocalDateString()`.

- [ ] **Step 1: Failing tests**

Create `test/integration/apertura.test.js`:

```js
'use strict';

// MUST be first
const { setupTestDb } = require('../helpers/setup-test-db');
const db = setupTestDb();

const { setupTestApp } = require('../helpers/setup-app');
const { createConsegna, createTurno, clearTurni, clearConsegne } = require('../helpers/seed');
const { apertura } = require('../../server/services/apertura');
const request = require('supertest');

const TODAY = '2026-10-09'; // a Friday

beforeEach(() => {
  clearConsegne(db);
  clearTurni(db);
});

describe('apertura', () => {
  it('opens today without turni', () => {
    expect(apertura(db, TODAY)).toEqual({ data: TODAY, aperte: [] });
  });

  it('opens the last turno while it has no consegna', () => {
    createTurno(db, { settimana: '2026-09-29' });
    createTurno(db, { settimana: '2026-10-06' });
    createTurno(db, { settimana: '2026-10-13' }); // future: ignored
    expect(apertura(db, TODAY).data).toBe('2026-10-06');
  });

  it('opens the last turno while its consegna is open', () => {
    createTurno(db, { settimana: '2026-10-06' });
    const id = createConsegna(db, { data: '2026-10-06' });
    expect(apertura(db, TODAY)).toEqual({ data: '2026-10-06', aperte: [{ id, data: '2026-10-06' }] });
  });

  it('opens today once the last turno is closed', () => {
    createTurno(db, { settimana: '2026-10-06' });
    createConsegna(db, { data: '2026-10-06', chiusa: 1 });
    expect(apertura(db, TODAY).data).toBe(TODAY);
  });

  it('opens a turno today on today', () => {
    createTurno(db, { settimana: TODAY });
    createConsegna(db, { data: '2026-10-06', chiusa: 1 });
    expect(apertura(db, TODAY).data).toBe(TODAY);
  });

  it('uses the real day of a moved turno', () => {
    createTurno(db, { settimana: '2026-10-06', data: '2026-10-07' });
    expect(apertura(db, TODAY).data).toBe('2026-10-07');
  });

  it('skips weeks without consegna (saltata)', () => {
    createTurno(db, { settimana: '2026-09-29' });
    createConsegna(db, { data: '2026-09-29', chiusa: 1 });
    createTurno(db, { settimana: '2026-10-06', saltata: 1 });
    expect(apertura(db, TODAY).data).toBe(TODAY);
  });

  it('lists every open consegna, oldest first', () => {
    const old = createConsegna(db, { data: '2026-09-22' });
    createConsegna(db, { data: '2026-09-29', chiusa: 1 });
    const recent = createConsegna(db, { data: '2026-10-06' });
    expect(apertura(db, TODAY).aperte).toEqual([{ id: old, data: '2026-09-22' }, { id: recent, data: '2026-10-06' }]);
  });
});

describe('GET /api/consegna/apertura', () => {
  let agent;
  beforeAll(async () => {
    const { app } = setupTestApp();
    agent = request.agent(app);
    await agent.post('/api/auth/login').send({ username: 'admin', password: 'admin' });
  });

  it('is not taken for a date by GET /:date', async () => {
    createTurno(db, { settimana: '2020-01-07' });
    const res = await agent.get('/api/consegna/apertura');
    expect(res.status).toBe(200);
    expect(res.body.data).toBe('2020-01-07');
    expect(res.body.aperte).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run test/integration/apertura.test.js`
Expected: FAIL ("Cannot find module '../../server/services/apertura'").

- [ ] **Step 3: Implement**

Create `server/services/apertura.js`:

```js
'use strict';

// Which consegna the Consegna page opens on, without a date picker: the last turno day
// up to today (weeks without consegna excluded) while it has no consegna or an open one,
// otherwise today. All open consegne are listed so the page can warn about the others.
function apertura(db, today) {
  const turno = db.prepare('SELECT data FROM turni WHERE data <= ? AND saltata = 0 ORDER BY data DESC LIMIT 1').get(today);
  const consegna = turno && db.prepare('SELECT chiusa FROM consegne WHERE data = ?').get(turno.data);
  const data = turno && !consegna?.chiusa ? turno.data : today;
  const aperte = db.prepare('SELECT id, data FROM consegne WHERE chiusa = 0 ORDER BY data').all();
  return { data, aperte };
}

module.exports = { apertura };
```

`server/routes/consegna.js`: import `toLocalDateString` from `../services/calculations` (same line as `calculateTrovatoInCassa`), `const { apertura } = require('../services/apertura');`, and add **above** `router.get('/:date', …)`:

```js
// Date the Consegna page opens on, and the open consegne to warn about (declared before /:date)
router.get('/apertura', (req, res) => {
  res.json({ success: true, ...apertura(db, toLocalDateString()) });
});
```

- [ ] **Step 4: Run the suite**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add server/services/apertura.js server/routes/consegna.js test/integration/apertura.test.js
git commit -m "feat(consegna): GET /api/consegna/apertura picks the date to open"
```

---

### Task 4: Consegna page — no date picker, opening rule, open-consegne warning, quota teatro per person

**Files:**
- Modify: `public/consegna.html`, `public/consegna-desktop.html`
- Modify: `public/js/consegna.js`, `public/js/consegna-desktop.js`
- Modify: `public/js/shared/consegna-common.js`
- Modify: `public/js/shared/utils.js` (`openConsegnaOn`, `storicoActionsHtml`)
- Modify: `public/js/shared/calendar.js` (`setDateDisplay` only; the rest is Task 6)
- Modify: `public/style.css`

**Interfaces:**
- Consumes: `GET /api/consegna/apertura` (Task 3), `movimenti[].teatro` + `teatroExtra` (Task 2).
- Produces: `openConsegnaOn(dateStr)` navigates to `/consegna?data=<dateStr>`; `setDateDisplay(dateStr)` sets `#data`, the header and the season, and **no longer** calls a callback nor writes `sessionStorage`; `dataIniziale()`, `renderAvvisoAperte()`, `addTeatroToList(id, nome, importo)` and the global `teatroExtra` live in `consegna-common.js`.

- [ ] **Step 1: Navigation helpers (`utils.js`, `calendar.js`)**

`public/js/shared/utils.js`, replace `openConsegnaOn` and make the Storico action buttons not trigger the row click (Task 5 makes rows clickable):

```js
function openConsegnaOn(dateStr) {
  window.location.href = `/consegna?data=${dateStr}`;
}
```

In `storicoActionsHtml`, change both `onclick="…"` to start with `event.stopPropagation(); ` (e.g. `onclick="event.stopPropagation(); openConsegnaOn('${consegna.data}')"`).

`public/js/shared/calendar.js`, in `setDateDisplay(dateStr)`: delete the `pickerYear`/`pickerMonth` lines, the `sessionStorage.setItem('gass_selected_date', …)` line and the `if (onDateSelected) { … }` block. Keep `#data`, header and `applySeason`.

- [ ] **Step 2: Shared opening + warning + teatro helpers (`consegna-common.js`)**

Update the header comment's dependency line to `calendar.js (setDateDisplay, getSelectedDate)`. Add:

```js
// ===== OPENING =====

// Date to open: ?data= from Storico, else the server's pick (last turno to finish, or today)
async function dataIniziale() {
  const fromUrl = new URLSearchParams(location.search).get('data');
  if (/^\d{4}-\d{2}-\d{2}$/.test(fromUrl || '')) return fromUrl;
  try {
    return (await API.get('/api/consegna/apertura')).data;
  } catch (error) {
    return toLocalDateString();
  }
}

// Other consegne still open, each linked so someone completes it
async function renderAvvisoAperte() {
  const el = document.getElementById('avviso-aperte');
  if (!el) return;
  let aperte = [];
  try {
    aperte = (await API.get('/api/consegna/apertura')).aperte.filter(c => c.data !== getSelectedDate());
  } catch (error) {
    aperte = [];
  }
  el.innerHTML = aperte.map(c => `
    <p>La consegna di <b>${formatDateLong(c.data)}</b> è ancora aperta.
      <button type="button" class="link-btn" onclick="openConsegnaOn('${c.data}')">Completala ›</button></p>
  `).join('');
  el.classList.toggle('initially-hidden', !aperte.length);
}

// ===== QUOTA TEATRO IN THE DAY'S LIST =====

// People who paid a quota teatro in this consegna but have no movimento
let teatroExtra = [];

// After a quota is recorded: show it in the list without reloading the page
function addTeatroToList(id, nome, importo) {
  const m = (existingConsegnaMovimenti || []).find(x => x.partecipante_id === id);
  const t = teatroExtra.find(x => x.user_id === id);
  if (m) m.teatro = roundToCents((m.teatro || 0) + importo);
  else if (t) t.importo = roundToCents(t.importo + importo);
  else teatroExtra.push({ user_id: id, nome, importo });
  renderMovimentiGiorno();
}

// "conto 15, pagato 25, salda debito 8, quota teatro 15" (mobile list rows)
function movimentoDetails(m) {
  const details = [`conto <b>${formatNumber(m.conto_produttore || 0)}</b>`, `pagato <b>${formatNumber(m.importo_saldato || 0)}</b>`];
  if (debitoPagato(m)) details.push(`salda debito <b>${formatNumber(debitoPagato(m))}</b>`);
  if (m.usa_credito) details.push(`usa credito <b>${formatNumber(m.usa_credito)}</b>`);
  if (m.teatro) details.push(`quota teatro <b>${formatNumber(m.teatro)}</b>`);
  return details.join(', ');
}
```

In `registraTeatro`, after `loadQuoteOggi();` add `addTeatroToList(id, p.nome, importo);`.
In `annullaConsegna`, delete the `await loadConsegneDates();` line.
In `renderQuoteOggi`, show the total whenever it is non-zero (closed consegne too): replace the last two lines' condition with `el.classList.toggle('initially-hidden', !quoteOggi);` and delete the now-unused `inProgress` constant.

- [ ] **Step 3: HTML (both pages)**

`public/consegna.html`: delete the `<div class="header-date-section">…</div>` block (button "Cambia data" + `#date-picker-container`). After `<div id="status" class="status" role="status"></div>` add:

```html
        <div id="avviso-aperte" class="avviso initially-hidden" role="status"></div>
```

`public/consegna-desktop.html`: delete the same `header-date-section` block inside `.stag-acts` (keep `#consegna-status-section`), and add the same `#avviso-aperte` div after `#status`.

Bump `?v=` of `style.css`, `utils.js`, `calendar.js`, `consegna-common.js` and the page script in both files.

- [ ] **Step 4: Mobile page (`consegna.js`)**

In `loadExistingConsegna(result)` add `teatroExtra = result.teatroExtra || [];` next to `existingConsegnaMovimenti = …`; in `loadNewConsegna` add `teatroExtra = [];`.

At the end of the `try` in `checkDateData()` add `renderAvvisoAperte();`.

In `saveWithParticipant`, delete `await loadConsegneDates(); // Refresh calendar`.

Replace `renderMovimentiGiorno()`:

```js
function renderMovimentiGiorno() {
  const container = document.getElementById('movimenti-giorno');
  if (!container) return;

  const movimenti = existingConsegnaMovimenti || [];
  const count = document.getElementById('movimenti-count');
  if (count) count.textContent = movimenti.length === 1 ? '1 partecipante' : `${movimenti.length} partecipanti`;

  container.innerHTML = movimenti.map(m => {
    const esito = esitoMovimento(m);
    return `
      <li onclick="openMovimento(${m.partecipante_id})">
        <span class="nm">${escapeHtml(m.nome)}</span>
        <span class="sub">${movimentoDetails(m)}</span>
        <span class="esito ${esito.cls}"><b>${esito.amount}</b><small>${esito.word}</small></span>
        ${m.note ? `<span class="nota">${escapeHtml(m.note)}</span>` : ''}
      </li>
    `;
  }).join('') + teatroExtra.map(t => `
      <li class="inert">
        <span class="nm">${escapeHtml(t.nome)}</span>
        <span class="sub">quota teatro <b>${formatNumber(t.importo)}</b></span>
        <span class="esito"><b>–</b><small>solo teatro</small></span>
      </li>
  `).join('');
}
```

Replace the `DOMContentLoaded` handler:

```js
document.addEventListener('DOMContentLoaded', async () => {
  // Reopen/annulla are admin-only: know the user before rendering the consegna status
  await sessionReady;
  setDateDisplay(await dataIniziale());
  checkDateData();
});
```

- [ ] **Step 5: Desktop page (`consegna-desktop.js`)**

Same `teatroExtra` assignments in its `loadExistingConsegna` / `loadNewConsegna`, same `renderAvvisoAperte();` at the end of the `try` in `checkDateData()`.

In `renderMovimentiGiorno()`: change the early return to `if (movimenti.length === 0 && teatroExtra.length === 0)`; add `<th>Quota teatro</th>` before `<th class="nt">Note</th>`; add `${cell(m.teatro)}` before the note cell of each row; after the movimenti rows append

```js
    + teatroExtra.map(t => `
      <tr>
        <td class="nm">${escapeHtml(t.nome)}</td>
        ${'<td class="mute">–</td>'.repeat(6)}
        ${cell(t.importo)}
        <td class="nt"></td>
      </tr>
    `).join('')
```

and in the footer add, before the last `<td></td>`:

```js
          ${cell(roundToCents(sum(m => m.teatro) + teatroExtra.reduce((acc, t) => acc + t.importo, 0)))}
```

Replace the `DOMContentLoaded` handler:

```js
document.addEventListener('DOMContentLoaded', async () => {
  // Ensure user data is loaded before rendering consegna status
  await sessionReady;
  setDateDisplay(await dataIniziale());
  checkDateData();
});
```

- [ ] **Step 6: CSS (`style.css`)**

```css
/* Consegna page: other consegne still open */
.avviso { background: #FFF6E5; border: 1.5px solid var(--s-acc); border-left-width: 5px; border-radius: 10px; padding: 10px 14px; margin: 14px 0; font-size: 17px; }
.avviso p { margin: 4px 0; }
.mov-list > li.inert { cursor: default; }
```

- [ ] **Step 7: Run tests and check in the browser**

Run: `npm test` → all PASS.
Run: `PORT=3010 npm start`, then with chrome-devtools on `http://localhost:3010/consegna` as admin (desktop) and with the `force_mobile=true` cookie (mobile):
- no "Cambia data"; header "Consegna di oggi" or "Consegna di <data>";
- `/consegna?data=<a closed consegna>` shows it read-only with teatro per person (row/column) and the teatro total in the cassa;
- with two open consegne, the one not shown appears in the warning and "Completala ›" opens it;
- `/consegna?data=abc` opens the date of the rule;
- paying a quota teatro in an open consegna adds it to the list immediately (desktop column, mobile row).

- [ ] **Step 8: Commit**

```bash
git add public/consegna.html public/consegna-desktop.html public/js/consegna.js public/js/consegna-desktop.js public/js/shared/consegna-common.js public/js/shared/utils.js public/js/shared/calendar.js public/style.css
git commit -m "feat(consegna): open on the last turno or today, warn about open consegne, quota teatro per person"
```

---

### Task 5: Storico as an index (mobile + desktop)

**Files:**
- Modify: `public/js/storico.js`, `public/js/storico-desktop.js` (rewrite)
- Modify: `public/storico.html`, `public/storico-desktop.html`
- Modify: `public/style.css` (replace the `.storico-*` block, lines ~515-524)
- Delete: `test/unit/storico-helpers.test.js` (it only tests `formatDateItalianWithDay`, unused by the app and removed here)

**Interfaces:**
- Consumes: `GET /api/storico` (Task 1), `openConsegnaOn`, `storicoActionsHtml` (Task 4), `formatDateLong`, `monthName`, `formatEuro`, `formatNumber` (utils/season).

- [ ] **Step 1: Mobile `storico.js` (whole file)**

```js
// ===== STORICO: one row per consegna, opening it on the Consegna page =====

async function loadStorico() {
  try {
    const result = await API.get('/api/storico');
    renderStorico(result.consegne);
  } catch (error) {
    showStatus('Errore: ' + error.message, 'error');
  }
}

// Grouped by month, newest first (the API sorts by date DESC)
function renderStorico(consegne) {
  const container = document.getElementById('storico-list');
  if (!consegne.length) {
    container.innerHTML = '<p class="empty-state">Nessuna consegna registrata</p>';
    return;
  }
  const months = [];
  consegne.forEach(c => {
    const key = c.data.slice(0, 7);
    if (months[months.length - 1]?.key !== key) months.push({ key, label: `${monthName(c.data)} ${c.data.slice(0, 4)}`, items: [] });
    months[months.length - 1].items.push(c);
  });
  container.innerHTML = '<p class="hint hint-top">Tocca una consegna per vederne il dettaglio.</p>' + months.map(m => `
    <h2 class="storico-month">${m.label}</h2>
    <ul class="mov-list">${m.items.map(consegnaRowHtml).join('')}</ul>
  `).join('');
}

function consegnaRowHtml(c) {
  const persone = c.num_movimenti === 1 ? '1 persona' : `${c.num_movimenti} persone`;
  const stato = c.chiusa ? 'chiusa' : 'aperta';
  return `
    <li onclick="openConsegnaOn('${c.data}')">
      <span class="nm">${formatDateLong(c.data)}</span>
      <span class="sub"><span class="stato-label ${stato}">${stato}</span> ${persone}${c.teatro ? `, quota teatro <b>${formatNumber(c.teatro)}</b>` : ''}</span>
      <span class="esito"><b>${formatEuro(c.lasciato_in_cassa)}</b><small>in cassa</small></span>
      <span class="sub storico-acts">${storicoActionsHtml(c)}<span class="det">Dettaglio ›</span></span>
    </li>
  `;
}

document.addEventListener('DOMContentLoaded', async () => {
  await sessionReady; // "Riapri consegna" is admin-only
  loadStorico();
});
```

`public/storico.html`: change `<ul id="storico-list" class="storico-list"></ul>` to `<div id="storico-list" class="storico-list"></div>`.

- [ ] **Step 2: Desktop `storico-desktop.js` (whole file)**

```js
// ===== STORICO: one row per consegna, opening it on the Consegna page =====

async function loadStorico() {
  try {
    const result = await API.get('/api/storico');
    renderStorico(result.consegne);
  } catch (error) {
    showStatus('Errore: ' + error.message, 'error');
  }
}

// Zeros render as "–" so the real figures stand out
function numCell(value) {
  return value ? `<td>${formatNumber(value)}</td>` : '<td class="mute">–</td>';
}

function renderStorico(consegne) {
  const container = document.getElementById('storico-list');
  if (!consegne.length) {
    container.innerHTML = '<p>Nessuna consegna registrata</p>';
    return;
  }
  container.innerHTML = `
    <p class="hint hint-top">Clic su una consegna per vederne il dettaglio.</p>
    <table class="t">
      <thead>
        <tr>
          <th>Consegna</th><th>Stato</th><th>Persone</th><th>Trovato</th><th>Incassato</th>
          <th>Pagato</th><th>In cassa</th><th>Quota teatro</th><th></th><th></th>
        </tr>
      </thead>
      <tbody>${consegne.map(c => `
        <tr class="clickable" onclick="openConsegnaOn('${c.data}')">
          <td class="nm">${formatDateLong(c.data)}</td>
          <td><span class="stato-label ${c.chiusa ? 'chiusa' : 'aperta'}">${c.chiusa ? 'Chiusa' : 'Aperta'}</span></td>
          <td>${c.num_movimenti}</td>
          <td>${formatNumber(c.trovato_in_cassa)}</td>
          <td>${formatNumber(c.incassato)}</td>
          <td>${formatNumber(c.pagato_produttore)}</td>
          <td><b>${formatNumber(c.lasciato_in_cassa)}</b></td>
          ${numCell(c.teatro)}
          <td>${storicoActionsHtml(c)}</td>
          <td class="det">Dettaglio ›</td>
        </tr>`).join('')}
      </tbody>
    </table>
  `;
}

document.addEventListener('DOMContentLoaded', async () => {
  await sessionReady; // "Riapri consegna" is admin-only
  loadStorico();
});
```

- [ ] **Step 3: CSS**

Replace the `.storico-list` … `.storico-consegna-content .esito b` block (lines ~515-524) with:

```css
.storico-list { padding-top: 16px; }
.storico-month { font-size: 16px; font-weight: 800; color: var(--salvia); text-transform: uppercase; letter-spacing: .06em; margin: 18px 4px 6px; }
.storico-list .mov-list { margin: 0; }
.storico-acts { display: flex; justify-content: space-between; gap: 12px; }
.det { color: var(--s-deep); font-weight: 800; white-space: nowrap; }
```

Check that nothing else uses the removed classes: `grep -rn "storico-consegna" public` → no output.

Bump `?v=` of `style.css`, `utils.js` and the page script in `storico.html` and `storico-desktop.html`.

- [ ] **Step 4: Delete the dead-code test and run the suite**

```bash
git rm test/unit/storico-helpers.test.js
npm test
```
Expected: all PASS.

- [ ] **Step 5: Check in the browser (mobile + desktop)**

On `http://localhost:3010/storico`: rows grouped by month (mobile) / one table (desktop) with the full cassa; tapping/clicking a row opens `/consegna?data=…`; "Riapri consegna" (admin only) reopens and opens the consegna; "Completa consegna" on open ones; as a non-admin no "Riapri"; browser back returns to Storico.

- [ ] **Step 6: Commit**

```bash
git add public/js/storico.js public/js/storico-desktop.js public/storico.html public/storico-desktop.html public/style.css
git commit -m "feat(storico): index of consegne opening each one on the Consegna page"
```

---

### Task 6: Saldi always today; remove the page date pickers from `calendar.js`

**Files:**
- Modify: `public/debiti.html`, `public/debiti-desktop.html`, `public/js/debiti.js`, `public/js/debiti-desktop.js`, `public/js/shared/debiti-common.js`
- Modify: `public/js/shared/calendar.js`, `public/style.css`
- Modify: `server/routes/participants.js`
- Test: `test/integration/participants.test.js`

**Interfaces:**
- Produces: `GET /api/participants` ignores `?date=` (always current saldi). `saldoAt` stays in `server/services/saldi.js` (`currentSaldo` uses it).
- After this task `calendar.js` exports (globals) only: `pickerHtml`, `setDateDisplay`, `getSelectedDate`, `initDateField`, `setDateField`, `dateFieldValue` and the date-field internals.

- [ ] **Step 1: Tests first**

In `test/integration/participants.test.js`: delete the test `'calculates historical saldi as of a given date when ?date= provided'`. Rewrite `'historical saldo counts a rettifica only from its date'` to call the service (add `const { saldoAt } = require('../../server/services/saldi');` below the other requires, after `setupTestDb()`):

```js
  it('historical saldo counts a rettifica only from its date', () => {
    const userId = createUser(db, { username: 'mario', displayName: 'Mario' });
    const c1 = createConsegna(db, { data: '2026-01-01' });
    createMovimento(db, { consegnaId: c1, partecipanteId: userId, creditoLasciato: 30 });
    createRettifica(db, { partecipanteId: userId, data: '2026-01-10', importo: -5 });

    expect(saldoAt(userId, '2026-01-09').saldo).toBe(30);
    expect(saldoAt(userId, '2026-01-10')).toEqual({ saldo: 25, ultimaModifica: '2026-01-10' });
  });
```

and add:

```js
  it('GET /api/participants ignores ?date= and returns current saldi', async () => {
    const userId = createUser(db, { username: 'mario', displayName: 'Mario' });
    createRettifica(db, { partecipanteId: userId, data: '2026-01-10', importo: -5 });
    db.prepare('UPDATE users SET saldo = -5 WHERE id = ?').run(userId);

    const res = await adminAgent.get('/api/participants?date=2026-01-01');
    expect(res.body.participants.find(p => p.id === userId).saldo).toBe(-5);
  });
```

Run: `npx vitest run test/integration/participants.test.js`
Expected: the new `?date=` test FAILS (the route still replays to 2026-01-01 → 0).

- [ ] **Step 2: Server**

`server/routes/participants.js` `GET /`: delete the `const { date } = req.query;`, the `${date ? …}` parts of the log lines and the whole `if (date) { … }` block; drop `saldoAt` from the `require('../services/saldi')` list. Run the test file again → PASS.

- [ ] **Step 3: Saldi pages**

`debiti-common.js`: `loadParticipants()` calls `API.get('/api/participants')` (drop the date/url logic); delete `renderSaldiHint()` and `isViewingToday()`.
`debiti.js`: delete the `renderSaldiHint();` call; replace each `isAdmin() && isViewingToday()` with `isAdmin()`; `DOMContentLoaded` becomes:

```js
document.addEventListener('DOMContentLoaded', async () => {
  // Saldi are editable only by admins: know the user before rendering
  await sessionReady;
  setDateDisplay(toLocalDateString());
  loadParticipants();
});
```

`debiti-desktop.js`: same removals; in its `DOMContentLoaded` replace `initCalendar(…)`, `restoreDateFromStorage()`/`setDateDisplay(dateToLoad)` and `loadConsegneDates()` with `setDateDisplay(toLocalDateString()); loadParticipants();` after `await sessionReady;` (keep the admin-only button hiding that follows).
`debiti.html`, `debiti-desktop.html`: delete the `header-date-section` block and the `<p id="saldi-hint" …>` line. Bump `?v=` of changed scripts and `style.css`.

- [ ] **Step 4: `calendar.js` cleanup**

Delete: `consegneDates`, `pickerYear`, `pickerMonth`, `isPickerOpen`, `onDateSelected`, `initCalendar`, `toggleDatePicker`, `renderDatePicker`, `changePickerMonth`, `selectPickerDate`, `setConsegneDates`, `loadConsegneDates`, `restoreDateFromStorage`, and the "CLICK OUTSIDE HANDLER" block. Keep `pickerHtml`, `setDateDisplay`, `getSelectedDate` and the "DATE FIELDS" section.

Check nothing still calls them:
`grep -rn "initCalendar\|toggleDatePicker\|loadConsegneDates\|restoreDateFromStorage\|selectPickerDate\|gass_selected_date\|change-date-btn\|date-picker-container" public` → no output.

`style.css`: delete `.header-date-section { … }` and `.stag-acts .header-date-section { … }`, and any `.change-date-btn` rule (`grep -n "change-date-btn" public/style.css`). Keep `.date-picker-*` (used by the date fields).

- [ ] **Step 5: Run tests and check in the browser**

Run: `npm test` → all PASS.
On `/debiti` (mobile + desktop): no "Cambia data", header "Saldi di oggi"; admin sees "Modifica saldo"; transactions modal works. On `/turni` and `/teatro` (desktop admin) the date fields still open their calendar.

- [ ] **Step 6: Commit**

```bash
git add -A public server/routes/participants.js test/integration/participants.test.js
git commit -m "feat(saldi): always today, drop the date pickers and the shared selected date"
```

---

### Task 7: Docs and project notes

**Files:**
- Modify: `docs/MANUALE_UTENTE.md`, `docs/GUIDA_RAPIDA_MOBILE.md`, `docs/GUIDA_RAPIDA_DESKTOP.md`, `docs/TECHNICAL.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: User docs (use the `ops-docs` skill, per user rule)**

`grep -n "Cambia data\|Storico\|storico\|data selezionata" docs/*.md` and update each hit: Storico = index, row opens the consegna; Consegna opens on the last turno to finish or today, with the warning for open consegne; quota teatro per person in the consegna; Saldi always today (history of a person in Transazioni). No `Cambia data` left.

- [ ] **Step 2: `docs/TECHNICAL.md`**

Document `GET /api/consegna/apertura` and the opening rule, `teatroExtra` / `movimenti[].teatro` in `GET /api/consegna/:date`, the new `GET /api/storico` fields, removal of `/api/storico/dettaglio` and of `?date=` on `/api/participants`.

- [ ] **Step 3: `CLAUDE.md`**

Update: Routes (`storico.js` summary only; `consegna.js` `/apertura` before `/:date`), Services (`apertura.js`), `calendar.js` line (no page picker: `pickerHtml` + date fields + `setDateDisplay`), `utils.js` (`openConsegnaOn` → `/consegna?data=`), the "Date Selection" section (replace with: date comes from `?data=` or `/apertura`; no `sessionStorage`), Consegna Locking (Storico rows open the consegna; "Riapri" still on Storico), Admin-Only "Edit saldi (… only for today's date)" → "Edit saldi (debiti page)", test count after `npm test`.

- [ ] **Step 4: Commit**

```bash
git add docs CLAUDE.md
git commit -m "docs: storico index, consegna opening rule, saldi without date"
```
