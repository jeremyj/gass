// ===== SEASON THEME =====
// The accent colours follow the season of the selected date (body class), and the
// header names the month's produce. Credit/debt colours never change.
// Depends on: utils.js (toLocalDateString)

const SEASONS = {
  inverno:   { months: [12, 1, 2],  ill: 'ill-carciofo' },
  primavera: { months: [3, 4, 5],   ill: 'ill-fave' },
  estate:    { months: [6, 7, 8],   ill: 'ill-pomodoro' },
  autunno:   { months: [9, 10, 11], ill: 'ill-zucca' }
};

const PRODUCE = [
  'carciofo romanesco, arance e puntarelle',
  'carciofi, broccoletti e arance',
  'puntarelle, agretti e carciofi',
  'fave, piselli e asparagi',
  'fave, fragole e piselli',
  'ciliegie, zucchine e albicocche',
  'pomodori, melanzane e basilico',
  'pomodori, pesche e peperoni',
  'uva, fichi e peperoni',
  'castagne, zucca e melagrane',
  'zucca, cavolo nero e castagne',
  'broccolo romanesco, cavolo nero e arance'
];

function seasonOf(dateStr) {
  const month = parseInt(dateStr.split('-')[1], 10);
  return Object.keys(SEASONS).find(name => SEASONS[name].months.includes(month));
}

function applySeason(dateStr = toLocalDateString()) {
  const season = seasonOf(dateStr);
  Object.keys(SEASONS).forEach(name => document.body.classList.toggle(`s-${name}`, name === season));

  const produce = document.getElementById('season-produce');
  if (produce) produce.textContent = PRODUCE[parseInt(dateStr.split('-')[1], 10) - 1];

  document.querySelectorAll('.stag-ill use').forEach(use => use.setAttribute('href', `#${SEASONS[season].ill}`));
}

// "martedì 4 novembre" (the year only when it isn't the current one)
function formatDateLong(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  const options = { weekday: 'long', day: 'numeric', month: 'long' };
  if (date.getFullYear() !== new Date().getFullYear()) options.year = 'numeric';
  return date.toLocaleDateString('it-IT', options);
}

// Produce drawings and nav icons, referenced with <svg><use href="#id"/></svg>
const SPRITE = `
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <symbol id="ill-zucca" viewBox="0 0 100 100">
    <path d="M49 26 C47 18 50 12 56 8 L60 12 C55 15 54 20 55 26 Z" fill="var(--s-alt)"/>
    <path d="M56 20 C64 10 78 12 82 20 C72 20 64 22 58 26 Z" fill="#6E8F4E"/>
    <ellipse cx="30" cy="60" rx="22" ry="30" fill="var(--s-acc)"/>
    <ellipse cx="70" cy="60" rx="22" ry="30" fill="var(--s-acc)"/>
    <ellipse cx="50" cy="60" rx="20" ry="33" fill="#F4A13A"/>
    <path d="M50 28 V93" stroke="rgba(0,0,0,.14)" stroke-width="1.5"/>
  </symbol>
  <symbol id="ill-carciofo" viewBox="0 0 100 100">
    <path d="M48 78 C46 88 44 94 40 99 L46 99 C50 94 52 88 52 78 Z" fill="var(--s-alt)"/>
    <path d="M50 80 C24 78 16 58 22 40 C30 54 40 62 50 64 Z" fill="var(--s-alt)"/>
    <path d="M50 80 C76 78 84 58 78 40 C70 54 60 62 50 64 Z" fill="var(--s-alt)"/>
    <path d="M50 70 C32 66 28 46 34 28 C40 42 46 50 50 52 Z" fill="#8E7AA8"/>
    <path d="M50 70 C68 66 72 46 66 28 C60 42 54 50 50 52 Z" fill="#8E7AA8"/>
    <path d="M50 58 C40 50 40 28 50 12 C60 28 60 50 50 58 Z" fill="#B7A5CC"/>
  </symbol>
  <symbol id="ill-fave" viewBox="0 0 100 100">
    <path d="M12 72 C10 48 40 22 80 18 C92 18 94 26 88 34 C74 52 46 78 20 82 C14 82 12 78 12 72 Z" fill="var(--s-acc)"/>
    <ellipse cx="34" cy="62" rx="9" ry="7" transform="rotate(-35 34 62)" fill="#DDEFB8"/>
    <ellipse cx="52" cy="48" rx="9" ry="7" transform="rotate(-35 52 48)" fill="#DDEFB8"/>
    <ellipse cx="70" cy="34" rx="8" ry="6" transform="rotate(-35 70 34)" fill="#DDEFB8"/>
    <path d="M86 22 C90 14 94 10 98 8" stroke="var(--s-acc)" stroke-width="4" fill="none" stroke-linecap="round"/>
  </symbol>
  <symbol id="ill-pomodoro" viewBox="0 0 100 100">
    <ellipse cx="50" cy="60" rx="38" ry="34" fill="var(--s-acc)"/>
    <ellipse cx="36" cy="50" rx="8" ry="12" fill="rgba(255,255,255,.22)" transform="rotate(25 36 50)"/>
    <path d="M50 30 L40 18 L47 29 L30 26 L45 33 L34 42 L50 35 L66 42 L55 33 L70 26 L53 29 L60 18 Z" fill="var(--s-alt)"/>
    <path d="M50 30 C50 22 52 14 56 10" stroke="var(--s-alt)" stroke-width="4" fill="none" stroke-linecap="round"/>
  </symbol>
  <symbol id="i-consegna" viewBox="0 0 24 24"><path d="M4 10h16l-1.5 10h-13z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M8 10c0-3 1.8-5 4-5s4 2 4 5" fill="none" stroke="currentColor" stroke-width="2"/></symbol>
  <symbol id="i-saldi" viewBox="0 0 24 24"><path d="M12 4v16M5 8h14M5 8l-3 7h6zM19 8l-3 7h6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></symbol>
  <symbol id="i-storico" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></symbol>
  <symbol id="i-esci" viewBox="0 0 24 24"><path d="M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></symbol>
  <symbol id="i-chiave" viewBox="0 0 24 24"><circle cx="8" cy="15" r="4" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M11 12l9-9M17 6l3 3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></symbol>
</defs></svg>`;

document.addEventListener('DOMContentLoaded', () => {
  document.body.insertAdjacentHTML('afterbegin', SPRITE);
  applySeason(); // today; pages with a date picker re-apply it in setDateDisplay
});
