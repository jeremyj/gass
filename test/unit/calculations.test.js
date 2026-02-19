'use strict';

const {
  roundToCents,
  calculateTrovatoInCassa,
  processConsegneWithDynamicValues,
  applySaldoChanges,
} = require('../../server/services/calculations');

describe('roundToCents', () => {
  it('rounds to nearest 0.01', () => {
    expect(roundToCents(1.006)).toBe(1.01);
    expect(roundToCents(1.004)).toBe(1.0);
    expect(roundToCents(10.126)).toBe(10.13);
  });

  it('returns whole numbers unchanged', () => {
    expect(roundToCents(5)).toBe(5);
    expect(roundToCents(0)).toBe(0);
  });

  it('handles floating point noise', () => {
    expect(roundToCents(0.1 + 0.2)).toBe(0.3);
  });
});

describe('calculateTrovatoInCassa', () => {
  it('returns previousLasciato when provided', () => {
    const consegna = { trovato_in_cassa: 100 };
    expect(calculateTrovatoInCassa(consegna, 50)).toBe(50);
  });

  it('falls back to consegna.trovato_in_cassa when previousLasciato is undefined', () => {
    const consegna = { trovato_in_cassa: 100 };
    expect(calculateTrovatoInCassa(consegna, undefined)).toBe(100);
  });

  it('accepts 0 as valid previousLasciato', () => {
    const consegna = { trovato_in_cassa: 100 };
    expect(calculateTrovatoInCassa(consegna, 0)).toBe(0);
  });
});

describe('applySaldoChanges', () => {
  it('returns unchanged saldo with all-zero movimento', () => {
    const mov = { salda_tutto: 0, usa_credito: 0, salda_debito_totale: 0, debito_saldato: 0, debito_lasciato: 0, credito_lasciato: 0 };
    expect(applySaldoChanges(100, mov)).toBe(100);
    expect(applySaldoChanges(-50, mov)).toBe(-50);
    expect(applySaldoChanges(0, mov)).toBe(0);
  });

  it('salda_tutto resets saldo to 0 regardless of current value', () => {
    const mov = { salda_tutto: 1, usa_credito: 0, salda_debito_totale: 0, debito_saldato: 0, debito_lasciato: 0, credito_lasciato: 0 };
    expect(applySaldoChanges(200, mov)).toBe(0);
    expect(applySaldoChanges(-150, mov)).toBe(0);
  });

  it('credito_lasciato adds to saldo', () => {
    const mov = { salda_tutto: 0, usa_credito: 0, salda_debito_totale: 0, debito_saldato: 0, debito_lasciato: 0, credito_lasciato: 30 };
    expect(applySaldoChanges(0, mov)).toBe(30);
    expect(applySaldoChanges(20, mov)).toBe(50);
  });

  it('debito_lasciato subtracts from saldo', () => {
    const mov = { salda_tutto: 0, usa_credito: 0, salda_debito_totale: 0, debito_saldato: 0, debito_lasciato: 15, credito_lasciato: 0 };
    expect(applySaldoChanges(0, mov)).toBe(-15);
    expect(applySaldoChanges(30, mov)).toBe(15);
  });

  it('usa_credito subtracts from positive saldo', () => {
    const mov = { salda_tutto: 0, usa_credito: 20, salda_debito_totale: 0, debito_saldato: 0, debito_lasciato: 0, credito_lasciato: 0 };
    expect(applySaldoChanges(50, mov)).toBe(30);
  });

  it('debito_saldato reduces negative saldo but not below 0', () => {
    const mov = { salda_tutto: 0, usa_credito: 0, salda_debito_totale: 0, debito_saldato: 10, debito_lasciato: 0, credito_lasciato: 0 };
    expect(applySaldoChanges(-15, mov)).toBe(-5);
    // Cannot exceed 0
    expect(applySaldoChanges(-5, mov)).toBe(0);
    // debito_saldato has no effect on positive saldo
    expect(applySaldoChanges(20, mov)).toBe(20);
  });

  it('salda_debito_totale clears negative saldo entirely', () => {
    const mov = { salda_tutto: 0, usa_credito: 0, salda_debito_totale: 1, debito_saldato: 0, debito_lasciato: 0, credito_lasciato: 0 };
    expect(applySaldoChanges(-100, mov)).toBe(0);
    // No effect on positive saldo
    expect(applySaldoChanges(50, mov)).toBe(50);
  });

  it('compound: creditoLasciato accumulates across multiple calls', () => {
    const mov = { salda_tutto: 0, usa_credito: 0, salda_debito_totale: 0, debito_saldato: 0, debito_lasciato: 0, credito_lasciato: 20 };
    let saldo = 0;
    saldo = applySaldoChanges(saldo, mov); // +20 → 20
    saldo = applySaldoChanges(saldo, mov); // +20 → 40
    expect(saldo).toBe(40);
  });

  it('order of operations: salda_tutto runs before credito_lasciato', () => {
    // salda_tutto zeroes first, then credito_lasciato adds
    const mov = { salda_tutto: 1, usa_credito: 0, salda_debito_totale: 0, debito_saldato: 0, debito_lasciato: 0, credito_lasciato: 15 };
    expect(applySaldoChanges(100, mov)).toBe(15);
  });
});

describe('processConsegneWithDynamicValues', () => {
  it('returns empty array for empty input', () => {
    expect(processConsegneWithDynamicValues([])).toEqual([]);
  });

  it('chains trovato from previous lasciato in chronological order', () => {
    const consegne = [
      { id: 1, data: '2026-01-01', trovato_in_cassa: 0, lasciato_in_cassa: 50, pagato_produttore: 10 },
      { id: 2, data: '2026-01-02', trovato_in_cassa: 0, lasciato_in_cassa: 80, pagato_produttore: 20 },
      { id: 3, data: '2026-01-03', trovato_in_cassa: 0, lasciato_in_cassa: 60, pagato_produttore: 5 },
    ];

    // Input is DESC (newest first), which is how storico loads it
    const desc = [...consegne].reverse();
    const result = processConsegneWithDynamicValues(desc);

    // Result should be in DESC order (same as input)
    expect(result[0].data).toBe('2026-01-03');
    expect(result[1].data).toBe('2026-01-02');
    expect(result[2].data).toBe('2026-01-01');

    // First consegna: no previous → trovato_in_cassa unchanged (0)
    const first = result.find(c => c.data === '2026-01-01');
    expect(first.trovato_in_cassa).toBe(0);

    // Second consegna: trovato = first.lasciato = 50
    const second = result.find(c => c.data === '2026-01-02');
    expect(second.trovato_in_cassa).toBe(50);

    // Third consegna: trovato = second.lasciato = 80
    const third = result.find(c => c.data === '2026-01-03');
    expect(third.trovato_in_cassa).toBe(80);
  });

  it('works with isAscending=true', () => {
    const consegne = [
      { id: 1, data: '2026-01-01', trovato_in_cassa: 0, lasciato_in_cassa: 100 },
      { id: 2, data: '2026-01-02', trovato_in_cassa: 0, lasciato_in_cassa: 200 },
    ];

    const result = processConsegneWithDynamicValues(consegne, true);
    expect(result[0].trovato_in_cassa).toBe(0);    // first: no previous
    expect(result[1].trovato_in_cassa).toBe(100);   // second: prev lasciato
  });
});
