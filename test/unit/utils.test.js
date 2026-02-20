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

const { escapeHtml, formatDateItalian, parseAmount, roundUpCents, formatNumber, formatSaldo } = sandbox;

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

describe('roundUpCents', () => {
  it('rounds to nearest 0.01', () => {
    expect(roundUpCents(1.006)).toBe(1.01);
    expect(roundUpCents(1.004)).toBe(1.0);
  });

  it('returns whole numbers unchanged', () => {
    expect(roundUpCents(10)).toBe(10);
  });
});

describe('formatNumber', () => {
  it('displays whole numbers without decimals', () => {
    expect(formatNumber(10)).toBe('10');
    expect(formatNumber(0)).toBe('0');
  });

  it('displays decimal numbers with 2 decimal places', () => {
    expect(formatNumber(10.5)).toBe('10.50');
    expect(formatNumber(3.14)).toBe('3.14');
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

describe('formatSaldo', () => {
  it('formats whole number by removing .0', () => {
    expect(formatSaldo(5)).toBe('5');
    expect(formatSaldo(-5)).toBe('5'); // abs value
  });

  it('keeps non-zero decimal with 2 places', () => {
    expect(formatSaldo(5.5)).toBe('5.50');
    expect(formatSaldo(5.73)).toBe('5.73');
  });

  it('handles 0', () => {
    expect(formatSaldo(0)).toBe('0');
  });
});
