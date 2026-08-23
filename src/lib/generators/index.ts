/** Catálogo dos geradores de rede. Cada entrada descreve os parâmetros que o
 *  menu precisa oferecer; o componente não sabe nada sobre a rede em si. */

import type { Fragment } from './common';
import { mpo, mps, sandwich, transferChain } from './chains';
import { peps } from './lattices';
import { mera, ttn } from './trees';

export type GeneratorId = 'mps' | 'mpo' | 'sandwich' | 'peps' | 'ttn' | 'mera2' | 'mera3' | 'transfer';

export interface GeneratorParam {
  key: string;
  labelKey: string;
  min: number;
  max: number;
  step?: number;
  default: number;
}

export interface GeneratorSpec {
  id: GeneratorId;
  labelKey: string;
  icon: string;
  params: GeneratorParam[];
  /** Contorno periódico faz sentido? */
  periodic?: boolean;
  build: (values: Record<string, number>, periodic: boolean) => Fragment;
}

const sites: GeneratorParam = { key: 'sites', labelKey: 'gen.sites', min: 2, max: 64, default: 6 };

export const GENERATORS: GeneratorSpec[] = [
  {
    id: 'mps',
    labelKey: 'gen.mps',
    icon: 'ic-mps',
    params: [sites],
    periodic: true,
    build: (v, periodic) => mps({ sites: v['sites']!, periodic }),
  },
  {
    id: 'mpo',
    labelKey: 'gen.mpo',
    icon: 'ic-mpo',
    params: [sites],
    periodic: true,
    build: (v, periodic) => mpo({ sites: v['sites']!, periodic }),
  },
  {
    id: 'sandwich',
    labelKey: 'gen.sandwich',
    icon: 'ic-contrair',
    params: [sites],
    periodic: true,
    build: (v, periodic) => sandwich({ sites: v['sites']!, periodic }),
  },
  {
    id: 'peps',
    labelKey: 'gen.peps',
    icon: 'ic-peps',
    params: [
      { key: 'rows', labelKey: 'gen.rows', min: 2, max: 12, default: 3 },
      { key: 'cols', labelKey: 'gen.cols', min: 2, max: 12, default: 3 },
    ],
    build: (v) => peps({ rows: v['rows']!, cols: v['cols']! }),
  },
  {
    id: 'ttn',
    labelKey: 'gen.ttn',
    icon: 'ic-mera',
    params: [{ key: 'leaves', labelKey: 'gen.leaves', min: 2, max: 64, default: 8 }],
    build: (v) => ttn({ leaves: v['leaves']! }),
  },
  {
    id: 'mera2',
    labelKey: 'gen.mera2',
    icon: 'ic-mera',
    params: [{ key: 'leaves', labelKey: 'gen.leaves', min: 4, max: 64, default: 16 }],
    build: (v) => mera({ leaves: v['leaves']!, arity: 2 }),
  },
  {
    id: 'mera3',
    labelKey: 'gen.mera3',
    icon: 'ic-mera',
    params: [{ key: 'leaves', labelKey: 'gen.leaves', min: 9, max: 81, default: 27 }],
    build: (v) => mera({ leaves: v['leaves']!, arity: 3 }),
  },
  {
    id: 'transfer',
    labelKey: 'gen.transfer',
    icon: 'ic-vinculo',
    params: [
      { key: 'sites', labelKey: 'gen.sites', min: 2, max: 32, default: 6 },
      { key: 'cell', labelKey: 'gen.cell', min: 1, max: 8, default: 2 },
    ],
    build: (v) => transferChain({ sites: v['sites']!, cell: v['cell']! }),
  },
];

export { mps, mpo, sandwich, transferChain, peps, ttn, mera };
export type { Fragment };
