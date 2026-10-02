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

function renderStorico(consegne) {
  const container = document.getElementById('storico-list');
  if (!consegne.length) {
    container.innerHTML = '<p>Nessuna consegna registrata</p>';
    return;
  }
  container.innerHTML = `
    <p class="hint hint-top">Clic su una consegna per vederne il dettaglio.</p>
    <table class="t">
      <thead>
        <tr>
          <th>Consegna</th><th>Stato</th><th>Persone</th><th>Trovato</th><th>Incassato</th>
          <th>Pagato</th><th>In cassa</th><th>Quota teatro</th><th></th><th></th>
        </tr>
      </thead>
      <tbody>${consegne.map(c => `
        <tr class="clickable" onclick="openConsegnaOn('${c.data}')">
          <td class="nm">${formatDateLong(c.data)}</td>
          <td><span class="stato-label ${c.chiusa ? 'chiusa' : 'aperta'}">${c.chiusa ? 'Chiusa' : 'Aperta'}</span></td>
          <td>${c.num_movimenti}</td>
          <td>${formatNumber(c.trovato_in_cassa)}</td>
          <td>${formatNumber(c.incassato)}</td>
          <td>${formatNumber(c.pagato_produttore)}</td>
          <td><b>${formatNumber(c.lasciato_in_cassa)}</b></td>
          ${numCell(c.teatro)}
          <td>${storicoActionsHtml(c)}</td>
          <td class="det">Dettaglio ›</td>
        </tr>`).join('')}
      </tbody>
    </table>
  `;
}

document.addEventListener('DOMContentLoaded', async () => {
  await sessionReady; // "Riapri consegna" is admin-only
  loadStorico();
});
