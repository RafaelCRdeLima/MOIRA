/** Paleta e escalas. Tudo aqui é função pura: o canvas e o exportador de SVG
 *  do M4 precisam chegar exatamente à mesma cor e à mesma espessura. */

/** Papéis fixos, na ordem em que a identidade os define. */
export const INK = 'var(--c-ink)';
export const GENERIC = 'var(--c-generic)';
export const ISOMETRY = 'var(--c-isometry)';
export const UNITARY = 'var(--c-unitary)';
export const ORTHOCENTER = 'var(--c-orthocenter)';

/** Rotação de cores por tag. Púrpura é a primeira e ciano a quinta, como manda
 *  a identidade; o cinza fecha a lista e recebe também tudo que sobra. */
export const TAG_SLOTS = [
  'var(--purple)',
  'var(--blue)',
  'var(--green)',
  'var(--amber)',
  'var(--cyan)',
  'var(--red)',
  'var(--grey)',
] as const;

export const OVERFLOW_COLOR = 'var(--grey)';

/** FNV-1a de 32 bits: pequeno, sem dependência e estável entre sessões — é o
 *  que garante que a mesma tag receba sempre a mesma cor. */
export function hashTag(name: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Distribui as tags pelos sete lugares. Cada tag começa no lugar que o seu
 *  hash indica e anda para o próximo livre em caso de choque, percorrendo as
 *  tags em ordem alfabética para que o resultado não dependa da ordem em que
 *  elas apareceram no canvas. Da oitava tag em diante, cinza. */
export function assignTagColors(tags: Iterable<string>): Map<string, string> {
  const distinct = [...new Set(tags)].sort();
  const taken = new Array<string | undefined>(TAG_SLOTS.length).fill(undefined);
  const result = new Map<string, string>();

  for (const tag of distinct) {
    if (result.size >= TAG_SLOTS.length) {
      result.set(tag, OVERFLOW_COLOR);
      continue;
    }
    let slot = hashTag(tag) % TAG_SLOTS.length;
    for (let probe = 0; probe < TAG_SLOTS.length; probe++) {
      const candidate = (slot + probe) % TAG_SLOTS.length;
      if (taken[candidate] === undefined) {
        slot = candidate;
        break;
      }
    }
    taken[slot] = tag;
    result.set(tag, TAG_SLOTS[slot]!);
  }
  return result;
}

/** Viridis em dezesseis paradas, interpoladas em RGB. É a rampa que a
 *  identidade manda usar em toda grandeza contínua — dimensão, entropia,
 *  profundidade. */
const VIRIDIS: [number, number, number][] = [
  [68, 1, 84], [72, 26, 108], [71, 47, 125], [65, 68, 135],
  [57, 86, 140], [49, 104, 142], [42, 120, 142], [35, 136, 142],
  [31, 152, 139], [34, 168, 132], [53, 183, 121], [84, 197, 104],
  [122, 209, 81], [165, 219, 54], [210, 226, 27], [253, 231, 37],
];

export function viridis(t: number): string {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0));
  const pos = clamped * (VIRIDIS.length - 1);
  const i = Math.min(VIRIDIS.length - 2, Math.floor(pos));
  const f = pos - i;
  const a = VIRIDIS[i]!;
  const b = VIRIDIS[i + 1]!;
  const mix = (k: 0 | 1 | 2) => Math.round(a[k] + (b[k] - a[k]) * f);
  return `rgb(${mix(0)} ${mix(1)} ${mix(2)})`;
}

// ─── espessura das arestas ──────────────────────────────────────────────────

export const MIN_WIDTH = 1.2;
export const MAX_WIDTH = 6;
export const DEFAULT_WIDTH = 1.6;
/** Perna livre um pouco mais fina que vínculo interno. */
export const FREE_LEG_FACTOR = 0.85;

const LOG2_MIN = 1; // D = 2
const LOG2_MAX = 12; // D = 4096

/** Espessura proporcional a log(D), presa em [1.2, 6]. Sem dimensão definida,
 *  1.6 — nem o mais fino nem o mais grosso, para que a ausência de informação
 *  não pareça uma dimensão pequena. */
export function edgeWidth(dim: number | undefined): number {
  if (dim === undefined || !Number.isFinite(dim) || dim < 2) return DEFAULT_WIDTH;
  const t = (Math.log2(dim) - LOG2_MIN) / (LOG2_MAX - LOG2_MIN);
  const w = MIN_WIDTH + Math.max(0, Math.min(1, t)) * (MAX_WIDTH - MIN_WIDTH);
  return Math.round(w * 100) / 100;
}

/** Normaliza um valor dentro de um intervalo, tolerando intervalo degenerado. */
export function normalize(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  if (max - min < 1e-12) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}
