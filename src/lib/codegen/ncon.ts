/** `ncon`, a convenção nativa da comunidade — Pfeifer, Evenbly, Singh & Vidal.
 *
 *  Índices contraídos são inteiros positivos, somados em ordem crescente;
 *  índices livres são negativos, e a saída sai na ordem −1, −2, … A numeração
 *  dos positivos segue a ordem em que a contração os consome, para que o
 *  argumento de sequência saia simplesmente 1, 2, 3, … */

import type { ContractNetwork } from '../contract/network';
import type { ContractionPath } from '../contract/order';
import type { GeneratedCode } from './common';
import type { CodeOptions } from './common';
import { DEFAULT_CODE_OPTIONS, exampleBlock, header, operands, shapeComments } from './common';

export function nconLabels(net: ContractNetwork, path: ContractionPath): Map<string, number> {
  const rotulos = new Map<string, number>();

  // Livres primeiro: −1, −2, … na ordem de leitura, que é a ordem dos eixos da
  // saída e a mesma que o lado esquerdo da fórmula exibe.
  net.free.forEach((axis, i) => rotulos.set(axis.key, -(i + 1)));

  // Contraídos na ordem em que os passos os consomem; o que sobrar (rede sem
  // caminho) entra depois, para nenhum índice ficar sem número.
  let n = 1;
  for (const step of path.steps) {
    for (const key of step.contracted) if (!rotulos.has(key)) rotulos.set(key, n++);
  }
  for (const axis of net.summed) if (!rotulos.has(axis.key)) rotulos.set(axis.key, n++);

  return rotulos;
}

function listas(net: ContractNetwork, rotulos: Map<string, number>): string[][] {
  return operands(net).map((t) => t.axes.map((a) => String(rotulos.get(a.key)!)));
}

export function toNconMatlab(
  net: ContractNetwork,
  path: ContractionPath,
  options: CodeOptions = DEFAULT_CODE_OPTIONS,
): GeneratedCode {
  const rotulos = nconLabels(net, path);
  const tensores = operands(net);
  const idx = listas(net, rotulos);
  const sequencia = sequenceOf(path, rotulos);

  const linhas = [
    ...header(net, path, '%', options),
    '%',
    '% Contracted indices are numbered in the order the chosen path sums them,',
    '% so the sequence argument is simply 1, 2, 3, ...',
    '%',
    ...shapeComments(net, '%'),
    '',
    // O MATLAB não tem array de uma dimensão: um tensor de uma perna vira
    // vetor coluna, e `rand([n])` daria uma matriz n×n.
    ...(options.examples
      ? exampleBlock(
          net,
          '%',
          (t) =>
            `${t.code} = rand([${t.axes.map((a) => a.dim).join(' ')}${t.axes.length === 1 ? ' 1' : ''}]);`,
        )
      : []),
    `tensores = {${tensores.map((t) => t.code).join(', ')}};`,
    `indices  = {${idx.map((l) => `[${l.join(' ')}]`).join(', ')}};`,
    sequencia.length > 0 ? `sequencia = [${sequencia.join(' ')}];` : 'sequencia = [];',
    '',
    'R = ncon(tensores, indices, sequencia);',
    'disp(R)',
  ];
  return { dialect: 'ncon-matlab', source: linhas.join('\n'), problem: null };
}

export function toNconJulia(
  net: ContractNetwork,
  path: ContractionPath,
  options: CodeOptions = DEFAULT_CODE_OPTIONS,
): GeneratedCode {
  const rotulos = nconLabels(net, path);
  const tensores = operands(net);
  const idx = listas(net, rotulos);
  const sequencia = sequenceOf(path, rotulos);

  const linhas = [
    ...header(net, path, '#', options),
    '#',
    '# Contracted indices are numbered in the order the chosen path sums them.',
    ...shapeComments(net, '#'),
    '',
    'using TensorOperations',
    '',
    ...(options.examples
      ? exampleBlock(net, '#', (t) => `${t.code} = randn(${t.axes.map((a) => a.dim).join(', ')})`)
      : []),
    `tensores = [${tensores.map((t) => t.code).join(', ')}]`,
    `indices  = [${idx.map((l) => `[${l.join(', ')}]`).join(', ')}]`,
    sequencia.length > 0 ? `sequencia = [${sequencia.join(', ')}]` : 'sequencia = Int[]',
    '',
    // O ncon do TensorOperations.jl não é o do MATLAB: o terceiro argumento
    // posicional ali é a lista de conjugação, e a sequência vai em `order=`.
    // Passá-la na posição dá "number of tensors and of index lists should be
    // the same", que não diz nada sobre a causa.
    'R = ncon(tensores, indices; order=sequencia)',
    'println(R)',
  ];
  return { dialect: 'ncon-julia', source: linhas.join('\n'), problem: null };
}

/** Ordem em que os índices positivos são somados. */
function sequenceOf(path: ContractionPath, rotulos: Map<string, number>): number[] {
  const seq: number[] = [];
  for (const step of path.steps) {
    for (const key of step.contracted) {
      const n = rotulos.get(key);
      if (n !== undefined && n > 0 && !seq.includes(n)) seq.push(n);
    }
  }
  return seq;
}
