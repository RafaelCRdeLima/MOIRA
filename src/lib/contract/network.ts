/** A rede vista como problema de contração: tensores com eixos, cada eixo
 *  carregando o índice que a faixa da equação exibe e a dimensão que o custo
 *  usa.
 *
 *  Fonte única. A busca de ordem, o cálculo de custo e os quatro geradores de
 *  código consomem esta estrutura e nenhum deles recalcula índice, ordem de
 *  eixo ou nome de tensor por conta própria — pelo mesmo motivo que
 *  `bondCurve` é a única conta da curva de um vínculo. */

import type { IndexAssignment } from '../formula/indices';
import { displayNames } from '../formula/indices';
import type { Network } from '../model/types';

/** Dimensão suposta quando o usuário não declarou nenhuma. Aparece marcada em
 *  `known: false` para o painel de custo poder dizer quantas ele supôs. */
export const ASSUMED_DIM = 2;

export interface ContractAxis {
  /** Chave estável do índice: id do vínculo, ou da perna quando livre. */
  key: string;
  /** Símbolo LaTeX, o mesmo que a faixa da equação mostra. */
  symbol: string;
  /** Identificador de código, o mesmo nos quatro dialetos. */
  code: string;
  dim: number;
  known: boolean;
  free: boolean;
}

export interface ContractTensor {
  id: string;
  /** Nome exibido no canvas e na fórmula. */
  name: string;
  /** Identificador de variável no código gerado; único, e distinto entre um
   *  tensor e o seu conjugado, que compartilham o nome exibido. */
  code: string;
  conjugate: boolean;
  tags: string[];
  /** Eixos na ordem das pernas — que é a ordem dos eixos do tensor, e a mesma
   *  que a fórmula usa dentro do fator. */
  axes: ContractAxis[];
}

export interface ContractNetwork {
  tensors: ContractTensor[];
  /** Eixos de saída, em ordem de leitura do canvas. */
  free: ContractAxis[];
  summed: ContractAxis[];
  /** Maior dimensão presente: é o χ do escalonamento. */
  chi: number;
  /** Índices cuja dimensão foi suposta. */
  assumed: number;
  byKey: Map<string, ContractAxis>;
}

export function buildContractNetwork(
  network: Network,
  assignment: IndexAssignment,
): ContractNetwork {
  const dims = resolveDimensions(network, assignment);
  const byKey = new Map<string, ContractAxis>();

  const axisOf = (key: string): ContractAxis => {
    const existing = byKey.get(key);
    if (existing) return existing;
    const entry = [...assignment.byLeg.values()].find((s) => s.key === key)!;
    const resolved = dims.get(key) ?? { dim: ASSUMED_DIM, known: false };
    const axis: ContractAxis = {
      key,
      symbol: entry.symbol,
      code: entry.code,
      dim: resolved.dim,
      known: resolved.known,
      free: entry.kind === 'free',
    };
    byKey.set(key, axis);
    return axis;
  };

  const names = displayNames(network);
  const codes = new Set<string>();

  const tensors: ContractTensor[] = assignment.factors.map(({ tensor }) => ({
    id: tensor.id,
    name: names.get(tensor.id)!,
    code: uniqueCode(names.get(tensor.id)!, tensor.conjugate === true, codes),
    conjugate: tensor.conjugate === true,
    tags: [...tensor.tags],
    axes: tensor.legs.map((leg) => axisOf(assignment.byLeg.get(leg.id)!.key)),
  }));

  const free = assignment.free.map((s) => axisOf(s.key));
  const summed = assignment.summed.map((s) => axisOf(s.key));
  const todos = [...byKey.values()];

  return {
    tensors,
    free,
    summed,
    chi: todos.length > 0 ? Math.max(...todos.map((a) => a.dim)) : 1,
    assumed: todos.filter((a) => !a.known).length,
    byKey,
  };
}

/** Dimensão de cada índice. Num vínculo vem da declaração do vínculo e, na
 *  falta dela, da perna que declarar — o §5 diz que `Bond.dim` só é preenchido
 *  quando as duas pontas concordam, então anotar uma delas é comum. */
function resolveDimensions(
  network: Network,
  assignment: IndexAssignment,
): Map<string, { dim: number; known: boolean }> {
  const legDim = new Map<string, number>();
  for (const tensor of network.tensors) {
    for (const leg of tensor.legs) if (leg.dim !== undefined) legDim.set(leg.id, leg.dim);
  }

  const dims = new Map<string, { dim: number; known: boolean }>();
  for (const bond of network.bonds) {
    const dim = bond.dim ?? legDim.get(bond.a) ?? legDim.get(bond.b);
    dims.set(bond.id, dim !== undefined ? { dim, known: true } : { dim: ASSUMED_DIM, known: false });
  }
  for (const symbol of assignment.free) {
    const dim = legDim.get(symbol.legIds[0]!);
    dims.set(symbol.key, dim !== undefined ? { dim, known: true } : { dim: ASSUMED_DIM, known: false });
  }
  return dims;
}

/** Nome de variável. O conjugado ganha sufixo porque bra e ket compartilham o
 *  nome exibido — no código eles são dois arrays diferentes. */
function uniqueCode(name: string, conjugate: boolean, used: Set<string>): string {
  const base = sanitize(name) + (conjugate ? 'c' : '');
  let candidate = base;
  let n = 2;
  while (used.has(candidate)) candidate = `${base}_${n++}`;
  used.add(candidate);
  return candidate;
}

function sanitize(name: string): string {
  const limpo = name.replace(/[^A-Za-z0-9_]/g, '');
  if (limpo === '') return 'T';
  return /^\d/.test(limpo) ? `T${limpo}` : limpo;
}
