// ===== DATA LOADING =====

async function loadStorico() {
  showStatus('Caricamento in corso...', 'success');

  try {
    const response = await fetch('/api/storico/dettaglio');
    const result = await response.json();

    if (result.success) {
      renderStorico(result.storico);
      showStatus('Storico caricato con successo!', 'success');
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
  section.className = 'storico-card';

  const header = createConsegnaHeader(consegna, index, storico);
  const content = document.createElement('div');
  content.className = 'storico-card-content';

  const infoTable = createInfoTable(consegna);
  content.appendChild(infoTable);

  if (consegna.movimenti && consegna.movimenti.length > 0) {
    const movimentiTitle = createMovimentiTitle();
    const movimentiTable = createMovimentiTable(consegna.movimenti);
    content.appendChild(movimentiTitle);
    content.appendChild(movimentiTable);
  }

  section.appendChild(header);
  section.appendChild(content);

  return section;
}

function createConsegnaHeader(consegna, index, storico) {
  const header = document.createElement('div');
  header.className = 'storico-card-header';

  const discrepanzaWarning = calculateDiscrepanzaWarning(consegna, index, storico);

  header.innerHTML = `
    <div>
      <div class="storico-date">${formatDateItalian(consegna.data)}</div>
      ${discrepanzaWarning ? `<div class="storico-warning">${discrepanzaWarning}</div>` : ''}
    </div>
    <button class="btn-delete-storico" onclick="deleteConsegna(${consegna.id})">Elimina</button>
  `;

  return header;
}

function calculateDiscrepanzaWarning(consegna, index, storico) {
  const warnings = [];

  // Discrepanza Cassa Lasciata
  if (consegna.discrepanza_cassa === 1) {
    const lasciatoCalcolato = consegna.trovato_in_cassa - consegna.pagato_produttore;
    const discrepanzaImporto = consegna.lasciato_in_cassa - lasciatoCalcolato;

    const segno = discrepanzaImporto >= 0 ? '+' : '';
    const color = discrepanzaImporto >= 0 ? '#2e7d32' : '#d32f2f';
    warnings.push(`<span style="color: ${color};">⚠️ CASSA LASCIATA ${segno}€${discrepanzaImporto.toFixed(2)}</span>`);
  }

  // Discrepanza Cassa Trovata
  if (consegna.discrepanza_trovata === 1 && index < storico.length - 1) {
    const consegnaPrecedente = storico[index + 1];
    const discrepanzaTrovata = consegna.trovato_in_cassa - consegnaPrecedente.lasciato_in_cassa;

    if (Math.abs(discrepanzaTrovata) > 0.01) {
      const segno = discrepanzaTrovata >= 0 ? '+' : '';
      const color = discrepanzaTrovata >= 0 ? '#2e7d32' : '#d32f2f';
      warnings.push(`<span style="color: ${color};">⚠️ CASSA TROVATA ${segno}€${discrepanzaTrovata.toFixed(2)}</span>`);
    }
  }

  return warnings.join('<br>');
}

function createInfoTable(consegna) {
  // Build HTML for each value with override indicator if needed
  const trovatoHtml = consegna.discrepanza_trovata === 1
    ? `<span class="consegna-info-value has-override">€${consegna.trovato_in_cassa.toFixed(2)}<span class="override-indicator">MANUALE</span></span>`
    : `€${consegna.trovato_in_cassa.toFixed(2)}`;

  const pagatoHtml = consegna.discrepanza_pagato === 1
    ? `<span class="consegna-info-value has-override">€${consegna.pagato_produttore.toFixed(2)}<span class="override-indicator">MANUALE</span></span>`
    : `€${consegna.pagato_produttore.toFixed(2)}`;

  const lasciatoHtml = consegna.discrepanza_cassa === 1
    ? `<span class="consegna-info-value has-override">€${consegna.lasciato_in_cassa.toFixed(2)}<span class="override-indicator">MANUALE</span></span>`
    : `€${consegna.lasciato_in_cassa.toFixed(2)}`;

  const table = document.createElement('table');
  table.className = 'storico-info-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Trovato</th>
        <th>Pagato</th>
        <th>Lasciato</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${trovatoHtml}</td>
        <td>${pagatoHtml}</td>
        <td>${lasciatoHtml}</td>
      </tr>
    </tbody>
  `;
  return table;
}

function createMovimentiTitle() {
  const title = document.createElement('div');
  title.className = 'storico-movimenti-title';
  title.textContent = 'Movimenti Partecipanti';
  return title;
}

function createMovimentiTable(movimenti) {
  const rows = movimenti.map((m) => {
    return `
      <tr>
        <td><strong>${m.nome}</strong></td>
        <td>${m.importo_saldato ? '€' + m.importo_saldato.toFixed(2) : '-'}</td>
        <td>${m.usa_credito ? '€' + m.usa_credito.toFixed(2) : '-'}</td>
        <td>${m.debito_lasciato ? '€' + m.debito_lasciato.toFixed(2) : '-'}</td>
        <td>${m.credito_lasciato ? '€' + m.credito_lasciato.toFixed(2) : '-'}</td>
        <td>${m.debito_saldato ? '€' + m.debito_saldato.toFixed(2) : '-'}</td>
      </tr>
    `;
  }).join('');

  const table = document.createElement('table');
  table.className = 'storico-movimenti-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Nome</th>
        <th>Saldato</th>
        <th>Credito</th>
        <th>Deb.Lasc</th>
        <th>Cred.Lasc</th>
        <th>Deb.Sald</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
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
