'use strict';

// Which consegna the Consegna page opens on, without a date picker: the last turno day
// up to today (weeks without consegna excluded) while it has no consegna or an open one,
// otherwise today. All open consegne are listed so the page can warn about the others.
function apertura(db, today) {
  const turno = db.prepare('SELECT data FROM turni WHERE data <= ? AND saltata = 0 ORDER BY data DESC LIMIT 1').get(today);
  const consegna = turno && db.prepare('SELECT chiusa FROM consegne WHERE data = ?').get(turno.data);
  const data = turno && !consegna?.chiusa ? turno.data : today;
  const aperte = db.prepare('SELECT id, data FROM consegne WHERE chiusa = 0 ORDER BY data').all();
  return { data, aperte };
}

module.exports = { apertura };
