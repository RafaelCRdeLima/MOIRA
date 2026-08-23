/** Estado da sessão: rede, seleção, vista, histórico e persistência. */

import type { Fragment } from '../lib/generators/common';
import { boundingBox, extractSubnetwork, pasteFragment } from '../lib/model/clipboard';
import { curvatureFor, legGeometryFor, MIN_LEG_LENGTH } from '../lib/model/geometry';
import { History } from '../lib/model/history';
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
import type { Bond, ColorMode, Network, Shape, Tensor } from '../lib/model/types';
import { loadNetwork, loadView, saveNetwork, saveView } from '../lib/storage/persist';

const SAVE_DELAY_MS = 250;
const PASTE_OFFSET = 32;

export interface View {
  x: number;
  y: number;
  scale: number;
}

export interface Grid {
  on: boolean;
  size: number;
}

class Session {
  network = $state<Network>(emptyNetwork());
  selection = $state<string[]>([]);
  pendingLeg = $state<string | null>(null);
  view = $state<View>({ x: 0, y: 0, scale: 1 });
  grid = $state<Grid>({ on: false, size: 24 });
  /** Tensor aberto no inspetor. */
  inspecting = $state<string | null>(null);
  /** Vínculo aberto no inspetor, quando não há tensor aberto. */
  inspectingBond = $state<string | null>(null);
  historyDepth = $state(0);
  redoDepth = $state(0);

  #history = new History();
  #clipboard: Fragment | null = null;
  #saveTimer: ReturnType<typeof setTimeout> | undefined;
  #viewTimer: ReturnType<typeof setTimeout> | undefined;
  /** Verdadeiro quando havia uma vista gravada: sem ela, a rede é enquadrada. */
  viewRestored = false;
  #dragOrigins: Map<string, { x: number; y: number }> | null = null;
  /** Um gesto só entra no histórico quando move alguma coisa: clicar sem
   *  arrastar não pode encher o desfazer de passos vazios. */
  #gestureCaptured = false;

  restore(): void {
    const stored = loadNetwork();
    if (stored) this.network = stored;
    const view = loadView();
    if (view) {
      this.view = view;
      this.viewRestored = true;
    }
  }

  // ─── histórico ───────────────────────────────────────────────────────────

  /** Guarda o estado atual antes de mudá-lo. Um arrasto chama isto uma vez, no
   *  começo, e não a cada quadro. */
  change(): void {
    this.#history.capture($state.snapshot(this.network) as Network);
    this.#syncHistoryDepth();
  }

  undo(): void {
    const previous = this.#history.undo($state.snapshot(this.network) as Network);
    if (previous) this.#restoreState(previous);
  }

  redo(): void {
    const next = this.#history.redo($state.snapshot(this.network) as Network);
    if (next) this.#restoreState(next);
  }

