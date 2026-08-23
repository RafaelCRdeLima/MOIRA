import { beforeEach, describe, expect, it } from 'vitest';
import { mera, mps } from '../generators/index';
import { resetIdCounters } from '../model/id';
import { addBond, createTensor, emptyNetwork } from '../model/network';
import type { Network } from '../model/types';
import { buildLegend } from './legend';
import { GENERIC, INK, ISOMETRY, UNITARY } from './palette';
import { bondDim, bondWidth, computeStyle, tensorFill, tensorRing } from './style';

function comFragmento(fragmento: { tensors: Network['tensors']; bonds: Network['bonds'] }): Network {
  return { ...emptyNetwork(), tensors: fragmento.tensors, bonds: fragmento.bonds };
}

describe('modos de coloração', () => {
  beforeEach(resetIdCounters);

  it('por tag: primeira tag pinta, segunda vira anel', () => {
    const network = emptyNetwork();
    const a = createTensor(0, 0, { tags: ['mps', 'bra'] });
    const b = createTensor(60, 0, { tags: ['mps'] });
    const c = createTensor(120, 0);
    network.tensors.push(a, b, c);
    const style = computeStyle(network);

    expect(tensorFill(network, style, a)).toBe(tensorFill(network, style, b));
    expect(tensorRing(network, style, a)).not.toBeNull();
    expect(tensorRing(network, style, b)).toBeNull();
    expect(tensorFill(network, style, c)).toBe(GENERIC); // sem tag, genérico
  });

  it('por papel: a forma diz o papel', () => {
    const network = emptyNetwork();
    network.colorMode = 'role';
    const iso = createTensor(0, 0, { shape: 'triangle' });
    const uni = createTensor(60, 0, { shape: 'square' });
    const delta = createTensor(120, 0, { shape: 'dot' });
    const gen = createTensor(180, 0);
    network.tensors.push(iso, uni, delta, gen);
    const style = computeStyle(network);

    expect(tensorFill(network, style, iso)).toBe(ISOMETRY);
    expect(tensorFill(network, style, uni)).toBe(UNITARY);
    expect(tensorFill(network, style, delta)).toBe(INK);
    expect(tensorFill(network, style, gen)).toBe(GENERIC);
  });

  it('por camada: uma MERA vira um degradê de baixo para cima', () => {
    const network = comFragmento(mera({ leaves: 16 }));
    network.colorMode = 'layer';
    const style = computeStyle(network);

    const baixo = network.tensors.reduce((a, b) => (a.y > b.y ? a : b));
    const cima = network.tensors.reduce((a, b) => (a.y < b.y ? a : b));
    expect(tensorFill(network, style, baixo)).not.toBe(tensorFill(network, style, cima));
  });

  it('por grau: quem tem mais pernas recebe outra cor', () => {
    const network = emptyNetwork();
    network.colorMode = 'degree';
    const poucas = createTensor(0, 0, { legCount: 2 });
    const muitas = createTensor(60, 0, { legCount: 6 });
    network.tensors.push(poucas, muitas);
    const style = computeStyle(network);
    expect(tensorFill(network, style, poucas)).not.toBe(tensorFill(network, style, muitas));
  });

  it('a cor manual sobrepõe qualquer modo', () => {
    const network = emptyNetwork();
    const tensor = createTensor(0, 0, { tags: ['mps'] });
    tensor.color = '#123456';
    network.tensors.push(tensor);

    for (const mode of ['tag', 'role', 'layer', 'degree', 'manual'] as const) {
      network.colorMode = mode;
      expect(tensorFill(network, computeStyle(network), tensor)).toBe('#123456');
    }
  });

  it('o delta é sempre tinta cheia, seja qual for o modo', () => {
    const network = emptyNetwork();
    const delta = createTensor(0, 0, { shape: 'dot', tags: ['mps'] });
    network.tensors.push(delta);
    expect(tensorFill(network, computeStyle(network), delta)).toBe(INK);
  });
});

describe('espessura na rede', () => {
  beforeEach(resetIdCounters);

  it('a dimensão do vínculo cai para a das pernas quando não foi declarada', () => {
    const network = emptyNetwork();
    const a = createTensor(0, 0);
    const b = createTensor(60, 0);
    network.tensors.push(a, b);
    a.legs[0]!.dim = 64;
    const bond = addBond(network, a.legs[0]!.id, b.legs[1]!.id)!;

    expect(bond.dim).toBeUndefined(); // as pontas não concordavam
    expect(bondDim(network, bond)).toBe(64);
    expect(bondWidth(network, bond)).toBeGreaterThan(bondWidth(network, { ...bond, dim: 2 }));
  });

  it('numa MERA os vínculos de cima são mais grossos que os de baixo', () => {
    const network = comFragmento(mera({ leaves: 16 }));
    const larguras = network.bonds.map((b) => bondWidth(network, b));
    expect(Math.max(...larguras)).toBeGreaterThan(Math.min(...larguras));
  });
});

describe('legenda automática', () => {
  beforeEach(resetIdCounters);

  it('lista as tags presentes e some quando desligada', () => {
    const network = comFragmento(mps({ sites: 4 }));
    const style = computeStyle(network);
    const legenda = buildLegend(network, style)!;
    expect(legenda.swatches.some((s) => s.text === 'mps')).toBe(true);

    network.showLegend = false;
    expect(buildLegend(network, computeStyle(network))).toBeNull();
  });

  it('no modo por camada vira rampa, não amostras', () => {
    const network = comFragmento(mera({ leaves: 16 }));
    network.colorMode = 'layer';
    const legenda = buildLegend(network, computeStyle(network))!;
    expect(legenda.swatches).toHaveLength(0);
    expect(legenda.ramp).not.toBeNull();
  });

  it('a barra de cor do valor das arestas só aparece quando há valor', () => {
    const network = comFragmento(mps({ sites: 4 }));
    network.edgeColorByValue = true;
    expect(buildLegend(network, computeStyle(network))!.valueRamp).toBeNull();

    network.bonds[0]!.value = 0.4;
    network.bonds[1]!.value = 1.2;
    const legenda = buildLegend(network, computeStyle(network))!;
    expect(legenda.valueRamp).toEqual({ min: 0.4, max: 1.2, key: 'legend.bondValue' });
  });

  it('rede vazia não tem legenda', () => {
    const network = emptyNetwork();
    expect(buildLegend(network, computeStyle(network))).toBeNull();
  });
});
