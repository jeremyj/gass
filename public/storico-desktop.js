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

  const header = createConsegnaHeader(consegna, index, storico);
  const infoTable = createInfoTable(consegna);

  section.appendChild(header);
  section.appendChild(infoTable);

  if (consegna.movimenti && consegna.movimenti.length > 0) {
    const movimentiTitle = createMovimentiTitle();
    const movimentiTable = createMovimentiTable(consegna.movimenti);
    section.appendChild(movimentiTitle);
    section.appendChild(movimentiTable);
  }

  return section;
}

function createConsegnaHeader(consegna, index, storico) {
  const header = document.createElement('div');
  header.className = 'storico-header';

  const discrepanzaWarning = calculateDiscrepanzaWarning(consegna, index, storico);

  header.innerHTML = `
    <div>
      <h3 class="storico-date">Data: ${formatDateItalian(consegna.data)}</h3>
      ${discrepanzaWarning}
    </div>
  `;

  return header;
}

function calculateDiscrepanzaWarning(consegna, index, storico) {
  let warning = '';

  // Discrepanza Cassa Lasciata
  if (consegna.discrepanza_cassa === 1) {
    const lasciatoCalcolato = consegna.trovato_in_cassa - consegna.pagato_produttore;
    const discrepanzaImporto = consegna.lasciato_in_cassa - lasciatoCalcolato;

    const segno = discrepanzaImporto >= 0 ? '+' : '';
    const className = discrepanzaImporto >= 0 ? 'discrepanza-positive' : 'discrepanza-negative';
    warning = `<span class="discrepanza-warning ${className}">⚠️ DISCREPANZA CASSA LASCIATA ${segno}€${discrepanzaImporto.toFixed(2)}</span>`;
  }

  // Discrepanza Cassa Trovata
  if (consegna.discrepanza_trovata === 1 && index < storico.length - 1) {
    const consegnaPrecedente = storico[index + 1];
    const discrepanzaTrovata = consegna.trovato_in_cassa - consegnaPrecedente.lasciato_in_cassa;

    if (Math.abs(discrepanzaTrovata) > 0.01) {
      const segno = discrepanzaTrovata >= 0 ? '+' : '';
      const className = discrepanzaTrovata >= 0 ? 'discrepanza-positive' : 'discrepanza-negative';
      warning += `<span class="discrepanza-warning ${className}">⚠️ DISCREPANZA CASSA TROVATA ${segno}€${discrepanzaTrovata.toFixed(2)}</span>`;
    }
  }

  return warning;
}

function createInfoTable(consegna) {
  const table = document.createElement('table');
  table.className = 'storico-info-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Trovato in Cassa</th>
        <th>Pagato Produttore</th>
        <th>Lasciato in Cassa</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>€${consegna.trovato_in_cassa.toFixed(2)}</td>
        <td>€${consegna.pagato_produttore.toFixed(2)}</td>
        <td>€${consegna.lasciato_in_cassa.toFixed(2)}</td>
      </tr>
    </tbody>
  `;
  return table;
}

function createMovimentiTitle() {
  const title = document.createElement('h4');
  title.className = 'storico-movimenti-title';
  title.textContent = 'Movimenti Partecipanti';
  return title;
}

function createMovimentiTable(movimenti) {
  const rows = movimenti.map((m, idx) => {
    return `
      <tr>
        <td><strong>${m.nome}</strong></td>
        <td>${m.importo_saldato ? '€' + m.importo_saldato.toFixed(2) : ''}</td>
        <td>${m.usa_credito ? '€' + m.usa_credito.toFixed(2) : ''}</td>
        <td>${m.debito_lasciato ? '€' + m.debito_lasciato.toFixed(2) : ''}</td>
        <td>${m.credito_lasciato ? '€' + m.credito_lasciato.toFixed(2) : ''}</td>
        <td>${m.debito_saldato ? '€' + m.debito_saldato.toFixed(2) : ''}</td>
        <td>${m.note || ''}</td>
      </tr>
    `;
  }).join('');

  const table = document.createElement('table');
  table.className = 'storico-movimenti-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Nome</th>
        <th>Importo Saldato</th>
        <th>Usa Credito</th>
        <th>Debito Lasciato</th>
        <th>Credito Lasciato</th>
        <th>Salda Debito</th>
        <th>Note</th>
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
