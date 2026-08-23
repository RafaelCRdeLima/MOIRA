/** Ordem de contração e custo.
 *
 *  Até dez tensores a busca é exaustiva por programação dinâmica sobre
 *  subconjuntos: `melhor[S]` é o menor custo de contrair S, achado testando
 *  toda bipartição de S. São 3ⁿ pares subconjunto/complemento — 59 mil para
 *  dez tensores, instantâneo — e o resultado é ótimo, não aproximado. É a ideia
 *  do `netcon` de Pfeifer, Haegeman & Verstraete sem as podas que o levam mais
 *  longe.
 *
 *  Acima disso, guloso: a cada passo contrai o par conectado mais barato. */

import type { ContractNetwork } from './network';

export const EXHAUSTIVE_LIMIT = 10;

export type OrderNode =
  | { kind: 'leaf'; tensor: number }
  | { kind: 'pair'; left: OrderNode; right: OrderNode };

export interface PairStep {
  /** Tensores de cada lado, por índice na rede. */
  left: number[];
  right: number[];
  /** Índices somados neste passo. */
  contracted: string[];
  /** Índices que sobram no resultado. */
  open: string[];
  flops: number;
  /** Elementos do tensor intermediário produzido. */
  elements: number;
}

export interface Monomial {
  dim: number;
  power: number;
}

export interface ContractionPath {
  tree: OrderNode | null;
  steps: PairStep[];
  flops: number;
  /** Maior intermediário, em número de elementos. */
  peakElements: number;
  /** Monômio do passo mais caro, agrupado por dimensão. */
  costliest: Monomial[];
  /** Expoente de χ no passo mais caro. */
  chiExponent: number;
  chi: number;
  method: 'exhaustive' | 'greedy' | 'manual';
}

interface Node {
  mask: number;
  members: number[];
  open: string[];
  elements: number;
}

export function findPath(net: ContractNetwork, method?: 'exhaustive' | 'greedy'): ContractionPath {
  const n = net.tensors.length;
  if (n === 0) return emptyPath(net);

  const escolhido = method ?? (n <= EXHAUSTIVE_LIMIT ? 'exhaustive' : 'greedy');
  const tree = escolhido === 'exhaustive' && n <= EXHAUSTIVE_LIMIT ? exhaustive(net) : greedy(net);
  return describe(net, tree, escolhido);
}

/** Percorre uma árvore dada — a ordem fixada à mão — e mede o mesmo que as
 *  automáticas, para a comparação lado a lado ser entre iguais. */
export function measurePath(net: ContractNetwork, tree: OrderNode): ContractionPath {
  return describe(net, tree, 'manual');
}

// ─── contabilidade de índices ───────────────────────────────────────────────

/** Índices que sobram num conjunto de tensores: os que aparecem uma vez só.
 *  Um índice que aparece duas vezes está contraído ali dentro; num só tensor,
 *  isso é traço parcial. */
function openIndices(net: ContractNetwork, members: number[]): string[] {
  const contagem = new Map<string, number>();
  for (const i of members) {
    for (const axis of net.tensors[i]!.axes) {
      contagem.set(axis.key, (contagem.get(axis.key) ?? 0) + 1);
    }
  }
  return [...contagem.entries()].filter(([, n]) => n === 1).map(([k]) => k);
}

function sizeOf(net: ContractNetwork, keys: string[]): number {
  let size = 1;
  for (const key of keys) size *= net.byKey.get(key)!.dim;
  return size;
}

/** Custo de contrair dois grupos: produto das dimensões de todos os índices
 *  envolvidos — os somados e os que sobram. Sem índice em comum, isto é o
 *  produto tensorial, e o custo é o produto dos tamanhos. */
function stepCost(net: ContractNetwork, a: string[], b: string[]): number {
  return sizeOf(net, [...new Set([...a, ...b])]);
}

