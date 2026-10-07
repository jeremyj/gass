// Help tips: an (i) button after every element with data-tip="<key>", opening a bubble with TIPS[key].
// Tap on mobile, click on desktop; elements rendered later get their button too (MutationObserver).

const TIPS = {
  uscite: 'Soldi presi dalla cassa o rimessi dentro. Esce = tolti (es. hai pagato Altobelli 358 invece di 357,20: 0,80), entra = rimessi (hai pagato 357: 0,20). Tocca esce/entra o scrivi − / + davanti all\'importo. Con il pulsante + a destra aggiungi una riga; per toglierne una svuota la riga.',
  teatro_oggi: 'Quote teatro pagate in questa consegna: vanno nella cassa del teatro, non in questa, e non cambiano In cassa.',
  teatro_versato: 'Quanto paga ora per la quota teatro: questi soldi vanno nel bussolotto, non in cassa. Copre prima i semestri più vecchi; quello che avanza resta come anticipo.',
  modifica_saldo: 'Scrivi il saldo giusto. L\'app registra la differenza come correzione con la data di oggi: i movimenti passati non cambiano.',
  stato: 'Attivo: fa i turni e deve la quota teatro del semestre. No turni: i suoi turni futuri tornano "da coprire" e non deve la quota teatro del semestre in corso, se non l\'ha già pagata. Disattivato: non accede più; saldo e storico restano.',
  teatro_griglia: '✓ pagata, ✗ da pagare, – non dovuta o non era nel GASS. Clicca una cella per cambiare quanto deve quella persona in quel semestre; clicca un semestre per cambiare la quota di tutti.',
  quanto_deve: 'Per una persona: quanto deve in quel semestre (quota piena, ridotta per chi entra a metà, 0 = non dovuta). Per un semestre: la quota di chi ha la quota piena.'
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
    el.append(btn);
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