  #restoreState(state: Network): void {
    this.network = state;
    const alive = new Set(state.tensors.map((t) => t.id));
    this.selection = this.selection.filter((id) => alive.has(id));
    if (this.inspecting && !alive.has(this.inspecting)) this.inspecting = null;
    const bonds = new Set(state.bonds.map((b) => b.id));
    if (this.inspectingBond && !bonds.has(this.inspectingBond)) this.inspectingBond = null;
    this.pendingLeg = null;
    this.#syncHistoryDepth();
    this.touch();
  }

  #syncHistoryDepth(): void {
    this.historyDepth = this.#history.canUndo ? this.#history.depth : 0;
    this.redoDepth = this.#history.canRedo ? 1 : 0;
  }

  // ─── persistência ────────────────────────────────────────────────────────

  touch(): void {
    clearTimeout(this.#saveTimer);
    this.#saveTimer = setTimeout(() => this.flush(), SAVE_DELAY_MS);
  }

  flush(): void {
    clearTimeout(this.#saveTimer);
    this.#saveTimer = undefined;
    saveNetwork($state.snapshot(this.network) as Network);
    this.flushView();
  }

  /** A vista tem gravação própria: deslocar a tela não precisa reserializar a
   *  rede inteira a cada quadro. */
  touchView(): void {
    clearTimeout(this.#viewTimer);
    this.#viewTimer = setTimeout(() => this.flushView(), SAVE_DELAY_MS);
  }

  flushView(): void {
    clearTimeout(this.#viewTimer);
    this.#viewTimer = undefined;
    saveView({ ...this.view });
  }

  // ─── tensores ────────────────────────────────────────────────────────────

  addTensor(x: number, y: number): Tensor {
    this.change();
    const tensor = createTensor(this.#snap(x), this.#snap(y));
    this.network.tensors.push(tensor);
    this.selection = [tensor.id];
    this.touch();
    return tensor;
  }

  deleteSelection(): void {
    if (this.selection.length === 0) return;
    this.change();
    for (const id of this.selection) removeTensor(this.network, id);
    if (this.inspecting && this.selection.includes(this.inspecting)) this.inspecting = null;
    this.selection = [];
    this.pendingLeg = null;
    this.touch();
  }

  updateTensor(id: string, patch: Partial<Omit<Tensor, 'id' | 'legs'>>): void {
    const tensor = this.network.tensors.find((t) => t.id === id);
    if (!tensor) return;
    this.change();
    Object.assign(tensor, patch);
    this.touch();
  }

  setShape(id: string, shape: Shape): void {
    this.updateTensor(id, { shape });
  }

  /** Tags em bloco: substitui a lista inteira em cada tensor selecionado. */
  setTagsOnSelection(tags: string[]): void {
    if (this.selection.length === 0) return;
    this.change();
    for (const id of this.selection) {
      const tensor = this.network.tensors.find((t) => t.id === id);
      if (tensor) tensor.tags = [...tags];
    }
    this.touch();
  }

  toggleOrthogonalityCenter(id: string): void {
    this.change();
    this.network.orthogonalityCenter = this.network.orthogonalityCenter === id ? undefined : id;
    this.touch();
  }

  // ─── seleção ─────────────────────────────────────────────────────────────

  select(id: string, additive = false): void {
    if (!additive) {
      this.selection = [id];
      return;
    }
    this.selection = this.selection.includes(id)
      ? this.selection.filter((s) => s !== id)
      : [...this.selection, id];
  }

  selectMany(ids: string[], additive = false): void {
    this.selection = additive ? [...new Set([...this.selection, ...ids])] : ids;
  }

  clearSelection(): void {
    this.selection = [];
  }

  /** Tensores cujo centro cai dentro do retângulo, em coordenadas do canvas. */
  tensorsInRect(x0: number, y0: number, x1: number, y1: number): string[] {
    const [left, right] = x0 <= x1 ? [x0, x1] : [x1, x0];
    const [top, bottom] = y0 <= y1 ? [y0, y1] : [y1, y0];
    return this.network.tensors
      .filter((t) => t.x >= left && t.x <= right && t.y >= top && t.y <= bottom)
      .map((t) => t.id);
  }

  // ─── arrasto ─────────────────────────────────────────────────────────────

  /** Guarda as posições de partida para que o encaixe na grade seja calculado
   *  sobre o deslocamento total, e não acumule erro a cada quadro. */
  beginDrag(): void {
    this.#gestureCaptured = false;
    this.#dragOrigins = new Map();
    for (const id of this.selection) {
      const tensor = this.network.tensors.find((t) => t.id === id);
      if (tensor && !tensor.frozen) this.#dragOrigins.set(id, { x: tensor.x, y: tensor.y });
    }
  }

  dragBy(dx: number, dy: number): void {
    if (!this.#dragOrigins) return;
    this.#captureOnce();
    for (const [id, origin] of this.#dragOrigins) {
      const tensor = this.network.tensors.find((t) => t.id === id);
      if (!tensor) continue;
      tensor.x = this.#snap(origin.x + dx);
      tensor.y = this.#snap(origin.y + dy);
    }
  }

  endDrag(): void {
    this.#dragOrigins = null;
    if (this.#gestureCaptured) this.touch();
    this.#gestureCaptured = false;
  }

  /** Início de qualquer gesto contínuo: arrasto, perna, curvatura. */
  beginGesture(): void {
    this.#gestureCaptured = false;
  }

  endGesture(): void {
    if (this.#gestureCaptured) this.touch();
    this.#gestureCaptured = false;
  }

  #captureOnce(): void {
    if (this.#gestureCaptured) return;
    this.change();
    this.#gestureCaptured = true;
  }

  /** Deslocamento por teclado: passo único, com histórico próprio. */
  nudgeSelection(dx: number, dy: number): void {
    if (this.selection.length === 0) return;
    this.change();
    for (const id of this.selection) {
      const tensor = this.network.tensors.find((t) => t.id === id);
      if (tensor && !tensor.frozen) {
        tensor.x += dx;
        tensor.y += dy;
      }
    }
    this.touch();
  }

  #snap(v: number): number {
    return this.grid.on ? Math.round(v / this.grid.size) * this.grid.size : v;
  }

  // ─── pernas e vínculos ───────────────────────────────────────────────────

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
    this.change();
    addBond(this.network, this.pendingLeg, legId);
    this.pendingLeg = null;
    this.touch();
  }

  cancelPending(): void {
    this.pendingLeg = null;
  }

  unbind(bondId: string): void {
    this.change();
    if (removeBond(this.network, bondId)) {
      if (this.inspectingBond === bondId) this.inspectingBond = null;
      this.touch();
    }
  }

  /** Arrastar a ponta de uma perna muda ângulo e comprimento juntos. */
  dragLegTo(legId: string, point: { x: number; y: number }): void {
    const found = findLeg(this.network, legId);
    if (!found) return;
    this.#captureOnce();
    const { angle, length } = legGeometryFor(found.tensor, point);
    found.leg.angle = angle;
    found.leg.length = length;
  }

  setLegGeometry(legId: string, angle: number, length: number): void {
    const found = findLeg(this.network, legId);
    if (!found) return;
    this.change();
    found.leg.angle = angle;
    found.leg.length = Math.max(MIN_LEG_LENGTH, length);
    this.touch();
  }

  updateLeg(legId: string, patch: { dim?: number; label?: string; arrow?: 'in' | 'out' | null }): void {
    const found = findLeg(this.network, legId);
    if (!found) return;
    this.change();
    if ('dim' in patch) {
      if (patch.dim === undefined) delete found.leg.dim;
      else found.leg.dim = patch.dim;
    }
    if ('label' in patch) {
      if (!patch.label) delete found.leg.label;
      else found.leg.label = patch.label;
    }
    if ('arrow' in patch) {
      if (!patch.arrow) delete found.leg.arrow;
      else found.leg.arrow = patch.arrow;
    }
    this.touch();
  }

  dragBondTo(bondId: string, point: { x: number; y: number }): void {
    const bond = this.network.bonds.find((b) => b.id === bondId);
    if (!bond) return;
    this.#captureOnce();
    bond.curvature = curvatureFor(this.network, bond, point);
  }

  updateBond(bondId: string, patch: Partial<Omit<Bond, 'id' | 'a' | 'b'>>): void {
    const bond = this.network.bonds.find((b) => b.id === bondId);
    if (!bond) return;
    this.change();
    Object.assign(bond, patch);
    this.touch();
  }

  // ─── copiar, colar, gerar ────────────────────────────────────────────────

  copy(): void {
    if (this.selection.length === 0) return;
    // Instantâneo antes de recortar: a rede viva é um proxy reativo, e
    // structuredClone não clona proxy.
    this.#clipboard = extractSubnetwork($state.snapshot(this.network) as Network, this.selection);
  }

  get hasClipboard(): boolean {
    return this.#clipboard !== null;
  }

  paste(): void {
    if (!this.#clipboard) return;
    this.change();
    const ids = pasteFragment(this.network, this.#clipboard, { x: PASTE_OFFSET, y: PASTE_OFFSET });
    this.selection = ids;
    this.touch();
  }

  /** Insere um fragmento gerado ao lado do que já existe, sem apagar nada. */
  insertFragment(fragment: Fragment): void {
    this.change();
    const existing = boundingBox(this.network.tensors);
    const offset =
      this.network.tensors.length === 0
        ? { x: 0, y: 0 }
        : { x: existing.x + existing.w / 2, y: existing.y + existing.h + 140 };
    const ids = pasteFragment(this.network, fragment, offset);
    this.selection = ids;
    this.touch();
  }

  // ─── linguagem visual ────────────────────────────────────────────────────

  setColorMode(mode: ColorMode): void {
    if (this.network.colorMode === mode) return;
    this.change();
    this.network.colorMode = mode;
    this.touch();
  }

  toggleLegend(): void {
    this.change();
    this.network.showLegend = this.network.showLegend === false;
    this.touch();
  }

  toggleEdgeColorByValue(): void {
    this.change();
    this.network.edgeColorByValue = !this.network.edgeColorByValue;
    this.touch();
  }

  setTensorColor(id: string, color: string | undefined): void {
    const tensor = this.network.tensors.find((t) => t.id === id);
    if (!tensor) return;
    this.change();
    if (color) tensor.color = color;
    else delete tensor.color;
    this.touch();
  }

  bond(id: string | null): Bond | undefined {
    return id ? this.network.bonds.find((b) => b.id === id) : undefined;
  }

  // ─── enquadramento ───────────────────────────────────────────────────────

  /** Ajusta a vista para que os tensores dados caibam na tela. Uma MERA de 16
   *  folhas gerada num clique tem de aparecer inteira; sem isto ela nasce
   *  metade fora do canto. */
  fitTo(viewport: { w: number; h: number }, ids?: string[]): void {
    const wanted = ids ? new Set(ids) : null;
    const tensors = wanted
      ? this.network.tensors.filter((t) => wanted.has(t.id))
      : this.network.tensors;
    if (tensors.length === 0) return;

    // Margem para as pernas livres e os rótulos, que ficam fora do centro.
    const pad = 70;
    const box = boundingBox(tensors);
    const w = box.w + 2 * pad;
    const h = box.h + 2 * pad;
    const scale = Math.max(0.2, Math.min(2, Math.min(viewport.w / w, viewport.h / h)));

    this.view = {
      scale,
      x: viewport.w / 2 - (box.x + box.w / 2) * scale,
      y: viewport.h / 2 - (box.y + box.h / 2) * scale,
    };
    this.touchView();
  }

  // ─── consultas ───────────────────────────────────────────────────────────

  freeLegCount(): number {
    let n = 0;
    for (const tensor of this.network.tensors) {
      for (const leg of tensor.legs) if (!bondOfLeg(this.network, leg.id)) n++;
    }
    return n;
  }

  tensor(id: string | null): Tensor | undefined {
    return id ? this.network.tensors.find((t) => t.id === id) : undefined;
  }
}

export const session = new Session();
