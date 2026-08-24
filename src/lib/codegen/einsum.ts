/** `numpy.einsum` e `opt_einsum`.
 *
 *  Com até 52 índices distintos sai a forma de string, que é a que se lê. Acima
 *  disso sai a forma intercalada com listas de inteiros, que não tem limite —
 *  uma MERA de 16 folhas tem 53 índices e não caberia no alfabeto. */

import type { ContractNetwork } from '../contract/network';
import type { ContractionPath } from '../contract/order';
import type { GeneratedCode } from './common';
import type { CodeOptions } from './common';
import {
  DEFAULT_CODE_OPTIONS,
  exampleBlock,
  header,
  operands,
  pairSequence,
  shapeComments,
} from './common';

const ALFABETO = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** O caminho no formato que o `numpy.einsum` aceita em `optimize=`: a lista
 *  começa com o marcador `'einsum_path'` e segue com os pares de posições. */
function numpyPath(pares: [number, number][]): string {
  return `['einsum_path', ${pares.map(([a, b]) => `(${a}, ${b})`).join(', ')}]`;
}

/** O `opt_einsum` toma a mesma lista, sem o marcador. */
function optPath(pares: [number, number][]): string {
  return `[${pares.map(([a, b]) => `(${a}, ${b})`).join(', ')}]`;
}

export function einsumLetters(net: ContractNetwork): Map<string, string> | null {
  const chaves = [...net.byKey.keys()];
  if (chaves.length > ALFABETO.length) return null;
  // Na ordem em que os índices aparecem nos operandos: o que se lê primeiro na
  // string é o que aparece primeiro no primeiro tensor.
  const ordem: string[] = [];
  for (const t of operands(net)) for (const a of t.axes) if (!ordem.includes(a.key)) ordem.push(a.key);
  for (const a of net.free) if (!ordem.includes(a.key)) ordem.push(a.key);
  return new Map(ordem.map((k, i) => [k, ALFABETO[i]!]));
}

export function toEinsum(
  net: ContractNetwork,
  path: ContractionPath,
  options: CodeOptions = DEFAULT_CODE_OPTIONS,
): GeneratedCode {
  const tensores = operands(net);
  const letras = einsumLetters(net);
  const caminho = pairSequence(path, tensores.length);

  const linhas = [
    ...header(net, path, '#', options),
    '#',
    ...shapeComments(net, '#'),
    '',
    'import numpy as np',
    '',
    ...(options.examples
      ? exampleBlock(
          net,
          '#',
          (t) => `${t.code} = np.random.rand(${t.axes.map((a) => a.dim).join(', ')})`,
        )
      : []),
  ];

  if (letras) {
    const entradas = tensores.map((t) => t.axes.map((a) => letras.get(a.key)!).join(''));
    const saida = net.free.map((a) => letras.get(a.key)!).join('');
    const assinatura = `${entradas.join(',')}->${saida}`;
    linhas.push(
      '# The contraction order MOIRA found. numpy takes it directly:',
      '# without it, einsum contracts naively and a network of this size does',
      '# not finish.',
      `caminho = ${numpyPath(caminho)}`,
      '',
      `R = np.einsum('${assinatura}', ${tensores.map((t) => t.code).join(', ')}, optimize=caminho)`,
      'print(R)',
      '',
      '# opt_einsum takes the same path, without the leading marker:',
      `# contract('${assinatura}', ${tensores.map((t) => t.code).join(', ')}, optimize=${optPath(caminho)})`,
    );
  } else {
    // Forma intercalada: cada tensor seguido da lista de eixos, e a lista de
    // saída no fim. Sem limite de alfabeto.
    const numeros = new Map([...net.byKey.keys()].map((k, i) => [k, i]));
    const argumentos = tensores
      .map((t) => `${t.code}, [${t.axes.map((a) => numeros.get(a.key)!).join(', ')}]`)
      .join(',\n    ');
    const saida = `[${net.free.map((a) => numeros.get(a.key)!).join(', ')}]`;
    linhas.push(
      '',
      `# ${net.byKey.size} distinct indices exceed the einsum alphabet;`,
      '# this is the interleaved form, which has no such limit.',
      '# The contraction order MOIRA found; without it einsum contracts naively.',
      `caminho = ${numpyPath(caminho)}`,
      '',
      'R = np.einsum(',
      `    ${argumentos},`,
      `    ${saida},`,
      '    optimize=caminho,',
      ')',
      'print(R)',
    );
  }

  return { dialect: 'einsum', source: linhas.join('\n'), problem: null };
}
