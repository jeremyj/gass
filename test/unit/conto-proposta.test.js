'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');

// Conto produttore proposal of the participant card (renderContoHint), in a sandbox with a fake DOM
const els = {};
const element = () => ({ value: '', textContent: '', innerHTML: '', dataset: {}, style: {} });
const sandbox = {
  document: { getElementById: id => (els[id] ||= element()), querySelector: () => null, querySelectorAll: () => [], addEventListener() {} },
  window: {}, setTimeout: () => {}, console, isConsegnaClosed: false,
};
vm.createContext(sandbox);
for (const f of ['utils.js', 'consegna-common.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../../public/js/shared', f), 'utf8'), sandbox);
}

const hint = (conto, effettivo) => {
  els.contoProduttore_1 = { ...element(), value: conto };
  els.contoHint_1 = element();
  vm.runInContext(`contoFoglio[1] = ${JSON.stringify(effettivo)}`, sandbox);
  sandbox.renderContoHint(1);
  return els.contoHint_1;
};

describe('renderContoHint', () => {
  it('proposes the Altobelli effettivo in green until the conto equals it', () => {
    expect(hint('', 44).innerHTML).toContain('class="conto-prop verde"');
    expect(hint('42', 44).innerHTML).toContain('44');
    expect(hint('44', 44).innerHTML).toContain('Uguale al foglio Altobelli');
  });

  it('without an effettivo, shows nothing: the empty field asks for the receipt rounded', () => {
    expect(hint('20,82', null).innerHTML).toBe('');
    expect(hint('', null).textContent).toBe('');
    expect(vm.runInContext('CONTO_PLACEHOLDER', sandbox)).toBe('arrotonda scontrino: ,01-,05 → ,00 · ,06-,09 → ,10');
  });
});
