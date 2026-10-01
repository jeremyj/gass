// Turni, mobile: agenda of the next 12 weeks; tap "scambia" on your own turno to swap it

let turni = [];
let myId = null;
let aperto = null; // id of the turno whose swap row is open

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
  let html = '';
  let month = '';
  turni.forEach((t, i) => {
    const m = monthName(t.data);
    if (m !== month) {
      html += `${month ? '</ul>' : ''}<h2 class="turni-mese">${m}</h2><ul class="turni-ag">`;
      month = m;
    }
    const mine = t.turnisti.some(p => p && p.id === myId);
    const canSwap = mine && !t.saltata && t.data >= toLocalDateString();
    const tags = (mine ? '<span class="tag-tu">TU</span>' : '') + (t.riunione ? '<span class="tag-riunione">riunione</span>' : '');
    const action = canSwap && aperto !== t.id ? `<button type="button" class="link-btn" onclick="apriScambio(${t.id})">scambia</button>` : '';
    const swapRow = canSwap && aperto === t.id
      ? `<div class="turno-swap">${scambioSelectHtml(turni, t, 'swap-select')}<button type="button" class="btn btn-line" onclick="apriScambio(null)">Annulla</button></div>`
      : '';
    html += `
      <li class="${i === 0 ? 'cur' : ''}${t.saltata ? ' off' : ''}">
        <div class="turno-dd${t.data !== t.settimana ? ' moved' : ''}"><b>${Number(t.data.slice(8))}</b><small>${weekdayShort(t.data)}</small></div>
        <div class="turno-mid"><div class="turno-who">${turnoWhoHtml(t)}</div>${tags ? `<div class="turno-tags">${tags}</div>` : ''}</div>
        <div class="turno-act">${action}</div>${swapRow}
      </li>`;
  });
  list.innerHTML = html + '</ul>';
  const select = document.getElementById('swap-select');
  if (select) select.onchange = e => e.target.value && scambia(Number(e.target.value));

  const next = turni.find(t => !t.saltata && t.turnisti.some(p => p && p.id === myId));
  document.getElementById('mio-turno').textContent = next
    ? `il tuo: ${formatDateLong(next.data)}`
    : 'nessun turno per te nelle prossime 12 settimane';
}

function apriScambio(id) {
  aperto = id;
  renderTurni();
}

async function scambia(userId) {
  const t = turni.find(x => x.id === aperto);
  const slot = t.turnisti[0] && t.turnisti[0].id === myId ? 1 : 2;
  if (!await scambiaTurno(turni, t, slot, userId)) return renderTurni();
  aperto = null;
  await loadTurni();
}

async function loadTurni() {
  try {
    const [result, user] = await Promise.all([API.get('/api/turni'), sessionReady]);
    turni = result.turni;
    myId = user?.id;
    renderTurni();
  } catch (error) {
    showStatus('Errore: ' + error.message, 'error');
  }
}

document.addEventListener('DOMContentLoaded', loadTurni);
