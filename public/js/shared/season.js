// ===== SEASON THEME =====
// The accent colours follow the season of the selected date (body class), and the
// header drawing is one of the season's fruit/vegetables, changing every week.
// Credit/debt colours never change.
// Depends on: utils.js (toLocalDateString)

const SEASONS = {
  inverno:   { months: [12, 1, 2],  ills: ['ill-carciofo', 'ill-arancia', 'ill-finocchio', 'ill-romanesco'] },
  primavera: { months: [3, 4, 5],   ills: ['ill-fave', 'ill-asparagi', 'ill-fragola', 'ill-ciliegie'] },
  estate:    { months: [6, 7, 8],   ills: ['ill-pomodoro', 'ill-anguria', 'ill-pesca', 'ill-melanzana'] },
  autunno:   { months: [9, 10, 11], ills: ['ill-uva', 'ill-zucca', 'ill-castagna', 'ill-melagrana'] }
};

function seasonOf(dateStr) {
  const month = parseInt(dateStr.split('-')[1], 10);
  return Object.keys(SEASONS).find(name => SEASONS[name].months.includes(month));
}

// Weeks since 1970, Monday to Sunday (1 Jan 1970 was a Thursday): the same date always gets the same drawing
function weekIndex(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Math.floor((Date.UTC(y, m - 1, d) / 86400000 + 3) / 7);
}

