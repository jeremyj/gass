'use strict';

const { semestreOf, semestreLabel, semestreDopo, isSemestre, allocate } = require('../../server/services/teatro-calc');

describe('semesters', () => {
  it('maps dates to January-June / July-December', () => {
    expect(semestreOf('2026-06-30')).toBe('2026-1');
    expect(semestreOf('2026-07-01')).toBe('2026-2');
    expect(semestreLabel('2026-2')).toBe('2° sem. 2026');
    expect(semestreDopo('2026-1')).toBe('2026-2');
    expect(semestreDopo('2026-2')).toBe('2027-1');
    expect(isSemestre('2026-2')).toBe(true);
    expect(isSemestre('2026-3')).toBe(false);
  });
});

describe('allocate', () => {
  const dovuti = [{ semestre: '2026-2', dovuto: 15 }, { semestre: '2026-1', dovuto: 15 }];

  it('covers the oldest semester first and leaves the last one partial', () => {
    const r = allocate(dovuti, 20);
    expect(r.righe).toEqual([{ semestre: '2026-1', dovuto: 15, pagato: 15 }, { semestre: '2026-2', dovuto: 15, pagato: 5 }]);
    expect(r.residuo).toBe(10);
    expect(r.anticipo).toBe(0);
  });

  it('keeps what exceeds the owed semesters as an advance', () => {
    const r = allocate(dovuti, 35);
    expect(r.residuo).toBe(0);
    expect(r.anticipo).toBe(5);
  });

  it('skips non dovuto (0) and handles reduced quotas', () => {
    const r = allocate([{ semestre: '2025-2', dovuto: 0 }, { semestre: '2026-1', dovuto: 7 }, { semestre: '2026-2', dovuto: 15 }], 7);
    expect(r.righe.map(x => x.pagato)).toEqual([0, 7, 0]);
    expect(r.residuo).toBe(15);
  });
});

describe('coperturaPagamenti', () => {
  const { coperturaPagamenti, copreLabel } = require('../../server/services/teatro-calc');
  const dovuti = [{ semestre: '2026-2', dovuto: 15 }, { semestre: '2026-1', dovuto: 15 }, { semestre: '2025-2', dovuto: 0 }];
  const labels = (pagamenti, opts = { quota: 15, dopo: '2026-2' }) =>
    coperturaPagamenti(dovuti, pagamenti, opts).map(p => [p.id, copreLabel(p.copre)]);

  it('replays payments by date then id: acconto, salda, anticipo', () => {
    expect(labels([
      { id: 3, data: '2026-10-27', importo: 25 },
      { id: 1, data: '2026-03-03', importo: 10 },
      { id: 2, data: '2026-03-03', importo: 10 }
    ])).toEqual([
      [1, 'acconto 1° sem. 2026'],
      [2, 'salda 1° sem. 2026, acconto 2° sem. 2026'],
      [3, 'salda 2° sem. 2026, anticipo 1° sem. 2027']
    ]);
  });

  it('keeps an advance on the following semesters at the latest quota', () => {
    expect(labels([
      { id: 1, data: '2026-01-10', importo: 30 },
      { id: 2, data: '2026-10-01', importo: 20 },
      { id: 3, data: '2026-11-01', importo: 15 }
    ])).toEqual([
      [1, 'salda 1° sem. 2026, salda 2° sem. 2026'],
      [2, 'anticipo 1° sem. 2027, anticipo 2° sem. 2027'],
      [3, 'anticipo 2° sem. 2027, anticipo 1° sem. 2028']
    ]);
  });

  it('starts an advance after `dopo` when the owed semesters end earlier', () => {
    expect(labels([{ id: 1, data: '2027-02-01', importo: 45 }], { quota: 15, dopo: '2027-1' }))
      .toEqual([[1, 'salda 1° sem. 2026, salda 2° sem. 2026, anticipo 2° sem. 2027']]);
  });

  it('puts the whole advance on one semester when the quota is 0', () => {
    expect(labels([{ id: 1, data: '2026-01-10', importo: 40 }], { quota: 0, dopo: '2026-2' }))
      .toEqual([[1, 'salda 1° sem. 2026, salda 2° sem. 2026, anticipo 1° sem. 2027']]);
  });
});
