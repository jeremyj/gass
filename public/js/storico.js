// ===== STATE =====

let expandedConsegnaId = null;

// ===== DATA LOADING =====

async function loadStorico() {
  try {
    const result = await API.get('/api/storico/dettaglio');
    renderStorico(result.storico);
  } catch (error) {
    showStatus('Errore: ' + error.message, 'error');
  }
}

// ===== RENDERING =====

function renderStorico(storico) {
  const container = document.getElementById('storico-list');
  container.innerHTML = '';

  if (storico.length === 0) {
    container.innerHTML = '<li class="empty-state">Nessuna consegna registrata</li>';
    return;
  }

  storico.forEach((consegna) => {
    const card = createConsegnaCard(consegna);
    container.appendChild(card);
  });
}

function createConsegnaCard(consegna) {
  const isExpanded = expandedConsegnaId === consegna.id;
  const card = document.createElement('li');
  card.className = 'storico-consegna-card' + (isExpanded ? ' expanded' : '');

  // Header (always visible)
  const header = document.createElement('button');
  header.type = 'button';
  header.className = 'storico-consegna-header';
  header.setAttribute('aria-expanded', String(isExpanded));
  header.onclick = () => toggleConsegnaCard(consegna.id);
  header.innerHTML = `
    <span class="storico-consegna-date">${formatDateLong(consegna.data)}</span>
    <span class="storico-consegna-meta">${consegna.chiusa ? 'chiusa' : 'aperta'}, in cassa ${formatEuro(consegna.lasciato_in_cassa)}</span>
  `;
  card.appendChild(header);

  if (isExpanded) {
    const content = document.createElement('div');
    content.className = 'storico-consegna-content';
    content.appendChild(createCassaSection(consegna));
    if (consegna.movimenti?.length || consegna.teatro_extra?.length) {
      content.appendChild(createMovimentiSection(consegna.movimenti || [], consegna.teatro_extra || []));
    }
    const acts = document.createElement('div');
    acts.className = 'storico-acts';
    acts.innerHTML = storicoActionsHtml(consegna);
    content.appendChild(acts);
    card.appendChild(content);
  }

  return card;
}

// Same sum as the consegna page: trovato + incassato − pagato = lasciato
function createCassaSection(consegna) {
  const incassato = (consegna.movimenti || []).reduce((sum, m) => sum + (m.importo_saldato || 0), 0);
  const section = document.createElement('div');
  section.className = 'cassa-v';
  section.innerHTML = `
    <p><label>Trovato</label><output>${formatNumber(consegna.trovato_in_cassa)}</output></p>
    <p><label>+ Incassato</label><output>${formatNumber(roundToCents(incassato))}</output></p>
    <p><label>− Pagato</label><output>${formatNumber(consegna.pagato_produttore)}</output></p>
    <p class="tot"><label>= In cassa</label><output>${formatNumber(consegna.lasciato_in_cassa)}</output></p>
    ${consegna.note ? `<div class="nt">Note: <i>${escapeHtml(consegna.note)}</i></div>` : ''}
  `;
  return section;
}

// teatroExtra: quote teatro paid by people with no movimento in this consegna
function createMovimentiSection(movimenti, teatroExtra) {
  const list = document.createElement('ul');
  list.className = 'mov-list';
  list.innerHTML = movimenti.map(createParticipantMovimentoItem).join('') + teatroExtra.map(t => `
    <li>
      <span class="nm">${escapeHtml(t.nome)}</span>
      <span class="sub">quota teatro <b>${formatNumber(t.importo)}</b></span>
    </li>
  `).join('');
  return list;
}

function createParticipantMovimentoItem(m) {
  const saldoFinale = (m.credito_lasciato || 0) - (m.debito_lasciato || 0);
  const cls = saldoFinale > 0 ? 'cr' : saldoFinale < 0 ? 'db' : '';
  const word = saldoFinale > 0 ? 'credito' : saldoFinale < 0 ? 'debito' : 'saldato';

  const details = [`conto <b>${formatNumber(m.conto_produttore || 0)}</b>`, `pagato <b>${formatNumber(m.importo_saldato || 0)}</b>`];
  if (debitoPagato(m)) details.push(`salda debito <b>${formatNumber(debitoPagato(m))}</b>`);
  if (m.usa_credito) details.push(`usa credito <b>${formatNumber(m.usa_credito)}</b>`);
  if (m.teatro) details.push(`quota teatro <b>${formatNumber(m.teatro)}</b>`);

  return `
    <li>
      <span class="nm">${escapeHtml(m.nome)}</span>
      <span class="sub">${details.join(', ')}</span>
      <span class="esito ${cls}"><b>${saldoFinale ? formatSigned(saldoFinale) : '–'}</b><small>${word}</small></span>
      ${m.note ? `<span class="nota">${escapeHtml(m.note)}</span>` : ''}
    </li>
  `;
}

function toggleConsegnaCard(id) {
  if (expandedConsegnaId === id) {
    expandedConsegnaId = null;
  } else {
    expandedConsegnaId = id;
  }
  loadStorico();
}

// ===== UTILS =====

function formatDateItalianWithDay(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  const days = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const dayName = days[date.getDay()];

  return `${day}/${month}/${year} - ${dayName}`;
}

// ===== INITIALIZATION =====

document.addEventListener('DOMContentLoaded', async () => {
  await sessionReady; // "Riapri consegna" is admin-only
  loadStorico();
});
