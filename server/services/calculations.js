// Round to 0.01€ (1 cent) to avoid floating-point precision errors
const roundToCents = (num) => Math.round(num * 100) / 100;

// Local calendar date as yyyy-mm-dd (process TZ; the image sets TZ=Europe/Rome)
function toLocalDateString(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

// Calculate trovato_in_cassa dynamically from previous consegna's lasciato
function calculateTrovatoInCassa(consegna, previousLasciato) {
  return previousLasciato !== undefined ? roundToCents(previousLasciato) : consegna.trovato_in_cassa;
}

// Fill trovato_in_cassa of each consegna from the previous one's lasciato (chronological order)
function processConsegneWithDynamicValues(consegne, isAscending = false) {
  const asc = isAscending ? consegne : [...consegne].reverse();
  const processed = asc.map((c, i) => ({
    ...c,
    trovato_in_cassa: calculateTrovatoInCassa(c, asc[i - 1]?.lasciato_in_cassa)
  }));
  return isAscending ? processed : processed.reverse();
}

// Recalculate participant saldo from movimento
function applySaldoChanges(currentSaldo, movimento) {
  let saldo = currentSaldo;

  if (movimento.usa_credito > 0) {
    saldo -= movimento.usa_credito;
  }

  if (movimento.salda_debito_totale && saldo < 0) {
    saldo = 0;
  } else if (movimento.debito_saldato > 0 && saldo < 0) {
    saldo = Math.min(0, saldo + movimento.debito_saldato);
  }

  if (movimento.debito_lasciato > 0) {
    saldo -= movimento.debito_lasciato;
  }

  if (movimento.credito_lasciato > 0) {
    saldo += movimento.credito_lasciato;
  }

  return roundToCents(saldo);
}

// Apply one ledger event: a movimento, or a manual rettifica (signed amount)
function applyEvent(saldo, event) {
  return event.tipo === 'rettifica'
    ? roundToCents(saldo + event.importo)
    : applySaldoChanges(saldo, event);
}

// Ledger order: by date, then by creation time within the same date
function compareEvents(a, b) {
  return a.data.localeCompare(b.data) || (a.created_at || '').localeCompare(b.created_at || '');
}

module.exports = {
  roundToCents,
  toLocalDateString,
  calculateTrovatoInCassa,
  processConsegneWithDynamicValues,
  applySaldoChanges,
  applyEvent,
  compareEvents
};
