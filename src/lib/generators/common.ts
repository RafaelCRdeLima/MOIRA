/** Peças comuns aos geradores de rede (§6). Um gerador devolve um fragmento —
 *  tensores e vínculos soltos — que a sessão mescla na rede corrente. */

import { nextId } from '../model/id';
import type { Bond, Leg, Shape, Tensor } from '../model/types';

/** Ângulos em coordenadas de SVG: y cresce para baixo. */
export const RIGHT = 0;
export const DOWN = Math.PI / 2;
export const LEFT = Math.PI;
export const UP = -Math.PI / 2;

export const SITE_DX = 64;
export const LAYER_DY = 72;

export interface Fragment {
  tensors: Tensor[];
  bonds: Bond[];
}

export interface NodeOptions {
  name?: string;
  shape?: Shape;
  tags?: string[];
  conjugate?: boolean;
  legLength?: number;
  /** Índice, dentro de `angles`, da perna para onde aponta a ponta do triângulo. */
  tip?: number;
  /** Dimensão de cada perna, na mesma ordem dos ângulos. Sem isto a rede sai
   *  sem espessura por dimensão, que é metade da linguagem visual. */
  dims?: number[];
}

/** Cria um tensor com as pernas nos ângulos pedidos, na ordem dada — quem chama
 *  guarda as referências e liga pelo índice. */
export function node(
  fragment: Fragment,
  x: number,
  y: number,
  angles: number[],
  options: NodeOptions = {},
): Tensor {
  const legs: Leg[] = angles.map((angle, i) => {
    const leg: Leg = { id: nextId('l'), angle, length: options.legLength ?? 26 };
    const dim = options.dims?.[i];
    if (dim !== undefined) leg.dim = dim;
    return leg;
  });
  const tensor: Tensor = {
    id: nextId('t'),
    name: options.name ?? '',
    x,
    y,
    shape: options.shape ?? 'circle',
    legs,
    tags: options.tags ?? [],
  };
  if (options.conjugate) tensor.conjugate = true;
  if (options.tip !== undefined && legs[options.tip]) tensor.isometryTip = legs[options.tip]!.id;
  fragment.tensors.push(tensor);
  return tensor;
}

export function link(fragment: Fragment, a: Leg, b: Leg, curvature = 0): Bond {
  const bond: Bond = { id: nextId('b'), a: a.id, b: b.id, curvature };
  if (a.dim !== undefined && a.dim === b.dim) bond.dim = a.dim;
  fragment.bonds.push(bond);
  return bond;
}

/** Dimensões que os geradores usam quando o usuário não pediu outra coisa:
 *  sítio físico de spin 1/2 e vínculo de tamanho moderado. Servem para que a
 *  rede nasça já com espessura de aresta significando alguma coisa. */
export const PHYS_DIM = 2;
export const BOND_DIM = 16;

export function emptyFragment(): Fragment {
  return { tensors: [], bonds: [] };
}

/** Centra o fragmento na origem, para que ele apareça onde a vista está. */
export function centerFragment(fragment: Fragment): Fragment {
  if (fragment.tensors.length === 0) return fragment;
  const xs = fragment.tensors.map((t) => t.x);
  const ys = fragment.tensors.map((t) => t.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  for (const tensor of fragment.tensors) {
    tensor.x -= cx;
    tensor.y -= cy;
  }
  return fragment;
}

/** Nomes de sítio com índice: A₁, A₂... em algarismos comuns, que a fonte mono
 *  desenha melhor que os subscritos Unicode. */
export function siteName(prefix: string, i: number): string {
  return `${prefix}${i + 1}`;
}
