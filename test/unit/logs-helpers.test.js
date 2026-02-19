'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');

// Load utils.js first (provides escapeHtml, formatNumber, formatDateItalian)
const utilsCode = fs.readFileSync(path.join(__dirname, '../../public/js/shared/utils.js'), 'utf8');
const logsCode = fs.readFileSync(path.join(__dirname, '../../public/js/logs-desktop.js'), 'utf8');

const sandbox = {
  document: {
    addEventListener: () => {},
    getElementById: () => ({ innerHTML: '' }),
    createElement: () => ({ className: '', innerHTML: '', appendChild: () => {} }),
  },
  fetch: async () => {},
  setTimeout: () => {},
  currentPage: 1,
  totalPages: 1,
};
vm.createContext(sandbox);
vm.runInContext(utilsCode, sandbox);
vm.runInContext(logsCode, sandbox);

const { getEventIcon, getEventDescription, formatTimestamp } = sandbox;

describe('getEventIcon', () => {
  const cases = [
    ['movimento_created', '➕'],
    ['movimento_historical', '📜'],
    ['movimento_updated', '✏️'],
    ['movimento_changed', '✏️'],
    ['consegna_closed', '🔒'],
    ['consegna_reopened', '🔓'],
    ['user_created', '👤'],
    ['user_edited', '✏️'],
    ['user_deleted', '🗑️'],
    ['password_changed', '🔑'],
    ['saldo_updated', '💰'],
    ['unknown_event', '•'],
  ];

  cases.forEach(([eventType, icon]) => {
    it(`returns ${icon} for ${eventType}`, () => {
      expect(getEventIcon(eventType)).toBe(icon);
    });
  });
});

describe('getEventDescription', () => {
  it('includes escaped participant name for movimento_created', () => {
    const event = { event_type: 'movimento_created', partecipante_nome: 'Mario <Rossi>' };
    expect(getEventDescription(event)).toContain('Mario &lt;Rossi&gt;');
    expect(getEventDescription(event)).toContain('Movimento creato');
  });

  it('includes escaped participant name for saldo_updated', () => {
    const event = { event_type: 'saldo_updated', partecipante_nome: 'Giulia & Bianchi' };
    expect(getEventDescription(event)).toContain('Giulia &amp; Bianchi');
  });

  it('returns plain text for consegna_closed', () => {
    const event = { event_type: 'consegna_closed' };
    expect(getEventDescription(event)).toBe('Consegna chiusa');
  });

  it('returns plain text for consegna_reopened', () => {
    const event = { event_type: 'consegna_reopened' };
    expect(getEventDescription(event)).toBe('Consegna riaperta');
  });

  it('uses N/A when partecipante_nome is null for user_edited', () => {
    const event = { event_type: 'user_edited', partecipante_nome: null };
    expect(getEventDescription(event)).toContain('N/A');
  });

  it('escapes event_type for unknown events', () => {
    const event = { event_type: '<custom_event>' };
    const result = getEventDescription(event);
    expect(result).not.toContain('<custom_event>');
    expect(result).toContain('&lt;custom_event&gt;');
  });
});

describe('formatTimestamp', () => {
  it('returns "-" for null', () => {
    expect(formatTimestamp(null)).toBe('-');
  });

  it('returns "-" for undefined', () => {
    expect(formatTimestamp(undefined)).toBe('-');
  });

  it('formats a local datetime string as DD/MM/YYYY HH:MM:SS', () => {
    // Use a local time string (no timezone spec) to get deterministic output
    const result = formatTimestamp('2026-02-19T10:30:45');
    expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/);
    expect(result).toContain('2026');
  });
});
