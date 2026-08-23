/** Contrator de referência, deliberadamente burro.
 *
 *  Vive aqui, no diretório de testes, e não é importado pela aplicação em
 *  lugar nenhum — o §14.1 é explícito: se ele passar a ser útil em produção,
 *  alguma coisa saiu do escopo, porque o MOIRA não calcula nada numérico.
 *
 *  O valor dele está em não compartilhar uma linha com o que verifica. A soma
 *  é explícita sobre todos os índices, com laços aninhados: nenhuma reordenação
 *  de eixo, nenhuma multiplicação de matriz, nenhuma esperteza. É lento e é o
 *  ponto. */

import type { Network } from '../src/lib/model/types';

export interface DenseTensor {
  /** Chave do índice em cada eixo, na ordem dos eixos. */
  indices: string[];
  dims: number[];
  data: Float64Array;
}

/** Gerador determinístico: o mesmo teste tem de falhar sempre pelo mesmo
 *  motivo, e um caso que só quebra de vez em quando não se depura. */
export function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000 - 0.5;
  };
}

export function strides(dims: number[]): number[] {
  const s = new Array<number>(dims.length).fill(1);
  for (let i = dims.length - 2; i >= 0; i--) s[i] = s[i + 1]! * dims[i + 1]!;
  return s;
}

export function sizeOf(dims: number[]): number {
  return dims.reduce((a, b) => a * b, 1);
}

/** Tensores densos com dados aleatórios, com os índices lidos do próprio
 *  desenho: perna vinculada leva o id do vínculo, perna livre leva o seu. */
export function denseFromNetwork(
  network: Network,
  dimOf: (key: string) => number,
  rand: () => number,
): { byId: Map<string, DenseTensor>; keys: Map<string, string[]>; freeKeys: string[] } {
  const bondOfLeg = new Map<string, string>();
  for (const bond of network.bonds) {
    bondOfLeg.set(bond.a, bond.id);
    bondOfLeg.set(bond.b, bond.id);
  }

  const byId = new Map<string, DenseTensor>();
  const keys = new Map<string, string[]>();
  const contagem = new Map<string, number>();

  for (const tensor of network.tensors) {
    const indices = tensor.legs.map((leg) => bondOfLeg.get(leg.id) ?? leg.id);
    const dims = indices.map(dimOf);
    const data = new Float64Array(sizeOf(dims));
    for (let i = 0; i < data.length; i++) data[i] = rand();
    byId.set(tensor.id, { indices, dims, data });
    keys.set(tensor.id, indices);
    for (const key of indices) contagem.set(key, (contagem.get(key) ?? 0) + 1);
  }

  const freeKeys = [...contagem.entries()].filter(([, n]) => n === 1).map(([k]) => k);
  return { byId, keys, freeKeys };
}

/** Força bruta: um laço por índice distinto da rede, somando o produto de
 *  todas as entradas. Devolve um mapa da tupla de índices livres para o valor. */
export function bruteForce(
  tensors: DenseTensor[],
  freeKeys: string[],
  dimOf: (key: string) => number,
): Map<string, number> {
  const todos = [...new Set(tensors.flatMap((t) => t.indices))];
  const dims = todos.map(dimOf);
  const posicao = new Map(todos.map((k, i) => [k, i]));
  const valor = new Array<number>(todos.length).fill(0);

  const passos = tensors.map((t) => ({
    tensor: t,
    eixos: t.indices.map((k) => posicao.get(k)!),
    passo: strides(t.dims),
  }));

  const saida = new Map<string, number>();
  const total = sizeOf(dims);

  for (let n = 0; n < total; n++) {
    // Decodifica n na combinação de valores de todos os índices.
    let resto = n;
    for (let i = todos.length - 1; i >= 0; i--) {
      valor[i] = resto % dims[i]!;
      resto = Math.floor(resto / dims[i]!);
    }

    let produto = 1;
    for (const { tensor, eixos, passo } of passos) {
      let offset = 0;
      for (let e = 0; e < eixos.length; e++) offset += valor[eixos[e]!]! * passo[e]!;
      produto *= tensor.data[offset]!;
      if (produto === 0) break;
    }
    if (produto === 0) continue;

    const chave = freeKeys.map((k) => valor[posicao.get(k)!]).join(',');
    saida.set(chave, (saida.get(chave) ?? 0) + produto);
  }

  // Combinações cujo produto foi zero também precisam existir na saída.
  for (const chave of todasAsTuplas(freeKeys.map(dimOf))) {
    if (!saida.has(chave)) saida.set(chave, 0);
  }
  return saida;
}

function* todasAsTuplas(dims: number[]): Generator<string> {
  const total = sizeOf(dims);
  for (let n = 0; n < total; n++) {
    let resto = n;
    const valores = new Array<number>(dims.length);
    for (let i = dims.length - 1; i >= 0; i--) {
      valores[i] = resto % dims[i]!;
      resto = Math.floor(resto / dims[i]!);
    }
    yield valores.join(',');
  }
}

