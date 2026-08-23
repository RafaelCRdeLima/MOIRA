/** Atribuição de índices à rede. Função pura, sem DOM: é a mesma tabela que
 *  alimenta a fórmula do M3a e vai alimentar a geração de código do M3b, e as
 *  duas têm de concordar letra por letra.
 *
 *  Duas ordens diferentes convivem aqui, e confundi-las é o erro fácil:
 *
 *  - a **ordem de leitura** do canvas, que decide qual índice aparece primeiro
 *    no lado esquerdo e em que ordem os fatores entram no produto;
 *  - a **atribuição de letras**, que é grudenta: uma perna que já tinha letra a
 *    mantém enquanto existir. Sem isso, mover um tensor renomearia os índices
 *    de quem ficou parado, que é justamente o que o §8.1 proíbe. */

import { bondMidpoint, legTip } from '../model/geometry';
import type { Network, Tensor } from '../model/types';

/** Latinas para índices físicos. */
export const LATIN = ['i', 'j', 'k', 'l', 'm', 'n', 'p', 'q', 'r', 's'];
/** Gregas para vínculos internos. */
export const GREEK = [
  '\\alpha', '\\beta', '\\gamma', '\\delta', '\\epsilon', '\\zeta',
  '\\eta', '\\theta', '\\lambda', '\\mu', '\\nu', '\\xi',
];

/** Altura de uma faixa de leitura. Dois tensores dentro da mesma faixa contam
 *  como da mesma linha e se ordenam pela horizontal; faixas diferentes se
 *  ordenam de cima para baixo. É o que faz "esquerda→direita, cima→baixo"
 *  significar ordem de leitura de texto, e não varredura por coluna. */
export const ROW_BAND = 32;

export type IndexKind = 'free' | 'bond';

export interface IndexSymbol {
  /** Chave estável: id do vínculo, ou id da perna quando ela está livre. */
  key: string;
  kind: IndexKind;
  /** Símbolo em LaTeX: `i`, `\alpha`, `i_{1}`. */
  symbol: string;
  /** Veio de rótulo escrito pelo usuário, e por isso não entra no rodízio. */
  custom: boolean;
  legIds: string[];
}

export interface IndexAssignment {
  /** Uma entrada por perna; as duas pernas de um vínculo apontam para o mesmo símbolo. */
  byLeg: Map<string, IndexSymbol>;
  /** Índices livres, em ordem de leitura do canvas. */
  free: IndexSymbol[];
  /** Índices somados, em ordem de leitura do canvas. */
  summed: IndexSymbol[];
  /** Tensores em ordem de leitura, com o nome que a fórmula vai usar. */
  factors: { tensor: Tensor; name: string }[];
}

interface Slot {
  key: string;
  kind: IndexKind;
  legIds: string[];
  label: string | undefined;
  x: number;
  y: number;
}

/** `previous` guarda as letras já em uso. Passar a própria saída de volta é
 *  idempotente, então o componente pode recomputar a cada quadro sem medo. */
export function assignIndices(network: Network, previous?: IndexAssignment): IndexAssignment {
  const slots = collectSlots(network).sort(readingOrder);

  const inherited = new Map<string, string>();
  const used = new Set<string>();

  // Primeira passada: rótulo do usuário vence, e letra herdada se mantém.
  for (const slot of slots) {
    if (slot.label) {
      used.add(slot.label);
      continue;
    }
    const before = previous?.byLeg.get(slot.legIds[0]!);
    if (before && before.key === slot.key && before.kind === slot.kind && !before.custom) {
      inherited.set(slot.key, before.symbol);
      used.add(before.symbol);
    }
  }

  // Segunda passada: quem sobrou recebe a próxima letra livre do alfabeto certo.
  const byLeg = new Map<string, IndexSymbol>();
  const free: IndexSymbol[] = [];
  const summed: IndexSymbol[] = [];

  for (const slot of slots) {
    const alphabet = slot.kind === 'free' ? LATIN : GREEK;
    const symbol = slot.label ?? inherited.get(slot.key) ?? nextSymbol(alphabet, used);
    used.add(symbol);

    const entry: IndexSymbol = {
      key: slot.key,
      kind: slot.kind,
      symbol,
      custom: slot.label !== undefined,
      legIds: slot.legIds,
    };
    for (const legId of slot.legIds) byLeg.set(legId, entry);
    (slot.kind === 'free' ? free : summed).push(entry);
  }

  return { byLeg, free, summed, factors: orderedFactors(network) };
}

