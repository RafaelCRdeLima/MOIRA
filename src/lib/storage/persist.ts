/** Persistência local. Nenhum dado sai da máquina: localStorage e mais nada. */

import type { Network } from '../model/types';
import { fromJSON, toJSON } from './serialize';

export const STORAGE_KEY = 'moira:sessao';
export const VIEW_KEY = 'moira:vista';

export interface StoredView {
  x: number;
  y: number;
  scale: number;
}

export function saveNetwork(network: Network, storage: Storage = localStorage): void {
  try {
    storage.setItem(STORAGE_KEY, toJSON(network));
  } catch {
    // Cota estourada ou armazenamento bloqueado: o desenho na tela continua
    // válido, então não vale interromper o trabalho por causa disso.
  }
}

export function loadNetwork(storage: Storage = localStorage): Network | undefined {
  let text: string | null = null;
  try {
    text = storage.getItem(STORAGE_KEY);
  } catch {
    return undefined;
  }
  return text ? fromJSON(text) : undefined;
}

export function clearNetwork(storage: Storage = localStorage): void {
  try {
    storage.removeItem(STORAGE_KEY);
    storage.removeItem(VIEW_KEY);
  } catch {
    /* nada a fazer */
  }
}

/** A vista fica em chave própria: deslocamento e zoom são estado de interface,
 *  não da rede, e não podem sujar o arquivo do projeto. */
export function saveView(view: StoredView, storage: Storage = localStorage): void {
  try {
    storage.setItem(VIEW_KEY, JSON.stringify(view));
  } catch {
    /* nada a fazer */
  }
}

export function loadView(storage: Storage = localStorage): StoredView | undefined {
  try {
    const text = storage.getItem(VIEW_KEY);
    if (!text) return undefined;
    const raw: unknown = JSON.parse(text);
    if (typeof raw !== 'object' || raw === null) return undefined;
    const { x, y, scale } = raw as Record<string, unknown>;
    if (typeof x !== 'number' || typeof y !== 'number' || typeof scale !== 'number') return undefined;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(scale) || scale <= 0) return undefined;
    return { x, y, scale };
  } catch {
    return undefined;
  }
}
