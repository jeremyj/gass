// Turni, mobile: agenda of the next 6 months (last 3 on request). Tapping a consegna opens it
// for editing like on desktop: the two names from a menu, "Modifica giorno", and on your own
// turno the shortcuts swap, move or leave.

let turni = [];
let attivi = [];
let myId = null;
let autoOn = true;
let aperto = null; // id of the turno open for editing

function turnoWhoHtml(t) {
  if (t.saltata) {
    return `<div class="turno-off">niente consegna</div>${t.nota ? `<div class="turno-why">${escapeHtml(t.nota)}</div>` : ''}`;
  }
  const names = t.turnisti.map(p => p ? `<div>${escapeHtml(p.nome)}</div>` : '<div class="da-coprire">da coprire</div>').join('');
  const moved = t.data !== t.settimana ? `<div class="turno-why">spostata da ${formatDateLong(t.settimana)}${t.nota ? `, ${escapeHtml(t.nota)}` : ''}</div>` : '';
  const nota = t.data === t.settimana && t.nota && !t.riunione ? `<div class="turno-why">${escapeHtml(t.nota)}</div>` : '';
  return names + moved + nota;
}

const mine = t => t.turnisti.some(p => p && p.id === myId);

// The open consegna: name menus, own-turno shortcuts, "Modifica giorno", "Chiudi"
function turnoEditHtml(t) {
  let html = '';
  if (nomiModificabili(t)) {
    html += [1, 2].map(slot => `<label class="turno-nome">Turnista ${slot}${nameSelectHtml(t, slot, attivi)}</label>`).join('');
    if (mine(t)) html += `<div class="turno-swap"><span class="turno-edit-h">Il tuo turno</span>${azioniTurnoHtml(turni, t, mySlot(t))}</div>`;
  }
  html += `<button type="button" class="btn btn-line" onclick="apriGiorno(${t.id})">Modifica giorno</button>
    <button type="button" class="btn btn-line" onclick="apriTurno(null)">Chiudi</button>`;
  return `<div class="turno-edit">${html}</div>`;
}

function renderTurni() {
  const list = document.getElementById('turni-list');
  if (turni.length === 0) {
    list.innerHTML = '<p class="empty-state">Nessun turno in programma</p>';
    return;
  }
  const today = toLocalDateString();
  const curId = turni.find(t => t.data >= today)?.id;
  let html = '';
  let month = '';
  turni.forEach(t => {
    const m = monthName(t.data);
    if (m !== month) {
      html += `${month ? '</ul>' : ''}<h2 class="turni-mese">${m}</h2><ul class="turni-ag">`;
      month = m;
    }
    const tap = giornoModificabile(t);
    const open = tap && aperto === t.id;
    const tags = (mine(t) ? '<span class="tag-tu">TU</span>' : '') + (t.riunione ? '<span class="tag-riunione">riunione</span>' : '');
    const action = tap && !open ? `<button type="button" class="link-btn" aria-expanded="false">Apri</button>` : '';
    html += `
      <li class="${t.id === curId ? 'cur' : ''}${t.data < today ? ' past' : ''}${t.saltata ? ' off' : ''}${tap ? ' tap' : ''}${open ? ' open' : ''}"${tap ? ` onclick="tocca(event, ${t.id})"` : ''}>
        <div class="turno-dd${t.data !== t.settimana ? ' moved' : ''}"><b>${Number(t.data.slice(8))}</b>${giornoTurno(t.data) ? `<small>${giornoTurno(t.data)}</small>` : ''}</div>
        <div class="turno-who">${turnoWhoHtml(t)}</div>
        <div class="turno-act">${tags}${action}</div>${open ? turnoEditHtml(t) : ''}
      </li>`;
  });
  list.innerHTML = html + '</ul>';
  const t = turni.find(x => x.id === aperto);
  if (t && document.getElementById('swap-select')) {
    collegaAzioniTurno(turni, t, mySlot(t), () => { aperto = null; loadTurni(); }, renderTurni);
  }

  const next = turni.find(t => t.data >= today && !t.saltata && mine(t));
  // "il tuo prossimo turno" with the date in a badge
  document.getElementById('mio-turno').innerHTML = next
    ? `il tuo prossimo turno <span class="mio-data">${formatDateLong(next.data)}</span>`
    : 'nessun turno per te in programma';
}

// A tap on the row opens or closes it; taps inside the open part are its own controls
function tocca(event, id) {
  if (event.target.closest('.turno-edit')) return;
  apriTurno(aperto === id ? null : id);
}

function apriTurno(id) {
  aperto = id;
  renderTurni();
}

async function assignSlot(id, slot, select) {
  if (await assegnaTurnista(turni.find(x => x.id === id), slot, select, attivi)) await loadTurni();
}

const apriGiorno = id => openGiorno(turni.find(x => x.id === id), { autoOn, onSaved: loadTurni });

const mySlot = t => (t.turnisti[0] && t.turnisti[0].id === myId ? 1 : 2);

async function loadTurni() {
  try {
    const passati = document.getElementById('turni-passati').checked;
    const [result, user, partecipanti] = await Promise.all([
      API.get(`/api/turni${passati ? '?passati=1' : ''}`), sessionReady, API.get('/api/participants')
    ]);
    turni = result.turni;
    autoOn = result.auto;
    myId = user?.id;
    attivi = partecipanti.participants.filter(p => p.stato === 'attivo').sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
    if (!turni.some(t => t.id === aperto)) aperto = null;
    document.getElementById('turni-note-view').textContent = result.note;
    document.getElementById('turni-note-box').classList.toggle('initially-hidden', !result.note);
    renderTurni();
  } catch (error) {
    showStatus('Errore: ' + error.message, 'error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initGiorno();
  loadTurni();
});
