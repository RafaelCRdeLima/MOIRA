import { beforeEach, describe, expect, it } from 'vitest';
import { History, HISTORY_LIMIT } from './history';
import { resetIdCounters } from './id';
import { addBond, createTensor, emptyNetwork } from './network';
import type { Network } from './types';

function withTensors(n: number): Network {
  const network = emptyNetwork();
  for (let i = 0; i < n; i++) network.tensors.push(createTensor(i * 10, 0));
  return network;
}

const clone = (n: Network): Network => structuredClone(n);

describe('desfazer e refazer', () => {
  beforeEach(resetIdCounters);

  it('devolve o estado anterior e depois o refaz', () => {
    const history = new History();
    const um = withTensors(1);
    const dois = withTensors(2);

    history.capture(clone(um));
    expect(history.canUndo).toBe(true);

    const desfeito = history.undo(clone(dois))!;
    expect(desfeito.tensors).toHaveLength(1);
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(true);

    const refeito = history.redo(clone(desfeito))!;
    expect(refeito.tensors).toHaveLength(2);
  });

  it('uma ação nova mata o refazer', () => {
    const history = new History();
    history.capture(withTensors(1));
    history.undo(withTensors(2));
    expect(history.canRedo).toBe(true);

    history.capture(withTensors(3));
    expect(history.canRedo).toBe(false);
  });

  it('guarda pelo menos os cinquenta passos que a especificação pede', () => {
    const history = new History();
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) history.capture(withTensors(1));
    expect(history.depth).toBe(HISTORY_LIMIT);
    expect(HISTORY_LIMIT).toBeGreaterThanOrEqual(50);
  });

  it('não desfaz nada quando a pilha está vazia', () => {
    const history = new History();
    expect(history.undo(withTensors(1))).toBeUndefined();
    expect(history.redo(withTensors(1))).toBeUndefined();
  });

  it('o instantâneo é independente: mexer na rede depois não corrompe o passado', () => {
    const history = new History();
    const network = withTensors(2);
    addBond(network, network.tensors[0]!.legs[0]!.id, network.tensors[1]!.legs[1]!.id);
    history.capture(clone(network));

    network.tensors[0]!.x = 999;
    network.bonds.length = 0;

    const desfeito = history.undo(clone(network))!;
    expect(desfeito.tensors[0]!.x).toBe(0);
    expect(desfeito.bonds).toHaveLength(1);
  });
});