/** Quanto o par encolhe a memória: tamanho dos dois somado menos o do
 *  resultado. Positivo quer dizer que a contração reduz o que está guardado.
 *
 *  É por este número que a gulosa escolhe, e não pelo custo do passo. Escolher
 *  pelo passo mais barato leva a contrair primeiro o que é pequeno agora e
 *  deixar para o fim o que virou enorme — na prática dá caminhos várias vezes
 *  piores que o ótimo, e às vezes piores que não escolher nada. */
function shrinkage(net: ContractNetwork, a: string[], b: string[]): number {
  const resultado = [...new Set([...a, ...b])].filter(
    (k) => !(a.includes(k) && b.includes(k)),
  );
  return sizeOf(net, a) + sizeOf(net, b) - sizeOf(net, resultado);
}

/** Traço parcial de um tensor sozinho: passa uma vez por todos os seus
 *  índices, contando o índice repetido só uma vez. */
function leafCost(net: ContractNetwork, i: number): number {
  const keys = new Set(net.tensors[i]!.axes.map((a) => a.key));
  const temLaco = keys.size < net.tensors[i]!.axes.length;
  return temLaco ? sizeOf(net, [...keys]) : 0;
}

// ─── busca exaustiva ────────────────────────────────────────────────────────

function exhaustive(net: ContractNetwork): OrderNode {
  const n = net.tensors.length;
  const total = 1 << n;
  const custo = new Float64Array(total).fill(Infinity);
  const arvore = new Array<OrderNode | null>(total).fill(null);
  const abertos = new Array<string[]>(total);
  const membros = new Array<number[]>(total);

  for (let mask = 1; mask < total; mask++) {
    const lista: number[] = [];
    for (let i = 0; i < n; i++) if (mask & (1 << i)) lista.push(i);
    membros[mask] = lista;
    abertos[mask] = openIndices(net, lista);
  }

  for (let i = 0; i < n; i++) {
    const mask = 1 << i;
    custo[mask] = leafCost(net, i);
    arvore[mask] = { kind: 'leaf', tensor: i };
  }

  for (let mask = 1; mask < total; mask++) {
    if (membros[mask]!.length < 2) continue;
    // Cada bipartição uma vez só: `sub` sempre contém o menor membro.
    const menor = mask & -mask;
    for (let sub = (mask - 1) & mask; sub > 0; sub = (sub - 1) & mask) {
      if (!(sub & menor)) continue;
      const resto = mask ^ sub;
      if (resto === 0) continue;
      const parcial = custo[sub]! + custo[resto]!;
      if (!Number.isFinite(parcial)) continue;
      const candidato = parcial + stepCost(net, abertos[sub]!, abertos[resto]!);
      if (candidato < custo[mask]!) {
        custo[mask] = candidato;
        arvore[mask] = { kind: 'pair', left: arvore[sub]!, right: arvore[resto]! };
      }
    }
  }

  return arvore[total - 1]!;
}

// ─── heurística gulosa ──────────────────────────────────────────────────────

function greedy(net: ContractNetwork): OrderNode {
  let nodes: { node: Node; tree: OrderNode }[] = net.tensors.map((_, i) => ({
    node: { mask: 1 << i, members: [i], open: openIndices(net, [i]), elements: 0 },
    tree: { kind: 'leaf', tensor: i } as OrderNode,
  }));

  while (nodes.length > 1) {
    let melhor: { i: number; j: number; encolhe: number; custo: number } | null = null;

    // Só pares que compartilham índice: um produto tensorial nunca é o passo
    // mais barato enquanto houver o que contrair de verdade.
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]!.node.open;
        const b = nodes[j]!.node.open;
        if (!a.some((k) => b.includes(k))) continue;
        const encolhe = shrinkage(net, a, b);
        const custo = stepCost(net, a, b);
        if (
          melhor === null ||
          encolhe > melhor.encolhe ||
          (encolhe === melhor.encolhe && custo < melhor.custo)
        ) {
          melhor = { i, j, encolhe, custo };
        }
      }
    }

    // Nada conectado: a rede é desconexa, e o que resta são produtos
    // tensoriais. Junta os dois menores primeiro.
    if (melhor === null) {
      const ordenados = [...nodes.keys()].sort(
        (a, b) => sizeOf(net, nodes[a]!.node.open) - sizeOf(net, nodes[b]!.node.open),
      );
      melhor = { i: ordenados[0]!, j: ordenados[1]!, encolhe: 0, custo: 0 };
    }

    const a = nodes[melhor.i]!;
    const b = nodes[melhor.j]!;
    const members = [...a.node.members, ...b.node.members];
    const fundido = {
      node: { mask: a.node.mask | b.node.mask, members, open: openIndices(net, members), elements: 0 },
      tree: { kind: 'pair', left: a.tree, right: b.tree } as OrderNode,
    };
    nodes = nodes.filter((_, k) => k !== melhor!.i && k !== melhor!.j);
    nodes.push(fundido);
  }

  return nodes[0]!.tree;
}

