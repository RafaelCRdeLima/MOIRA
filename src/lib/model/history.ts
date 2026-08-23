/** Desfazer e refazer por instantâneos da rede inteira.
 *
 *  A alternativa seria o padrão comando, com um inverso por ação. Não compensa:
 *  seriam trinta inversos para escrever e testar, e cada ação nova do M2 em
 *  diante teria de trazer o seu. Um instantâneo de 300 tensores dá alguns
 *  poucos kilobytes, e cinquenta deles cabem folgados na memória.
 *
 *  Quem chama é responsável pelos limites de transação: um arrasto captura uma
 *  vez, no início, e não a cada quadro. */

import type { Network } from './types';

export const HISTORY_LIMIT = 60; // o §6 pede no mínimo 50

export class History {
  #undo: Network[] = [];
  #redo: Network[] = [];

  get canUndo(): boolean {
    return this.#undo.length > 0;
  }

  get canRedo(): boolean {
    return this.#redo.length > 0;
  }

  get depth(): number {
    return this.#undo.length;
  }

  /** Guarda o estado anterior a uma mudança. Toda ação nova mata o refazer. */
  capture(before: Network): void {
    this.#undo.push(before);
    if (this.#undo.length > HISTORY_LIMIT) this.#undo.shift();
    this.#redo.length = 0;
  }

  /** Devolve o estado a restaurar, guardando o atual do outro lado. */
  undo(current: Network): Network | undefined {
    const previous = this.#undo.pop();
    if (!previous) return undefined;
    this.#redo.push(current);
    return previous;
  }

  redo(current: Network): Network | undefined {
    const next = this.#redo.pop();
    if (!next) return undefined;
    this.#undo.push(current);
    return next;
  }

  clear(): void {
    this.#undo.length = 0;
    this.#redo.length = 0;
  }
}
