/** Exportação TikZ.
 *
 *  É o gancho de adoção real: o autor do artigo que originou este projeto
 *  desenhou tudo à mão no Inkscape por não ter isto. Por isso a exigência
 *  central não é "sair um PDF", é **sair ajustável**: mover um tensor tem de
 *  ser mudar uma coordenada com nome, e não caçar quatro números repetidos.
 *
 *  Duas escolhas garantem isso. Cada tensor vira uma `\coordinate` nomeada, e
 *  tudo que o toca — pernas, pontos de controle das curvas, rótulo — é escrito
 *  como deslocamento a partir dela, com a biblioteca `calc`. E a caixa usa
 *  `x=1pt, y=-1pt`: as coordenadas do arquivo são as do modelo, sem fator de
 *  escala para converter de cabeça, e o `-1` no eixo y resolve num lugar só a
 *  diferença entre o SVG, que cresce para baixo, e o TikZ, que cresce para cima.
 *
 *  A geometria vem toda de `model/geometry` e a cor de `render/style` — o mesmo
 *  princípio do exportador de SVG. */

import { tensorSymbol } from '../formula/latex';
import {
  bondCurve,
  legBase,
  legTip,
  NAME_OFFSET,
  round,
  SHAPE_RADIUS,
  shapeVertices,
  tipAngle,
} from '../model/geometry';
import { bondOfLeg } from '../model/network';
import type { Network, Tensor } from '../model/types';
import type { NetworkStyle } from '../render/style';
import { bondStroke, bondWidth, legWidth, tensorFill, tensorRing } from '../render/style';

export interface TikzOptions {
  /** Só para escrever os `\definecolor`: devolve o hexadecimal de um token. */
  resolveColor: (value: string) => string;
  names: Map<string, string>;
  title?: string;
  /** Envolve a figura num documento completo, pronto para `pdflatex`. */
  standalone?: boolean;
}

/** Nome de cor da identidade para cada token. Trocar a paleta inteira é mudar
 *  estas linhas do preâmbulo, e nada mais. */
const NOMES_DE_COR: Record<string, string> = {
  'var(--c-ink)': 'moiraInk',
  'var(--c-paper)': 'moiraPaper',
  'var(--c-generic)': 'moiraGrey',
  'var(--c-isometry)': 'moiraBlue',
  'var(--c-unitary)': 'moiraGreen',
  'var(--c-orthocenter)': 'moiraAmber',
  'var(--purple)': 'moiraPurple',
  'var(--blue)': 'moiraBlue',
  'var(--green)': 'moiraGreen',
  'var(--amber)': 'moiraAmber',
  'var(--cyan)': 'moiraCyan',
  'var(--red)': 'moiraRed',
  'var(--grey)': 'moiraGrey',
};

/** Junta as cores usadas e devolve o nome de cada uma, inventando nome só para
 *  o que não está na identidade — rampa de viridis e cor manual. */
class Paleta {
  readonly usadas = new Map<string, string>();
  #extras = 0;

  constructor(private readonly resolve: (v: string) => string) {}

  nome(valor: string): string {
    const existente = this.usadas.get(valor);
    if (existente) return existente;
    const nome = NOMES_DE_COR[valor] ?? `moiraTom${++this.#extras}`;
    this.usadas.set(valor, nome);
    return nome;
  }

  definicoes(): string[] {
    return [...this.usadas].map(
      ([valor, nome]) => `\\definecolor{${nome}}{HTML}{${paraHex(this.resolve(valor))}}`,
    );
  }
}

