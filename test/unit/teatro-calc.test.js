'use strict';

const { semestreOf, semestreLabel, isSemestre, allocate } = require('../../server/services/teatro-calc');

describe('semesters', () => {
  it('maps dates to January-June / July-December', () => {
    expect(semestreOf('2026-06-30')).toBe('2026-1');
    expect(semestreOf('2026-07-01')).toBe('2026-2');
    expect(semestreLabel('2026-2')).toBe('2° sem. 2026');
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
