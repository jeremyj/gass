// ===== STATE =====

let currentPage = 1;
let totalPages = 1;

// ===== DATA LOADING =====

async function loadLogs(page = 1) {
  try {
    const response = await fetch(`/api/logs?page=${page}&limit=50`);
    const result = await response.json();

    if (result.success) {
      currentPage = result.page;
      totalPages = result.totalPages;
      renderLogs(result.events);
      renderPagination(result);
    } else {
      showStatus('Errore: ' + result.error, 'error');
    }
  } catch (error) {
    showStatus('Errore: ' + error.message, 'error');
  }
}

// ===== RENDERING =====

function renderLogs(events) {
  const container = document.getElementById('logs-container');
  container.innerHTML = '';

  if (events.length === 0) {
    container.innerHTML = '<p>Nessuna attivita registrata</p>';
    return;
  }

  const table = createLogsTable(events);
  container.appendChild(table);
}

function getEventIcon(eventType) {
  switch (eventType) {
    case 'movimento_created': return '➕';
    case 'movimento_updated': return '✏️';
    case 'consegna_closed': return '🔒';
    case 'consegna_reopened': return '🔓';
    case 'saldo_updated': return '💰';
    default: return '•';
  }
}

function getEventDescription(event) {
  switch (event.event_type) {
    case 'movimento_created':
      return `Movimento creato per <strong>${event.partecipante_nome}</strong>`;
    case 'movimento_updated':
      return `Movimento modificato per <strong>${event.partecipante_nome}</strong>`;
    case 'consegna_closed':
      return `Consegna chiusa`;
    case 'consegna_reopened':
      return `Consegna riaperta`;
    case 'saldo_updated':
      return `Saldo modificato per <strong>${event.partecipante_nome}</strong>`;
    default:
      return event.event_type;
  }
}

function getEventDetails(event) {
  if (event.event_type === 'movimento_created' || event.event_type === 'movimento_updated') {
    const parts = [];
    if (event.conto_produttore) parts.push(`Conto: €${formatNumber(event.conto_produttore)}`);
    if (event.importo_saldato) parts.push(`Saldato: €${formatNumber(event.importo_saldato)}`);
    if (event.credito_lasciato) parts.push(`Cred: €${formatNumber(event.credito_lasciato)}`);
    if (event.debito_lasciato) parts.push(`Deb: €${formatNumber(event.debito_lasciato)}`);
    if (event.usa_credito) parts.push(`Usa Cred: €${formatNumber(event.usa_credito)}`);
    if (event.debito_saldato) parts.push(`Salda Deb: €${formatNumber(event.debito_saldato)}`);
    return parts.join(' | ') || '-';
  }
  if (event.event_type === 'saldo_updated') {
    return `Nuovo saldo: €${formatNumber(event.saldo)}`;
  }
  return '';
}

function createLogsTable(events) {
  const rows = events.map(e => {
    const icon = getEventIcon(e.event_type);
    const desc = getEventDescription(e);
    const details = getEventDetails(e);

    return `
      <tr>
        <td>${formatTimestamp(e.event_time)}</td>
        <td>${icon}</td>
        <td>${formatDateItalian(e.consegna_data)}</td>
        <td>${desc}</td>
        <td class="details-cell">${details}</td>
        <td>${e.user_name || '-'}</td>
      </tr>
    `;
  }).join('');

  const table = document.createElement('table');
  table.className = 'logs-table activity-log';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Quando</th>
        <th></th>
        <th>Consegna</th>
        <th>Azione</th>
        <th>Dettagli</th>
        <th>Utente</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  `;
  return table;
}

function formatTimestamp(isoString) {
  if (!isoString) return '-';
  const date = new Date(isoString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

function renderPagination(data) {
  const container = document.getElementById('pagination');

  if (data.totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <button onclick="goToPage(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''}>
      &laquo; Precedente
    </button>
    <span class="page-info">Pagina ${currentPage} di ${totalPages}</span>
    <button onclick="goToPage(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''}>
      Successiva &raquo;
    </button>
  `;
}

function goToPage(page) {
  if (page >= 1 && page <= totalPages) {
    loadLogs(page);
  }
}

// ===== INITIALIZATION =====

document.addEventListener('DOMContentLoaded', () => {
  loadLogs();
});
