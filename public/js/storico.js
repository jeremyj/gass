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
    if (months[months.length - 1]?.key !== key) months.push({ key, label: `${capitalize(monthName(c.data))} ${c.data.slice(0, 4)}`, items: [] });
    months[months.length - 1].items.push(c);
  });
  container.innerHTML = storicoHint('Tocca') + months.map(m => `
    <h2 class="storico-month">${m.label}</h2>
    <ul class="mov-list">${m.items.map(consegnaRowHtml).join('')}</ul>
  `).join('');
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// The month heading already says month and year
function dayLabel(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric' });
}

function consegnaRowHtml(c) {
  const persone = c.num_movimenti === 1 ? '1 persona' : `${c.num_movimenti} persone`;
  const stato = c.chiusa ? 'chiusa' : 'aperta';
  return `
    <li onclick="openConsegnaOn('${c.data}')">
      <span class="nm">${storicoDateLink(c.data, dayLabel(c.data))}</span>
      <span class="sub"><span class="stato-label ${stato}">${stato}</span>, ${persone}${c.teatro ? `, quota teatro <b>${formatNumber(c.teatro)}</b>` : ''}</span>
      <span class="esito${c.lasciato_in_cassa < 0 ? ' db' : ''}"><b>${formatCassa(c.lasciato_in_cassa)} €</b><small>in cassa</small></span>
      ${c.num_scontrini ? `<span class="sub">${galleriaLink(c)}</span>` : ''}
    </li>
  `;
}

document.addEventListener('DOMContentLoaded', async () => {
  await sessionReady; // the hint mentions reopening to admins only
  loadStorico();
});
