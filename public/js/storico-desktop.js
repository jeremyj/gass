// ===== STORICO: one row per consegna, opening it on the Consegna page =====

async function loadStorico() {
  try {
    const result = await API.get('/api/storico');
    renderStorico(result.consegne);
  } catch (error) {
    showStatus('Errore: ' + error.message, 'error');
  }
}

// Zeros render as "–" so the real figures stand out
function numCell(value) {
  return value ? `<td>${formatNumber(value)}</td>` : '<td class="mute">–</td>';
}

// Negative cassa in the debito colour, as on the Consegna page
function cassaCell(value, bold = false) {
  const text = bold ? `<b>${formatCassa(value)}</b>` : formatCassa(value);
  return `<td${value < 0 ? ' class="db"' : ''}>${text}</td>`;
}

function renderStorico(consegne) {
  const container = document.getElementById('storico-list');
  if (!consegne.length) {
    container.innerHTML = '<p>Nessuna consegna registrata</p>';
    return;
  }
  container.innerHTML = `
    ${storicoHint('Clic su')}
    <table class="t">
      <thead>
        <tr>
          <th>Consegna</th><th class="left">Stato</th><th>Persone</th><th>Trovato</th><th>Incassato</th>
          <th>Pagato</th><th>In cassa</th><th>Quota teatro</th><th>Scontrini</th>
        </tr>
      </thead>
      <tbody>${consegne.map(c => `
        <tr class="clickable" onclick="openConsegnaOn('${c.data}')">
          <td class="nm">${storicoDateLink(c.data, formatDateLong(c.data))}</td>
          <td class="left"><span class="stato-label ${c.chiusa ? 'chiusa' : 'aperta'}">${c.chiusa ? 'Chiusa' : 'Aperta'}</span></td>
          <td>${c.num_movimenti}</td>
          ${cassaCell(c.trovato_in_cassa)}
          <td>${formatNumber(c.incassato)}</td>
          <td>${formatNumber(c.pagato_produttore)}</td>
          ${cassaCell(c.lasciato_in_cassa, true)}
          ${numCell(c.teatro)}
          ${c.num_scontrini ? `<td>${galleriaLink(c)}</td>` : '<td class="mute">–</td>'}
        </tr>`).join('')}
      </tbody>
    </table>
  `;
}

document.addEventListener('DOMContentLoaded', async () => {
  await sessionReady; // the hint mentions reopening to admins only
  loadStorico();
});
