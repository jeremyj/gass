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

describe('arrotonda10', () => {
  it('rounds to the 10 cents, a 5 upwards', () => {
    expect(sandbox.arrotonda10(20.82)).toBe(20.8);
    expect(sandbox.arrotonda10(21.08)).toBe(21.1);
    expect(sandbox.arrotonda10(21.05)).toBe(21.1);
    expect(sandbox.arrotonda10(37.07)).toBe(37.1);
    expect(sandbox.arrotonda10(14.3)).toBe(14.3);
  });
});

describe('renderContoHint', () => {
  it('proposes the Altobelli effettivo in green until the conto equals it', () => {
    expect(hint('', 44).innerHTML).toContain('class="conto-prop verde"');
    expect(hint('42', 44).innerHTML).toContain('44');
    expect(hint('44', 44).innerHTML).toContain('Uguale al foglio Altobelli');
  });

  it('without an effettivo, proposes the receipt rounded to the 10 cents in amber', () => {
    expect(hint('20,82', null).innerHTML).toContain('class="conto-prop ambra"');
    expect(hint('20,82', null).innerHTML).toContain('20,80');
    expect(hint('20,80', null).textContent).toContain('arrotondato ai 10 centesimi');
    expect(hint('', null).textContent).toContain('arrotondato ai 10 centesimi');
  });
});
