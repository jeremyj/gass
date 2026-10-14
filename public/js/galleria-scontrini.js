// ===== GALLERIA SCONTRINI: the notebook photos, then all receipt photos of one consegna, grouped by person =====
// Same script for scontrini.html (mobile) and scontrini-desktop.html; reached from Storico and Consegna

async function loadGalleria(date) {
  const container = document.getElementById('galleria');
  const [lista, quaderno] = await Promise.all([loadScontrini(date), loadQuaderno(date)]);
  const persone = [...new Set(lista.map(s => s.partecipante_id))];

  document.getElementById('galleria-meta').innerHTML = `
    <a class="link" href="${consegnaHref(date)}">‹ Apri la consegna</a>
    ${lista.length ? ` · ${lista.length} foto, ${persone.length === 1 ? '1 persona' : `${persone.length} persone`}` : ''}
    ${quaderno.length ? ` · quaderno ${quaderno.length} foto` : ''}
    ${lista.length + quaderno.length && window.matchMedia('(hover: hover) and (pointer: fine)').matches ? ' · clic su una foto per ingrandirla, frecce ← → per scorrere' : ''}
  `;
  if (!lista.length && !quaderno.length) {
    container.innerHTML = '<p class="empty-state">Nessuno scontrino in questa consegna</p>';
    return;
  }
  // The notebook first, then people sorted by name; the lightbox goes through all photos in the same order
  const ordinate = [
    ...(quaderno.length ? [quaderno] : []),
    ...persone.map(id => lista.filter(s => s.partecipante_id === id)).sort((a, b) => a[0].nome.localeCompare(b[0].nome, 'it'))
  ];
  const tutte = ordinate.flat();
  container.innerHTML = ordinate.map(foto => `
    <section class="galleria-persona">
      <h2>${escapeHtml(foto[0].nome)} <small>${foto.length} foto</small></h2>
      <div class="galleria-griglia">
        ${foto.map(s => `<button type="button" onclick="apriFoto(${tutte.indexOf(s)})" aria-label="${s.quaderno ? 'Foto del quaderno' : `Scontrino di ${escapeHtml(s.nome)}`}"><img src="${fotoUrl(s, true)}" alt="" loading="lazy"></button>`).join('')}
      </div>
    </section>
  `).join('');
  window.apriFoto = i => openLightbox(tutte, i);
}

document.addEventListener('DOMContentLoaded', async () => {
  const date = new URLSearchParams(location.search).get('data');
  // A real yyyy-mm-dd only, else back to the index
  if (!date || toLocalDateString(new Date(`${date}T00:00:00`)) !== date) {
    location.href = '/storico';
    return;
  }
  setDateDisplay(date);
  await sessionReady;
  loadGalleria(date);
});
