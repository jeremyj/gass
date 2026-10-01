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
    container.innerHTML = '<p>Nessuna consegna registrata</p>';
    return;
  }

  storico.forEach(consegna => {
    const section = createConsegnaSection(consegna);
    container.appendChild(section);
  });
}

function createConsegnaSection(consegna) {
  const section = document.createElement('section');
  section.className = 'storico-section';

  section.innerHTML = `
    <div class="storico-header">
      <h2>${formatDateLong(consegna.data)}</h2>
      <span class="stato-label ${consegna.chiusa ? 'chiusa' : 'aperta'}">${consegna.chiusa ? 'Chiusa' : 'Aperta'}</span>
      <span class="storico-meta">${(consegna.movimenti?.length || 0) === 1 ? '1 movimento' : `${consegna.movimenti?.length || 0} movimenti`}</span>
      <span class="storico-acts">${storicoActionsHtml(consegna)}</span>
    </div>
  `;

  const content = document.createElement('div');
  content.className = 'd-grid';
  content.appendChild(createCassaSummary(consegna));

  const movimenti = document.createElement('div');
  if (consegna.movimenti?.length || consegna.teatro_extra?.length) {
    movimenti.appendChild(createMovimentiTable(consegna.movimenti || [], consegna.teatro_extra || []));
  }
  content.appendChild(movimenti);

  section.appendChild(content);
  return section;
}

// Same sum as the consegna page: trovato + incassato − pagato = lasciato
function createCassaSummary(consegna) {
  const incassato = (consegna.movimenti || []).reduce((sum, m) => sum + (m.importo_saldato || 0), 0);
  const summary = document.createElement('div');
  summary.className = 'cassa-v';
  summary.innerHTML = `
    <p><label>Trovato in cassa</label><output>${formatNumber(consegna.trovato_in_cassa)}</output></p>
    <p><label>+ Incassato</label><output>${formatNumber(roundToCents(incassato))}</output></p>
    <p><label>− Pagato al produttore</label><output>${formatNumber(consegna.pagato_produttore)}</output></p>
    <p class="tot"><label>= Lasciato in cassa</label><output>${formatNumber(consegna.lasciato_in_cassa)}</output></p>
    ${consegna.note ? `<div class="nt">Note: <i>${escapeHtml(consegna.note)}</i></div>` : ''}
  `;
  return summary;
}

// Zeros render as "–" so the real figures stand out
function numCell(value, cls = '') {
  return value ? `<td class="${cls}">${formatNumber(value)}</td>` : '<td class="mute">–</td>';
}

// teatroExtra: quote teatro paid by people with no movimento in this consegna
function createMovimentiTable(movimenti, teatroExtra) {
  const sum = fn => roundToCents(movimenti.reduce((acc, m) => acc + (fn(m) || 0), 0));
  const teatroTot = roundToCents(sum(m => m.teatro) + teatroExtra.reduce((acc, t) => acc + t.importo, 0));

  const rows = movimenti.map(m => `
    <tr>
      <td class="nm">${escapeHtml(m.nome)}</td>
      ${numCell(m.conto_produttore)}
      ${numCell(m.importo_saldato)}
      ${m.credito_lasciato ? `<td class="cr">+${formatNumber(m.credito_lasciato)}</td>` : '<td class="mute">–</td>'}
      ${debitoNuovo(m) ? `<td class="db">−${formatNumber(debitoNuovo(m))}</td>` : '<td class="mute">–</td>'}
      ${numCell(m.usa_credito)}
      ${numCell(debitoPagato(m))}
      ${numCell(m.teatro)}
      <td class="nt">${escapeHtml(m.note)}</td>
    </tr>
  `).join('') + teatroExtra.map(t => `
    <tr>
      <td class="nm">${escapeHtml(t.nome)}</td>
      ${'<td class="mute">–</td>'.repeat(6)}
      ${numCell(t.importo)}
      <td class="nt"></td>
    </tr>
  `).join('');

  const table = document.createElement('table');
  table.className = 't';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Partecipante</th>
        <th>Conto produttore</th>
        <th>Importo saldato</th>
        <th>Lascia credito</th>
        <th>Lascia debito</th>
        <th>Usa credito</th>
        <th>Salda debito</th>
        <th>Quota teatro</th>
        <th class="nt">Note</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr>
        <td>Totale</td>
        ${numCell(sum(m => m.conto_produttore))}
        ${numCell(sum(m => m.importo_saldato))}
        ${numCell(sum(m => m.credito_lasciato))}
        ${numCell(sum(debitoNuovo))}
        ${numCell(sum(m => m.usa_credito))}
        ${numCell(sum(debitoPagato))}
        ${numCell(teatroTot)}
        <td></td>
      </tr>
    </tfoot>
  `;
  return table;
}

// ===== INITIALIZATION =====

document.addEventListener('DOMContentLoaded', async () => {
  await sessionReady; // "Riapri consegna" is admin-only
  loadStorico();
});
