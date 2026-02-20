// ===== STATE =====

let currentPage = 1;
let totalPages = 1;

// ===== DATA LOADING =====

async function loadLogs(page = 1) {
  try {
    const response = await fetch(`/api/logs?page=${page}&limit=15`);
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
    case 'movimento_historical': return '📜';
    case 'movimento_updated': return '✏️';
    case 'movimento_changed': return '✏️';
    case 'consegna_closed': return '🔒';
    case 'consegna_reopened': return '🔓';
    case 'consegna_deleted': return '🗑️';
    case 'user_created': return '👤';
    case 'user_edited': return '✏️';
    case 'user_deleted': return '🗑️';
    case 'password_changed': return '🔑';
    case 'saldo_updated': return '💰';
    default: return '•';
  }
}

function getEventDescription(event) {
  switch (event.event_type) {
    case 'movimento_created':
      return `Movimento creato per <strong>${escapeHtml(event.partecipante_nome)}</strong>`;
    case 'movimento_historical':
      return `Movimento storico per <strong>${escapeHtml(event.partecipante_nome)}</strong>`;
    case 'movimento_updated':
      return `Movimento modificato per <strong>${escapeHtml(event.partecipante_nome)}</strong>`;
    case 'consegna_closed':
      return `Consegna chiusa`;
    case 'consegna_reopened':
      return `Consegna riaperta`;
    case 'consegna_deleted':
      return `Consegna annullata`;
    case 'user_created':
      return `Utente creato`;
    case 'user_edited':
      return `Utente modificato: <strong>${escapeHtml(event.partecipante_nome || 'N/A')}</strong>`;
    case 'user_deleted':
      return `Utente eliminato`;
    case 'password_changed':
      return `Password cambiata`;
    case 'saldo_updated':
      return `Saldo modificato per <strong>${escapeHtml(event.partecipante_nome || 'N/A')}</strong>`;
    case 'movimento_changed':
      return `Movimento modificato per <strong>${escapeHtml(event.partecipante_nome || 'N/A')}</strong>`;
    default:
      return escapeHtml(event.event_type);
  }
}

function getEventDetails(event) {
  if (event.event_type === 'movimento_created' || event.event_type === 'movimento_updated' || event.event_type === 'movimento_historical') {
    const parts = [];
    if (event.conto_produttore) parts.push(`Conto: €${formatNumber(event.conto_produttore)}`);
    if (event.importo_saldato) parts.push(`Saldato: €${formatNumber(event.importo_saldato)}`);
    if (event.credito_lasciato) parts.push(`Cred: €${formatNumber(event.credito_lasciato)}`);
    if (event.debito_lasciato) parts.push(`Deb: €${formatNumber(event.debito_lasciato)}`);
    if (event.usa_credito) parts.push(`Usa Cred: €${formatNumber(event.usa_credito)}`);
    if (event.debito_saldato) parts.push(`Salda Deb: €${formatNumber(event.debito_saldato)}`);
    return parts.join(' | ') || (event.details || '-');
  }
  // User management events have details field
  if (event.details) {
    return event.details;
  }
  return '';
}

function createLogsTable(events) {
  const rows = events.map(e => {
    const icon = getEventIcon(e.event_type);
    const desc = getEventDescription(e);
    let details = getEventDetails(e);
    let consegnaData = e.consegna_data;

    // Extract consegna date from details field (for activity_logs entries)
    if (!consegnaData && e.details) {
      const match = e.details.match(/^consegna: (\d{4}-\d{2}-\d{2})(?:, (.*))?$/);
      if (match) {
        consegnaData = match[1];
        details = match[2] || '';
      }
    }

    return `
      <tr>
        <td>${formatTimestamp(e.event_time)}</td>
        <td>${icon}</td>
        <td>${formatDateItalian(consegnaData)}</td>
        <td>${desc}</td>
        <td class="details-cell">${escapeHtml(details)}</td>
        <td>${escapeHtml(e.user_name) || '-'}</td>
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
    container.innerHTML = `<span class="page-info">Totale: ${data.total} eventi</span>`;
    return;
  }

  container.innerHTML = `
    <button onclick="goToPage(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''}>
      &laquo; Precedente
    </button>
    <span class="page-info">Pagina ${currentPage} di ${totalPages} (${data.total} eventi)</span>
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
