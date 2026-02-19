// Round to 0.01€ (1 cent) to avoid floating-point precision errors
const roundToCents = (num) => Math.round(num * 100) / 100;

// Calculate trovato_in_cassa dynamically from previous consegna's lasciato
function calculateTrovatoInCassa(consegna, previousLasciato) {
  return previousLasciato !== undefined ? roundToCents(previousLasciato) : consegna.trovato_in_cassa;
}

// Calculate lasciato_in_cassa: always read from database (calculated correctly when saving)
function calculateLasciatoInCassa(consegna) {
  return consegna.lasciato_in_cassa;
}

// Apply dynamic calculations to single consegna
function applyDynamicCalculations(consegna, previousLasciato) {
  const trovato = calculateTrovatoInCassa(consegna, previousLasciato);
  const lasciato = calculateLasciatoInCassa(consegna, trovato);

  return {
    ...consegna,
    trovato_in_cassa: trovato,
    lasciato_in_cassa: lasciato
  };
}

// Process array of consegne in chronological order with recursive calculation
function processConsegneWithDynamicValues(consegne, isAscending = false) {
  const consegneAsc = isAscending ? consegne : [...consegne].reverse();

  const processed = consegneAsc.map((consegna, index) => {
    const previousLasciato = index > 0
      ? (consegneAsc[index - 1].lasciato_in_cassa_calculated ?? consegneAsc[index - 1].lasciato_in_cassa)
      : undefined;

    const trovato = calculateTrovatoInCassa(consegna, previousLasciato);
    const lasciato = calculateLasciatoInCassa(consegna, trovato);

    return {
      ...consegna,
      trovato_in_cassa: trovato,
      lasciato_in_cassa: lasciato,
      lasciato_in_cassa_calculated: lasciato // Store for next iteration
    };
  });

  return isAscending ? processed : processed.reverse();
}

// Recalculate participant saldo from movimento
function applySaldoChanges(currentSaldo, movimento) {
  let saldo = currentSaldo;

  if (movimento.salda_tutto) {
    saldo = 0;
  }

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

  return saldo;
}

module.exports = {
  roundToCents,
  calculateTrovatoInCassa,
  calculateLasciatoInCassa,
  applyDynamicCalculations,
  processConsegneWithDynamicValues,
  applySaldoChanges
};
