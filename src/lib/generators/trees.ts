/** Redes em árvore: TTN e MERA.
 *
 *  As duas se constroem camada a camada, de baixo para cima, guardando por
 *  sítio a perna que ainda está à espera de ligação. No fundo da rede essa
 *  perna não existe: é ali que ficam as pernas físicas, livres por construção. */

import type { Fragment } from './common';
import { BOND_DIM, PHYS_DIM, SITE_DX, centerFragment, emptyFragment, link, node } from './common';
import type { Leg } from '../model/types';

const LAYER_H = 150;
const DIS_DROP = 50; // altura do desemaranhador dentro da camada
const ISO_DROP = 105; // altura da isometria dentro da camada

const DOWN_LEFT = (3 * Math.PI) / 4;
const DOWN_RIGHT = Math.PI / 4;
const UP_LEFT = (-3 * Math.PI) / 4;
const UP_RIGHT = -Math.PI / 4;
const STRAIGHT_UP = -Math.PI / 2;
const STRAIGHT_DOWN = Math.PI / 2;

/** A dimensão do vínculo no nível `level`: juntar `arity` sítios multiplica o
 *  espaço, então ela cresce como PHYS^(arity^level) até bater no teto χ. É
 *  exatamente onde a rede passa a truncar, e a espessura da aresta mostra isso. */
function levelDim(level: number, arity: number): number {
  const exponent = arity ** Math.min(level, 5);
  return exponent > 12 ? BOND_DIM : Math.min(BOND_DIM, PHYS_DIM ** exponent);
}

/** Posição horizontal do sítio `s` no nível `level`, com espaçamento dobrando
 *  a cada nível para que o pai caia no meio dos filhos. */
function siteX(level: number, s: number, arity: number): number {
  return (s + 0.5) * SITE_DX * arity ** level;
}

/** Pernas descendentes de um tensor de `arity` filhos. */
function downAngles(arity: number): number[] {
  if (arity === 3) return [DOWN_LEFT, STRAIGHT_DOWN, DOWN_RIGHT];
  return [DOWN_LEFT, DOWN_RIGHT];
}

/** Árvore binária: cada tensor junta dois sítios num só, até a raiz.
 *  As pernas físicas são as descendentes da camada de baixo. */
export function ttn(options: { leaves: number }): Fragment {
  const arity = 2;
  const leaves = clampToPower(options.leaves, arity);
  const fragment = emptyFragment();

  let n = leaves;
  let level = 0;
  /** Perna à espera de ligação em cada sítio; undefined no fundo da rede. */
  let pending: (Leg | undefined)[] = new Array(leaves).fill(undefined);

  while (n > 1) {
    const next: (Leg | undefined)[] = [];
    for (let i = 0; i < n / arity; i++) {
      const tensor = node(
        fragment,
        siteX(level + 1, i, arity),
        -(level + 1) * LAYER_H,
        [...downAngles(arity), STRAIGHT_UP],
        {
          shape: 'triangle',
          tags: ['ttn'],
          tip: arity,
          name: `w${level + 1}`,
          dims: [...new Array(arity).fill(levelDim(level, arity)), levelDim(level + 1, arity)],
        },
      );
      for (let k = 0; k < arity; k++) {
        const below = pending[arity * i + k];
        if (below) link(fragment, below, tensor.legs[k]!);
      }
      next.push(tensor.legs[arity]!);
    }
    pending = next;
    n = n / arity;
    level += 1;
  }

  return centerFragment(fragment);
}

/** MERA: cada camada tem uma fileira de desemaranhadores e outra de isometrias.
 *  Os desemaranhadores ficam desencontrados dos blocos de coarse-graining — é
 *  exatamente esse desencontro que remove o emaranhamento de curto alcance
 *  antes de a isometria descartar graus de liberdade. */
export function mera(options: { leaves: number; arity?: 2 | 3 }): Fragment {
  const arity = options.arity ?? 2;
  const leaves = clampToPower(options.leaves, arity);
  const fragment = emptyFragment();

  let n = leaves;
  let level = 0;
  let pending: (Leg | undefined)[] = new Array(leaves).fill(undefined);

  while (n >= arity) {
    const baseY = -level * LAYER_H;

    // Desemaranhadores: um por fronteira entre blocos vizinhos, agindo sobre as
    // duas pernas que a isometria seguinte separaria.
    const afterDis: (Leg | undefined)[] = [...pending];
    for (let j = 0; j < n / arity - 1; j++) {
      const left = arity * j + arity - 1;
      const right = arity * j + arity;
      const x = (siteX(level, left, arity) + siteX(level, right, arity)) / 2;
      const u = node(fragment, x, baseY - DIS_DROP, [DOWN_LEFT, DOWN_RIGHT, UP_LEFT, UP_RIGHT], {
        shape: 'square',
        tags: ['mera', 'desemaranhador'],
        name: `u${level + 1}`,
        dims: new Array(4).fill(levelDim(level, arity)),
      });
      if (pending[left]) link(fragment, pending[left]!, u.legs[0]!);
      if (pending[right]) link(fragment, pending[right]!, u.legs[1]!);
      afterDis[left] = u.legs[2]!;
      afterDis[right] = u.legs[3]!;
    }

    // Isometrias: cada uma junta um bloco de `arity` sítios num sítio do nível
    // de cima. A ponta do triângulo aponta para a perna de saída, que é a de
    // dimensão menor.
    const next: (Leg | undefined)[] = [];
    for (let i = 0; i < n / arity; i++) {
      const w = node(
        fragment,
        siteX(level + 1, i, arity),
        baseY - ISO_DROP,
        [...downAngles(arity), STRAIGHT_UP],
        {
          shape: 'triangle',
          tags: ['mera', 'isometria'],
          tip: arity,
          name: `w${level + 1}`,
          dims: [...new Array(arity).fill(levelDim(level, arity)), levelDim(level + 1, arity)],
        },
      );
      for (let k = 0; k < arity; k++) {
        const below = afterDis[arity * i + k];
        if (below) link(fragment, below, w.legs[k]!);
      }
      next.push(w.legs[arity]!);
    }

    pending = next;
    n = n / arity;
    level += 1;
  }

  return centerFragment(fragment);
}

/** O número de folhas precisa ser potência da aridade; ajusta para a potência
 *  mais próxima em vez de recusar, que é o que o usuário quis dizer. */
export function clampToPower(value: number, base: number): number {
  const safe = Math.max(base, Math.round(value));
  const exponent = Math.max(1, Math.round(Math.log(safe) / Math.log(base)));
  return base ** exponent;
}
