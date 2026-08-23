/** Legenda automática a partir do modo de coloração ativo. Devolve estrutura,
 *  não marcação: quem desenha é o canvas, e no M4 será também o exportador. */

import type { Network } from '../model/types';
import type { NetworkStyle } from './style';
import { GENERIC, INK, ISOMETRY, ORTHOCENTER, OVERFLOW_COLOR, UNITARY } from './palette';

export interface LegendSwatch {
  color: string;
  /** Texto vindo dos dados (nome de tag), já pronto para desenhar. */
  text?: string;
  /** Chave de tradução, para os rótulos que são do programa. */
  key?: string;
}

export interface LegendRamp {
  min: number;
  max: number;
  key: string;
  /** Rótulos das pontas, quando o número em si não diz nada — a coordenada y
   *  crua do canvas não informa ninguém; "base" e "topo" informam. */
  labels?: [string, string];
}

export interface Legend {
  titleKey: string;
  swatches: LegendSwatch[];
  ramp: LegendRamp | null;
  /** Segunda rampa, quando as arestas estão coloridas por valor. */
  valueRamp: LegendRamp | null;
}

export function buildLegend(network: Network, style: NetworkStyle): Legend | null {
  if (network.showLegend === false || network.tensors.length === 0) return null;

  const legend: Legend = {
    titleKey: `color.${network.colorMode}`,
    swatches: [],
    ramp: null,
    valueRamp: null,
  };

  switch (network.colorMode) {
    case 'tag': {
      const present = [...new Set(network.tensors.flatMap((t) => t.tags))].sort();
      const shown = present.filter((tag) => !style.overflowTags.includes(tag));
      legend.swatches = shown.map((tag) => ({ color: style.tagColors.get(tag)!, text: tag }));
      if (network.tensors.some((t) => t.tags.length === 0)) {
        legend.swatches.push({ color: GENERIC, key: 'legend.untagged' });
      }
      if (style.overflowTags.length > 0) {
        legend.swatches.push({ color: OVERFLOW_COLOR, key: 'legend.others' });
      }
      break;
    }
    case 'role': {
      const shapes = new Set(network.tensors.map((t) => t.shape));
      if (shapes.has('circle')) legend.swatches.push({ color: GENERIC, key: 'role.generic' });
      if (shapes.has('triangle')) legend.swatches.push({ color: ISOMETRY, key: 'role.isometry' });
      if (shapes.has('square')) legend.swatches.push({ color: UNITARY, key: 'role.unitary' });
      if (shapes.has('dot')) legend.swatches.push({ color: INK, key: 'role.delta' });
      if (shapes.has('diamond') || network.orthogonalityCenter) {
        legend.swatches.push({ color: ORTHOCENTER, key: 'role.orthocenter' });
      }
      break;
    }
    case 'layer':
      // A rampa vai do escuro ao claro da esquerda para a direita, e o mapa
      // manda o y maior (base) para o escuro: base à esquerda, topo à direita.
      legend.ramp = {
        min: style.yRange[0],
        max: style.yRange[1],
        key: 'color.layer',
        labels: ['legend.bottom', 'legend.top'],
      };
      break;
    case 'degree':
      legend.ramp = { min: style.degreeRange[0], max: style.degreeRange[1], key: 'color.degree' };
      break;
    case 'manual':
      break;
  }

  if (network.edgeColorByValue && style.valueRange) {
    legend.valueRamp = { min: style.valueRange[0], max: style.valueRange[1], key: 'legend.bondValue' };
  }

  // Uma legenda cuja única entrada é "sem tag" informa apenas que não há
  // informação: ocupa espaço e ensina o leitor a ignorar a legenda.
  const soSemTag =
    legend.swatches.length === 1 && legend.swatches[0]!.key === 'legend.untagged';
  const empty =
    (legend.swatches.length === 0 || soSemTag) && legend.ramp === null && legend.valueRamp === null;
  return empty ? null : legend;
}
