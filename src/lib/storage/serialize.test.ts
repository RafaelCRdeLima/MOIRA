import { beforeEach, describe, expect, it } from 'vitest';
import { resetIdCounters } from '../model/id';
import { addBond, createTensor, emptyNetwork } from '../model/network';
import { SCHEMA_VERSION } from '../model/types';
import { clearNetwork, loadNetwork, saveNetwork } from './persist';
import { fromJSON, toJSON } from './serialize';

function sample() {
  const network = emptyNetwork('teste');
  const a = createTensor(10, 20, { name: 'A', tags: ['mps'] });
  const b = createTensor(80, 20, { name: 'B', tags: ['mps'] });
  network.tensors.push(a, b);
  addBond(network, a.legs[0]!.id, b.legs[1]!.id);
  network.bonds[0]!.curvature = 0.3;
  return network;
}

describe('serialização', () => {
  beforeEach(() => {
    resetIdCounters();
    clearNetwork();
  });

  it('sobrevive à ida e à volta', () => {
    const original = sample();
    const round = fromJSON(toJSON(original));
    expect(round).toBeDefined();
    expect(round!.tensors).toEqual(original.tensors);
    expect(round!.bonds).toEqual(original.bonds);
    expect(round!.meta.title).toBe('teste');
    expect(round!.meta.version).toBe(SCHEMA_VERSION);
  });

  it('devolve undefined para JSON quebrado ou de outro formato', () => {
    expect(fromJSON('{')).toBeUndefined();
    expect(fromJSON('[]')).toBeUndefined();
    expect(fromJSON('{"tensors":[]}')).toBeUndefined();
    expect(fromJSON('42')).toBeUndefined();
  });

  it('descarta vínculo que aponta para perna inexistente sem perder a rede', () => {
    const network = sample();
    const doc = JSON.parse(toJSON(network));
    doc.bonds.push({ id: 'b99', a: 'l404', b: 'l405', curvature: 0 });

    const parsed = fromJSON(JSON.stringify(doc));
    expect(parsed).toBeDefined();
    expect(parsed!.tensors).toHaveLength(2);
    expect(parsed!.bonds).toHaveLength(1);
  });

  it('não deixa duas ligações caírem na mesma perna ao ler o arquivo', () => {
    const network = sample();
    const doc = JSON.parse(toJSON(network));
    doc.bonds.push({ id: 'b98', a: doc.bonds[0].a, b: doc.tensors[1].legs[2].id, curvature: 0 });

    const parsed = fromJSON(JSON.stringify(doc));
    expect(parsed!.bonds).toHaveLength(1);
  });

  it('ignora centro de ortogonalidade que não corresponde a tensor algum', () => {
    const network = sample();
    network.orthogonalityCenter = 't404';
    expect(fromJSON(toJSON(network))!.orthogonalityCenter).toBeUndefined();
  });

  it('recusa arquivo de versão futura', () => {
    const network = sample();
    const doc = JSON.parse(toJSON(network));
    doc.meta.version = SCHEMA_VERSION + 1;
    expect(fromJSON(JSON.stringify(doc))).toBeUndefined();
  });
});

describe('persistência local', () => {
  beforeEach(() => {
    resetIdCounters();
    clearNetwork();
  });

  it('grava e reencontra a rede — o critério de aceite do M0', () => {
    const network = emptyNetwork('cadeia de 5');
    for (let i = 0; i < 5; i++) network.tensors.push(createTensor(i * 60, 0, { name: `A${i}` }));
    for (let i = 0; i < 4; i++) {
      addBond(network, network.tensors[i]!.legs[0]!.id, network.tensors[i + 1]!.legs[1]!.id);
    }
    saveNetwork(network);

    const restored = loadNetwork();
    expect(restored).toBeDefined();
    expect(restored!.tensors).toHaveLength(5);
    expect(restored!.bonds).toHaveLength(4);
    expect(restored!.tensors.map((t) => t.name)).toEqual(['A0', 'A1', 'A2', 'A3', 'A4']);
  });

  it('devolve undefined quando não há nada gravado', () => {
    expect(loadNetwork()).toBeUndefined();
  });
});
