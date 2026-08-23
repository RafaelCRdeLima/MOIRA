/** Validação numérica do §14.1, camada A.
 *
 *  Contrai cada rede de duas maneiras: pela ordem que o MOIRA determinou, com
 *  os eixos que ele diz que cada tensor tem, e por força bruta somando sobre
 *  todos os índices. Os dois têm de dar o mesmo número.
 *
 *  É um critério mais forte que o original — "o ncon gerado bate com o quimb" —
 *  porque não depende de o quimb estar instalado nem de a convenção do ncon
 *  estar certa. Verifica a matemática: contabilidade de índices, ordem de
 *  contração e transposição implícita. */

import { beforeEach, describe, expect, it } from 'vitest';
import { assignIndices } from '../src/lib/formula/indices';
import { sandwich } from '../src/lib/generators/index';
import { buildContractNetwork } from '../src/lib/contract/network';
import type { OrderNode } from '../src/lib/contract/order';
import { findPath, measurePath } from '../src/lib/contract/order';
import { resetIdCounters } from '../src/lib/model/id';
import { emptyNetwork } from '../src/lib/model/network';
import type { Network } from '../src/lib/model/types';
import { braKet, comLaco, desconexa, dimensionar, doisVinculos } from './redes';
import type { DenseTensor } from './reference';
import { asMap, bruteForce, contractPair, denseFromNetwork, makeRandom, traceSelf } from './reference';

/** Executa a árvore que o MOIRA escolheu, usando os eixos que ele declarou. */
function contrairPelaOrdem(
  tensores: DenseTensor[],
  tree: OrderNode,
): DenseTensor {
  const percorrer = (node: OrderNode): DenseTensor =>
    node.kind === 'leaf'
      ? traceSelf(tensores[node.tensor]!)
      : contractPair(percorrer(node.left), percorrer(node.right));
  return percorrer(tree);
}

/** O núcleo do teste: as duas contas, e a conferência de que os eixos que o
 *  MOIRA declara para cada tensor são os que o desenho tem. */
function conferir(network: Network, semente: number) {
  const assignment = assignIndices(network);
  const contract = buildContractNetwork(network, assignment);
  const dimOf = (key: string) => contract.byKey.get(key)!.dim;

  const rand = makeRandom(semente);
  const { byId, keys, freeKeys } = denseFromNetwork(network, dimOf, rand);

  // Os eixos que o MOIRA declara são os do desenho, na mesma ordem.
  for (const t of contract.tensors) {
    expect(t.axes.map((a) => a.key)).toEqual(keys.get(t.id));
  }
  // E os índices livres são os mesmos, como conjunto.
  expect(new Set(contract.free.map((a) => a.key))).toEqual(new Set(freeKeys));

  const naOrdemDoMoira = contract.tensors.map((t) => byId.get(t.id)!);
  const path = findPath(contract);

  const resultado = contrairPelaOrdem(naOrdemDoMoira, path.tree!);
  const referencia = bruteForce([...byId.values()], freeKeys, dimOf);
  const obtido = asMap(resultado, freeKeys);

  expect(obtido.size).toBe(referencia.size);
  for (const [chave, esperado] of referencia) {
    expect(obtido.get(chave)).toBeCloseTo(esperado, 9);
  }
  return { path, contract, referencia };
}

function comoRede(fragmento: { tensors: Network['tensors']; bonds: Network['bonds'] }): Network {
  return { ...emptyNetwork(), tensors: fragmento.tensors, bonds: fragmento.bonds };
}

