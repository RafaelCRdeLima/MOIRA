/** Exportação SVG. Função pura: recebe a rede, o estilo e um resolvedor de
 *  cor, e devolve a string do arquivo.
 *
 *  Nada de geometria é recalculado aqui. As curvas saem de `bondCurve`, as
 *  formas de `shapeOutline`, as pernas de `freeLegPath` — pelo mesmo motivo
 *  que fez a alça de curvatura sair do lugar quando `bondPath` e
 *  `bondMidpoint` mantinham cada um a sua conta. Este é o terceiro consumidor
 *  daquela função, e o primeiro cujo resultado sai do programa.
 *
 *  Cor, espessura e preenchimento vêm de `lib/render`, os mesmos que o canvas
 *  usa; o que este módulo faz é trocar `var(--c-ink)` pelo hexadecimal, porque
 *  variável de CSS não existe fora do aplicativo. */

import type { Legend } from '../render/legend';
import { INK, viridis } from '../render/palette';
import type { NetworkStyle } from '../render/style';
import { bondStroke, bondWidth, legWidth, tensorFill, tensorRing } from '../render/style';
import {
  bondCurve,
  bondPath,
  freeLegPath,
  legTip,
  NAME_OFFSET,
  round,
  SHAPE_RADIUS,
  shapeOutline,
  tipAngle,
} from '../model/geometry';
import { bondOfLeg } from '../model/network';
import type { Network, Tensor } from '../model/types';

export interface SvgOptions {
  /** Troca `var(--c-ink)` pelo valor concreto. No aplicativo vem de
   *  `getComputedStyle`; no teste, de uma tabela fixa. */
  resolveColor: (value: string) => string;
  /** Nome exibido de cada tensor, o mesmo do canvas e da fórmula. */
  names: Map<string, string>;
  /** Traduz as chaves de texto da legenda. O SVG sai no idioma da tela. */
  translate: (key: string) => string;
  legend?: Legend | null;
  /** Margem em volta do conteúdo, para pernas livres e rótulos. */
  padding?: number;
  /** Pinta o fundo. Desligado, o SVG fica transparente — que é o que se quer
   *  ao colar num documento com fundo próprio. */
  background?: boolean;
  title?: string;
}

const NAME_SIZE = 12;
/** Largura média de um caractere na mono de 12 px. Serve para a caixa, não
 *  para posicionar: o texto é centralizado pelo próprio SVG. */
const NAME_CHAR = 7.2;

const LEGEND_ROW = 18;
const LEGEND_RAMP_W = 128;

export function toSvg(
  network: Network,
  style: NetworkStyle,
  options: SvgOptions,
): string {
  const padding = options.padding ?? 24;
  const cor = options.resolveColor;
  const caixa = contentBounds(network, options.names, options.legend ?? null, padding);

  const partes: string[] = [];
  partes.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${caixa.x} ${caixa.y} ${caixa.w} ${caixa.h}"` +
      ` width="${caixa.w}" height="${caixa.h}" role="img" aria-label="${escape(options.title ?? 'Rede tensorial')}">`,
  );
  partes.push(`<title>${escape(options.title ?? 'Rede tensorial')}</title>`);

  // Tinta clara sobre transparente some num documento branco, e quem descobre
  // isso costuma descobrir depois de já ter mandado o PDF ao coautor. O aviso
  // vai dentro do arquivo, e não só na tela que o produziu: é o arquivo que
  // viaja. A regra olha a cor de fato, não o tema — o exportador não sabe que
  // temas existem.
  if (options.background === false && isLight(cor('var(--c-ink)'))) {
    partes.push(
      '<!-- Esta figura tem traço claro e fundo transparente: ela assume um fundo escuro.',
      '     Num documento de fundo branco, ficará invisível. -->',
    );
  }
  partes.push(styleBlock(cor, options.background !== false));

  if (options.background !== false) {
    partes.push(
      `<rect class="moira-paper" x="${caixa.x}" y="${caixa.y}" width="${caixa.w}" height="${caixa.h}"/>`,
    );
  }

  // Agrupado por papel, e não por tensor: é o que faz uma regra no editor
  // alcançar todos os elementos de um tipo, e o que deixa a lista de objetos do
  // Inkscape legível.
  const vinculos = bondElements(network, style, cor);
  if (vinculos.length > 0) partes.push(group('moira-bonds', vinculos));

  const pernas = legElements(network);
  if (pernas.length > 0) partes.push(group('moira-legs', pernas));

  const centros = orthocenterElements(network);
  if (centros.length > 0) partes.push(group('moira-orthocenters', centros));

  const aneis = ringElements(network, style, cor);
  if (aneis.length > 0) partes.push(group('moira-rings', aneis));

  partes.push(group('moira-shapes', shapeElements(network, style, cor)));

  const nomes = nameElements(network, options.names);
  if (nomes.length > 0) partes.push(group('moira-names', nomes));

  if (options.legend) {
    partes.push(legendElement(options.legend, cor, options.translate, caixa, padding));
  }

  partes.push('</svg>');
  return partes.filter(Boolean).join('\n');
}

