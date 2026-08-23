/** `quimb`, preservando as tags do diagrama — é por elas que o quimb seleciona
 *  e colore tensores, e é a coloração por tag do §7 que o MOIRA já usa. */

import type { ContractNetwork } from '../contract/network';
import type { ContractionPath } from '../contract/order';
import type { GeneratedCode } from './common';
import { header, operands } from './common';

export function toQuimb(net: ContractNetwork, path: ContractionPath): GeneratedCode {
  const tensores = operands(net);

  const linhas = [
    ...header(net, path, '#'),
    '',
    'import quimb.tensor as qtn',
    '',
  ];

  for (const t of tensores) {
    const inds = t.axes.map((a) => `'${a.code}'`).join(', ');
    const tags = t.tags.map((tag) => `'${tag}'`).join(', ');
    const forma = t.axes.map((a) => a.dim).join(', ');
    linhas.push(
      `# ${t.name}${t.conjugate ? '†' : ''} — shape (${forma})`,
      `t_${t.code} = qtn.Tensor(${t.code}, inds=(${inds}${t.axes.length === 1 ? ',' : ''}), tags=(${tags}${t.tags.length === 1 ? ',' : ''}))`,
    );
  }

  const saida = net.free.map((a) => `'${a.code}'`).join(', ');
  linhas.push(
    '',
    `tn = qtn.TensorNetwork([${tensores.map((t) => `t_${t.code}`).join(', ')}])`,
    net.free.length > 0
      ? `R = tn.contract(output_inds=(${saida}${net.free.length === 1 ? ',' : ''}))`
      : 'R = tn.contract()',
  );

  return { dialect: 'quimb', source: linhas.join('\n'), problem: null };
}
