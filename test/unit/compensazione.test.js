'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');

// Credit/debt auto-compensation of the participant card (handleContoProduttoreInput),
// run in a sandbox with a minimal fake DOM holding only the card's fields
function element() {
  return {
    value: '', textContent: '', innerHTML: '', dataset: {}, style: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    closest: () => null, querySelector: () => null, querySelectorAll: () => [],
    addEventListener() {}, setAttribute() {}, removeAttribute() {},
  };
}

function loadCard() {
  const els = {};
  const sandbox = {
    document: {
      getElementById: id => (els[id] ||= element()),
      querySelector: () => null, querySelectorAll: () => [],
      addEventListener() {}, createElement: element, body: element(),
    },
    window: {}, setTimeout: () => {}, console,
  };
  vm.createContext(sandbox);
  for (const f of ['utils.js', 'consegna-common.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../../public/js/shared', f), 'utf8'), sandbox);
  }
  // Fill the card's fields and recompute, as typing does
  return (saldo, conto, importo) => {
    const id = 1;
    for (const f of ['contoProduttore', 'importo', 'usaCredito', 'debitoSaldato', 'credito', 'debito']) sandbox.document.getElementById(`${f}_${id}`).value = '';
    els[`contoProduttore_${id}`].value = conto;
    els[`importo_${id}`].value = importo;
    sandbox.handleContoProduttoreInput(id, saldo);
    const v = f => els[`${f}_${id}`].value;
    return { usaCredito: v('usaCredito'), debito: v('debito'), credito: v('credito'), debitoSaldato: v('debitoSaldato') };
  };
}

const card = loadCard();

describe('auto-compensation in the participant card', () => {
  it('uses the credit when the person pays nothing (Paola Mazza, 6/10/2026)', () => {
    expect(card(55.8, '17,40', '')).toMatchObject({ usaCredito: '17,40', debito: '' });
  });

  it('uses only the credit available and leaves the rest as debt', () => {
    expect(card(5, '30', '')).toMatchObject({ usaCredito: '5', debito: '25' });
  });

  it('uses the credit for what a partial payment does not cover', () => {
    expect(card(5, '30', '8')).toMatchObject({ usaCredito: '5', debito: '17' });
  });

  it('pays off a debt with no conto (19dfdf7)', () => {
    expect(card(-10, '', '10')).toMatchObject({ debitoSaldato: '10', credito: '' });
  });

  it('leaves the whole conto as debt for someone without credit', () => {
    expect(card(-10, '32,50', '')).toMatchObject({ usaCredito: '', debito: '32,50' });
  });
});
