// Turni, mobile: read-only agenda of the next 12 weeks

function turnoWhoHtml(t) {
  if (t.saltata) {
    return `<div class="turno-off">niente consegna</div>${t.nota ? `<div class="turno-why">${escapeHtml(t.nota)}</div>` : ''}`;
  }
  const names = t.turnisti.map(p => p ? `<div>${escapeHtml(p.nome)}</div>` : '<div class="da-coprire">da coprire</div>').join('');
  const moved = t.data !== t.settimana ? `<div class="turno-why">spostata da ${formatDateLong(t.settimana)}${t.nota ? `, ${escapeHtml(t.nota)}` : ''}</div>` : '';
  const nota = t.data === t.settimana && t.nota && !t.riunione ? `<div class="turno-why">${escapeHtml(t.nota)}</div>` : '';
  return names + moved + nota;
}

function renderTurni(turni, myId) {
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
    const tags = (mine ? '<span class="tag-tu">TU</span>' : '') + (t.riunione ? '<span class="tag-riunione">riunione</span>' : '');
    html += `
      <li class="${i === 0 ? 'cur' : ''}${t.saltata ? ' off' : ''}">
        <div class="turno-dd${t.data !== t.settimana ? ' moved' : ''}"><b>${Number(t.data.slice(8))}</b><small>${weekdayShort(t.data)}</small></div>
        <div class="turno-who">${turnoWhoHtml(t)}</div>
        <div class="turno-tags">${tags}</div>
      </li>`;
  });
  list.innerHTML = html + '</ul>';

  const next = turni.find(t => !t.saltata && t.turnisti.some(p => p && p.id === myId));
  document.getElementById('mio-turno').textContent = next
    ? `il tuo: ${formatDateLong(next.data)}`
    : 'nessun turno per te nelle prossime 12 settimane';
}

async function loadTurni() {
  try {
    const [result, user] = await Promise.all([API.get('/api/turni'), sessionReady]);
    renderTurni(result.turni, user?.id);
  } catch (error) {
    showStatus('Errore: ' + error.message, 'error');
  }
}

document.addEventListener('DOMContentLoaded', loadTurni);