/** Traço parcial: soma os eixos que carregam o mesmo índice dentro do tensor. */
export function traceSelf(t: DenseTensor): DenseTensor {
  const contagem = new Map<string, number>();
  for (const k of t.indices) contagem.set(k, (contagem.get(k) ?? 0) + 1);
  const repetidos = [...contagem.entries()].filter(([, n]) => n > 1).map(([k]) => k);
  if (repetidos.length === 0) return t;

  const mantidos = t.indices
    .map((k, i) => ({ k, i }))
    .filter(({ k }) => contagem.get(k) === 1);
  const outDims = mantidos.map((m) => t.dims[m.i]!);
  const lacoDims = repetidos.map((k) => t.dims[t.indices.indexOf(k)]!);
  const passo = strides(t.dims);
  const out = new Float64Array(sizeOf(outDims));

  for (let a = 0; a < out.length; a++) {
    const valoresMantidos = decode(a, outDims);
    let soma = 0;
    for (let l = 0; l < sizeOf(lacoDims); l++) {
      const valoresLaco = decode(l, lacoDims);
      let offset = 0;
      for (let e = 0; e < t.indices.length; e++) {
        const key = t.indices[e]!;
        const m = mantidos.findIndex((x) => x.i === e);
        const v = m >= 0 ? valoresMantidos[m]! : valoresLaco[repetidos.indexOf(key)]!;
        offset += v * passo[e]!;
      }
      soma += t.data[offset]!;
    }
    out[a] = soma;
  }

  return { indices: mantidos.map((m) => m.k), dims: outDims, data: out };
}

/** Contrai dois tensores somando os índices que eles têm em comum. Eixos de
 *  saída: os que sobram do primeiro, depois os que sobram do segundo. */
export function contractPair(a: DenseTensor, b: DenseTensor): DenseTensor {
  const comuns = a.indices.filter((k) => b.indices.includes(k));
  const restoA = a.indices.filter((k) => !comuns.includes(k));
  const restoB = b.indices.filter((k) => !comuns.includes(k));

  const dimDe = (t: DenseTensor, k: string) => t.dims[t.indices.indexOf(k)]!;
  const dimsA = restoA.map((k) => dimDe(a, k));
  const dimsB = restoB.map((k) => dimDe(b, k));
  const dimsC = comuns.map((k) => dimDe(a, k));

  const outIndices = [...restoA, ...restoB];
  const outDims = [...dimsA, ...dimsB];
  const out = new Float64Array(sizeOf(outDims));

  const passoA = strides(a.dims);
  const passoB = strides(b.dims);
  const eixoA = new Map(a.indices.map((k, i) => [k, i]));
  const eixoB = new Map(b.indices.map((k, i) => [k, i]));

  const nA = sizeOf(dimsA);
  const nB = sizeOf(dimsB);
  const nC = sizeOf(dimsC);

  for (let ia = 0; ia < nA; ia++) {
    const va = decode(ia, dimsA);
    for (let ib = 0; ib < nB; ib++) {
      const vb = decode(ib, dimsB);
      let soma = 0;
      for (let ic = 0; ic < nC; ic++) {
        const vc = decode(ic, dimsC);
        let offA = 0;
        restoA.forEach((k, j) => (offA += va[j]! * passoA[eixoA.get(k)!]!));
        comuns.forEach((k, j) => (offA += vc[j]! * passoA[eixoA.get(k)!]!));
        let offB = 0;
        restoB.forEach((k, j) => (offB += vb[j]! * passoB[eixoB.get(k)!]!));
        comuns.forEach((k, j) => (offB += vc[j]! * passoB[eixoB.get(k)!]!));
        soma += a.data[offA]! * b.data[offB]!;
      }
      out[ia * nB + ib] = soma;
    }
  }

  return { indices: outIndices, dims: outDims, data: out };
}

function decode(n: number, dims: number[]): number[] {
  const valores = new Array<number>(dims.length);
  let resto = n;
  for (let i = dims.length - 1; i >= 0; i--) {
    valores[i] = resto % dims[i]!;
    resto = Math.floor(resto / dims[i]!);
  }
  return valores;
}

/** Lê o resultado como mapa da tupla de índices livres para o valor, na ordem
 *  de `freeKeys` — assim a comparação não depende da ordem dos eixos. */
export function asMap(t: DenseTensor, freeKeys: string[]): Map<string, number> {
  const passo = strides(t.dims);
  const eixo = new Map(t.indices.map((k, i) => [k, i]));
  const dims = freeKeys.map((k) => t.dims[eixo.get(k)!]!);
  const saida = new Map<string, number>();
  for (let n = 0; n < sizeOf(dims); n++) {
    const valores = decode(n, dims);
    let offset = 0;
    freeKeys.forEach((k, j) => (offset += valores[j]! * passo[eixo.get(k)!]!));
    saida.set(valores.join(','), t.data[offset]!);
  }
  return saida;
}
