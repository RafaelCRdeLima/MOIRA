/** Copiar e colar sub-redes. O recorte leva só os vínculos internos à seleção:
 *  um vínculo com uma ponta de fora não tem como sobreviver à cópia, e a perna
 *  correspondente volta a ficar livre no que foi colado. */

import type { Fragment } from '../generators/common';
import { nextId } from './id';
import type { Bond, Network, Tensor } from './types';

export function extractSubnetwork(network: Network, tensorIds: string[]): Fragment {
  const wanted = new Set(tensorIds);
  const tensors = network.tensors.filter((t) => wanted.has(t.id));
  const legIds = new Set(tensors.flatMap((t) => t.legs.map((l) => l.id)));
  const bonds = network.bonds.filter((b) => legIds.has(b.a) && legIds.has(b.b));
  return structuredClone({ tensors, bonds });
}

/** Renomeia tudo antes de inserir: ids do recorte não podem colidir com os da
 *  rede, nem entre duas colagens do mesmo recorte. */
export function pasteFragment(
  network: Network,
  fragment: Fragment,
  offset: { x: number; y: number },
): string[] {
  const copy = structuredClone(fragment);
  const legMap = new Map<string, string>();
  const newTensors: Tensor[] = [];

  for (const tensor of copy.tensors) {
    const oldTip = tensor.isometryTip;
    tensor.id = nextId('t');
    for (const leg of tensor.legs) {
      const fresh = nextId('l');
      legMap.set(leg.id, fresh);
      leg.id = fresh;
    }
    if (oldTip) tensor.isometryTip = legMap.get(oldTip);
    tensor.x += offset.x;
    tensor.y += offset.y;
    newTensors.push(tensor);
  }

  const newBonds: Bond[] = [];
  for (const bond of copy.bonds) {
    const a = legMap.get(bond.a);
    const b = legMap.get(bond.b);
    if (!a || !b) continue;
    newBonds.push({ ...bond, id: nextId('b'), a, b });
  }

  network.tensors.push(...newTensors);
  network.bonds.push(...newBonds);
  return newTensors.map((t) => t.id);
}

/** Caixa que envolve os tensores dados, para posicionar o que vem de fora. */
export function boundingBox(tensors: Tensor[]): { x: number; y: number; w: number; h: number } {
  if (tensors.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  const xs = tensors.map((t) => t.x);
  const ys = tensors.map((t) => t.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