describe('a contração na ordem do MOIRA bate com a força bruta', () => {
  beforeEach(resetIdCounters);

  it('MPS aberta de 6 sítios contra a conjugada: ⟨ψ|ψ⟩', () => {
    const { path, referencia } = conferir(braKet(6, { chi: 2, d: 2 }), 12345);
    expect(referencia.size).toBe(1); // escalar
    expect(path.method).toBe('greedy'); // doze tensores passam do limite exaustivo
    expect(path.flops).toBeGreaterThan(0);
  });

  it('MPS de 4 sítios contra a conjugada, com χ = 3', () => {
    conferir(braKet(4, { chi: 3, d: 2 }), 777);
  });

  it('sanduíche ⟨ψ|O|ψ⟩ de 4 sítios', () => {
    const rede = dimensionar(comoRede(sandwich({ sites: 4 })), { chi: 2, d: 2 });
    const { referencia } = conferir(rede, 98765);
    expect(referencia.size).toBe(1);
  });

  it('dois tensores, dois vínculos, dimensões 2 e 3', () => {
    // Com χ igual nos dois vínculos, transpor errado não quebra forma alguma e
    // o teste passaria; com 2 e 3, quebra.
    const { contract, referencia } = conferir(doisVinculos(), 4242);
    expect(referencia.size).toBe(6); // duas pernas livres, 2 × 3
    const dims = contract.summed.map((a) => a.dim).sort();
    expect(dims).toEqual([2, 3]);
  });

  it('rede com laço: traço parcial', () => {
    const { contract, referencia } = conferir(comLaco(), 31415);
    expect(referencia.size).toBe(27); // três pernas livres de dimensão 3
    // O laço é um vínculo cujas duas pernas são do mesmo tensor.
    const laco = contract.tensors.find(
      (t) => new Set(t.axes.map((a) => a.key)).size < t.axes.length,
    );
    expect(laco).toBeDefined();
  });

  it('rede desconexa: o produto dos dois escalares', () => {
    const { referencia } = conferir(desconexa(), 2718);
    expect(referencia.size).toBe(1);
  });
});

describe('ordem exaustiva e gulosa', () => {
  beforeEach(resetIdCounters);

  it('a exaustiva nunca é pior que a gulosa', () => {
    const rede = dimensionar(comoRede(sandwich({ sites: 3 })), { chi: 4, d: 2 });
    const contract = buildContractNetwork(rede, assignIndices(rede));
    expect(contract.tensors).toHaveLength(9);

    const otima = findPath(contract, 'exhaustive');
    const gulosa = findPath(contract, 'greedy');
    expect(otima.flops).toBeLessThanOrEqual(gulosa.flops);
  });

  it('as duas dão o mesmo número, ordem à parte', () => {
    const rede = braKet(4, { chi: 2, d: 2 });
    const assignment = assignIndices(rede);
    const contract = buildContractNetwork(rede, assignment);
    const dimOf = (key: string) => contract.byKey.get(key)!.dim;
    const { byId, freeKeys } = denseFromNetwork(rede, dimOf, makeRandom(555));
    const tensores = contract.tensors.map((t) => byId.get(t.id)!);

    const gulosa = contrairPelaOrdem(tensores, findPath(contract, 'greedy').tree!);
    const referencia = bruteForce([...byId.values()], freeKeys, dimOf);
    expect(asMap(gulosa, freeKeys).get('')).toBeCloseTo(referencia.get('')!, 9);
  });

  it('a gulosa fica perto da ótima, e não a três vezes de distância', () => {
    // Escolher pelo passo mais barato — em vez de pelo quanto o par encolhe a
    // memória — dava caminhos cinco vezes piores que o ótimo neste mesmo caso.
    const rede = dimensionar(comoRede(sandwich({ sites: 3 })), { chi: 16, d: 2 });
    const contract = buildContractNetwork(rede, assignIndices(rede));
    const otima = findPath(contract, 'exhaustive');
    const gulosa = findPath(contract, 'greedy');
    expect(gulosa.flops).toBeLessThan(otima.flops * 1.5);
  });

  it('a gulosa também bate a dobra à esquerda, que é não escolher nada', () => {
    const rede = dimensionar(comoRede(sandwich({ sites: 4 })), { chi: 16, d: 2 });
    const contract = buildContractNetwork(rede, assignIndices(rede));
    let dobra: OrderNode = { kind: 'leaf', tensor: 0 };
    for (let i = 1; i < contract.tensors.length; i++) {
      dobra = { kind: 'pair', left: dobra, right: { kind: 'leaf', tensor: i } };
    }
    expect(findPath(contract, 'greedy').flops).toBeLessThan(measurePath(contract, dobra).flops);
  });

  it('a ordem ruim custa mais que a boa — é para isso que a busca existe', () => {
    const rede = braKet(5, { chi: 4, d: 2 });
    const contract = buildContractNetwork(rede, assignIndices(rede));
    const boa = findPath(contract, 'greedy');

    // Contrair tudo pela esquerda, sem escolher: a ordem que ninguém quer.
    let ingenua: OrderNode = { kind: 'leaf', tensor: 0 };
    for (let i = 1; i < contract.tensors.length; i++) {
      ingenua = { kind: 'pair', left: ingenua, right: { kind: 'leaf', tensor: i } };
    }
    expect(measurePath(contract, ingenua).flops).toBeGreaterThan(boa.flops);
  });
});
