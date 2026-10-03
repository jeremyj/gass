// Validation of POST /api/consegna payloads. Every movimento is replayed into the saldo
// ledger, so a bad amount would corrupt every later saldo of that participant.

const { isDateString } = require('./turni-schedule');

const MOVIMENTO_AMOUNTS = ['contoProduttore', 'importoSaldato', 'usaCredito',
                           'debitoLasciato', 'creditoLasciato', 'debitoSaldato'];
const CASSA_AMOUNTS = ['trovatoInCassa', 'pagatoProduttore', 'lasciatoInCassa'];
const CENT = 0.005; // tolerance for float noise when comparing euro amounts

const isOptionalNumber = v => v == null || (typeof v === 'number' && Number.isFinite(v));
const isOptionalAmount = v => v == null || (isOptionalNumber(v) && v >= 0);

// Returns an Italian error message, or null when the payload is valid.
// saldoBefore(id) gives the saldo the participant's consegna form started from.
function validateConsegnaPayload(body, saldoBefore) {
  if (!body || !isDateString(body.data)) {
    return 'Data non valida';
  }
  for (const field of CASSA_AMOUNTS) {
    if (!isOptionalNumber(body[field])) return `Importo non valido: ${field}`;
  }
  if (!isOptionalAmount(body.usciteCassa)) return 'Importo non valido: usciteCassa';
  if (body.usciteCassa > 0 && !String(body.usciteMotivo || '').trim()) {
    return 'Indica il motivo delle uscite di cassa';
  }
  if (!Array.isArray(body.partecipanti)) return 'Elenco partecipanti non valido';

  for (const p of body.partecipanti) {
    if (!p || !Number.isInteger(p.partecipante_id)) return 'Partecipante non valido';
    for (const field of MOVIMENTO_AMOUNTS) {
      if (!isOptionalAmount(p[field])) return `Importo non valido: ${field}`;
    }
    if (p.debitoLasciato > 0 && p.creditoLasciato > 0) {
      return 'Non puoi lasciare sia credito che debito';
    }
    const saldo = saldoBefore(p.partecipante_id);
    if ((p.usaCredito || 0) > Math.max(0, saldo) + CENT) {
      return 'Credito usato superiore al credito disponibile';
    }
    if ((p.debitoSaldato || 0) > Math.max(0, -saldo) + CENT) {
      return 'Debito saldato superiore al debito esistente';
    }
  }
  return null;
}

module.exports = { validateConsegnaPayload };
