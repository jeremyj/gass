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

// The semester after s: '2026-2' → '2027-1'
function semestreDopo(s) {
  const [y, h] = s.split('-').map(Number);
  return h === 1 ? `${y}-2` : `${y + 1}-1`;
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

// What each payment covered, replaying them by date then id over the owed semesters oldest first.
// copre: [{ tipo: 'salda' | 'acconto' | 'anticipo', semestre }]. What goes beyond every owed
// semester is an advance on the semesters after max(last owed, dopo), `quota` each (0 = all on one).
function coperturaPagamenti(dovuti, pagamenti, { quota = 0, dopo = null } = {}) {
  const round = x => Math.round(x * 100) / 100;
  const aperti = [...dovuti].sort((a, b) => a.semestre.localeCompare(b.semestre))
    .filter(d => d.dovuto > 0).map(d => ({ semestre: d.semestre, resta: d.dovuto }));
  const ultimo = [...dovuti.map(d => d.semestre), dopo].filter(Boolean).sort().pop();
  let anticipo = null; // { semestre, resta } once the owed semesters are paid
  return [...pagamenti].sort((a, b) => a.data.localeCompare(b.data) || a.id - b.id).map(p => {
    let left = round(p.importo);
    const copre = [];
    for (const d of aperti) {
      if (left <= 0) break;
      if (d.resta <= 0) continue;
      const x = Math.min(d.resta, left);
      d.resta = round(d.resta - x);
      left = round(left - x);
      copre.push({ tipo: d.resta === 0 ? 'salda' : 'acconto', semestre: d.semestre });
    }
    while (left > 0) {
      if (!anticipo) anticipo = { semestre: semestreDopo(ultimo || semestreOf(p.data)), resta: quota };
      if (quota > 0 && anticipo.resta <= 0) anticipo = { semestre: semestreDopo(anticipo.semestre), resta: quota };
      copre.push({ tipo: 'anticipo', semestre: anticipo.semestre });
      const x = quota > 0 ? Math.min(anticipo.resta, left) : left;
      anticipo.resta = round(anticipo.resta - x);
      left = round(left - x);
    }
    return { ...p, copre };
  });
}

// 'salda 2° sem. 2025, anticipo 1° sem. 2026'
function copreLabel(copre) {
  return copre.map(c => `${c.tipo} ${semestreLabel(c.semestre)}`).join(', ');
}

module.exports = { semestreOf, semestreLabel, semestreDopo, isSemestre, allocate, coperturaPagamenti, copreLabel };
