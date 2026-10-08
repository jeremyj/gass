// ===== SCONTRINI: receipt photos of a person in a consegna =====
// Used by the Consegna pages (block in the participant card) and the gallery pages (/scontrini).
// The photo is shrunk here (canvas, which also drops EXIF/GPS) and uploaded right away.

let scontriniGiorno = []; // photos of the consegna shown (GET /api/scontrini?data=)
let scontriniMax = 3;

const FOTO_LATO = 1600;
const THUMB_LATO = 320;

// Phones get a camera wording, computers a file/drag wording
const conMouse = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

function fotoUrl(s, thumb = false) {
  return `/api/scontrini/${s.id}/${thumb ? 'thumb' : 'foto'}`;
}

async function loadScontrini(date) {
  try {
    const r = await API.get(`/api/scontrini?data=${date}`);
    scontriniGiorno = r.scontrini;
    scontriniMax = r.max;
  } catch {
    scontriniGiorno = [];
  }
  return scontriniGiorno;
}

const scontriniDi = id => scontriniGiorno.filter(s => s.partecipante_id === id);

// Draw the photo at most `lato` px on its long side and re-encode it as JPEG (base64, no prefix)
function jpegDa(bitmap, lato, qualita) {
  const k = Math.min(1, lato / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * k);
  canvas.height = Math.round(bitmap.height * k);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return { b64: canvas.toDataURL('image/jpeg', qualita).split(',')[1], w: canvas.width, h: canvas.height };
}

async function riduciFoto(file) {
  // from-image: portrait photos stay portrait
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const foto = jpegDa(bitmap, FOTO_LATO, 0.8);
  const thumb = jpegDa(bitmap, THUMB_LATO, 0.7);
  bitmap.close?.();
  return { foto: foto.b64, thumb: thumb.b64, larghezza: foto.w, altezza: foto.h };
}

// ----- Block in the participant card -----

// One tile. The PDF in accept is on purpose: with image types only, Android Chrome opens the
// system photo picker, which has no camera; any other type brings its Foto/File chooser
// (tested on the user's phone 2026-10-08). Non-image files are skipped in caricaScontrini.
function addTile(id) {
  return `
    <label class="sc-add">
      <input type="file" accept="image/*,application/pdf" multiple onchange="caricaScontrini(${id}, this)">
      <svg aria-hidden="true"><use href="#i-foto"/></svg>
      <span>${conMouse() ? 'Allega scontrino' : 'Fotografa'}</span>
    </label>`;
}

function renderScontriniBox(id) {
  const box = document.getElementById(`scontrini_${id}`);
  if (!box) return;
  const foto = scontriniDi(id);
  const mio = s => s.created_by === currentUser?.id || isAdmin();
  const chiusa = typeof isConsegnaClosed !== 'undefined' && isConsegnaClosed;
  const tile = !chiusa && foto.length < scontriniMax;

  box.innerHTML = `
    <h4 class="blocco-titolo"><span data-tip="scontrini">Scontrini</span><span>${foto.length ? `${foto.length} foto` : ''}</span></h4>
    <div class="sc-strip">
      ${foto.map((s, i) => `
        <span class="sc-thumb">
          <img src="${fotoUrl(s, true)}" alt="Scontrino ${i + 1}" onclick="openLightbox(scontriniDi(${id}), ${i})">
          ${!chiusa && mio(s) ? `<button type="button" class="sc-x" aria-label="Togli la foto" onclick="togliScontrino(${s.id}, ${id})">×</button>` : ''}
        </span>`).join('')}
      ${tile ? addTile(id) : ''}
    </div>
    ${tile && conMouse() ? '<p class="sc-hint">Oppure trascina qui l\'immagine.</p>' : ''}
    ${!tile && !chiusa ? `<p class="sc-hint">Massimo ${scontriniMax} foto per persona.</p>` : ''}
  `;
  // Drag and drop (computers); harmless on phones
  box.ondragover = e => { if (tile) { e.preventDefault(); box.classList.add('drag'); } };
  box.ondragleave = () => box.classList.remove('drag');
  box.ondrop = e => {
    e.preventDefault();
    box.classList.remove('drag');
    if (tile) caricaScontrini(id, e.dataTransfer);
  };
}

