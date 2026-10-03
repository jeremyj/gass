'use strict';

const { validateConsegnaPayload } = require('../../server/services/validation');

const movimento = (fields = {}) => ({
  partecipante_id: 1, contoProduttore: 10, importoSaldato: 10, usaCredito: 0,
  debitoLasciato: 0, creditoLasciato: 0, debitoSaldato: 0, ...fields
});
const payload = (fields = {}, movimenti = [movimento()]) => ({
  data: '2026-09-30', trovatoInCassa: 50, partecipanti: movimenti, ...fields
});
const saldo = value => () => value;

describe('validateConsegnaPayload', () => {
  it('accepts a normal payload', () => {
    expect(validateConsegnaPayload(payload(), saldo(0))).toBeNull();
  });

  it('requires each uscita di cassa to be a positive amount with a motivo', () => {
    const uscite = list => payload({ uscite: list });
    expect(validateConsegnaPayload(uscite([{ importo: 45, motivo: 'teatro' }, { importo: 20, motivo: 'tofu' }]), saldo(0))).toBeNull();
    expect(validateConsegnaPayload(uscite([]), saldo(0))).toBeNull();
    expect(validateConsegnaPayload(uscite([{ importo: 0, motivo: 'x' }]), saldo(0))).toMatch(/importo/);
    expect(validateConsegnaPayload(uscite([{ importo: 5, motivo: ' ' }]), saldo(0))).toMatch(/motivo/);
    expect(validateConsegnaPayload(payload({ uscite: 'x' }), saldo(0))).toMatch(/uscite/);
  });

  it('accepts a cassa-only save and a negative trovato', () => {
    expect(validateConsegnaPayload(payload({ trovatoInCassa: -5 }, []), saldo(0))).toBeNull();
  });

  it('rejects a well-formed date that does not exist', () => {
    expect(validateConsegnaPayload(payload({ data: '2026-02-31' }), saldo(0))).toMatch(/Data/);
    expect(validateConsegnaPayload(payload({ data: '2026-13-01' }), saldo(0))).toMatch(/Data/);
  });

  it('rejects a malformed date', () => {
    expect(validateConsegnaPayload(payload({ data: '30/09/2026' }), saldo(0))).toMatch(/Data/);
  });

  it('rejects a missing partecipanti array', () => {
    expect(validateConsegnaPayload(payload({ partecipanti: undefined }), saldo(0))).toMatch(/partecipanti/);
  });

  it('rejects non-numeric, non-finite and negative amounts', () => {
    for (const bad of ['10', NaN, Infinity, -1]) {
      expect(validateConsegnaPayload(payload({}, [movimento({ importoSaldato: bad })]), saldo(0)))
        .toMatch(/importoSaldato/);
    }
  });

  it('rejects leaving both credito and debito', () => {
    const m = movimento({ creditoLasciato: 5, debitoLasciato: 5 });
    expect(validateConsegnaPayload(payload({}, [m]), saldo(0))).toMatch(/sia credito che debito/);
  });

  it('caps usaCredito at the available credit', () => {
    expect(validateConsegnaPayload(payload({}, [movimento({ usaCredito: 20 })]), saldo(20))).toBeNull();
    expect(validateConsegnaPayload(payload({}, [movimento({ usaCredito: 20.01 })]), saldo(20))).toMatch(/Credito/);
    expect(validateConsegnaPayload(payload({}, [movimento({ usaCredito: 5 })]), saldo(-10))).toMatch(/Credito/);
  });

  it('caps debitoSaldato at the existing debt', () => {
    expect(validateConsegnaPayload(payload({}, [movimento({ debitoSaldato: 26.73 })]), saldo(-26.73))).toBeNull();
    expect(validateConsegnaPayload(payload({}, [movimento({ debitoSaldato: 30 })]), saldo(-26.73))).toMatch(/Debito/);
    expect(validateConsegnaPayload(payload({}, [movimento({ debitoSaldato: 5 })]), saldo(10))).toMatch(/Debito/);
  });
});
