/** Cadeias: MPS, MPO e o sanduíche ⟨ψ|O|ψ⟩. */

import type { Fragment } from './common';
import { DOWN, LEFT, RIGHT, SITE_DX, UP, centerFragment, emptyFragment, link, node, siteName } from './common';
import type { Tensor } from '../model/types';

export interface ChainOptions {
  sites: number;
  periodic?: boolean;
}

/** Perna física para baixo (ket). Contorno periódico fecha o anel com uma
 *  curvatura para que o vínculo de volta não passe por cima da cadeia. */
export function mps(options: ChainOptions, y = 0, physical = DOWN, name = 'A'): Fragment {
  const { sites, periodic = false } = options;
  const fragment = emptyFragment();
  const nodes: Tensor[] = [];

  for (let i = 0; i < sites; i++) {
    const first = i === 0;
    const last = i === sites - 1;
    // Num contorno aberto as pontas não têm perna de vínculo para fora.
    const angles = [
      ...(periodic || !first ? [LEFT] : []),
      ...(periodic || !last ? [RIGHT] : []),
      physical,
    ];
    nodes.push(
      node(fragment, i * SITE_DX, y, angles, { name: siteName(name, i), tags: ['mps'] }),
    );
  }

  for (let i = 0; i < sites - 1; i++) {
    link(fragment, rightLeg(nodes[i]!), leftLeg(nodes[i + 1]!));
  }
  if (periodic && sites > 1) {
    link(fragment, leftLeg(nodes[0]!), rightLeg(nodes[sites - 1]!), 0.55);
  }

  return fragment;
}

/** Duas pernas físicas por sítio, uma para cima e outra para baixo. */
export function mpo(options: ChainOptions, y = 0, name = 'W'): Fragment {
  const { sites, periodic = false } = options;
  const fragment = emptyFragment();
  const nodes: Tensor[] = [];

  for (let i = 0; i < sites; i++) {
    const first = i === 0;
    const last = i === sites - 1;
    const angles = [
      ...(periodic || !first ? [LEFT] : []),
      ...(periodic || !last ? [RIGHT] : []),
      UP,
      DOWN,
    ];
    nodes.push(
      node(fragment, i * SITE_DX, y, angles, { name: siteName(name, i), shape: 'square', tags: ['mpo'] }),
    );
  }

  for (let i = 0; i < sites - 1; i++) {
    link(fragment, rightLeg(nodes[i]!), leftLeg(nodes[i + 1]!));
  }
  if (periodic && sites > 1) {
    link(fragment, leftLeg(nodes[0]!), rightLeg(nodes[sites - 1]!), 0.55);
  }

  return fragment;
}

/** ⟨ψ|O|ψ⟩: ket embaixo, operador no meio, bra conjugada em cima, já ligados.
 *  Nenhuma perna física sobra livre — a rede contrai para um escalar. */
export function sandwich(options: ChainOptions): Fragment {
  const { sites, periodic = false } = options;
  const gap = 88;

  const ket = mps({ sites, periodic }, gap, UP, 'A');
  const op = mpo({ sites, periodic }, 0, 'W');
  const bra = mps({ sites, periodic }, -gap, DOWN, 'A');

  for (const tensor of bra.tensors) {
    tensor.conjugate = true;
    tensor.tags = ['mps', 'bra'];
  }
  for (const tensor of ket.tensors) tensor.tags = ['mps', 'ket'];

  const fragment: Fragment = {
    tensors: [...ket.tensors, ...op.tensors, ...bra.tensors],
    bonds: [...ket.bonds, ...op.bonds, ...bra.bonds],
  };

  for (let i = 0; i < sites; i++) {
    link(fragment, physicalLeg(ket.tensors[i]!, UP), physicalLeg(op.tensors[i]!, DOWN));
    link(fragment, physicalLeg(op.tensors[i]!, UP), physicalLeg(bra.tensors[i]!, DOWN));
  }

  return centerFragment(fragment);
}

/** Rede infinita: a célula unitária fica marcada por tag, e as pernas de
 *  vínculo das pontas ficam livres para indicar a continuação. */
export function transferChain(options: { sites: number; cell: number }): Fragment {
  const { sites, cell } = options;
  const fragment = emptyFragment();
  const nodes: Tensor[] = [];

  for (let i = 0; i < sites; i++) {
    const inCell = i < cell;
    nodes.push(
      node(fragment, i * SITE_DX, 0, [LEFT, RIGHT, UP, DOWN], {
        name: siteName('T', i),
        shape: 'square',
        tags: inCell ? ['célula'] : ['repetição'],
      }),
    );
  }
  for (let i = 0; i < sites - 1; i++) {
    link(fragment, rightLeg(nodes[i]!), leftLeg(nodes[i + 1]!));
  }
  return centerFragment(fragment);
}

function legAt(tensor: Tensor, angle: number) {
  const leg = tensor.legs.find((l) => Math.abs(l.angle - angle) < 1e-9);
  if (!leg) throw new Error(`Tensor ${tensor.id} sem perna no ângulo ${angle}.`);
  return leg;
}

const leftLeg = (t: Tensor) => legAt(t, LEFT);
const rightLeg = (t: Tensor) => legAt(t, RIGHT);
const physicalLeg = (t: Tensor, angle: number) => legAt(t, angle);