/** Nenhum `<g>` vazio: quem não tem filho não é escrito. */
function group(classe: string, filhos: string[]): string {
  return `<g class="${classe}">\n${filhos.map((f) => `  ${f}`).join('\n')}\n</g>`;
}

// ─── elementos ──────────────────────────────────────────────────────────────

function bondElements(network: Network, style: NetworkStyle, cor: (v: string) => string): string[] {
  const saida: string[] = [];
  for (const bond of network.bonds) {
    const d = bondPath(network, bond);
    if (!d) continue;
    const traco = bondStroke(network, style, bond);
    // A cor só vira atributo quando difere da regra da classe; assim uma linha
    // no editor continua alcançando todos os vínculos comuns.
    const atributoCor = traco === INK ? '' : ` stroke="${cor(traco)}"`;
    saida.push(`<path class="moira-bond" d="${d}" stroke-width="${bondWidth(network, bond)}"${atributoCor}/>`);
  }
  return saida;
}

function legElements(network: Network): string[] {
  const saida: string[] = [];
  for (const tensor of network.tensors) {
    for (const leg of tensor.legs) {
      if (bondOfLeg(network, leg.id)) continue;
      saida.push(
        `<path class="moira-leg" d="${freeLegPath(tensor, leg)}" stroke-width="${legWidth(leg)}"/>`,
      );
    }
  }
  return saida;
}

function orthocenterElements(network: Network): string[] {
  if (!network.orthogonalityCenter) return [];
  const tensor = network.tensors.find((t) => t.id === network.orthogonalityCenter);
  if (!tensor) return [];
  return [`<circle class="moira-orthocenter" cx="${round(tensor.x)}" cy="${round(tensor.y)}" r="17"/>`];
}

function ringElements(network: Network, style: NetworkStyle, cor: (v: string) => string): string[] {
  const saida: string[] = [];
  for (const tensor of network.tensors) {
    const anel = tensorRing(network, style, tensor);
    if (!anel) continue;
    saida.push(
      `<path class="moira-ring" d="${shapeOutline(tensor.shape, tipAngle(tensor))}"` +
        ` transform="translate(${round(tensor.x)} ${round(tensor.y)}) scale(1.17)" stroke="${cor(anel)}"/>`,
    );
  }
  return saida;
}

function shapeElements(network: Network, style: NetworkStyle, cor: (v: string) => string): string[] {
  return network.tensors.map(
    (tensor) =>
      `<path class="moira-shape shape-${tensor.shape}" d="${shapeOutline(tensor.shape, tipAngle(tensor))}"` +
      ` transform="translate(${round(tensor.x)} ${round(tensor.y)})" fill="${cor(tensorFill(network, style, tensor))}"/>`,
  );
}

function nameElements(network: Network, names: Map<string, string>): string[] {
  const saida: string[] = [];
  for (const tensor of network.tensors) {
    const nome = nameOf(tensor, names);
    if (!nome) continue;
    saida.push(
      `<text class="moira-name" x="${round(tensor.x)}" y="${round(tensor.y + NAME_OFFSET)}">${escape(nome)}</text>`,
    );
  }
  return saida;
}

function nameOf(tensor: Tensor, names: Map<string, string>): string {
  const base = tensor.name || names.get(tensor.id) || '';
  return base ? `${base}${tensor.conjugate ? '†' : ''}` : '';
}

// ─── legenda ────────────────────────────────────────────────────────────────

