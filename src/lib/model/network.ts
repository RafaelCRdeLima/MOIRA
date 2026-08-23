/** Operações sobre a rede que preservam os invariantes do §5:
 *  uma perna participa de no máximo um vínculo; vínculo entre duas pernas do
 *  mesmo tensor é laço legítimo (traço parcial); dimensão conflitante é aviso,
 *  não erro bloqueante — quem avisa é lib/model/validate.ts. */

import { nextId } from './id';
import type { Bond, Leg, Network, Shape, Tensor } from './types';
import { SCHEMA_VERSION } from './types';

export const DEFAULT_LEG_LENGTH = 26;

export function emptyNetwork(title = ''): Network {
  return {
    tensors: [],
    bonds: [],
    colorMode: 'tag',
    meta: { title, created: new Date().toISOString(), version: SCHEMA_VERSION },
  };
}

export function createLeg(angle: number, length = DEFAULT_LEG_LENGTH): Leg {
  return { id: nextId('l'), angle, length };
}

/** Pernas distribuídas uniformemente pelo círculo, começando à direita. */
export function createTensor(
  x: number,
  y: number,
  options: { name?: string; shape?: Shape; legCount?: number; tags?: string[] } = {},
): Tensor {
  const legCount = options.legCount ?? 3;
  const legs: Leg[] = [];
  for (let i = 0; i < legCount; i++) {
    legs.push(createLeg((i / legCount) * 2 * Math.PI));
  }
  return {
    id: nextId('t'),
    name: options.name ?? '',
    x,
    y,
    shape: options.shape ?? 'circle',
    legs,
    tags: options.tags ?? [],
  };
}

export function findTensor(network: Network, tensorId: string): Tensor | undefined {
  return network.tensors.find((t) => t.id === tensorId);
}

export function findLeg(network: Network, legId: string): { tensor: Tensor; leg: Leg } | undefined {
  for (const tensor of network.tensors) {
    const leg = tensor.legs.find((l) => l.id === legId);
    if (leg) return { tensor, leg };
  }
  return undefined;
}

export function bondOfLeg(network: Network, legId: string): Bond | undefined {
  return network.bonds.find((b) => b.a === legId || b.b === legId);
}

export function isLegFree(network: Network, legId: string): boolean {
  return bondOfLeg(network, legId) === undefined;
}

/** Cria o vínculo, ou devolve undefined se ele violaria um invariante:
 *  perna inexistente, perna já vinculada, ou perna consigo mesma. */
export function addBond(network: Network, legA: string, legB: string): Bond | undefined {
  if (legA === legB) return undefined;
  if (!findLeg(network, legA) || !findLeg(network, legB)) return undefined;
  if (!isLegFree(network, legA) || !isLegFree(network, legB)) return undefined;

  const bond: Bond = { id: nextId('b'), a: legA, b: legB, curvature: 0 };
  const dimA = findLeg(network, legA)?.leg.dim;
  const dimB = findLeg(network, legB)?.leg.dim;
  if (dimA !== undefined && dimA === dimB) bond.dim = dimA;

  network.bonds.push(bond);
  return bond;
}

export function removeBond(network: Network, bondId: string): boolean {
  const i = network.bonds.findIndex((b) => b.id === bondId);
  if (i === -1) return false;
  network.bonds.splice(i, 1);
  return true;
}

/** Apaga o tensor e todo vínculo que tocava alguma de suas pernas. */
export function removeTensor(network: Network, tensorId: string): boolean {
  const i = network.tensors.findIndex((t) => t.id === tensorId);
  if (i === -1) return false;
  const legIds = new Set(network.tensors[i]!.legs.map((l) => l.id));
  network.bonds = network.bonds.filter((b) => !legIds.has(b.a) && !legIds.has(b.b));
  network.tensors.splice(i, 1);
  if (network.orthogonalityCenter === tensorId) network.orthogonalityCenter = undefined;
  return true;
}

/** O tensor do outro lado do vínculo. Num laço, é o próprio tensor. */
export function bondEnds(
  network: Network,
  bond: Bond,
): { from: { tensor: Tensor; leg: Leg }; to: { tensor: Tensor; leg: Leg } } | undefined {
  const from = findLeg(network, bond.a);
  const to = findLeg(network, bond.b);
  if (!from || !to) return undefined;
  return { from, to };
}

export function isLoop(network: Network, bond: Bond): boolean {
  const ends = bondEnds(network, bond);
  return ends !== undefined && ends.from.tensor.id === ends.to.tensor.id;
}
