// ===== STORICO: one row per consegna, opening it on the Consegna page =====

async function loadStorico() {
  try {
    const result = await API.get('/api/storico');
    renderStorico(result.consegne);
  } catch (error) {
    showStatus('Errore: ' + error.message, 'error');
  }
}

// Grouped by month, newest first (the API sorts by date DESC)
function renderStorico(consegne) {
  const container = document.getElementById('storico-list');
  if (!consegne.length) {
    container.innerHTML = '<p class="empty-state">Nessuna consegna registrata</p>';
    return;
  }
  const months = [];
  consegne.forEach(c => {
    const key = c.data.slice(0, 7);
    if (months[months.length - 1]?.key !== key) months.push({ key, label: `${monthName(c.data)} ${c.data.slice(0, 4)}`, items: [] });
    months[months.length - 1].items.push(c);
  });
  container.innerHTML = '<p class="hint hint-top">Tocca una consegna per vederne il dettaglio.</p>' + months.map(m => `
    <h2 class="storico-month">${m.label}</h2>
    <ul class="mov-list">${m.items.map(consegnaRowHtml).join('')}</ul>
  `).join('');
}

function consegnaRowHtml(c) {
  const persone = c.num_movimenti === 1 ? '1 persona' : `${c.num_movimenti} persone`;
  const stato = c.chiusa ? 'chiusa' : 'aperta';
  return `
    <li onclick="openConsegnaOn('${c.data}')">
      <span class="nm">${formatDateLong(c.data)}</span>
      <span class="sub"><span class="stato-label ${stato}">${stato}</span> ${persone}${c.teatro ? `, quota teatro <b>${formatNumber(c.teatro)}</b>` : ''}</span>
      <span class="esito"><b>${formatEuro(c.lasciato_in_cassa)}</b><small>in cassa</small></span>
      <span class="sub storico-acts">${storicoActionsHtml(c)}<span class="det">Dettaglio ›</span></span>
    </li>
  `;
}

document.addEventListener('DOMContentLoaded', async () => {
  await sessionReady; // "Riapri consegna" is admin-only
  loadStorico();
});