// Upload one photo at a time, each shown with "carico…" until it is stored
async function caricaScontrini(id, source) {
  const date = getSelectedDate();
  const liberi = scontriniMax - scontriniDi(id).length;
  const immagini = [...(source.files || [])].filter(f => f.type.startsWith('image/'));
  const files = immagini.slice(0, liberi);
  if (immagini.length < (source.files?.length || 0)) showStatus('Solo foto: gli altri file non sono stati caricati', 'error');
  else if (immagini.length > liberi) showStatus(`Massimo ${scontriniMax} foto per persona: caricate solo ${liberi}`, 'error');
  const strip = document.querySelector(`#scontrini_${id} .sc-strip`);

  for (const file of files) {
    const segno = document.createElement('span');
    segno.className = 'sc-thumb up';
    segno.innerHTML = '<span class="sc-up">carico…</span>';
    strip?.insertBefore(segno, strip.querySelector('.sc-add'));
    try {
      const ridotta = await riduciFoto(file);
      segno.insertAdjacentHTML('afterbegin', `<img src="data:image/jpeg;base64,${ridotta.thumb}" alt="">`);
      const r = await API.post('/api/scontrini', { data: date, partecipanteId: id, ...ridotta });
      // The first photo of the day created the consegna: show it as open
      if (!currentConsegnaId && r.consegnaId) updateConsegnaStatusUI({ id: r.consegnaId, chiusa: false });
    } catch (error) {
      showStatus('Foto non caricata: ' + error.message, 'error');
    }
  }
  await loadScontrini(date);
  renderScontriniBox(id);
  renderMovimentiGiorno();
}

async function togliScontrino(scontrinoId, id) {
  const ok = await confirmDialog({ title: 'Togliere la foto?', message: 'La foto dello scontrino viene eliminata.', confirmText: 'Togli', danger: true });
  if (!ok) return;
  try {
    await API.delete(`/api/scontrini/${scontrinoId}`);
  } catch (error) {
    showStatus('Errore: ' + error.message, 'error');
  }
  await loadScontrini(getSelectedDate());
  renderScontriniBox(id);
  renderMovimentiGiorno();
}

// ----- Day's list: count per person, people with photos only, link to the gallery -----

function scontriniBadge(id) {
  const n = scontriniDi(id).length;
  return n ? ` <span class="sc-n" title="${n} scontrin${n === 1 ? 'o' : 'i'}"><svg aria-hidden="true"><use href="#i-foto"/></svg>${n}</span>` : '';
}

// People with photos but neither a movimento nor a quota teatro in this consegna
function soloScontrini(movimenti, teatro) {
  const visti = new Set([...movimenti.map(m => m.partecipante_id), ...teatro.map(t => t.user_id)]);
  const persone = new Map();
  scontriniGiorno.filter(s => !visti.has(s.partecipante_id)).forEach(s => persone.set(s.partecipante_id, s.nome));
  return [...persone].map(([id, nome]) => ({ id, nome }));
}

function renderScontriniLink() {
  const el = document.getElementById('scontrini-link');
  if (!el) return;
  const n = scontriniGiorno.length;
  el.innerHTML = n ? `<a class="link" href="/scontrini?data=${getSelectedDate()}">Vedi ${n === 1 ? 'lo scontrino' : `i ${n} scontrini`} ›</a>` : '';
}

// ----- Lightbox: one photo large, previous/next, swipe, arrows, Esc -----

function openLightbox(lista, indice) {
  if (!lista.length) return;
  let i = indice;
  const box = document.createElement('div');
  box.className = 'lightbox';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  document.body.appendChild(box);

  const quando = s => new Date(s.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  const draw = () => {
    const s = lista[i];
    const suoi = lista.filter(x => x.partecipante_id === s.partecipante_id);
    const pos = suoi.length > 1 ? ` · ${suoi.indexOf(s) + 1} di ${suoi.length}` : '';
    box.innerHTML = `
      <div class="lb-top">
        <button type="button" class="lb-btn" data-lb="close">‹ Chiudi</button>
        <span><b>${escapeHtml(s.nome)}</b>${pos}</span>
      </div>
      <div class="lb-stage"><img src="${fotoUrl(s)}" alt="Scontrino di ${escapeHtml(s.nome)}"></div>
      <div class="lb-nav">
        <button type="button" class="lb-btn" data-lb="prev" ${i === 0 ? 'disabled' : ''}>‹ Prec.</button>
        <span>${s.autore ? `scattata alle ${quando(s)} da ${escapeHtml(s.autore)}` : `scattata alle ${quando(s)}`}</span>
        <button type="button" class="lb-btn" data-lb="next" ${i === lista.length - 1 ? 'disabled' : ''}>Succ. ›</button>
      </div>
    `;
  };
  const go = d => { if (lista[i + d]) { i += d; draw(); } };
  const close = () => { document.removeEventListener('keydown', onKey); box.remove(); };
  const onKey = e => {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') go(-1);
    else if (e.key === 'ArrowRight') go(1);
  };

  box.addEventListener('click', e => {
    const act = e.target.closest('[data-lb]')?.dataset.lb;
    if (act === 'close') close();
    else if (act === 'prev') go(-1);
    else if (act === 'next') go(1);
  });
  // Swipe with one finger; pinch (two fingers) is the browser zoom
  let x0 = null;
  box.addEventListener('touchstart', e => { x0 = e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
  box.addEventListener('touchend', e => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1);
    x0 = null;
  });
  document.addEventListener('keydown', onKey);
  draw();
}