function legendElement(
  legend: Legend,
  cor: (v: string) => string,
  traduz: (k: string) => string,
  caixa: Bounds,
  padding: number,
): string {
  const filhos: string[] = [];
  const rotuloDe = (s: { text?: string; key?: string }) => s.text ?? (s.key ? traduz(s.key) : '');
  const largura = legendWidth(legend, rotuloDe, traduz);
  const altura = legendHeight(legend);

  filhos.push(`<rect class="moira-legend-box" x="-9" y="-9" width="${largura}" height="${altura}" rx="4"/>`);
  filhos.push(`<text class="moira-legend-title" x="0" y="10">${escape(traduz(legend.titleKey))}</text>`);

  legend.swatches.forEach((swatch, i) => {
    const y = 22 + i * LEGEND_ROW;
    filhos.push(
      `<rect class="moira-legend-swatch" x="0" y="${y}" width="11" height="11" rx="2" fill="${cor(swatch.color)}"/>`,
    );
    filhos.push(
      `<text class="moira-legend-label" x="17" y="${round(y + 9.5)}">${escape(rotuloDe(swatch))}</text>`,
    );
  });

  const rampas = [legend.ramp, legend.valueRamp].filter((r) => r !== null);
  let y = 22 + legend.swatches.length * LEGEND_ROW + 4;
  rampas.forEach((rampa, i) => {
    const id = `moira-rampa-${i}`;
    filhos.push(gradient(id));
    filhos.push(
      `<rect class="moira-legend-ramp" x="0" y="${y}" width="${LEGEND_RAMP_W}" height="9" rx="2" fill="url(#${id})"/>`,
    );
    const rotulos = rampa!.labels
      ? [traduz(rampa!.labels[0]), traduz(rampa!.labels[1])]
      : [String(rampa!.min), String(rampa!.max)];
    filhos.push(`<text class="moira-legend-label" x="0" y="${y + 21}">${escape(rotulos[0]!)}</text>`);
    filhos.push(
      `<text class="moira-legend-label moira-legend-end" x="${LEGEND_RAMP_W}" y="${y + 21}">${escape(rotulos[1]!)}</text>`,
    );
    y += 34;
  });

  const x = round(caixa.x + padding);
  const yTopo = round(caixa.y + padding);
  return `<g class="moira-legend" transform="translate(${x} ${yTopo})">\n${filhos.map((f) => `  ${f}`).join('\n')}\n</g>`;
}

/** As paradas do gradiente saem da mesma função `viridis` que pinta o canvas. */
function gradient(id: string): string {
  const paradas = Array.from({ length: 12 }, (_, i) => {
    const t = i / 11;
    return `<stop offset="${round(t * 100)}%" stop-color="${viridis(t)}"/>`;
  });
  return `<linearGradient id="${id}" x1="0" x2="1" y1="0" y2="0">${paradas.join('')}</linearGradient>`;
}

function legendWidth(
  legend: Legend,
  rotuloDe: (s: { text?: string; key?: string }) => string,
  traduz: (k: string) => string,
): number {
  const rotulos = legend.swatches.map((s) => rotuloDe(s).length * 6.7 + 29);
  return Math.max(92, LEGEND_RAMP_W + 16, traduz(legend.titleKey).length * 6 + 12, ...rotulos);
}

function legendHeight(legend: Legend): number {
  const rampas = [legend.ramp, legend.valueRamp].filter((r) => r !== null).length;
  return 22 + legend.swatches.length * LEGEND_ROW + rampas * 34 + 8;
}

// ─── caixa de contorno ──────────────────────────────────────────────────────

interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Ajustada ao conteúdo, e não ao tamanho da janela: entram as formas, as
 *  pontas das pernas livres, o texto dos nomes e o que a curva de cada vínculo
 *  alcança — uma cúbica muito curvada passa longe das suas pontas. */
