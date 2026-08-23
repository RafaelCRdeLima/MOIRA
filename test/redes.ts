/** Redes de teste, montadas com os mesmos geradores da aplicação e depois
 *  redimensionadas para caber na força bruta: χ = 2 ou 3 e d = 2, como manda o
 *  §14.1. As dimensões que os geradores põem (χ = 16) dariam 16¹⁰ combinações. */

import { mps } from '../src/lib/generators/index';
import { addBond, createTensor, emptyNetwork } from '../src/lib/model/network';
import type { Network } from '../src/lib/model/types';

const UP = -Math.PI / 2;
const DOWN = Math.PI / 2;

/** Perna vertical é física; horizontal é vínculo de correlação. */
export function dimensionar(network: Network, { chi, d }: { chi: number; d: number }): Network {
  for (const tensor of network.tensors) {
    for (const leg of tensor.legs) {
      const vertical = Math.abs(Math.abs(leg.angle) - Math.PI / 2) < 1e-6;
      leg.dim = vertical ? d : chi;
    }
  }
  for (const bond of network.bonds) {
    const legs = network.tensors.flatMap((t) => t.legs);
    const a = legs.find((l) => l.id === bond.a);
    bond.dim = a?.dim;
  }
  return network;
}

function comoRede(fragmento: { tensors: Network['tensors']; bonds: Network['bonds'] }): Network {
  return { ...emptyNetwork(), tensors: fragmento.tensors, bonds: fragmento.bonds };
}

/** ⟨ψ|ψ⟩: MPS aberta contra a própria conjugada, pernas físicas ligadas. */
export function braKet(sites: number, dims = { chi: 2, d: 2 }): Network {
  const ket = mps({ sites }, 80, UP, 'A');
  const bra = mps({ sites }, -80, DOWN, 'A');
  for (const tensor of bra.tensors) {
    tensor.conjugate = true;
    tensor.tags = ['bra', 'mps'];
  }
  for (const tensor of ket.tensors) tensor.tags = ['ket', 'mps'];

  const network = comoRede({
    tensors: [...ket.tensors, ...bra.tensors],
    bonds: [...ket.bonds, ...bra.bonds],
  });

  const fisica = (t: Network['tensors'][number], angulo: number) =>
    t.legs.find((l) => Math.abs(l.angle - angulo) < 1e-9)!;
  for (let i = 0; i < sites; i++) {
    addBond(network, fisica(ket.tensors[i]!, UP).id, fisica(bra.tensors[i]!, DOWN).id);
  }
  return dimensionar(network, dims);
}

/** Dois tensores ligados por dois vínculos, de dimensões diferentes.
 *
 *  É o caso que pega o erro que os outros não pegam: contrair um índice,
 *  transpor errado e contrair o outro sobre o eixo trocado dá um número
 *  plausível. Com χ iguais, a transposição indevida não quebra forma alguma e o
 *  teste passa; com 2 e 3, quebra. */
export function doisVinculos(): Network {
  const network = emptyNetwork();
  const a = createTensor(0, 0, { name: 'A', legCount: 3 });
  const b = createTensor(200, 0, { name: 'B', legCount: 3 });
  network.tensors.push(a, b);

  a.legs[0]!.dim = 2; // vínculo χ = 2
  b.legs[1]!.dim = 2;
  a.legs[1]!.dim = 3; // vínculo χ = 3
  b.legs[0]!.dim = 3;
  a.legs[2]!.dim = 2; // perna livre
  b.legs[2]!.dim = 3;

  addBond(network, a.legs[0]!.id, b.legs[1]!.id);
  addBond(network, a.legs[1]!.id, b.legs[0]!.id);
  return network;
}

/** Um tensor com laço: traço parcial sobre um dos índices. */
export function comLaco(): Network {
  const network = emptyNetwork();
  const t = createTensor(0, 0, { name: 'T', legCount: 4 });
  const u = createTensor(180, 0, { name: 'U', legCount: 3 });
  network.tensors.push(t, u);
  for (const leg of [...t.legs, ...u.legs]) leg.dim = 3;

  addBond(network, t.legs[1]!.id, t.legs[2]!.id); // laço no próprio T
  addBond(network, t.legs[0]!.id, u.legs[1]!.id);
  return network;
}

/** Duas componentes sem ligação: a contração é o produto dos dois escalares. */
export function desconexa(): Network {
  const network = emptyNetwork();
  const a = createTensor(0, 0, { name: 'A', legCount: 2 });
  const b = createTensor(120, 0, { name: 'B', legCount: 2 });
  const c = createTensor(0, 200, { name: 'C', legCount: 2 });
  const d = createTensor(120, 200, { name: 'D', legCount: 2 });
  network.tensors.push(a, b, c, d);
  for (const leg of [...a.legs, ...b.legs, ...c.legs, ...d.legs]) leg.dim = 2;

  addBond(network, a.legs[0]!.id, b.legs[1]!.id);
  addBond(network, a.legs[1]!.id, b.legs[0]!.id);
  addBond(network, c.legs[0]!.id, d.legs[1]!.id);
  addBond(network, c.legs[1]!.id, d.legs[0]!.id);
  return network;
}
