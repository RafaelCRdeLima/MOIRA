/** Da rede para a string LaTeX. Pura: o componente só entrega o resultado ao
 *  KaTeX. Assim o teste confere a fórmula sem montar DOM nenhum. */

import type { Network, Tensor } from '../model/types';
import type { IndexAssignment } from './indices';

export type Summation = 'explicit' | 'einstein';
export type ConjugateMark = 'dagger' | 'asterisk';

export interface FormulaOptions {
  summation: Summation;
  conjugate: ConjugateMark;
}

export const DEFAULT_OPTIONS: FormulaOptions = { summation: 'explicit', conjugate: 'dagger' };

export interface FormulaFactor {
  tensorId: string;
  name: string;
  latex: string;
}

export interface Formula {
  /** A expressão inteira, pronta para o botão de copiar. */
  latex: string;
  lhs: string;
  rhs: string;
  /** Símbolos somados, na ordem em que entram sob o Σ. */
  summed: string[];
  /** `\\sum_{...}` quando a convenção é explícita, senão nulo. */
  sum: string | null;
  /** Um fator por tensor, em ordem de leitura. A faixa compõe cada um por si
   *  para poder realçá-lo quando o cursor passa pelo nó correspondente — e é o
   *  que torna a fórmula conferível fator a fator contra o desenho. */
  factors: FormulaFactor[];
  /** Rede sem tensor algum não tem fórmula. */
  empty: boolean;
}

/** Símbolo do resultado. Genérico de propósito: quem copiar o LaTeX vai
 *  renomeá-lo para o que a sua conta chama. */
const RESULT = 'M';

export function buildFormula(
  network: Network,
  assignment: IndexAssignment,
  options: FormulaOptions = DEFAULT_OPTIONS,
): Formula {
  if (network.tensors.length === 0) {
    return { latex: '', lhs: '', rhs: '', summed: [], sum: null, factors: [], empty: true };
  }

  const lhs = buildLeftSide(assignment);
  const factors: FormulaFactor[] = assignment.factors.map(({ tensor, name }) => ({
    tensorId: tensor.id,
    name,
    latex: buildFactor(tensor, name, assignment, options),
  }));

  const summed = assignment.summed.map((s) => s.symbol);
  const sum =
    options.summation === 'explicit' && summed.length > 0
      ? `\\sum_{${joinIndices(summed)}}`
      : null;

  const product = factors.map((f) => f.latex).join('\\,');
  const rhs = sum ? `${sum} ${product}` : product;

  return { latex: `${lhs} = ${rhs}`, lhs, rhs, summed, sum, factors, empty: false };
}

/** Sem índices livres, o lado esquerdo é escalar. */
function buildLeftSide(assignment: IndexAssignment): string {
  const free = assignment.free.map((s) => s.symbol);
  return free.length === 0 ? RESULT : `${RESULT}_{${joinIndices(free)}}`;
}

/** Índices se separam por espaço, não por nada: `\alpha` colado em `i` vira o
 *  comando inexistente `\alphai`. O espaço some na composição. */
function joinIndices(symbols: string[]): string {
  return symbols.join(' ');
}

function buildFactor(
  tensor: Tensor,
  name: string,
  assignment: IndexAssignment,
  options: FormulaOptions,
): string {
  const indices = joinIndices(tensor.legs.map((leg) => assignment.byLeg.get(leg.id)?.symbol ?? '?'));

  // A forma `dot` é o tensor delta: sai como δ, e não com o nome do tensor.
  // Delta não se conjuga — δ é real.
  if (tensor.shape === 'dot') {
    return indices ? `\\delta_{${indices}}` : '\\delta';
  }

  const { base, sup } = splitName(name);
  const marks = [sup, tensor.conjugate ? conjugateMark(options) : ''].filter(Boolean).join('');
  const head = marks ? `${base}^{${marks}}` : base;

  return indices ? `${head}_{${indices}}` : head;
}

function conjugateMark(options: FormulaOptions): string {
  return options.conjugate === 'dagger' ? '\\dagger' : '*';
}

/** O número no nome de um sítio vira expoente entre colchetes — `A^{[3]}`, como
 *  na literatura de MPS — e não subscrito. Subscrito já está ocupado pelos
 *  índices, e LaTeX não aceita dois no mesmo símbolo. */
function splitName(name: string): { base: string; sup: string } {
  if (name.startsWith('\\')) return { base: name, sup: '' };
  const match = /^([A-Za-z]+)(\d+)$/.exec(name);
  if (match) return { base: upright(match[1]!), sup: `[${match[2]}]` };
  return { base: upright(name), sup: '' };
}

/** Nome ASCII de mais de uma letra vai reto, senão o KaTeX o lê como produto de
 *  variáveis. Nome com letra grega ou símbolo fica como está: `\mathrm` não
 *  serve para eles. */
function upright(name: string): string {
  if (name.length <= 1) return name;
  return /^[A-Za-z]+$/.test(name) ? `\\mathrm{${name}}` : name;
}
