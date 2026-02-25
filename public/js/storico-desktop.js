// ===== DATA LOADING =====

async function loadStorico() {
  try {
    const response = await fetch('/api/storico/dettaglio');
    const result = await response.json();

    if (result.success) {
      renderStorico(result.storico);
    } else {
      showStatus('Errore: ' + result.error, 'error');
    }
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

  storico.forEach((consegna, index) => {
    const section = createConsegnaSection(consegna, index, storico);
    container.appendChild(section);
  });
}

function createConsegnaSection(consegna, index, storico) {
  const section = document.createElement('div');
  section.className = 'section storico-section';

  const header = createConsegnaHeader(consegna);
  section.appendChild(header);

  const content = document.createElement('div');
  content.className = 'storico-content';

  const cassaSummary = createCassaSummary(consegna);
  content.appendChild(cassaSummary);

  if (consegna.movimenti && consegna.movimenti.length > 0) {
    const movimentiTable = createMovimentiTable(consegna.movimenti);
    content.appendChild(movimentiTable);
  }

  section.appendChild(content);
  return section;
}

function createConsegnaHeader(consegna) {
  const header = document.createElement('div');
  header.className = 'storico-header';

  const statusClass = consegna.chiusa ? 'status-closed' : 'status-open';
  const statusText = consegna.chiusa ? 'Chiusa' : 'Aperta';
  const statusIcon = consegna.chiusa ? '🔒' : '🔓';

  header.innerHTML = `
    <div class="storico-header-left">
      <span class="storico-date">${formatDateItalian(consegna.data)}</span>
      <span class="storico-status ${statusClass}">${statusIcon} ${statusText}</span>
    </div>
    <div class="storico-header-right">
      <span class="storico-summary-mini">
        ${consegna.movimenti?.length || 0} movimenti
      </span>
    </div>
  `;

  return header;
}

function createCassaSummary(consegna) {
  const summary = document.createElement('div');
  summary.className = 'storico-cassa-summary';
  summary.innerHTML = `
    <div class="cassa-item">
      <span class="cassa-label">Trovato</span>
      <span class="cassa-value">€${formatNumber(consegna.trovato_in_cassa)}</span>
    </div>
    <div class="cassa-item">
      <span class="cassa-label">Pagato Produttore</span>
      <span class="cassa-value cassa-negative">€${formatNumber(consegna.pagato_produttore)}</span>
    </div>
    <div class="cassa-item">
      <span class="cassa-label">Lasciato</span>
      <span class="cassa-value ${consegna.lasciato_in_cassa >= 0 ? 'cassa-positive' : 'cassa-negative'}">€${formatNumber(consegna.lasciato_in_cassa)}</span>
    </div>
  `;
  return summary;
}

function createMovimentiTable(movimenti) {
  // Calculate totals
  const totals = movimenti.reduce((acc, m) => ({
    conto: acc.conto + (m.conto_produttore || 0),
    saldato: acc.saldato + (m.importo_saldato || 0),
    credito: acc.credito + (m.credito_lasciato || 0),
    debito: acc.debito + (m.debito_lasciato || 0),
    usaCredito: acc.usaCredito + (m.usa_credito || 0),
    saldaDebito: acc.saldaDebito + (m.debito_saldato || 0)
  }), { conto: 0, saldato: 0, credito: 0, debito: 0, usaCredito: 0, saldaDebito: 0 });

  const rows = movimenti.map(m => `
    <tr>
      <td class="col-nome">${escapeHtml(m.nome)}</td>
      <td class="col-num">${m.conto_produttore ? '€' + formatNumber(m.conto_produttore) : '-'}</td>
      <td class="col-num">${m.importo_saldato ? '€' + formatNumber(m.importo_saldato) : '-'}</td>
      <td class="col-num col-credito">${m.credito_lasciato ? '€' + formatNumber(m.credito_lasciato) : '-'}</td>
      <td class="col-num col-debito">${m.debito_lasciato ? '€' + formatNumber(m.debito_lasciato) : '-'}</td>
      <td class="col-num col-credito">${m.usa_credito ? '€' + formatNumber(m.usa_credito) : '-'}</td>
      <td class="col-num col-debito">${m.debito_saldato ? '€' + formatNumber(m.debito_saldato) : '-'}</td>
      <td class="col-note">${escapeHtml(m.note)}</td>
    </tr>
  `).join('');

  const totalsRow = `
    <tr class="totals-row">
      <td class="col-nome"><strong>Totale</strong></td>
      <td class="col-num"><strong>€${formatNumber(totals.conto)}</strong></td>
      <td class="col-num"><strong>€${formatNumber(totals.saldato)}</strong></td>
      <td class="col-num col-credito"><strong>${totals.credito ? '€' + formatNumber(totals.credito) : '-'}</strong></td>
      <td class="col-num col-debito"><strong>${totals.debito ? '€' + formatNumber(totals.debito) : '-'}</strong></td>
      <td class="col-num col-credito"><strong>${totals.usaCredito ? '€' + formatNumber(totals.usaCredito) : '-'}</strong></td>
      <td class="col-num col-debito"><strong>${totals.saldaDebito ? '€' + formatNumber(totals.saldaDebito) : '-'}</strong></td>
      <td class="col-note"></td>
    </tr>
  `;

  const table = document.createElement('table');
  table.className = 'storico-movimenti-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th class="col-nome">Partecipante</th>
        <th class="col-num">Conto</th>
        <th class="col-num">Saldato</th>
        <th class="col-num">Lascia Credito</th>
        <th class="col-num">Lascia Debito</th>
        <th class="col-num">Usa Credito</th>
        <th class="col-num">Salda Debito</th>
        <th class="col-note">Note</th>
      </tr>
    </thead>
    <tbody>${rows}${totalsRow}</tbody>
  `;
  return table;
}

// ===== DELETE =====

async function deleteConsegna(id) {
  if (!confirm('Sei sicuro di voler eliminare questa consegna?')) {
    return;
  }

  showStatus('Eliminazione in corso...', 'success');

  try {
    const response = await fetch(`/api/consegna/${id}`, {
      method: 'DELETE',
    });

    const result = await response.json();

    if (result.success) {
      showStatus('Consegna eliminata con successo!', 'success');
      loadStorico();
    } else {
      showStatus('Errore: ' + result.error, 'error');
    }
  } catch (error) {
    showStatus('Errore durante l\'eliminazione: ' + error.message, 'error');
  }
}

// ===== INITIALIZATION =====

document.addEventListener('DOMContentLoaded', () => {
  loadStorico();
});
