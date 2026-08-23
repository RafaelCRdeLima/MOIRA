/** Serialização do projeto. O JSON é o formato de arquivo do MOIRA e o que vai
 *  para o localStorage, então a leitura é defensiva: um arquivo truncado ou
 *  editado à mão devolve undefined em vez de derrubar a aplicação. */

import { syncIdCounters } from '../model/id';
import type { Bond, ColorMode, Leg, Network, Shape, Tensor } from '../model/types';
import { SCHEMA_VERSION } from '../model/types';
import { migrate } from './migrate';

const SHAPES: Shape[] = ['circle', 'square', 'triangle', 'dot', 'diamond'];
const COLOR_MODES: ColorMode[] = ['tag', 'role', 'layer', 'degree', 'manual'];

export function toJSON(network: Network, pretty = false): string {
  return JSON.stringify(network, null, pretty ? 2 : 0);
}

export function fromJSON(text: string): Network | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return undefined;
  }
  return parseNetwork(parsed);
}

export function parseNetwork(input: unknown): Network | undefined {
  if (!isObject(input)) return undefined;

  let doc: Record<string, unknown>;
  try {
    doc = migrate(input);
  } catch {
    return undefined;
  }

  const rawTensors = doc['tensors'];
  const rawBonds = doc['bonds'];
  if (!Array.isArray(rawTensors) || !Array.isArray(rawBonds)) return undefined;

  const tensors: Tensor[] = [];
  for (const raw of rawTensors) {
    const tensor = parseTensor(raw);
    if (!tensor) return undefined;
    tensors.push(tensor);
  }

  // Um vínculo que aponta para perna inexistente é descartado, não fatal: vale
  // mais recuperar a rede quase inteira do que perder o arquivo por um id solto.
  const legIds = new Set(tensors.flatMap((t) => t.legs.map((l) => l.id)));
  const used = new Set<string>();
  const bonds: Bond[] = [];
  for (const raw of rawBonds) {
    const bond = parseBond(raw);
    if (!bond) continue;
    if (!legIds.has(bond.a) || !legIds.has(bond.b)) continue;
    if (used.has(bond.a) || used.has(bond.b)) continue; // invariante: uma perna, um vínculo
    used.add(bond.a);
    used.add(bond.b);
    bonds.push(bond);
  }

  const meta = isObject(doc['meta']) ? doc['meta'] : {};
  const network: Network = {
    tensors,
    bonds,
    colorMode: pick(doc['colorMode'], COLOR_MODES, 'tag'),
    meta: {
      title: str(meta['title']) ?? '',
      created: str(meta['created']) ?? new Date().toISOString(),
      version: SCHEMA_VERSION,
    },
  };

  if (doc['showLegend'] === false) network.showLegend = false;
  if (doc['edgeColorByValue'] === true) network.edgeColorByValue = true;

  const center = str(doc['orthogonalityCenter']);
  if (center && tensors.some((t) => t.id === center)) network.orthogonalityCenter = center;

  syncIdCounters(network);
  return network;
}

function parseTensor(raw: unknown): Tensor | undefined {
  if (!isObject(raw)) return undefined;
  const id = str(raw['id']);
  const x = num(raw['x']);
  const y = num(raw['y']);
  if (!id || x === undefined || y === undefined) return undefined;
  if (!Array.isArray(raw['legs'])) return undefined;

  const legs: Leg[] = [];
  for (const rawLeg of raw['legs']) {
    const leg = parseLeg(rawLeg);
    if (!leg) return undefined;
    legs.push(leg);
  }

  const tensor: Tensor = {
    id,
    name: str(raw['name']) ?? '',
    x,
    y,
    shape: pick(raw['shape'], SHAPES, 'circle'),
    legs,
    tags: Array.isArray(raw['tags']) ? raw['tags'].filter((t): t is string => typeof t === 'string') : [],
  };
  const tip = str(raw['isometryTip']);
  if (tip && legs.some((l) => l.id === tip)) tensor.isometryTip = tip;
  if (raw['conjugate'] === true) tensor.conjugate = true;
  if (raw['frozen'] === true) tensor.frozen = true;
  const color = str(raw['color']);
  if (color) tensor.color = color;
  return tensor;
}

function parseLeg(raw: unknown): Leg | undefined {
  if (!isObject(raw)) return undefined;
  const id = str(raw['id']);
  const angle = num(raw['angle']);
  const length = num(raw['length']);
  if (!id || angle === undefined || length === undefined) return undefined;
  const leg: Leg = { id, angle, length };
  const label = str(raw['label']);
  if (label) leg.label = label;
  const dim = num(raw['dim']);
  if (dim !== undefined) leg.dim = dim;
  if (raw['arrow'] === 'in' || raw['arrow'] === 'out') leg.arrow = raw['arrow'];
  return leg;
}

function parseBond(raw: unknown): Bond | undefined {
  if (!isObject(raw)) return undefined;
  const id = str(raw['id']);
  const a = str(raw['a']);
  const b = str(raw['b']);
  if (!id || !a || !b || a === b) return undefined;
  const bond: Bond = { id, a, b, curvature: num(raw['curvature']) ?? 0 };
  const dim = num(raw['dim']);
  if (dim !== undefined) bond.dim = dim;
  const label = str(raw['label']);
  if (label) bond.label = label;
  const value = num(raw['value']);
  if (value !== undefined) bond.value = value;
  return bond;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function pick<T extends string>(v: unknown, allowed: T[], fallback: T): T {
  return typeof v === 'string' && (allowed as string[]).includes(v) ? (v as T) : fallback;
}
