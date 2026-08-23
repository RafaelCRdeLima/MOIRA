import { beforeEach, describe, expect, it } from 'vitest';
import { boundaryRadius, bondMidpoint, bondPath, freeLegPath, legTip, round, SHAPE_RADIUS } from './geometry';
import { resetIdCounters } from './id';
import { addBond, createTensor, emptyNetwork } from './network';

describe('geometria das pernas', () => {
  beforeEach(resetIdCounters);

  it('a borda do quadrado fica mais longe na diagonal que na horizontal', () => {
    const reta = boundaryRadius('square', 0);
    const diagonal = boundaryRadius('square', Math.PI / 4);
    expect(reta).toBeCloseTo(SHAPE_RADIUS.square);
    expect(diagonal).toBeGreaterThan(reta);
  });

  it('a borda do losango fica mais perto na diagonal que na horizontal', () => {
    expect(boundaryRadius('diamond', Math.PI / 4)).toBeLessThan(boundaryRadius('diamond', 0));
  });

  it('a ponta da perna respeita ângulo e comprimento', () => {
    const tensor = createTensor(100, 100, { legCount: 4 });
    const leg = tensor.legs[0]!; // ângulo 0: aponta para a direita
    const tip = legTip(tensor, leg);
    expect(tip.y).toBeCloseTo(100);
    expect(tip.x).toBeCloseTo(100 + SHAPE_RADIUS.circle + leg.length);
  });

  it('arredonda toda saída de caminho a duas casas', () => {
    const tensor = createTensor(0.123456, 0.987654, { legCount: 3 });
    const d = freeLegPath(tensor, tensor.legs[1]!);
    for (const n of d.match(/-?\d+\.?\d*/g) ?? []) {
      expect(n).toBe(String(round(Number(n))));
    }
    expect(round(12.3456)).toBe(12.35);
    expect(round(12.3456)).toBe(round(12.3456 + Number.EPSILON));
  });
});

describe('caminho do vínculo', () => {
  beforeEach(resetIdCounters);

  it('vai de borda a borda, com as pontas das pernas como controles', () => {
    const network = emptyNetwork();
    const a = createTensor(0, 0, { legCount: 4 });
    const b = createTensor(200, 0, { legCount: 4 });
    network.tensors.push(a, b);
    const bond = addBond(network, a.legs[0]!.id, b.legs[2]!.id)!;

    const d = bondPath(network, bond)!;
    expect(d).toBe('M12 0C38 0,162 0,188 0');
  });

  it('a curvatura desloca o caminho, e a curvatura zero o devolve', () => {
    const network = emptyNetwork();
    const a = createTensor(0, 0, { legCount: 4 });
    const b = createTensor(200, 0, { legCount: 4 });
    network.tensors.push(a, b);
    const bond = addBond(network, a.legs[0]!.id, b.legs[2]!.id)!;
    const reto = bondPath(network, bond);

    bond.curvature = 0.25;
    expect(bondPath(network, bond)).not.toBe(reto);
    bond.curvature = 0;
    expect(bondPath(network, bond)).toBe(reto);
  });

  it('um laço tem caminho e ponto médio, sem caso especial', () => {
    const network = emptyNetwork();
    const a = createTensor(0, 0, { legCount: 4 });
    network.tensors.push(a);
    const loop = addBond(network, a.legs[0]!.id, a.legs[1]!.id)!;

    expect(bondPath(network, loop)).toBeDefined();
    const mid = bondMidpoint(network, loop)!;
    // O laço sai do tensor: o ponto médio não pode cair sobre o próprio centro.
    expect(Math.hypot(mid.x - a.x, mid.y - a.y)).toBeGreaterThan(SHAPE_RADIUS.circle);
  });

  it('devolve undefined quando uma ponta sumiu', () => {
    const network = emptyNetwork();
    const a = createTensor(0, 0);
    const b = createTensor(100, 0);
    network.tensors.push(a, b);
    const bond = addBond(network, a.legs[0]!.id, b.legs[1]!.id)!;
    network.tensors.pop();
    expect(bondPath(network, bond)).toBeUndefined();
  });
});
