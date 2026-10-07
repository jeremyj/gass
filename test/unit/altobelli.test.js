'use strict';

const fs = require('fs');
const path = require('path');
const { parseSchede, trovaSchede, parseCsv, parseImporto, parseFoglio, confronta, foglioId } =
  require('../../server/services/altobelli');

const fixture = name => fs.readFileSync(path.join(__dirname, '../fixtures/altobelli', name), 'utf8');

describe('parseSchede', () => {
  it('reads every tab with its gid from the /edit page, hidden ones included', () => {
    const schede = parseSchede(fixture('edit.html'));
    expect(schede).toHaveLength(6);
    expect(schede[0]).toEqual({ nome: 'Mercoledì 8 aprile', gid: '111' });
    expect(schede[5]).toEqual({ nome: '6 ottobre', gid: '666' });
  });

  it('gives no tabs for a page without them', () => {
    expect(parseSchede('<html>sign in</html>')).toEqual([]);
  });
});

describe('trovaSchede', () => {
  const schede = parseSchede(fixture('edit.html'));
  it('matches the tab of a date, whatever the weekday and spaces around it', () => {
    expect(trovaSchede(schede, '2026-10-06').map(s => s.gid)).toEqual(['666']);
    expect(trovaSchede(schede, '2026-04-08').map(s => s.gid)).toEqual(['111']);
    expect(trovaSchede(schede, '2026-06-30').map(s => s.gid)).toEqual(['444']);
  });
  it('returns both tabs of a week with a second order', () => {
    expect(trovaSchede(schede, '2026-06-23').map(s => s.gid)).toEqual(['222', '333']);
  });
  it('never matches another day of the same month', () => {
    expect(trovaSchede(schede, '2026-10-16')).toEqual([]);
    expect(trovaSchede(schede, '2026-06-03')).toEqual([]);
  });
});

describe('parseCsv and parseImporto', () => {
  it('handles quoted cells with commas, quotes and newlines', () => {
    expect(parseCsv('a,"b,1","c\nd","e ""x"""\nf,,')).toEqual([['a', 'b,1', 'c\nd', 'e "x"'], ['f', '', '']]);
  });
  it('reads Italian amounts with or without the euro sign', () => {
    expect(parseImporto('€ 37,61')).toBe(37.61);
    expect(parseImporto('17,2')).toBe(17.2);
    expect(parseImporto('23')).toBe(23);
    expect(parseImporto('€ 1.234,50')).toBe(1234.5);
    expect(parseImporto('')).toBeNull();
    expect(parseImporto('canasta')).toBeNull();
  });
});

describe('parseFoglio', () => {
  it('reads the people rows and the total written at the bottom', () => {
    const f = parseFoglio(fixture('29-settembre.csv'));
    expect(f.righe).toHaveLength(14);
    expect(f.righe[0]).toEqual({ nome: 'Anna', approssimativo: 72, effettivo: 74.8 });
    expect(f.totaleScritto).toBe(319.2);
  });

  it('keeps an empty effettivo as not filled in', () => {
    const csv = ',importo approssimativo,effettivi\nAnna,"€ 10,00","€ 11,00"\nBruno,"€ 24,51",\n';
    expect(parseFoglio(csv).righe[1]).toEqual({ nome: 'Bruno', approssimativo: 24.51, effettivo: null });
  });

  it('refuses a tab without the effettivi column', () => {
    expect(() => parseFoglio('a,b,c\n1,2,3\n')).toThrow(/effettivi/);
  });
});

describe('confronta', () => {
  const persone = [{ id: 1, nome: 'Anna' }, { id: 2, nome: 'Bruno' }, { id: 3, nome: 'Carla Rossi' }, { id: 4, nome: 'Dario' }, { id: 5, nome: 'Elena' }];
  const foglio = {
    righe: [
      { nome: 'Anna', approssimativo: 20, effettivo: 23 },
      { nome: 'bruno ', approssimativo: 25, effettivo: 26 },
      { nome: 'Carla', approssimativo: 37, effettivo: 37.61 },
      { nome: 'Dario', approssimativo: 30, effettivo: 32.5 },
      { nome: 'Franco', approssimativo: 24.51, effettivo: null },
      { nome: 'ginetto', approssimativo: 14, effettivo: 14.4 }
    ],
    totaleScritto: 86.61
  };
  const movimenti = [
    { partecipante_id: 1, conto_produttore: 23 },
    { partecipante_id: 2, conto_produttore: 26 },
    { partecipante_id: 3, conto_produttore: 37.6 },
    { partecipante_id: 5, conto_produttore: 18.3 },
    { partecipante_id: 6, conto_produttore: 0 } // paid a debt only: not an Altobelli order
  ];
  const nomi = { anna: 1, bruno: 2, carla: 3, dario: 4, franco: 7 };
  const r = confronta(foglio, movimenti, nomi, persone);
  const esito = nome => r.righe.find(x => x.nome === nome || x.persona === nome).esito;

  it('gives every row its outcome', () => {
    expect(esito('Anna')).toBe('uguale');
    expect(esito('bruno ')).toBe('uguale');
    expect(esito('Carla')).toBe('diverso');
    expect(esito('Dario')).toBe('manca_app');
    expect(esito('Franco')).toBe('non_segnato');
    expect(esito('ginetto')).toBe('da_associare');
    expect(esito('Elena')).toBe('manca_foglio');
    expect(r.righe).toHaveLength(7);
  });

  it('suggests a person for an unknown name by display name or its first word', () => {
    const carla = confronta({ righe: [{ nome: 'carla', approssimativo: 1, effettivo: 1 }], totaleScritto: null }, [], {}, persone);
    expect(carla.righe[0]).toMatchObject({ esito: 'da_associare', suggerito: 3 });
  });

  it('sums the effettivi row by row and flags a written total that differs', () => {
    expect(r.kpi.sommaEffettivi).toBe(133.51);
    expect(r.kpi.nonSegnati).toBe(1);
    expect(r.kpi.totaleScritto).toBe(86.61);
    expect(r.kpi.totaleDiverso).toBe(true);
    expect(r.kpi.sommaConti).toBe(104.9);
  });
});

describe('foglioId', () => {
  it('extracts the spreadsheet id from its link', () => {
    expect(foglioId('https://docs.google.com/spreadsheets/d/1Oe_f0CI-x/edit?usp=drivesdk')).toBe('1Oe_f0CI-x');
    expect(foglioId('https://example.com/x')).toBeNull();
  });
});
