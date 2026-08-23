import { beforeEach, describe, expect, it } from 'vitest';
import { resetIdCounters } from '../model/id';
import type { Fragment } from './common';
import { mera, mpo, mps, peps, sandwich, transferChain, ttn } from './index';
import { clampToPower } from './trees';

/** Todo gerador tem de produzir uma rede em que nenhuma perna foi usada duas
 *  vezes e nenhum vínculo aponta para o vazio. */
function assertWellFormed(fragment: Fragment) {
  const legIds = new Set(fragment.tensors.flatMap((t) => t.legs.map((l) => l.id)));
  const used = new Set<string>();
  for (const bond of fragment.bonds) {
    expect(legIds.has(bond.a)).toBe(true);
    expect(legIds.has(bond.b)).toBe(true);
    expect(bond.a).not.toBe(bond.b);
    expect(used.has(bond.a)).toBe(false);
    expect(used.has(bond.b)).toBe(false);
    used.add(bond.a);
    used.add(bond.b);
  }
}

function freeLegs(fragment: Fragment): number {
  const total = fragment.tensors.reduce((n, t) => n + t.legs.length, 0);
  return total - 2 * fragment.bonds.length;
}

/** Componentes conexas contando só os vínculos. */
function components(fragment: Fragment): number {
  const owner = new Map<string, string>();
  for (const t of fragment.tensors) for (const l of t.legs) owner.set(l.id, t.id);

  const parent = new Map(fragment.tensors.map((t) => [t.id, t.id]));
  const find = (a: string): string => {
    let root = a;
    while (parent.get(root) !== root) root = parent.get(root)!;
    return root;
  };
  for (const bond of fragment.bonds) {
    const ra = find(owner.get(bond.a)!);
    const rb = find(owner.get(bond.b)!);
    if (ra !== rb) parent.set(ra, rb);
  }
  return new Set(fragment.tensors.map((t) => find(t.id))).size;
}

describe('cadeias', () => {
  beforeEach(resetIdCounters);

  it('MPS aberta: N sítios, N-1 vínculos, N pernas físicas', () => {
    const net = mps({ sites: 8 });
    assertWellFormed(net);
    expect(net.tensors).toHaveLength(8);
    expect(net.bonds).toHaveLength(7);
    expect(freeLegs(net)).toBe(8);
    expect(components(net)).toBe(1);
  });

  it('MPS periódica fecha o anel com um vínculo a mais', () => {
    const net = mps({ sites: 8, periodic: true });
    assertWellFormed(net);
    expect(net.bonds).toHaveLength(8);
    expect(freeLegs(net)).toBe(8);
    // O vínculo de volta sai curvado para não deitar sobre a cadeia.
    expect(net.bonds.some((b) => b.curvature !== 0)).toBe(true);
  });

  it('MPO tem duas pernas físicas por sítio', () => {
    const net = mpo({ sites: 5 });
    assertWellFormed(net);
    expect(freeLegs(net)).toBe(10);
    expect(net.tensors.every((t) => t.shape === 'square')).toBe(true);
  });

  it('o sanduíche não deixa perna livre: a rede contrai para um escalar', () => {
    const net = sandwich({ sites: 6 });
    assertWellFormed(net);
    expect(net.tensors).toHaveLength(18);
    expect(freeLegs(net)).toBe(0);
    expect(components(net)).toBe(1);
    expect(net.tensors.filter((t) => t.conjugate).length).toBe(6);

    // A tag que distingue vem na frente: é ela que pinta o corpo no modo por
    // tag, e a família 'mps' fica no anel.
    const bra = net.tensors.filter((t) => t.conjugate);
    const ket = net.tensors.filter((t) => t.tags.includes('ket'));
    expect(bra.every((t) => t.tags[0] === 'bra' && t.tags[1] === 'mps')).toBe(true);
    expect(ket.every((t) => t.tags[0] === 'ket' && t.tags[1] === 'mps')).toBe(true);
  });

  it('a rede de transferência marca a célula unitária por tag', () => {
    const net = transferChain({ sites: 6, cell: 2 });
    assertWellFormed(net);
    expect(net.tensors.filter((t) => t.tags.includes('célula'))).toHaveLength(2);
  });
});

describe('grade', () => {
  beforeEach(resetIdCounters);

  it('PEPS L×L: vínculos horizontais e verticais, uma perna física por sítio', () => {
    const net = peps({ rows: 3, cols: 4 });
    assertWellFormed(net);
    expect(net.tensors).toHaveLength(12);
    expect(net.bonds).toHaveLength(3 * 3 + 4 * 2); // 9 horizontais + 8 verticais
    expect(freeLegs(net)).toBe(12);
    expect(components(net)).toBe(1);
  });
});

describe('árvores', () => {
  beforeEach(resetIdCounters);

  it('TTN binária de 8 folhas: 7 tensores e a perna do topo livre', () => {
    const net = ttn({ leaves: 8 });
    assertWellFormed(net);
    expect(net.tensors).toHaveLength(7); // 4 + 2 + 1
    expect(freeLegs(net)).toBe(9); // 8 folhas + topo
    expect(components(net)).toBe(1);
  });

  it('MERA binária de 16 folhas — o aceite do M1', () => {
    const net = mera({ leaves: 16, arity: 2 });
    assertWellFormed(net);
    // 4 camadas: 7+8, 3+4, 1+2, 0+1
    expect(net.tensors).toHaveLength(26);
    expect(net.bonds).toHaveLength(36);
    expect(freeLegs(net)).toBe(17); // 16 físicas embaixo + 1 no topo
    expect(components(net)).toBe(1);

    const desemaranhadores = net.tensors.filter((t) => t.tags.includes('desemaranhador'));
    const isometrias = net.tensors.filter((t) => t.tags.includes('isometria'));
    expect(desemaranhadores).toHaveLength(11);
    expect(isometrias).toHaveLength(15);
    // Forma e cor separam os dois papéis já na geração.
    expect(desemaranhadores.every((t) => t.shape === 'square')).toBe(true);
    expect(isometrias.every((t) => t.shape === 'triangle')).toBe(true);
    // Toda isometria sabe para onde aponta a ponta.
    expect(isometrias.every((t) => t.isometryTip !== undefined)).toBe(true);
  });

  it('MERA ternária de 27 folhas', () => {
    const net = mera({ leaves: 27, arity: 3 });
    assertWellFormed(net);
    expect(freeLegs(net)).toBe(28);
    expect(components(net)).toBe(1);
  });

  it('ajusta o número de folhas para a potência mais próxima da aridade', () => {
    expect(clampToPower(16, 2)).toBe(16);
    expect(clampToPower(20, 2)).toBe(16);
    expect(clampToPower(25, 2)).toBe(32);
    expect(clampToPower(27, 3)).toBe(27);
    expect(clampToPower(30, 3)).toBe(27);
  });
});