export function toTikz(network: Network, style: NetworkStyle, options: TikzOptions): string {
  const paleta = new Paleta(options.resolveColor);
  // A figura é montada primeiro: é ela que registra na paleta quais cores
  // aparecem, e o preâmbulo precisa dessa lista.
  const corpo = figura(network, style, options, paleta);
  const standalone = options.standalone !== false;

  const cabecalho = [
    '% Gerado pelo MOIRA a partir do diagrama.',
    '%',
    ...(standalone
      ? ['% Documento completo: compila direto com pdflatex.']
      : [
          '% Preâmbulo necessário, para colar num documento existente:',
          '%   \\usepackage{tikz}',
          '%   \\usetikzlibrary{calc}',
        ]),
    '%',
    '% As posições são coordenadas nomeadas: mover um tensor é mudar uma linha',
    '% da lista abaixo, e as pernas e as curvas o acompanham.',
    '',
    '% Paleta da identidade MOIRA. Trocar a figura inteira de cor é mudar aqui.',
    ...paleta.definicoes(),
    '',
  ];

  if (!standalone) return [...cabecalho, ...corpo].join('\n');

  return [
    '\\documentclass[tikz,border=6pt]{standalone}',
    '\\usetikzlibrary{calc}',
    '',
    ...cabecalho,
    '\\begin{document}',
    ...corpo,
    '\\end{document}',
  ].join('\n');
}

function figura(
  network: Network,
  style: NetworkStyle,
  options: TikzOptions,
  paleta: Paleta,
): string[] {
  const linhas: string[] = [];

  linhas.push(
    // x=1pt e y=-1pt: coordenada do arquivo é coordenada do modelo, e a
    // inversão do eixo vertical acontece uma vez só.
    '\\begin{tikzpicture}[',
    '    x=1pt, y=-1pt,',
    `    moira bond/.style={draw=${paleta.nome('var(--c-ink)')}, line cap=round},`,
    `    moira leg/.style={draw=${paleta.nome('var(--c-ink)')}, line cap=round},`,
    `    moira shape/.style={draw=${paleta.nome('var(--c-ink)')}, line width=1.6pt},`,
    '    moira ring/.style={line width=3pt},',
    `    moira name/.style={text=${paleta.nome('var(--c-ink)')}, font=\\footnotesize, inner sep=1pt},`,
    ']',
  );

  linhas.push('', '  % Posições dos tensores.');
  for (const tensor of network.tensors) {
    linhas.push(`  \\coordinate (${nodeName(tensor)}) at (${round(tensor.x)},${round(tensor.y)});`);
  }

  const vinculos = bondLines(network, style, paleta);
  if (vinculos.length > 0) linhas.push('', '  % Vínculos.', ...vinculos);

  const pernas = legLines(network);
  if (pernas.length > 0) linhas.push('', '  % Pernas livres.', ...pernas);

  if (network.orthogonalityCenter) {
    const centro = network.tensors.find((t) => t.id === network.orthogonalityCenter);
    if (centro) {
      linhas.push(
        '',
        '  % Centro de ortogonalidade.',
        `  \\fill[${paleta.nome('var(--c-orthocenter)')}, opacity=0.45] (${nodeName(centro)}) circle[radius=17pt];`,
      );
    }
  }

  linhas.push('', '  % Tensores.');
  for (const tensor of network.tensors) {
    const anel = tensorRing(network, style, tensor);
    if (anel) linhas.push(`  ${shapeLine(tensor, paleta.nome(anel), true)}`);
    linhas.push(`  ${shapeLine(tensor, paleta.nome(tensorFill(network, style, tensor)), false)}`);
  }

  const rotulos = nameLines(network, options.names);
  if (rotulos.length > 0) linhas.push('', '  % Rótulos.', ...rotulos);

  linhas.push('\\end{tikzpicture}');
  return linhas;
}

// ─── elementos ──────────────────────────────────────────────────────────────

function bondLines(network: Network, style: NetworkStyle, paleta: Paleta): string[] {
  const saida: string[] = [];
  for (const bond of network.bonds) {
    const curva = bondCurve(network, bond);
    if (!curva) continue;
    const pontas = bondAnchors(network, bond);
    if (!pontas) continue;

    const traco = bondStroke(network, style, bond);
    const cor = traco === 'var(--c-ink)' ? '' : `, draw=${paleta.nome(traco)}`;
    // Cada ponto escrito como deslocamento da coordenada do tensor: mover o
    // tensor arrasta a curva inteira junto.
    saida.push(
      `  \\draw[moira bond, line width=${bondWidth(network, bond)}pt${cor}] ` +
        `${offset(pontas.de, curva.p0)} .. controls ${offset(pontas.de, curva.c1)} and ` +
        `${offset(pontas.para, curva.c2)} .. ${offset(pontas.para, curva.p3)};`,
    );
  }
  return saida;
}

