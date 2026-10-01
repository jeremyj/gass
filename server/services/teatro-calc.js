/**
 * Pure helpers for the quota teatro (no DB).
 * A semester is 'yyyy-1' (January-June) or 'yyyy-2' (July-December).
 */

function semestreOf(dateStr) {
  const [y, m] = dateStr.split('-').map(Number);
  return `${y}-${m <= 6 ? 1 : 2}`;
}

function semestreLabel(s) {
  const [y, h] = s.split('-');
  return `${h}° sem. ${y}`;
}

function isSemestre(s) {
  return /^\d{4}-[12]$/.test(String(s));
}

// Payments (a total) cover the owed semesters oldest first; what is left is an advance.
// dovuti: [{ semestre, dovuto }] in any order. Returns rows with `pagato` per semester.
function allocate(dovuti, totalePagato) {
  let left = Math.round(totalePagato * 100) / 100;
  const righe = [...dovuti].sort((a, b) => a.semestre.localeCompare(b.semestre)).map(d => {
    const pagato = Math.min(d.dovuto, Math.max(left, 0));
    left = Math.round((left - pagato) * 100) / 100;
    return { semestre: d.semestre, dovuto: d.dovuto, pagato };
  });
  const residuo = righe.reduce((s, r) => s + r.dovuto - r.pagato, 0);
  return { righe, residuo: Math.round(residuo * 100) / 100, anticipo: left };
}

module.exports = { semestreOf, semestreLabel, isSemestre, allocate };
