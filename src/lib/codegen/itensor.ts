/** `ITensor` em Julia. Aqui os índices são objetos, não posições: dois tensores
 *  se contraem porque compartilham o mesmo `Index`, e a ordem dos eixos deixa
 *  de importar na hora da multiplicação. Por isso este é o único dialeto em que
 *  a ordem de contração aparece na ordem dos produtos, e não numa lista à parte. */

import type { ContractNetwork } from '../contract/network';
import type { ContractionPath, OrderNode } from '../contract/order';
import type { GeneratedCode } from './common';
import { header, operands } from './common';

export function toITensor(net: ContractNetwork, path: ContractionPath): GeneratedCode {
  const tensores = operands(net);

  const linhas = [
    ...header(net, path, '#'),
    '',
    'using ITensors',
    '',
    '# Indices: the name is the one the equation band shows.',
    ...[...net.byKey.values()].map((a) => `${a.code} = Index(${a.dim}, "${a.code}")`),
    '',
    '# Each tensor takes its indices in the axis order of the diagram.',
    ...tensores.map(
      (t) =>
        `${t.code} = ITensor(dados_${t.code}, ${t.axes.map((a) => a.code).join(', ')})` +
        (t.conjugate ? '  # conjugate' : ''),
    ),
    '',
    '# Contraction in the chosen order:',
  ];

  if (!path.tree) {
    linhas.push('# empty network');
    return { dialect: 'itensor', source: linhas.join('\n'), problem: null };
  }

  let intermediario = 0;
  const nomeDe = (node: OrderNode): string => {
    if (node.kind === 'leaf') return tensores[node.tensor]!.code;
    const esquerda = nomeDe(node.left);
    const direita = nomeDe(node.right);
    const nome = `R${++intermediario}`;
    linhas.push(`${nome} = ${esquerda} * ${direita}`);
    return nome;
  };

  const final = nomeDe(path.tree);
  linhas.push('', `R = ${final}`);

  return { dialect: 'itensor', source: linhas.join('\n'), problem: null };
}
