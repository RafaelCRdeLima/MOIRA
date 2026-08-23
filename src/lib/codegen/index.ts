/** Os quatro dialetos, e a recusa de gerar sobre rede inválida. */

import type { ContractNetwork } from '../contract/network';
import type { ContractionPath } from '../contract/order';
import type { Diagnostic } from '../validate/checks';
import type { Dialect, GeneratedCode } from './common';
import { toEinsum } from './einsum';
import { toITensor } from './itensor';
import { toNconJulia, toNconMatlab } from './ncon';
import { toQuimb } from './quimb';

export const DIALECTS: { id: Dialect; label: string }[] = [
  { id: 'ncon-matlab', label: 'ncon (MATLAB)' },
  { id: 'ncon-julia', label: 'ncon (Julia)' },
  { id: 'einsum', label: 'numpy.einsum' },
  { id: 'quimb', label: 'quimb' },
  { id: 'itensor', label: 'ITensor' },
];

const GERADORES: Record<Dialect, (net: ContractNetwork, path: ContractionPath) => GeneratedCode> = {
  'ncon-matlab': toNconMatlab,
  'ncon-julia': toNconJulia,
  einsum: toEinsum,
  quimb: toQuimb,
  itensor: toITensor,
};

/** Rede com problema bloqueante não gera código: o painel mostra o motivo em
 *  vez de entregar algo que não roda. Aviso não bloqueia — uma rede desconexa
 *  contrai para um produto tensorial, e isso é código legítimo. */
export function generate(
  dialect: Dialect,
  net: ContractNetwork,
  path: ContractionPath,
  diagnostics: Diagnostic[],
): GeneratedCode {
  if (net.tensors.length === 0) {
    return { dialect, source: null, problem: 'empty' };
  }
  const bloqueio = diagnostics.find((d) => d.severity === 'blocking');
  if (bloqueio) {
    return { dialect, source: null, problem: bloqueio.code };
  }
  return GERADORES[dialect](net, path);
}

export type { Dialect, GeneratedCode };
export { nconLabels } from './ncon';
export { einsumLetters } from './einsum';
export { scalingLabel, formatFlops, formatCount, pairSequence } from './common';
