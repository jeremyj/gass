// ===== STATE MANAGEMENT =====

let participants = [];
let expandedParticipantId = null;
let transactionsCache = {}; // Cache loaded transactions

// Calendar state now managed in calendar.js

// ===== CALENDAR AND DATE PICKER =====
// Calendar and date picker functions are now in calendar.js

// ===== RENDERING =====

function renderParticipants() {
  const container = document.getElementById('saldi-list');
  container.innerHTML = '';

  const list = visibleParticipants();
  if (list.length === 0) {
    container.innerHTML = '<p class="empty-state">Nessun partecipante</p>';
    return;
  }

  list.forEach(p => {
    const card = createParticipantCard(p);
    container.appendChild(card);
  });
}

function createParticipantCard(p) {
  const isExpanded = expandedParticipantId === p.id;
  const saldo = saldoLabel(p.saldo);
  const adminBadge = (p.is_admin ? '<span class="admin-badge">admin</span>' : '')
    + statoBadge(p.stato);

  const card = document.createElement('li');
  if (p.stato === 'disattivato') card.classList.add('off');
  const summary = `
    <span class="nm">${escapeHtml(p.nome)}${adminBadge}</span>
    <span class="sub">ultimo movimento ${formatDateItalian(p.ultima_modifica)}</span>
    ${p.teatro_residuo ? `<span class="sub"><span class="th-inline ${teatroLabel(p.teatro_residuo).cls}">teatro ${teatroLabel(p.teatro_residuo, p.teatro_anticipo_per).text}</span></span>` : ''}
    <span class="esito ${saldo.cls}"><b>${saldo.amount}</b><small>${saldo.word}</small></span>
  `;

  if (!isExpanded) {
    card.onclick = () => toggleParticipantCard(p.id);
    card.innerHTML = summary;
    return card;
  }

  card.classList.add('open');

  card.innerHTML = `
    <div class="saldo-header-expanded clickable" id="header-${p.id}">${summary}</div>
    <div class="saldo-transactions-section" id="transactions-${p.id}">
      <h3>Transazioni</h3>
      <div class="transactions-loading">Caricamento…</div>
    </div>
    <button class="btn btn-line btn-block" onclick="toggleParticipantCard(${p.id})">Chiudi</button>
  `;

  // Add click handler to header and load transactions after render
  setTimeout(() => {
    const header = document.getElementById(`header-${p.id}`);
    if (header) {
      header.addEventListener('click', () => toggleParticipantCard(p.id));
    }

    loadTransactions(p.id);
  }, 100);

  return card;
}

// ===== TRANSACTIONS =====

async function loadTransactions(participantId) {
  const container = document.getElementById(`transactions-${participantId}`);
  if (!container) return;

  // Use cache if available
  if (transactionsCache[participantId]) {
    renderTransactions(container, transactionsCache[participantId]);
    return;
  }

  try {
    const result = await API.get(`/api/participants/${participantId}/transactions`);
    transactionsCache[participantId] = result;
    renderTransactions(container, result);
  } catch (error) {
    container.innerHTML = `<h3>Transazioni</h3><p class="empty-state">Errore: ${escapeHtml(error.message)}</p>`;
  }
}

// The phone shows the latest transactions only, without credito usato / debito saldato: the computer has them all
const MOBILE_TRANSAZIONI = 12;

function renderTransactions(container, { transactions }) {
  if (transactions.length === 0) {
    container.innerHTML = '<h3>Transazioni</h3><p class="empty-state">Nessuna transazione</p>';
    return;
  }

  let html = '<h3>Transazioni</h3>';
  html += '<div class="transactions-list">';

  transactions.slice(0, MOBILE_TRANSAZIONI).forEach(t => {
    const saldo = saldoLabel(t.saldo_dopo);

    const details = [];
    if (t.tipo === 'rettifica') details.push(`rettifica manuale ${formatSigned(t.importo)}`);
    if (t.conto_produttore) details.push(`conto ${formatEuro(t.conto_produttore)}`);
    if (t.importo_saldato) details.push(`pagato ${formatEuro(t.importo_saldato)}`);
    if (t.teatro_importo) details.push(quotaTeatroHtml(t));

    html += `
      <div class="transaction-item">
        <div class="transaction-header">
          <span class="transaction-date">${formatDateItalian(t.data)}</span>
          <span class="transaction-effect ${saldo.cls}">${saldo.amount} ${saldo.word}</span>
        </div>
        <div class="transaction-details">${details.length > 0 ? details.join(', ') : 'nessun importo'}</div>
        ${t.note ? `<div class="transaction-note">${escapeHtml(t.note)}</div>` : ''}
      </div>
    `;
  });

  html += '</div>';
  html += '<p class="hint">Altri dettagli su movimenti di crediti e debiti sulla versione desktop.</p>';
  container.innerHTML = html;
}

// ===== CARD INTERACTION =====

// Saldi on the phone are read-only: the saldo is edited on the computer (Modifica utente)
function toggleParticipantCard(id) {
  expandedParticipantId = expandedParticipantId === id ? null : id;
  renderParticipants();
}

// ===== INITIALIZATION =====

document.addEventListener('DOMContentLoaded', async () => {
  await sessionReady;
  setDateDisplay(toLocalDateString());
  loadParticipants();
});
