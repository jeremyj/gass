// Turni, mobile: agenda of the next 6 months (last 3 on request); tap "cambia" on your own turno to swap, move or leave it

let turni = [];
let myId = null;
let aperto = null; // id of the turno whose action row is open

function turnoWhoHtml(t) {
  if (t.saltata) {
    return `<div class="turno-off">niente consegna</div>${t.nota ? `<div class="turno-why">${escapeHtml(t.nota)}</div>` : ''}`;
  }
  const names = t.turnisti.map(p => p ? `<div>${escapeHtml(p.nome)}</div>` : '<div class="da-coprire">da coprire</div>').join('');
  const moved = t.data !== t.settimana ? `<div class="turno-why">spostata da ${formatDateLong(t.settimana)}${t.nota ? `, ${escapeHtml(t.nota)}` : ''}</div>` : '';
  const nota = t.data === t.settimana && t.nota && !t.riunione ? `<div class="turno-why">${escapeHtml(t.nota)}</div>` : '';
  return names + moved + nota;
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
    const mine = t.turnisti.some(p => p && p.id === myId);
    const canSwap = mine && !t.saltata && t.data >= today;
    const tags = (mine ? '<span class="tag-tu">TU</span>' : '') + (t.riunione ? '<span class="tag-riunione">riunione</span>' : '');
    const action = canSwap && aperto !== t.id ? `<button type="button" class="link-btn" onclick="apriScambio(${t.id})">cambia</button>` : '';
    const swapRow = canSwap && aperto === t.id
      ? `<div class="turno-swap">${azioniTurnoHtml(turni, t, mySlot(t))}<button type="button" class="btn btn-line" onclick="apriScambio(null)">Annulla</button></div>`
      : '';
    html += `
      <li class="${t.id === curId ? 'cur' : ''}${t.data < today ? ' past' : ''}${t.saltata ? ' off' : ''}">
        <div class="turno-dd${t.data !== t.settimana ? ' moved' : ''}"><b>${Number(t.data.slice(8))}</b><small>${weekdayShort(t.data)}</small></div>
        <div class="turno-who">${turnoWhoHtml(t)}</div>
        <div class="turno-act">${tags}${action}</div>${swapRow}
      </li>`;
  });
  list.innerHTML = html + '</ul>';
  const t = turni.find(x => x.id === aperto);
  if (t && document.getElementById('swap-select')) {
    collegaAzioniTurno(turni, t, mySlot(t), () => { aperto = null; loadTurni(); }, renderTurni);
  }

  const next = turni.find(t => t.data >= today && !t.saltata && t.turnisti.some(p => p && p.id === myId));
  // "il tuo prossimo turno" with the date in a badge
  document.getElementById('mio-turno').innerHTML = next
    ? `il tuo prossimo turno <span class="mio-data">${formatDateLong(next.data)}</span>`
    : 'nessun turno per te nei prossimi 6 mesi';
}

function apriScambio(id) {
  aperto = id;
  renderTurni();
}

const mySlot = t => (t.turnisti[0] && t.turnisti[0].id === myId ? 1 : 2);

async function loadTurni() {
  try {
    const passati = document.getElementById('turni-passati').checked;
    const [result, user] = await Promise.all([API.get(`/api/turni${passati ? '?passati=1' : ''}`), sessionReady]);
    turni = result.turni;
    myId = user?.id;
    document.getElementById('turni-note-view').textContent = result.note;
    document.getElementById('turni-note-box').classList.toggle('initially-hidden', !result.note);
    renderTurni();
  } catch (error) {
    showStatus('Errore: ' + error.message, 'error');
  }
}

document.addEventListener('DOMContentLoaded', loadTurni);