function applySeason(dateStr = toLocalDateString()) {
  const season = seasonOf(dateStr);
  Object.keys(SEASONS).forEach(name => document.body.classList.toggle(`s-${name}`, name === season));

  const ills = SEASONS[season].ills;
  const ill = ills[weekIndex(dateStr) % ills.length];
  document.querySelectorAll('.stag-ill use').forEach(use => use.setAttribute('href', `#${ill}`));
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
  <symbol id="ill-arancia" viewBox="0 0 100 100">
    <circle cx="50" cy="60" r="36" fill="#F28C1E"/>
    <ellipse cx="37" cy="47" rx="8" ry="11" fill="rgba(255,255,255,.22)" transform="rotate(30 37 47)"/>
    <path d="M50 25 C50 18 52 13 55 9" stroke="#6E4128" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M53 21 C62 8 78 8 86 15 C76 23 63 25 53 21 Z" fill="#5E8C3A"/>
  </symbol>
  <symbol id="ill-finocchio" viewBox="0 0 100 100">
    <path d="M40 42 L35 12 M50 40 V8 M60 42 L66 14" stroke="#8DB85A" stroke-width="6" fill="none" stroke-linecap="round"/>
    <path d="M35 12 l-8 -5 M35 12 l-7 5 M50 8 l-6 -6 M50 8 l6 -6 M66 14 l8 -4 M66 14 l7 5" stroke="#C4E09A" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M50 36 C28 40 18 60 24 78 C30 94 70 94 76 78 C82 60 72 40 50 36 Z" fill="#EEF2DC"/>
    <path d="M50 38 C38 50 34 68 40 90 M50 38 C62 50 66 68 60 90" stroke="#C9D6A8" stroke-width="2" fill="none"/>
  </symbol>
  <symbol id="ill-romanesco" viewBox="0 0 100 100">
    <path d="M14 82 C8 92 22 100 36 96 C28 92 22 88 14 82 Z M86 82 C92 92 78 100 64 96 C72 92 78 88 86 82 Z" fill="#5E8C3A"/>
    <path d="M50 12 L88 82 C70 94 30 94 12 82 Z" fill="#8FB33E"/>
    <path d="M50 14 l8 14 h-16 z M40 34 l8 14 h-16 z M60 34 l8 14 h-16 z M30 54 l8 14 h-16 z M50 54 l8 14 h-16 z M70 54 l8 14 h-16 z M22 72 l7 12 h-14 z M40 72 l7 12 h-14 z M60 72 l7 12 h-14 z M78 72 l7 12 h-14 z" fill="#C3DC6E"/>
  </symbol>
  <symbol id="ill-asparagi" viewBox="0 0 100 100">
    <path d="M30 94 L38 18 M44 96 L46 10 M58 96 L56 12 M72 94 L64 18" stroke="#8DBE4E" stroke-width="8" fill="none" stroke-linecap="round"/>
    <ellipse cx="38" cy="16" rx="5" ry="9" fill="#7E5A8A" transform="rotate(6 38 16)"/>
    <ellipse cx="46" cy="9" rx="5" ry="9" fill="#7E5A8A"/>
    <ellipse cx="56" cy="11" rx="5" ry="9" fill="#7E5A8A"/>
    <ellipse cx="64" cy="16" rx="5" ry="9" fill="#7E5A8A" transform="rotate(-8 64 16)"/>
    <path d="M26 64 C44 70 60 70 78 64 L78 73 C60 79 44 79 26 73 Z" fill="#D9B26A"/>
  </symbol>
  <symbol id="ill-fragola" viewBox="0 0 100 100">
    <path d="M50 30 C24 26 14 44 20 60 C28 80 42 94 50 96 C58 94 72 80 80 60 C86 44 76 26 50 30 Z" fill="#E0445A"/>
    <g fill="#FBE38A">
      <ellipse cx="34" cy="52" rx="2" ry="3"/><ellipse cx="50" cy="50" rx="2" ry="3"/><ellipse cx="66" cy="52" rx="2" ry="3"/>
      <ellipse cx="40" cy="66" rx="2" ry="3"/><ellipse cx="60" cy="66" rx="2" ry="3"/><ellipse cx="50" cy="80" rx="2" ry="3"/>
    </g>
    <path d="M50 30 L32 22 L43 33 L26 36 L45 40 L50 49 L55 40 L74 36 L57 33 L68 22 Z" fill="#5E9C3A"/>
    <path d="M50 30 C50 22 52 15 56 10" stroke="#5E9C3A" stroke-width="4" fill="none" stroke-linecap="round"/>
  </symbol>
  <symbol id="ill-ciliegie" viewBox="0 0 100 100">
    <path d="M32 54 C38 34 46 20 56 12 M66 58 C64 38 60 24 56 12" stroke="#6E4128" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M56 12 C66 2 84 4 90 12 C80 20 66 20 56 12 Z" fill="#5E9C3A"/>
    <circle cx="32" cy="70" r="18" fill="#C8233A"/>
    <circle cx="66" cy="74" r="18" fill="#C8233A"/>
    <circle cx="25" cy="63" r="5" fill="rgba(255,255,255,.3)"/>
    <circle cx="59" cy="67" r="5" fill="rgba(255,255,255,.3)"/>
  </symbol>
  <symbol id="ill-anguria" viewBox="0 0 100 100">
    <path d="M4 46 A46 46 0 0 0 96 46 Z" fill="#3F8F3E"/>
    <path d="M9 46 A41 41 0 0 0 91 46 Z" fill="#D8EFB0"/>
    <path d="M14 46 A36 36 0 0 0 86 46 Z" fill="#EF4B4F"/>
    <g fill="#2A1E1E">
      <ellipse cx="34" cy="58" rx="2.5" ry="4"/><ellipse cx="50" cy="64" rx="2.5" ry="4"/><ellipse cx="66" cy="58" rx="2.5" ry="4"/>
      <ellipse cx="42" cy="74" rx="2.5" ry="4"/><ellipse cx="58" cy="74" rx="2.5" ry="4"/>
    </g>
  </symbol>
  <symbol id="ill-pesca" viewBox="0 0 100 100">
    <path d="M50 30 C24 28 12 50 18 70 C24 90 50 96 64 90 C84 82 90 58 80 42 C72 30 60 28 50 30 Z" fill="#F6A26B"/>
    <ellipse cx="66" cy="62" rx="18" ry="24" fill="#E8604A" opacity=".55"/>
    <path d="M50 32 C44 50 46 72 56 92" stroke="rgba(0,0,0,.14)" stroke-width="2" fill="none"/>
    <path d="M50 31 C50 24 51 19 53 15" stroke="#6E4128" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    <path d="M52 22 C58 10 74 6 86 12 C78 24 64 28 52 22 Z" fill="#5E9C3A"/>
  </symbol>
  <symbol id="ill-melanzana" viewBox="0 0 100 100">
    <path d="M38 32 C22 40 16 64 26 82 C36 98 64 98 74 82 C82 68 68 48 60 34 Z" fill="#8A4FA0"/>
    <ellipse cx="34" cy="64" rx="5" ry="14" fill="rgba(255,255,255,.2)" transform="rotate(10 34 64)"/>
    <path d="M34 32 C42 22 58 22 66 34 C58 40 54 34 50 42 C46 34 42 40 34 32 Z" fill="#3F8F3E"/>
    <path d="M50 26 C50 18 54 12 58 8" stroke="#3F8F3E" stroke-width="5" fill="none" stroke-linecap="round"/>
  </symbol>
  <symbol id="ill-uva" viewBox="0 0 100 100">
    <path d="M51 28 C52 18 54 12 56 6" stroke="#6E4128" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M56 20 C62 6 80 4 90 12 C84 16 86 24 78 26 C70 30 62 26 56 20 Z" fill="#6E8F4E"/>
    <g fill="#8E5AA8">
      <circle cx="24" cy="36" r="10"/><circle cx="42" cy="36" r="10"/><circle cx="60" cy="36" r="10"/><circle cx="78" cy="36" r="10"/>
      <circle cx="33" cy="52" r="10"/><circle cx="51" cy="52" r="10"/><circle cx="69" cy="52" r="10"/>
      <circle cx="42" cy="68" r="10"/><circle cx="60" cy="68" r="10"/>
      <circle cx="51" cy="84" r="10"/>
    </g>
    <g fill="rgba(255,255,255,.22)">
      <circle cx="20" cy="32" r="3"/><circle cx="47" cy="48" r="3"/><circle cx="56" cy="64" r="3"/><circle cx="47" cy="80" r="3"/>
    </g>
  </symbol>
  <symbol id="ill-castagna" viewBox="0 0 100 100">
    <path d="M50 12 C66 26 84 44 84 64 C84 84 68 92 50 92 C32 92 16 84 16 64 C16 44 34 26 50 12 Z" fill="#7A4424"/>
    <path d="M18 70 C22 88 78 88 82 70 C70 80 30 80 18 70 Z" fill="#D9B98A"/>
    <ellipse cx="36" cy="46" rx="6" ry="14" fill="rgba(255,255,255,.18)" transform="rotate(25 36 46)"/>
    <path d="M50 12 L50 5" stroke="#D9B98A" stroke-width="3" stroke-linecap="round"/>
  </symbol>
  <symbol id="ill-melagrana" viewBox="0 0 100 100">
    <path d="M40 30 L37 14 L45 22 L50 11 L55 22 L63 14 L60 30 Z" fill="#9E1B2E"/>
    <circle cx="50" cy="61" r="34" fill="#C8233A"/>
    <ellipse cx="36" cy="48" rx="8" ry="12" fill="rgba(255,255,255,.2)" transform="rotate(30 36 48)"/>
  </symbol>
  <symbol id="i-foto" viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.5" fill="none" stroke="currentColor" stroke-width="2"/></symbol>
  <symbol id="i-consegna" viewBox="0 0 24 24"><path d="M4 10h16l-1.5 10h-13z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M8 10c0-3 1.8-5 4-5s4 2 4 5" fill="none" stroke="currentColor" stroke-width="2"/></symbol>
  <symbol id="i-saldi" viewBox="0 0 24 24"><path d="M12 4v16M5 8h14M5 8l-3 7h6zM19 8l-3 7h6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></symbol>
  <symbol id="i-storico" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></symbol>
  <symbol id="i-turni" viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3.5 10h17M8 3v4M16 3v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="15" r="2" fill="currentColor"/></symbol>
  <symbol id="i-esci" viewBox="0 0 24 24"><path d="M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></symbol>
  <symbol id="i-chiave" viewBox="0 0 24 24"><circle cx="8" cy="15" r="4" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M11 12l9-9M17 6l3 3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></symbol>
</defs></svg>`;

document.addEventListener('DOMContentLoaded', () => {
  document.body.insertAdjacentHTML('afterbegin', SPRITE);
  applySeason(); // today; pages with a date picker re-apply it in setDateDisplay
});