function bondAnchors(network: Network, bond: { a: string; b: string }) {
  let de: Tensor | undefined;
  let para: Tensor | undefined;
  for (const tensor of network.tensors) {
    for (const leg of tensor.legs) {
      if (leg.id === bond.a) de = tensor;
      if (leg.id === bond.b) para = tensor;
    }
  }
  return de && para ? { de, para } : undefined;
}

function legLines(network: Network): string[] {
  const saida: string[] = [];
  for (const tensor of network.tensors) {
    for (const leg of tensor.legs) {
      if (bondOfLeg(network, leg.id)) continue;
      saida.push(
        `  \\draw[moira leg, line width=${legWidth(leg)}pt] ` +
          `${offset(tensor, legBase(tensor, leg))} -- ${offset(tensor, legTip(tensor, leg))};`,
      );
    }
  }
  return saida;
}

function shapeLine(tensor: Tensor, cor: string, anel: boolean): string {
  const estilo = anel ? `moira ring, draw=${cor}` : `moira shape, fill=${cor}`;
  const escala = anel ? 1.17 : 1;
  const nome = nodeName(tensor);
  const vertices = shapeVertices(tensor.shape, tipAngle(tensor));

  if (!vertices) {
    const r = round(SHAPE_RADIUS[tensor.shape] * escala);
    return `\\draw[${estilo}] (${nome}) circle[radius=${r}pt];`;
  }
  const caminho = vertices
    .map((v) => `($(${nome})+(${round(v.x * escala)},${round(v.y * escala)})$)`)
    .join(' -- ');
  return `\\draw[${estilo}] ${caminho} -- cycle;`;
}

function nameLines(network: Network, names: Map<string, string>): string[] {
  const saida: string[] = [];
  for (const tensor of network.tensors) {
    const nome = tensor.name || names.get(tensor.id) || '';
    if (!nome) continue;
    // Em modo matemático, com o mesmo símbolo que a faixa da fórmula compõe.
    const simbolo = tensorSymbol(nome, tensor.conjugate === true);
    // `anchor=base` no mesmo deslocamento que o SVG usa: a linha de base do
    // texto cai exatamente onde cai no canvas, e o rótulo fica acima da forma
    // em vez de sobre ela.
    saida.push(
      `  \\node[moira name, anchor=base] at ($(${nodeName(tensor)})+(0,${NAME_OFFSET})$) {$${simbolo}$};`,
    );
  }
  return saida;
}

// ─── auxiliares ─────────────────────────────────────────────────────────────

/** Ponto absoluto reescrito como deslocamento da coordenada do tensor. */
function offset(tensor: Tensor, ponto: { x: number; y: number }): string {
  const dx = round(ponto.x - tensor.x);
  const dy = round(ponto.y - tensor.y);
  if (dx === 0 && dy === 0) return `(${nodeName(tensor)})`;
  return `($(${nodeName(tensor)})+(${dx},${dy})$)`;
}

/** Nome de coordenada legível e válido em TikZ. */
function nodeName(tensor: Tensor): string {
  return `t-${tensor.id}`;
}

function paraHex(cor: string): string {
  const rgb = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(cor);
  if (rgb) {
    return [rgb[1], rgb[2], rgb[3]]
      .map((c) => Math.round(Number(c)).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }
  const hex = /^#?([0-9a-fA-F]{6})$/.exec(cor.trim());
  if (hex) return hex[1]!.toUpperCase();
  const curto = /^#?([0-9a-fA-F]{3})$/.exec(cor.trim());
  if (curto) {
    return curto[1]!
      .split('')
      .map((c) => c + c)
      .join('')
      .toUpperCase();
  }
  return '000000';
}
