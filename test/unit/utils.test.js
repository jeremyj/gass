'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');

// Load utils.js in a sandboxed context to avoid DOM dependencies
const code = fs.readFileSync(path.join(__dirname, '../../public/js/shared/utils.js'), 'utf8');
const sandbox = {
  document: {
    getElementById: () => ({ textContent: '', className: '' }),
  },
  setTimeout: () => {},
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const { escapeHtml, formatDateItalian, parseAmount, roundToCents, formatNumber, toLocalDateString,
        debitoPagato, debitoNuovo, formatEuro, formatSigned, weekdayShort, monthName,
        formatEffettoCassa, segnoDigitato } = sandbox;

describe('toLocalDateString', () => {
  it('uses the local calendar date, not the UTC one', () => {
    expect(toLocalDateString(new Date(2026, 8, 30, 0, 30))).toBe('2026-09-30');
    expect(toLocalDateString(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

describe('escapeHtml', () => {
  it('escapes ampersand', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes < and >', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes double quotes', () => {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#39;s');
  });

  it('returns empty string for null', () => {
    expect(escapeHtml(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(escapeHtml(undefined)).toBe('');
  });

  it('converts numbers to escaped strings', () => {
    expect(escapeHtml(42)).toBe('42');
  });

  it('passes safe strings unchanged', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });
});

describe('formatDateItalian', () => {
  it('converts yyyy-mm-dd to dd/mm/yyyy', () => {
    expect(formatDateItalian('2026-02-19')).toBe('19/02/2026');
  });

  it('returns "-" for null', () => {
    expect(formatDateItalian(null)).toBe('-');
  });

  it('returns "-" for empty string', () => {
    expect(formatDateItalian('')).toBe('-');
  });

  it('pads single digit day and month', () => {
    expect(formatDateItalian('2026-01-05')).toBe('05/01/2026');
  });
});

describe('parseAmount', () => {
  it('parses a dot-decimal string', () => {
    expect(parseAmount('12.50')).toBe(12.5);
  });

  it('parses a comma-decimal string', () => {
    expect(parseAmount('12,50')).toBe(12.5);
  });

  it('returns 0 for empty string', () => {
    expect(parseAmount('')).toBe(0);
  });

  it('returns 0 for non-numeric string', () => {
    expect(parseAmount('abc')).toBe(0);
  });

  it('passes through numeric values', () => {
    expect(parseAmount(7.5)).toBe(7.5);
  });
});

describe('roundToCents', () => {
  it('rounds to nearest 0.01', () => {
    expect(roundToCents(1.006)).toBe(1.01);
    expect(roundToCents(1.004)).toBe(1.0);
  });

  it('returns whole numbers unchanged', () => {
    expect(roundToCents(10)).toBe(10);
  });
});

describe('formatNumber', () => {
  it('displays whole numbers without decimals', () => {
    expect(formatNumber(10)).toBe('10');
    expect(formatNumber(0)).toBe('0');
  });

  it('displays decimal numbers with 2 decimal places and the Italian comma', () => {
    expect(formatNumber(10.5)).toBe('10,50');
    expect(formatNumber(3.14)).toBe('3,14');
  });

  it('round-trips through parseAmount', () => {
    expect(parseAmount(formatNumber(10.5))).toBe(10.5);
    expect(parseAmount(formatNumber(-14.25))).toBe(-14.25);
  });

  it('returns empty string for null', () => {
    expect(formatNumber(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(formatNumber(undefined)).toBe('');
  });

  it('returns empty string for NaN string', () => {
    expect(formatNumber('abc')).toBe('');
  });
});

describe('formatEuro / formatSigned', () => {
  it('puts € after the amount', () => {
    expect(formatEuro(11.5)).toBe('11,50 €');
    expect(formatEuro(8)).toBe('8 €');
  });

  it('signs credit with + and debt with a typographic minus', () => {
    expect(formatSigned(6)).toBe('+6 €');
    expect(formatSigned(-1.5)).toBe('−1,50 €');
    expect(formatSigned(0)).toBe('0 €');
  });
});

describe('debitoPagato / debitoNuovo', () => {
  it('partial payoff: shows what was paid, and no new debt', () => {
    const m = { debito_saldato: 26.73, debito_lasciato: 8.99 };
    expect(debitoPagato(m)).toBe(17.74);
    expect(debitoNuovo(m)).toBe(0);
  });

  it('full payoff', () => {
    const m = { debito_saldato: 26.73, debito_lasciato: 0 };
    expect(debitoPagato(m)).toBe(26.73);
    expect(debitoNuovo(m)).toBe(0);
  });

  it('new debt without payoff', () => {
    const m = { debito_saldato: 0, debito_lasciato: 12 };
    expect(debitoPagato(m)).toBe(0);
    expect(debitoNuovo(m)).toBe(12);
  });
});

describe('weekdayShort / monthName', () => {
  it('give the Italian short weekday and month name', () => {
    expect(weekdayShort('2026-12-09')).toBe('mer');
    expect(monthName('2026-12-09')).toBe('dicembre');
  });
});

describe('formatEffettoCassa', () => {
  it('shows an uscita (stored positive) as − and an entrata (stored negative) as +', () => {
    expect(formatEffettoCassa(90)).toBe('−90');
    expect(formatEffettoCassa(0.8)).toBe('−0,80');
    expect(formatEffettoCassa(-0.2)).toBe('+0,20');
    expect(formatEffettoCassa(0)).toBe('0');
  });
});

describe('segnoDigitato', () => {
  it('reads a leading − or + typed in an uscita amount and strips it', () => {
    expect(segnoDigitato('-0,80')).toEqual({ segno: 'esce', resto: '0,80' });
    expect(segnoDigitato('−3')).toEqual({ segno: 'esce', resto: '3' });
    expect(segnoDigitato('+0,20')).toEqual({ segno: 'entra', resto: '0,20' });
    expect(segnoDigitato('12')).toEqual({ segno: null, resto: '12' });
  });
});
