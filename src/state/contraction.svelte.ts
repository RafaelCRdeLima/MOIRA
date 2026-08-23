/** Estado da contração: dialeto escolhido, ordem manual e a memória do
 *  caminho.
 *
 *  A busca de ordem é cara para redes grandes e a rede muda a cada quadro de
 *  arrasto. O caminho é guardado por assinatura da topologia — ids, eixos e
 *  dimensões — então arrastar sem mudar a ordem de leitura não recalcula nada. */

import type { ContractNetwork } from '../lib/contract/network';
import { buildContractNetwork } from '../lib/contract/network';
import type { ContractionPath, OrderNode } from '../lib/contract/order';
import { findPath, measurePath } from '../lib/contract/order';
import type { Dialect } from '../lib/codegen/index';
import type { IndexAssignment } from '../lib/formula/indices';
import type { Network } from '../lib/model/types';

const STORAGE_KEY = 'moira:codigo';

function stored(): { dialect: Dialect; open: boolean } {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, unknown>;
    const dialect = raw['dialect'];
    return {
      dialect: typeof dialect === 'string' ? (dialect as Dialect) : 'ncon-matlab',
      open: raw['open'] !== false,
    };
  } catch {
    return { dialect: 'ncon-matlab', open: true };
  }
}

class ContractionStore {
  dialect = $state<Dialect>(stored().dialect);
  open = $state(stored().open);
  /** Ordem fixada à mão: ids de tensores, contraídos da esquerda para a direita. */
  manual = $state<string[] | null>(null);
  useManual = $state(false);

  #assinatura = '';
  #caminho: ContractionPath | null = null;

  setDialect(dialect: Dialect): void {
    this.dialect = dialect;
    this.#save();
  }

  toggleOpen(): void {
    this.open = !this.open;
    this.#save();
  }

  networkFor(network: Network, assignment: IndexAssignment): ContractNetwork {
    return buildContractNetwork(network, assignment);
  }

  /** Caminho automático, memorizado por topologia. */
  pathFor(net: ContractNetwork): ContractionPath {
    const assinatura = signatureOf(net);
    if (assinatura !== this.#assinatura || this.#caminho === null) {
      this.#assinatura = assinatura;
      this.#caminho = findPath(net);
    }
    return this.#caminho;
  }

  /** Caminho da ordem fixada à mão, ou nulo se ela não for uma permutação
   *  válida dos tensores da rede. */
  manualPathFor(net: ContractNetwork): ContractionPath | null {
    if (!this.manual || net.tensors.length === 0) return null;
    const posicao = new Map(net.tensors.map((t, i) => [t.id, i]));
    const ordem = this.manual.map((id) => posicao.get(id));
    if (ordem.length !== net.tensors.length || ordem.some((i) => i === undefined)) return null;
    if (new Set(ordem).size !== ordem.length) return null;

    // Dobra à esquerda: contrai o primeiro com o segundo, o resultado com o
    // terceiro, e assim por diante. É a leitura natural de "esta ordem".
    let tree: OrderNode = { kind: 'leaf', tensor: ordem[0]! };
    for (let i = 1; i < ordem.length; i++) {
      tree = { kind: 'pair', left: tree, right: { kind: 'leaf', tensor: ordem[i]! } };
    }
    return measurePath(net, tree);
  }

  /** O caminho que vale para gerar código. */
  activePathFor(net: ContractNetwork): ContractionPath {
    const manual = this.useManual ? this.manualPathFor(net) : null;
    return manual ?? this.pathFor(net);
  }

  setManualFrom(net: ContractNetwork): void {
    this.manual = net.tensors.map((t) => t.id);
  }

  clearManual(): void {
    this.manual = null;
    this.useManual = false;
  }

  #save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ dialect: this.dialect, open: this.open }));
    } catch {
      /* armazenamento bloqueado */
    }
  }
}

/** Topologia que muda o caminho: quem é cada tensor, com que eixos e que
 *  dimensões, na ordem em que entram. */
function signatureOf(net: ContractNetwork): string {
  return net.tensors
    .map((t) => `${t.id}:${t.axes.map((a) => `${a.key}@${a.dim}`).join(',')}`)
    .join('|');
}

export const contraction = new ContractionStore();
