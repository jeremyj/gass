// ===== BOZZE: what is typed in a form and not saved yet survives a page reload =====
// sessionStorage belongs to the browser tab: it survives a reload (or the phone dropping the page
// while the camera is open) and is gone when the tab is closed. Passwords and files are never stored.
//
// A container marked data-bozza="<key>" saves its fields (inputs/selects/textareas with an id,
// not disabled) on every input/change. The page puts them back with bozzaRiprendi(key, root) once
// it has filled the form, and calls bozzaCancella(key) when the form is saved or cancelled.

const BOZZA_PREFISSO = 'gass_bozza:';
let bozzaInRipresa = false; // restoring fires input events: don't save while doing it

function bozzaScrivi(key, dati) {
  try { sessionStorage.setItem(BOZZA_PREFISSO + key, JSON.stringify(dati)); } catch { /* storage full or off: no draft */ }
}

function bozzaLeggi(key) {
  try { return JSON.parse(sessionStorage.getItem(BOZZA_PREFISSO + key)); } catch { return null; }
}

function bozzaCancella(key) {
  sessionStorage.removeItem(BOZZA_PREFISSO + key);
}

// Keys of the drafts starting with `inizio` (e.g. the open card of a consegna date)
function bozzeChiavi(inizio) {
  return Object.keys(sessionStorage)
    .filter(k => k.startsWith(BOZZA_PREFISSO + inizio))
    .map(k => k.slice(BOZZA_PREFISSO.length));
}

function campiBozza(root) {
  return [...root.querySelectorAll('input[id], select[id], textarea[id]')]
    .filter(el => !el.disabled && !['password', 'file', 'hidden'].includes(el.type));
}

function bozzaSalva(key, root) {
  const valori = {};
  campiBozza(root).forEach(el => { valori[el.id] = el.type === 'checkbox' ? el.checked : el.value; });
  bozzaScrivi(key, { valori });
}

// Put the stored values back (firing the fields' own input/change handlers); returns the ids not found
// yet (a block rendered later can be filled with a second call). Shows a toast when something came back.
// `solo`: restore only these ids (the second call for a block rendered later).
function bozzaRiprendi(key, root = document, { avviso = true, solo = null } = {}) {
  const bozza = bozzaLeggi(key);
  if (!bozza?.valori) return [];
  const mancanti = [];
  bozzaInRipresa = true;
  try {
    Object.entries(bozza.valori).filter(([id]) => !solo || solo.includes(id)).forEach(([id, valore]) => {
      const el = root.querySelector(`#${CSS.escape(id)}`);
      if (!el || el.disabled) return mancanti.push(id);
      if (el.type === 'checkbox') el.checked = valore; else el.value = valore;
      el.dispatchEvent(new Event(el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'input', { bubbles: true }));
    });
  } finally {
    bozzaInRipresa = false;
  }
  if (avviso) showStatus('Ho ripreso quello che avevi scritto e non era salvato', 'success');
  return mancanti;
}

// Bubble phase: the fields' own handlers (normalising, computing) have already run
function salvaBozzaDaEvento(e) {
  const root = e.target.closest?.('[data-bozza]');
  if (root && !bozzaInRipresa) bozzaSalva(root.dataset.bozza, root);
}
document.addEventListener('input', salvaBozzaDaEvento);
document.addEventListener('change', salvaBozzaDaEvento);
