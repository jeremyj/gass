// Help tips: an (i) button after every element with data-tip="<key>", opening a bubble with TIPS[key].
// Tap on mobile, click on desktop; elements rendered later get their button too (MutationObserver).

const TIPS = {
  uscite: 'Soldi che escono dalla cassa o entrano in cassa, oltre ai conti delle persone. Scegli prima − esce (es. hai pagato Altobelli 358 invece di 357,20: 0,80) o + entra (es. Altobelli ci restituisce 32,80), poi scrivi importo e motivo. Con il pulsante + a destra aggiungi una riga; per toglierne una svuota la riga.',
  quaderno: 'Fotografa la pagina del quaderno dove avete fatto i conti a mano: è la controprova della cassa. Puoi farlo quando vuoi finché la consegna è aperta; alla chiusura GASS te lo ricorda. Dopo la chiusura può aggiungerle solo chi l\'ha chiusa o un amministratore.',
  scontrini: 'Foto degli scontrini di questo gassista, al massimo 3. Ogni foto si salva subito, anche senza premere Salva movimento. Tutti i gassisti le vedono nella galleria della consegna; può toglierle chi le ha scattate o un amministratore, finché la consegna è aperta.',
  teatro_oggi: 'Quote teatro pagate in questa consegna: vanno nella cassa teatro, non in questa, e non cambiano In cassa.',
  teatro_versato: 'Copre prima i semestri più vecchi; quello che avanza è un anticipo.',
  modifica_saldo: 'Scrivi il saldo giusto. La differenza diventa una Rettifica manuale con la data di oggi: i movimenti passati non cambiano.',
  stato: 'Attivo: fa i turni e deve la quota teatro del semestre. No turni: i suoi turni futuri tornano "da coprire" e non deve la quota teatro del semestre in corso, se non l\'ha già pagata. Disattivato: non accede più; saldo e storico restano.',
  quanto_deve: 'Quanto deve questo gassista in quel semestre: la quota intera, una ridotta per chi entra a metà, 0 = non dovuta.'
};

function addTipButtons() {
  document.querySelectorAll('[data-tip]:not([data-tip-ready])').forEach(el => {
    el.dataset.tipReady = '';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tip-btn';
    btn.textContent = 'i';
    btn.dataset.tipKey = el.dataset.tip;
    btn.setAttribute('aria-label', 'Spiegazione');
    btn.setAttribute('aria-expanded', 'false');
    // data-tip-prima: the (i) before the text
    if ('tipPrima' in el.dataset) el.prepend(btn, ' '); else el.append(btn);
  });
}

let openTip = null;

function closeTip() {
  if (!openTip) return;
  openTip.btn.setAttribute('aria-expanded', 'false');
  openTip.pop.remove();
  openTip = null;
}

function showTip(btn) {
  const pop = document.createElement('div');
  pop.className = 'tip-pop';
  pop.setAttribute('role', 'tooltip');
  pop.textContent = TIPS[btn.dataset.tipKey] || '';
  document.body.append(pop);
  // Below the button, kept inside the viewport
  const r = btn.getBoundingClientRect();
  const left = Math.min(Math.max(8, r.left - 12), document.documentElement.clientWidth - pop.offsetWidth - 8);
  pop.style.left = `${left + window.scrollX}px`;
  pop.style.top = `${r.bottom + window.scrollY + 6}px`;
  btn.setAttribute('aria-expanded', 'true');
  openTip = { btn, pop };
}

// Capture phase: the tip must not trigger the row/label it sits in
document.addEventListener('click', e => {
  const btn = e.target.closest('.tip-btn');
  if (!btn) {
    if (!e.target.closest('.tip-pop')) closeTip();
    return;
  }
  e.preventDefault();
  e.stopPropagation();
  const wasOpen = openTip?.btn === btn;
  closeTip();
  if (!wasOpen) showTip(btn);
}, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeTip(); });
window.addEventListener('resize', closeTip);

addTipButtons();
new MutationObserver(addTipButtons).observe(document.body, { childList: true, subtree: true });
