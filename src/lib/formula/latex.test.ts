import { beforeEach, describe, expect, it } from 'vitest';
import { mps, sandwich } from '../generators/index';
import { resetIdCounters } from '../model/id';
import { createTensor, emptyNetwork } from '../model/network';
import type { Network } from '../model/types';
import { assignIndices } from './indices';
import { buildFormula, DEFAULT_OPTIONS } from './latex';

function rede(fragmento: { tensors: Network['tensors']; bonds: Network['bonds'] }): Network {
  return { ...emptyNetwork(), tensors: fragmento.tensors, bonds: fragmento.bonds };
}

function formula(network: Network, opcoes = DEFAULT_OPTIONS) {
  return buildFormula(network, assignIndices(network), opcoes);
}

describe('fórmula em índices', () => {
  beforeEach(resetIdCounters);

  it('sanduíche de 4 sítios — o aceite do M3a, conferido à mão', () => {
    const f = formula(rede(sandwich({ sites: 4 })));

    // Sem perna livre, o lado esquerdo é escalar.
    expect(f.lhs).toBe('M');
    expect(f.summed).toHaveLength(17);

    // Bra em cima, operador no meio, ket embaixo: a ordem de leitura do canvas
    // produz ∑ A† W A, que é ⟨ψ|O|ψ⟩ lido da esquerda para a direita.
    expect(f.latex).toBe(
      'M = \\sum_{\\alpha \\beta \\gamma \\delta \\epsilon \\zeta \\eta \\theta \\lambda \\mu \\nu \\xi ' +
        '\\alpha_{1} \\beta_{1} \\gamma_{1} \\delta_{1} \\epsilon_{1}} ' +
        'A^{[1]\\dagger}_{\\alpha \\delta}\\,' +
        'A^{[2]\\dagger}_{\\alpha \\beta \\epsilon}\\,' +
        'A^{[3]\\dagger}_{\\beta \\gamma \\zeta}\\,' +
        'A^{[4]\\dagger}_{\\gamma \\eta}\\,' +
        'W^{[1]}_{\\theta \\delta \\nu}\\,' +
        'W^{[2]}_{\\theta \\lambda \\epsilon \\xi}\\,' +
        'W^{[3]}_{\\lambda \\mu \\zeta \\alpha_{1}}\\,' +
        'W^{[4]}_{\\mu \\eta \\beta_{1}}\\,' +
        'A^{[1]}_{\\gamma_{1} \\nu}\\,' +
        'A^{[2]}_{\\gamma_{1} \\delta_{1} \\xi}\\,' +
        'A^{[3]}_{\\delta_{1} \\epsilon_{1} \\alpha_{1}}\\,' +
        'A^{[4]}_{\\epsilon_{1} \\beta_{1}}',
    );
  });

  it('MPS aberta: índices livres à esquerda, na ordem do canvas', () => {
    const f = formula(rede(mps({ sites: 4 })));
    expect(f.latex).toBe(
      'M_{i j k l} = \\sum_{\\alpha \\beta \\gamma} ' +
        'A^{[1]}_{\\alpha i}\\,A^{[2]}_{\\alpha \\beta j}\\,' +
        'A^{[3]}_{\\beta \\gamma k}\\,A^{[4]}_{\\gamma l}',
    );
  });

  it('convenção de Einstein some com o somatório, e só com ele', () => {
    const network = rede(mps({ sites: 3 }));
    const explicito = formula(network);
    const einstein = formula(network, { ...DEFAULT_OPTIONS, summation: 'einstein' });
    expect(explicito.rhs.startsWith('\\sum')).toBe(true);
    expect(einstein.rhs.startsWith('\\sum')).toBe(false);
    expect(einstein.rhs).toBe(explicito.rhs.slice(explicito.rhs.indexOf('} ') + 2));
    expect(einstein.lhs).toBe(explicito.lhs);
  });

  it('conjugado sai com daga ou com asterisco, conforme a preferência', () => {
    const network = rede(sandwich({ sites: 2 }));
    expect(formula(network).latex).toContain('^{[1]\\dagger}');
    expect(formula(network, { ...DEFAULT_OPTIONS, conjugate: 'asterisk' }).latex).toContain('^{[1]*}');
  });

  it('separa os índices por espaço: grego colado no seguinte vira comando inexistente', () => {
    const f = formula(rede(mps({ sites: 2 })));
    expect(f.latex).not.toMatch(/\\alpha[a-z]/);
    expect(f.latex).toContain('\\alpha i');
  });

  it('a forma ponto vira delta, e delta não se conjuga', () => {
    const network = emptyNetwork();
    const delta = createTensor(0, 0, { shape: 'dot', name: 'D', legCount: 2 });
    delta.conjugate = true;
    network.tensors.push(delta);
    const f = formula(network);
    // A ordem dos índices dentro do fator é a ordem das pernas no modelo — que
    // é a ordem dos eixos do tensor —, e não a ordem de leitura do canvas. Aqui
    // a perna 0 aponta para a direita e a 1 para a esquerda, então a da
    // esquerda ganha `i` por ser lida antes, mas aparece em segundo lugar.
    expect(f.rhs).toBe('\\delta_{j i}');
    expect(f.rhs).not.toContain('\\dagger');
  });

  it('nome de mais de uma letra vai reto, para o KaTeX não o ler como produto', () => {
    const network = emptyNetwork();
    network.tensors.push(createTensor(0, 0, { name: 'Op', legCount: 1 }));
    expect(formula(network).rhs).toBe('\\mathrm{Op}_{i}');
  });

  it('tensor sem nome recebe letra pela ordem de criação, não pela posição', () => {
    const network = emptyNetwork();
    const primeiro = createTensor(300, 0, { legCount: 1 });
    const segundo = createTensor(0, 0, { legCount: 1 });
    network.tensors.push(primeiro, segundo);

    // O segundo criado está à esquerda, então encabeça o produto — mas continua B.
    const f = formula(network);
    expect(f.rhs).toBe('B_{i}\\,A_{j}');
  });

  it('rede vazia não tem fórmula', () => {
    const f = formula(emptyNetwork());
    expect(f.empty).toBe(true);
    expect(f.latex).toBe('');
  });
});