function contentBounds(
  network: Network,
  names: Map<string, string>,
  legend: Legend | null,
  padding: number,
): Bounds {
  const xs: number[] = [];
  const ys: number[] = [];
  const marcar = (x: number, y: number) => {
    xs.push(x);
    ys.push(y);
  };

  for (const tensor of network.tensors) {
    const r = SHAPE_RADIUS[tensor.shape] * 1.25; // o anel da segunda tag passa da forma
    marcar(tensor.x - r, tensor.y - r);
    marcar(tensor.x + r, tensor.y + r);

    const nome = nameOf(tensor, names);
    if (nome) {
      const meia = (nome.length * NAME_CHAR) / 2;
      marcar(tensor.x - meia, tensor.y + NAME_OFFSET - NAME_SIZE);
      marcar(tensor.x + meia, tensor.y + NAME_OFFSET);
    }

    for (const leg of tensor.legs) {
      if (bondOfLeg(network, leg.id)) continue;
      const tip = legTip(tensor, leg);
      marcar(tip.x, tip.y);
    }
  }

  for (const bond of network.bonds) {
    const curva = bondCurve(network, bond);
    if (!curva) continue;
    for (let i = 0; i <= 16; i++) {
      const ponto = cubicAt(curva, i / 16);
      marcar(ponto.x, ponto.y);
    }
  }

  if (xs.length === 0) return { x: 0, y: 0, w: 2 * padding, h: 2 * padding };

  let x = Math.min(...xs) - padding;
  let y = Math.min(...ys) - padding;
  let w = Math.max(...xs) + padding - x;
  let h = Math.max(...ys) + padding - y;

  // A legenda ocupa o canto superior esquerdo; a caixa cresce para caber nela.
  if (legend) {
    // Só a altura e uma largura mínima: o rótulo traduzido não é conhecido aqui,
    // e a caixa da legenda tem fundo próprio, então transbordar um pouco na
    // horizontal não deixa nada ilegível.
    const precisa = LEGEND_RAMP_W + 2 * padding + 20;
    const alto = legendHeight(legend) + 2 * padding;
    if (w < precisa) w = precisa;
    if (h < alto) h = alto;
  }

  return { x: round(x), y: round(y), w: round(w), h: round(h) };
}

function cubicAt(
  curva: { p0: { x: number; y: number }; c1: { x: number; y: number }; c2: { x: number; y: number }; p3: { x: number; y: number } },
  t: number,
): { x: number; y: number } {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * curva.p0.x + b * curva.c1.x + c * curva.c2.x + d * curva.p3.x,
    y: a * curva.p0.y + b * curva.c1.y + c * curva.c2.y + d * curva.p3.y,
  };
}

// ─── folha de estilo embutida ───────────────────────────────────────────────

/** Uma regra por papel, com as cores já resolvidas. Quem abrir no Inkscape
 *  muda a espessura de todos os vínculos numa linha só. */
function styleBlock(cor: (v: string) => string, comFundo: boolean): string {
  const regras = [
    // Sem regra órfã: o que não é desenhado também não é estilizado.
    ...(comFundo ? [`.moira-paper { fill: ${cor('var(--c-paper)')}; }`] : []),
    `.moira-bond { fill: none; stroke: ${cor('var(--c-ink)')}; stroke-linecap: round; }`,
    `.moira-leg { fill: none; stroke: ${cor('var(--c-ink)')}; stroke-linecap: round; }`,
    `.moira-shape { stroke: ${cor('var(--c-ink)')}; stroke-width: 1.6; }`,
    `.moira-ring { fill: none; stroke-width: 3; }`,
    `.moira-orthocenter { fill: ${cor('var(--c-orthocenter)')}; fill-opacity: 0.45; }`,
    `.moira-name { font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: ${NAME_SIZE}px;` +
      ` text-anchor: middle; fill: ${cor('var(--c-ink)')}; }`,
    `.moira-legend-box { fill: ${cor('var(--c-paper)')}; fill-opacity: 0.92; stroke: ${cor('var(--c-rule)')}; }`,
    `.moira-legend-title { font-family: 'IBM Plex Sans', system-ui, sans-serif; font-size: 11px;` +
      ` fill: ${cor('var(--c-muted)')}; }`,
    `.moira-legend-label { font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 11px;` +
      ` fill: ${cor('var(--c-ink)')}; }`,
    `.moira-legend-end { text-anchor: end; }`,
    `.moira-legend-swatch, .moira-legend-ramp { stroke: ${cor('var(--c-rule)')}; }`,
  ];
  return `<style>\n${regras.map((r) => `  ${r}`).join('\n')}\n</style>`;
}

/** Luminância relativa aproximada, só para decidir se a tinta é clara. */
export function isLight(cor: string): boolean {
  const rgb = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(cor);
  const hex = /^#([0-9a-f]{6})$/i.exec(cor.trim());
  let r: number;
  let g: number;
  let b: number;
  if (rgb) {
    [r, g, b] = [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  } else if (hex) {
    const n = parseInt(hex[1]!, 16);
    [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  } else {
    return false;
  }
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.55;
}

function escape(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
