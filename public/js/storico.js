// ===== STATE =====

let expandedConsegnaId = null;

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
    container.innerHTML = '<p style="text-align: center; padding: 20px;">Nessuna consegna registrata</p>';
    return;
  }

  storico.forEach((consegna) => {
    const card = createConsegnaCard(consegna);
    container.appendChild(card);
  });
}

function createConsegnaCard(consegna) {
  const isExpanded = expandedConsegnaId === consegna.id;
  const card = document.createElement('div');
  card.className = 'storico-consegna-card';
  if (isExpanded) {
    card.classList.add('expanded');
  }

  // Header (sempre visibile)
  const header = document.createElement('div');
  header.className = 'storico-consegna-header';
  header.onclick = () => toggleConsegnaCard(consegna.id);

  const dateObj = new Date(consegna.data + 'T00:00:00');
  const dateFormatted = formatDateItalianWithDay(consegna.data);
  const arrow = isExpanded ? '▲' : '▼';

  header.innerHTML = `
    <div class="storico-consegna-date">
      📦 ${dateFormatted}
    </div>
    <span class="storico-arrow">${arrow}</span>
  `;

  card.appendChild(header);

  // Content (espandibile)
  if (isExpanded) {
    const content = document.createElement('div');
    content.className = 'storico-consegna-content';

    // Sezione CASSA
    const cassaSection = createCassaSection(consegna);
    content.appendChild(cassaSection);

    // Sezione MOVIMENTI
    if (consegna.movimenti && consegna.movimenti.length > 0) {
      const movimentiSection = createMovimentiSection(consegna.movimenti);
      content.appendChild(movimentiSection);
    }

    card.appendChild(content);
  }

  return card;
}

function createCassaSection(consegna) {
  const section = document.createElement('div');
  section.className = 'storico-cassa-section';

  // TROVATO IN CASSA
  const trovatoDiv = document.createElement('div');
  trovatoDiv.className = 'storico-cassa-item';
  trovatoDiv.innerHTML = `
    <div class="storico-cassa-label">TROVATO IN CASSA</div>
    <div class="storico-cassa-value">
      ${formatNumber(consegna.trovato_in_cassa)} €
    </div>
  `;
  section.appendChild(trovatoDiv);

  // PAGATO PRODUTTORE
  const pagatoDiv = document.createElement('div');
  pagatoDiv.className = 'storico-cassa-item';
  pagatoDiv.innerHTML = `
    <div class="storico-cassa-label">PAGATO PRODUTTORE</div>
    <div class="storico-cassa-value">
      ${formatNumber(consegna.pagato_produttore)} €
    </div>
  `;
  section.appendChild(pagatoDiv);

  // LASCIATO IN CASSA
  const lasciatoDiv = document.createElement('div');
  lasciatoDiv.className = 'storico-cassa-item';
  lasciatoDiv.innerHTML = `
    <div class="storico-cassa-label">LASCIATO IN CASSA</div>
    <div class="storico-cassa-value lasciato">
      ${formatNumber(consegna.lasciato_in_cassa)} €
    </div>
  `;
  section.appendChild(lasciatoDiv);

  return section;
}

function createMovimentiSection(movimenti) {
  const section = document.createElement('div');
  section.className = 'storico-movimenti-section';

  const title = document.createElement('div');
  title.className = 'storico-movimenti-title';
  title.innerHTML = `👥 MOVIMENTI`;
  section.appendChild(title);

  movimenti.forEach(m => {
    const card = createParticipantMovimentoCard(m);
    section.appendChild(card);
  });

  return section;
}

function createParticipantMovimentoCard(m) {
  const card = document.createElement('div');

  // Calcola saldo finale
  const saldoFinale = (m.credito_lasciato || 0) - (m.debito_lasciato || 0);

  let cardClass = 'storico-participant-card';
  let saldoBadgeClass = 'storico-saldo-badge';
  let saldoText = '0.00 €';

  if (saldoFinale > 0) {
    cardClass += ' credito';
    saldoBadgeClass += ' credito';
    saldoText = `+${formatNumber(saldoFinale)} €`;
  } else if (saldoFinale < 0) {
    cardClass += ' debito';
    saldoBadgeClass += ' debito';
    saldoText = `${formatNumber(saldoFinale)} €`;
  } else {
    cardClass += ' pari';
    saldoBadgeClass += ' pari';
    saldoText = '0 €';
  }

  card.className = cardClass;

  const noteIcon = m.note ? ` <span class="note-icon" style="cursor: pointer;">ℹ️</span>` : '';

  card.innerHTML = `
    <div class="storico-participant-header">
      <div class="storico-participant-name">👤 ${escapeHtml(m.nome)}${noteIcon}</div>
    </div>
    <div class="storico-participant-details">
      ${m.conto_produttore ? `Conto: ${formatNumber(m.conto_produttore)} €` : ''}
      ${m.importo_saldato ? ` • Pagato: ${formatNumber(m.importo_saldato)} €` : ''}
      ${m.debito_saldato ? ` • Salda debito: ${formatNumber(m.debito_saldato)} €` : ''}
      ${m.usa_credito ? ` • Usa credito: ${formatNumber(m.usa_credito)} €` : ''}
      ${!m.conto_produttore && !m.importo_saldato && !m.usa_credito && !m.debito_saldato ? 'Pari' : ''}
    </div>
    ${m.note ? `<div class="storico-participant-note" style="display: none; padding: 8px; background: #fff3cd; border-radius: 4px; margin-top: 8px; font-size: 13px;">📝 ${escapeHtml(m.note)}</div>` : ''}
  `;

  // Add click handler for note icon
  if (m.note) {
    const noteIconEl = card.querySelector('.note-icon');
    const noteDiv = card.querySelector('.storico-participant-note');
    if (noteIconEl && noteDiv) {
      noteIconEl.addEventListener('click', (e) => {
        e.stopPropagation();
        noteDiv.style.display = noteDiv.style.display === 'none' ? 'block' : 'none';
      });
    }
  }

  return card;
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

document.addEventListener('DOMContentLoaded', () => {
  loadStorico();
});
