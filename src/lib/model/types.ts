/** Modelo de dados do MOIRA. Ver docs/moira-spec.md, §5. */

export type Shape = 'circle' | 'square' | 'triangle' | 'dot' | 'diamond';

/** Modos de coloração do §7. */
export type ColorMode = 'tag' | 'role' | 'layer' | 'degree' | 'manual';

export interface Leg {
  id: string;
  /** Radianos, relativo ao centro do tensor. 0 aponta para a direita, cresce para baixo. */
  angle: number;
  length: number;
  /** Rótulo KaTeX. */
  label?: string;
  dim?: number;
  /** Setas de simetria U(1), SU(2). */
  arrow?: 'in' | 'out' | null;
}

export interface Tensor {
  id: string;
  /** A, B, W, Λ... */
  name: string;
  x: number;
  y: number;
  shape: Shape;
  legs: Leg[];
  /** Base da coloração, estilo quimb. */
  tags: string[];
  /** Perna para onde aponta a ponta do triângulo. */
  isometryTip?: string;
  conjugate?: boolean;
  frozen?: boolean;
  /** Cor manual, em CSS. Sobrepõe qualquer modo de coloração (§7, modo 5). */
  color?: string;
}

export interface Bond {
  id: string;
  /** Ids de pernas. */
  a: string;
  b: string;
  dim?: number;
  label?: string;
  curvature: number;
  /** Escalar opcional para colorir (entropia etc.). */
  value?: number;
}

export interface Network {
  tensors: Tensor[];
  bonds: Bond[];
  orthogonalityCenter?: string;
  colorMode: ColorMode;
  /** Legenda automática do modo ativo. Desligável, ligada por padrão. */
  showLegend?: boolean;
  /** Colorir as arestas por `Bond.value` numa rampa sequencial. */
  edgeColorByValue?: boolean;
  meta: { title: string; created: string; version: number };
}

/** Versão do esquema de serialização. Sobe junto com uma migração em storage/migrate.ts. */
export const SCHEMA_VERSION = 1;