// ─── medida ─────────────────────────────────────────────────────────────────

function describe(
  net: ContractNetwork,
  tree: OrderNode,
  method: ContractionPath['method'],
): ContractionPath {
  const steps: PairStep[] = [];
  let flops = 0;
  let peak = 0;

  const percorrer = (node: OrderNode): { members: number[]; open: string[] } => {
    if (node.kind === 'leaf') {
      const open = openIndices(net, [node.tensor]);
      flops += leafCost(net, node.tensor);
      peak = Math.max(peak, sizeOf(net, open));
      return { members: [node.tensor], open };
    }
    const left = percorrer(node.left);
    const right = percorrer(node.right);
    const members = [...left.members, ...right.members];
    const open = openIndices(net, members);
    const contracted = [...new Set([...left.open, ...right.open])].filter(
      (k) => !open.includes(k),
    );
    const custo = stepCost(net, left.open, right.open);
    const elements = sizeOf(net, open);
    flops += custo;
    peak = Math.max(peak, elements);
    steps.push({
      left: left.members,
      right: right.members,
      contracted,
      open,
      flops: custo,
      elements,
    });
    return { members, open };
  };

  percorrer(tree);

  const maisCaro = steps.reduce<PairStep | null>(
    (a, b) => (a === null || b.flops > a.flops ? b : a),
    null,
  );
  const monomio = maisCaro ? monomialOf(net, [...new Set([...maisCaro.contracted, ...maisCaro.open])]) : [];

  return {
    tree,
    steps,
    flops,
    peakElements: peak,
    costliest: monomio,
    chiExponent: monomio.find((m) => m.dim === net.chi)?.power ?? 0,
    chi: net.chi,
    method,
  };
}

/** Agrupa as dimensões do passo mais caro: `[{dim:16,power:3},{dim:2,power:2}]`
 *  vira `O(χ³·2²)` na tela, que é como um físico escreve o escalonamento. */
function monomialOf(net: ContractNetwork, keys: string[]): Monomial[] {
  const contagem = new Map<number, number>();
  for (const key of keys) {
    const dim = net.byKey.get(key)!.dim;
    contagem.set(dim, (contagem.get(dim) ?? 0) + 1);
  }
  return [...contagem.entries()]
    .map(([dim, power]) => ({ dim, power }))
    .sort((a, b) => b.dim - a.dim);
}

function emptyPath(net: ContractNetwork): ContractionPath {
  return {
    tree: null,
    steps: [],
    flops: 0,
    peakElements: 0,
    costliest: [],
    chiExponent: 0,
    chi: net.chi,
    method: 'exhaustive',
  };
}

/** Ordem das folhas na árvore, da esquerda para a direita. */
export function leafOrder(tree: OrderNode | null): number[] {
  if (!tree) return [];
  if (tree.kind === 'leaf') return [tree.tensor];
  return [...leafOrder(tree.left), ...leafOrder(tree.right)];
}
