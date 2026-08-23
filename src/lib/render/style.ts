/** Da rede para a tinta: dado o modo de coloração ativo, qual cor e qual
 *  espessura cada tensor e cada aresta recebem.
 *
 *  A rede inteira é medida uma vez por quadro (`computeStyle`) e o resultado
 *  alimenta as funções por elemento — senão cada tensor recorreria a rede toda
 *  para descobrir o intervalo das rampas. */

import { bondOfLeg } from '../model/network';
import type { Bond, ColorMode, Leg, Network, Tensor } from '../model/types';
import {
  assignTagColors,
  edgeWidth,
  FREE_LEG_FACTOR,
  GENERIC,
  INK,
  ISOMETRY,
  normalize,
  ORTHOCENTER,
  TAG_SLOTS,
  UNITARY,
  viridis,
} from './palette';

export interface NetworkStyle {
  tagColors: Map<string, string>;
  /** Tags que passaram dos sete lugares e caíram em cinza. */
  overflowTags: string[];
  yRange: [number, number];
  degreeRange: [number, number];
  /** Intervalo de `Bond.value`, quando houver ao menos um definido. */
  valueRange: [number, number] | null;
}

export function computeStyle(network: Network): NetworkStyle {
  const allTags = network.tensors.flatMap((t) => t.tags);
  const tagColors = assignTagColors(allTags);
  const overflowTags = [...new Set(allTags)].sort().slice(TAG_SLOTS.length);

  const ys = network.tensors.map((t) => t.y);
  const degrees = network.tensors.map((t) => t.legs.length);
  const values = network.bonds.map((b) => b.value).filter((v): v is number => v !== undefined);

  return {
    tagColors,
    overflowTags,
    yRange: [Math.min(...ys, 0), Math.max(...ys, 0)],
    degreeRange: [Math.min(...degrees, 1), Math.max(...degrees, 1)],
    valueRange: values.length > 0 ? [Math.min(...values), Math.max(...values)] : null,
  };
}

/** Preenchimento do tensor. A cor manual vence em qualquer modo; o delta é
 *  sempre tinta cheia, porque é um símbolo e não um tensor com conteúdo. */
export function tensorFill(network: Network, style: NetworkStyle, tensor: Tensor): string {
  if (tensor.color) return tensor.color;
  if (tensor.shape === 'dot') return INK;

  switch (network.colorMode) {
    case 'tag':
      return tensor.tags.length > 0 ? (style.tagColors.get(tensor.tags[0]!) ?? GENERIC) : GENERIC;
    case 'role':
      return roleColor(tensor);
    case 'layer': {
      const [min, max] = style.yRange;
      return viridis(1 - normalize(tensor.y, min, max));
    }
    case 'degree': {
      const [min, max] = style.degreeRange;
      return viridis(normalize(tensor.legs.length, min, max));
    }
    case 'manual':
      return GENERIC;
  }
}

/** Anel fino com a cor da segunda tag, só no modo por tag. */
export function tensorRing(network: Network, style: NetworkStyle, tensor: Tensor): string | null {
  if (network.colorMode !== 'tag' || tensor.color) return null;
  const second = tensor.tags[1];
  return second ? (style.tagColors.get(second) ?? null) : null;
}

/** Papel estrutural pela forma, que é como a literatura o marca. */
function roleColor(tensor: Tensor): string {
  switch (tensor.shape) {
    case 'triangle':
      return ISOMETRY;
    case 'square':
      return UNITARY;
    case 'diamond':
      return ORTHOCENTER;
    case 'dot':
      return INK;
    default:
      return GENERIC;
  }
}

export function isOrthogonalityCenter(network: Network, tensor: Tensor): boolean {
  return network.orthogonalityCenter === tensor.id;
}

// ─── arestas ────────────────────────────────────────────────────────────────

/** A dimensão do vínculo, caindo para a das pernas quando não foi declarada
 *  nele — é comum anotar só uma das pontas. */
export function bondDim(network: Network, bond: Bond): number | undefined {
  if (bond.dim !== undefined) return bond.dim;
  for (const tensor of network.tensors) {
    for (const leg of tensor.legs) {
      if ((leg.id === bond.a || leg.id === bond.b) && leg.dim !== undefined) return leg.dim;
    }
  }
  return undefined;
}

export function bondWidth(network: Network, bond: Bond): number {
  return edgeWidth(bondDim(network, bond));
}

export function legWidth(leg: Leg): number {
  return Math.round(edgeWidth(leg.dim) * FREE_LEG_FACTOR * 100) / 100;
}

export function bondStroke(network: Network, style: NetworkStyle, bond: Bond): string {
  if (!network.edgeColorByValue || !style.valueRange || bond.value === undefined) return INK;
  const [min, max] = style.valueRange;
  return viridis(normalize(bond.value, min, max));
}

/** Uma perna livre nunca é colorida por valor: valor é propriedade do vínculo. */
export function legStroke(): string {
  return INK;
}

export function isLegFree(network: Network, legId: string): boolean {
  return bondOfLeg(network, legId) === undefined;
}

export const COLOR_MODES: ColorMode[] = ['tag', 'role', 'layer', 'degree', 'manual'];
