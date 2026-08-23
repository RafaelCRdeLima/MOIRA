/** Estado da sessão: a rede, a seleção, a vista e a persistência.
 *  O desfazer/refazer é do M1; por ora cada ação grava direto. */

import {
  addBond,
  bondOfLeg,
  createTensor,
  emptyNetwork,
  findLeg,
  isLegFree,
  removeBond,
  removeTensor,
} from '../lib/model/network';
import type { Network, Tensor } from '../lib/model/types';
import { loadNetwork, saveNetwork } from '../lib/storage/persist';

const SAVE_DELAY_MS = 250;

export interface View {
  x: number;
  y: number;
  scale: number;
}

class Session {
  network = $state<Network>(emptyNetwork());
  /** Ids de tensores selecionados. */
  selection = $state<string[]>([]);
  /** Perna à espera da segunda ponta do vínculo. */
  pendingLeg = $state<string | null>(null);
  view = $state<View>({ x: 0, y: 0, scale: 1 });

  #saveTimer: ReturnType<typeof setTimeout> | undefined;

  /** Carrega a sessão anterior. Chamado uma vez, na partida. */
  restore(): void {
    const stored = loadNetwork();
    if (stored) this.network = stored;
  }

  /** Grava com atraso: um arrasto dispara centenas de mutações e não faz
   *  sentido serializar a rede inteira a cada quadro. */
  touch(): void {
    clearTimeout(this.#saveTimer);
    this.#saveTimer = setTimeout(() => this.flush(), SAVE_DELAY_MS);
  }

  /** Grava agora. Ligado ao `pagehide` para que recarregar logo depois de um
   *  arrasto não perca o último movimento. */
  flush(): void {
    clearTimeout(this.#saveTimer);
    this.#saveTimer = undefined;
    saveNetwork($state.snapshot(this.network) as Network);
  }

  addTensor(x: number, y: number): Tensor {
    const tensor = createTensor(x, y);
    this.network.tensors.push(tensor);
    this.selection = [tensor.id];
    this.touch();
    return tensor;
  }

  deleteSelection(): void {
    if (this.selection.length === 0) return;
    for (const id of this.selection) removeTensor(this.network, id);
    this.selection = [];
    this.pendingLeg = null;
    this.touch();
  }

  select(id: string, additive = false): void {
    if (!additive) {
      this.selection = [id];
      return;
    }
    this.selection = this.selection.includes(id)
      ? this.selection.filter((s) => s !== id)
      : [...this.selection, id];
  }

  clearSelection(): void {
    this.selection = [];
  }

  moveTensor(id: string, dx: number, dy: number): void {
    const tensor = this.network.tensors.find((t) => t.id === id);
    if (!tensor || tensor.frozen) return;
    tensor.x += dx;
    tensor.y += dy;
    this.touch();
  }

  moveSelection(dx: number, dy: number): void {
    for (const id of this.selection) this.moveTensor(id, dx, dy);
  }

  /** Clique numa ponta livre: arma a primeira, fecha o vínculo na segunda.
   *  Clicar de novo na mesma perna desarma. */
  tapLeg(legId: string): void {
    if (!isLegFree(this.network, legId)) return;
    if (this.pendingLeg === null) {
      this.pendingLeg = legId;
      return;
    }
    if (this.pendingLeg === legId) {
      this.pendingLeg = null;
      return;
    }
    addBond(this.network, this.pendingLeg, legId);
    this.pendingLeg = null;
    this.touch();
  }

  cancelPending(): void {
    this.pendingLeg = null;
  }

  unbind(bondId: string): void {
    if (removeBond(this.network, bondId)) this.touch();
  }

  /** Pernas sem vínculo, na ordem em que aparecem no tensor. */
  freeLegCount(): number {
    let n = 0;
    for (const tensor of this.network.tensors) {
      for (const leg of tensor.legs) if (!bondOfLeg(this.network, leg.id)) n++;
    }
    return n;
  }

  legTensorId(legId: string): string | undefined {
    return findLeg(this.network, legId)?.tensor.id;
  }
}

export const session = new Session();
