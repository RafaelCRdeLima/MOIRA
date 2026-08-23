/** Persistência local. Nenhum dado sai da máquina: localStorage e mais nada. */

import type { Network } from '../model/types';
import { fromJSON, toJSON } from './serialize';

export const STORAGE_KEY = 'moira:sessao';

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
  } catch {
    /* nada a fazer */
  }
}
