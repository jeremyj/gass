'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');

// Load utils.js first (provides formatNumber etc.), then storico.js
const utilsCode = fs.readFileSync(path.join(__dirname, '../../public/js/shared/utils.js'), 'utf8');
const storicoCode = fs.readFileSync(path.join(__dirname, '../../public/js/storico.js'), 'utf8');

const sandbox = {
  document: {
    addEventListener: () => {},
    getElementById: () => ({ innerHTML: '' }),
    createElement: () => {
      const el = {
        className: '',
        innerHTML: '',
        onclick: null,
        classList: { add: () => {} },
        appendChild: () => {},
      };
      return el;
    },
  },
  fetch: async () => {},
  setTimeout: () => {},
};
vm.createContext(sandbox);
vm.runInContext(utilsCode, sandbox);
vm.runInContext(storicoCode, sandbox);

const { formatDateItalianWithDay } = sandbox;

describe('formatDateItalianWithDay', () => {
  // Use dates with known day-of-week
  const cases = [
    { date: '2026-02-16', day: 'Lunedì' },
    { date: '2026-02-17', day: 'Martedì' },
    { date: '2026-02-18', day: 'Mercoledì' },
    { date: '2026-02-19', day: 'Giovedì' },
    { date: '2026-02-20', day: 'Venerdì' },
    { date: '2026-02-21', day: 'Sabato' },
    { date: '2026-02-22', day: 'Domenica' },
  ];

  cases.forEach(({ date, day }) => {
    it(`formats ${date} as DD/MM/YYYY - ${day}`, () => {
      const result = formatDateItalianWithDay(date);
      const [datePart, dayName] = result.split(' - ');
      // datePart should be dd/mm/yyyy format
      expect(datePart).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
      expect(dayName).toBe(day);
    });
  });

  it('pads single-digit day and month', () => {
    const result = formatDateItalianWithDay('2026-01-05');
    expect(result.startsWith('05/01/2026')).toBe(true);
  });
});