function collectSlots(network: Network): Slot[] {
  const slots: Slot[] = [];
  const bonded = new Set<string>();

  const legOwner = new Map<string, { tensor: Tensor; legIndex: number }>();
  network.tensors.forEach((tensor) => {
    tensor.legs.forEach((leg, legIndex) => legOwner.set(leg.id, { tensor, legIndex }));
  });

  for (const bond of network.bonds) {
    const a = legOwner.get(bond.a);
    const b = legOwner.get(bond.b);
    if (!a || !b) continue;
    bonded.add(bond.a);
    bonded.add(bond.b);
    const mid = bondMidpoint(network, bond) ?? { x: a.tensor.x, y: a.tensor.y };
    slots.push({
      key: bond.id,
      kind: 'bond',
      legIds: [bond.a, bond.b],
      label: bond.label || a.tensor.legs[a.legIndex]!.label || b.tensor.legs[b.legIndex]!.label || undefined,
      x: mid.x,
      y: mid.y,
    });
  }

  for (const tensor of network.tensors) {
    for (const leg of tensor.legs) {
      if (bonded.has(leg.id)) continue;
      // A ponta da perna é onde o índice aparece desenhado; é ela que manda na
      // ordem de leitura, não o centro do tensor.
      const tip = legTip(tensor, leg);
      slots.push({
        key: leg.id,
        kind: 'free',
        legIds: [leg.id],
        label: leg.label || undefined,
        x: tip.x,
        y: tip.y,
      });
    }
  }

  return slots;
}

/** Ordem de leitura: faixa horizontal primeiro, depois esquerda para direita.
 *  Empate em tudo resolve por chave, senão a fórmula treme entre quadros. */
function readingOrder(a: { x: number; y: number; key: string }, b: { x: number; y: number; key: string }): number {
  const bandA = Math.round(a.y / ROW_BAND);
  const bandB = Math.round(b.y / ROW_BAND);
  if (bandA !== bandB) return bandA - bandB;
  if (a.x !== b.x) return a.x - b.x;
  if (a.y !== b.y) return a.y - b.y;
  return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
}

function nextSymbol(alphabet: string[], used: Set<string>): string {
  for (let i = 0; ; i++) {
    const round = Math.floor(i / alphabet.length);
    const base = alphabet[i % alphabet.length]!;
    const candidate = round === 0 ? base : `${base}_{${round}}`;
    if (!used.has(candidate)) return candidate;
  }
}

// ─── nomes dos fatores ──────────────────────────────────────────────────────

/** Letras para tensores sem nome. Sem I nem O: confundem com índice e com zero. */
const AUTO_NAMES = 'ABCDEFGHJKLMNPQRSTUVWXYZ'.split('');

/** Tensores na ordem de leitura do canvas, já com o nome que a fórmula usa.
 *  Nome automático sai da ordem de criação, não da posição: mover um tensor
 *  reordena os fatores do produto, mas não pode rebatizar ninguém. */
export function orderedFactors(network: Network): { tensor: Tensor; name: string }[] {
  const names = automaticNames(network);
  return [...network.tensors]
    .map((tensor) => ({ tensor, x: tensor.x, y: tensor.y, key: tensor.id }))
    .sort(readingOrder)
    .map(({ tensor }) => ({ tensor, name: tensor.name || names.get(tensor.id)! }));
}

function automaticNames(network: Network): Map<string, string> {
  const taken = new Set(network.tensors.map((t) => t.name).filter(Boolean));
  const unnamed = network.tensors
    .filter((t) => !t.name)
    .sort((a, b) => creationOrder(a.id) - creationOrder(b.id) || (a.id < b.id ? -1 : 1));

  const names = new Map<string, string>();
  let next = 0;
  for (const tensor of unnamed) {
    let name: string;
    do {
      name = next < AUTO_NAMES.length ? AUTO_NAMES[next]! : `T_{${next - AUTO_NAMES.length + 1}}`;
      next += 1;
    } while (taken.has(name));
    taken.add(name);
    names.set(tensor.id, name);
  }
  return names;
}

function creationOrder(id: string): number {
  const match = /(\d+)$/.exec(id);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}
