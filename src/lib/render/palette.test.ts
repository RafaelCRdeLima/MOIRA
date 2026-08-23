import { describe, expect, it } from 'vitest';
import {
  assignTagColors,
  DEFAULT_WIDTH,
  edgeWidth,
  hashTag,
  MAX_WIDTH,
  MIN_WIDTH,
  normalize,
  OVERFLOW_COLOR,
  TAG_SLOTS,
  viridis,
} from './palette';

describe('cores por tag', () => {
  it('a mesma tag recebe sempre a mesma cor', () => {
    const a = assignTagColors(['mps', 'mpo', 'bra']);
    const b = assignTagColors(['bra', 'mpo', 'mps']); // outra ordem de entrada
    expect(a.get('mps')).toBe(b.get('mps'));
    expect(a.get('mpo')).toBe(b.get('mpo'));
    expect(hashTag('mps')).toBe(hashTag('mps'));
    expect(hashTag('mps')).not.toBe(hashTag('mpo'));
  });

  it('sete tags distintas recebem sete cores distintas', () => {
    const tags = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const cores = assignTagColors(tags);
    expect(new Set(cores.values()).size).toBe(TAG_SLOTS.length);
  });

  it('da oitava tag em diante, cinza', () => {
    const tags = 'abcdefghij'.split('');
    const cores = assignTagColors(tags);
    const cinzas = tags.filter((tag) => cores.get(tag) === OVERFLOW_COLOR);
    expect(cinzas.length).toBeGreaterThanOrEqual(3);
    expect(cores.size).toBe(10);
  });

  it('púrpura é a primeira cor e ciano a quinta, como manda a identidade', () => {
    expect(TAG_SLOTS[0]).toBe('var(--purple)');
    expect(TAG_SLOTS[4]).toBe('var(--cyan)');
    expect(TAG_SLOTS.at(-1)).toBe('var(--grey)');
  });
});

describe('espessura por dimensão', () => {
  it('cresce com log(D) e fica presa nos limites', () => {
    expect(edgeWidth(2)).toBe(MIN_WIDTH);
    expect(edgeWidth(4096)).toBe(MAX_WIDTH);
    expect(edgeWidth(100000)).toBe(MAX_WIDTH);
    expect(edgeWidth(16)).toBeGreaterThan(edgeWidth(8));
    expect(edgeWidth(64)).toBeLessThan(edgeWidth(256));
  });

  it('é logarítmica, não linear: dobrar D dá sempre o mesmo acréscimo', () => {
    const passo = edgeWidth(8) - edgeWidth(4);
    expect(edgeWidth(16) - edgeWidth(8)).toBeCloseTo(passo, 1);
    expect(edgeWidth(64) - edgeWidth(32)).toBeCloseTo(passo, 1);
  });

  it('sem dimensão declarada, nem a mais fina nem a mais grossa', () => {
    expect(edgeWidth(undefined)).toBe(DEFAULT_WIDTH);
    expect(edgeWidth(NaN)).toBe(DEFAULT_WIDTH);
    expect(DEFAULT_WIDTH).toBeGreaterThan(MIN_WIDTH);
    expect(DEFAULT_WIDTH).toBeLessThan(MAX_WIDTH);
  });
});

describe('rampa viridis', () => {
  it('vai do roxo escuro ao amarelo', () => {
    expect(viridis(0)).toBe('rgb(68 1 84)');
    expect(viridis(1)).toBe('rgb(253 231 37)');
  });

  it('é monótona em claridade e aguenta entrada fora do intervalo', () => {
    const luz = (c: string) => c.match(/\d+/g)!.map(Number).reduce((a, b) => a + b, 0);
    expect(luz(viridis(0.9))).toBeGreaterThan(luz(viridis(0.1)));
    expect(viridis(-5)).toBe(viridis(0));
    expect(viridis(5)).toBe(viridis(1));
    expect(viridis(NaN)).toBe(viridis(0));
  });

  it('normaliza, inclusive com intervalo degenerado', () => {
    expect(normalize(5, 0, 10)).toBe(0.5);
    expect(normalize(-3, 0, 10)).toBe(0);
    expect(normalize(30, 0, 10)).toBe(1);
    expect(normalize(7, 7, 7)).toBe(0.5);
  });
});
