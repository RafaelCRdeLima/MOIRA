import { beforeEach, describe, expect, it } from 'vitest';
import { resetIdCounters, syncIdCounters } from './id';
import {
  addBond,
  bondOfLeg,
  createTensor,
  emptyNetwork,
  isLegFree,
  isLoop,
  removeBond,
  removeTensor,
} from './network';
import type { Network } from './types';

function chain(n: number): Network {
  const network = emptyNetwork('cadeia');
  for (let i = 0; i < n; i++) network.tensors.push(createTensor(i * 60, 0, { name: `A${i}` }));
  for (let i = 0; i < n - 1; i++) {
    addBond(network, network.tensors[i]!.legs[0]!.id, network.tensors[i + 1]!.legs[1]!.id);
  }
  return network;
}

describe('invariantes da rede', () => {
  beforeEach(resetIdCounters);

  it('liga duas pernas livres', () => {
    const network = emptyNetwork();
    const a = createTensor(0, 0);
    const b = createTensor(60, 0);
    network.tensors.push(a, b);

    const bond = addBond(network, a.legs[0]!.id, b.legs[1]!.id);
    expect(bond).toBeDefined();
    expect(network.bonds).toHaveLength(1);
    expect(isLegFree(network, a.legs[0]!.id)).toBe(false);
  });

  it('recusa uma segunda ligação na mesma perna', () => {
    const network = emptyNetwork();
    const a = createTensor(0, 0);
    const b = createTensor(60, 0);
    const c = createTensor(120, 0);
    network.tensors.push(a, b, c);

    addBond(network, a.legs[0]!.id, b.legs[1]!.id);
    expect(addBond(network, a.legs[0]!.id, c.legs[1]!.id)).toBeUndefined();
    expect(network.bonds).toHaveLength(1);
  });

  it('recusa a perna consigo mesma, mas aceita laço no mesmo tensor', () => {
    const network = emptyNetwork();
    const a = createTensor(0, 0);
    network.tensors.push(a);

    expect(addBond(network, a.legs[0]!.id, a.legs[0]!.id)).toBeUndefined();

    const loop = addBond(network, a.legs[0]!.id, a.legs[1]!.id);
    expect(loop).toBeDefined();
    expect(isLoop(network, loop!)).toBe(true);
  });

  it('herda a dimensão quando as duas pontas concordam, e não quando divergem', () => {
    const network = emptyNetwork();
    const a = createTensor(0, 0);
    const b = createTensor(60, 0);
    network.tensors.push(a, b);
    a.legs[0]!.dim = 8;
    b.legs[1]!.dim = 8;
    expect(addBond(network, a.legs[0]!.id, b.legs[1]!.id)?.dim).toBe(8);

    a.legs[2]!.dim = 4;
    b.legs[2]!.dim = 5;
    expect(addBond(network, a.legs[2]!.id, b.legs[2]!.id)?.dim).toBeUndefined();
  });

  it('apagar um tensor leva junto os vínculos que o tocavam', () => {
    const network = chain(3);
    expect(network.bonds).toHaveLength(2);

    removeTensor(network, network.tensors[1]!.id);
    expect(network.tensors).toHaveLength(2);
    expect(network.bonds).toHaveLength(0);
  });

  it('desfaz um vínculo e devolve as pernas ao estado livre', () => {
    const network = chain(2);
    const bond = network.bonds[0]!;
    expect(removeBond(network, bond.id)).toBe(true);
    expect(bondOfLeg(network, bond.a)).toBeUndefined();
    expect(removeBond(network, bond.id)).toBe(false);
  });
});

describe('contadores de id', () => {
  beforeEach(resetIdCounters);

  it('não repetem ids depois de carregar uma rede', () => {
    const loaded = chain(3);
    resetIdCounters(); // simula a página recarregada
    syncIdCounters(loaded);

    const novo = createTensor(0, 0);
    const existentes = new Set(loaded.tensors.flatMap((t) => [t.id, ...t.legs.map((l) => l.id)]));
    expect(existentes.has(novo.id)).toBe(false);
    for (const leg of novo.legs) expect(existentes.has(leg.id)).toBe(false);
  });
});
