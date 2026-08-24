/** Geometria das pernas e dos vínculos. Fica em módulo separado porque o
 *  exportador de SVG e de TikZ (M4) precisa das mesmas contas que o canvas.
 *
 *  Convenção: coordenadas de SVG, y cresce para baixo; o ângulo de uma perna é
 *  medido a partir da direita e cresce no sentido horário na tela. */

import { bondEnds } from './network';
import type { Bond, Leg, Network, Shape, Tensor } from './types';

export interface Point {
  x: number;
  y: number;
}

/** Deslocamento vertical do rótulo em relação ao centro do tensor: a linha de
 *  base do texto fica acima da forma. Mora aqui, e não em cada desenhista,
 *  porque o canvas, o SVG e o TikZ precisam pôr o nome no mesmo lugar. */
export const NAME_OFFSET = -20;

/** Meia-largura de cada forma, em unidades do canvas. */
export const SHAPE_RADIUS: Record<Shape, number> = {
  circle: 12,
  square: 11,
  triangle: 13,
  dot: 4.5,
  diamond: 12,
};

/** Distância do centro até a borda da forma na direção do ângulo dado.
 *  O triângulo usa o círculo circunscrito: a diferença some sob a espessura
 *  do traço e evita um caso especial por orientação da ponta. */
export function boundaryRadius(shape: Shape, angle: number): number {
  const r = SHAPE_RADIUS[shape];
  const c = Math.abs(Math.cos(angle));
  const s = Math.abs(Math.sin(angle));
  switch (shape) {
    case 'square':
      return r / Math.max(c, s, 1e-6);
    case 'diamond':
      return r / Math.max(c + s, 1e-6);
    default:
      return r;
  }
}

export function legBase(tensor: Tensor, leg: Leg): Point {
  const r = boundaryRadius(tensor.shape, leg.angle);
  return { x: tensor.x + Math.cos(leg.angle) * r, y: tensor.y + Math.sin(leg.angle) * r };
}

export function legTip(tensor: Tensor, leg: Leg): Point {
  const r = boundaryRadius(tensor.shape, leg.angle) + leg.length;
  return { x: tensor.x + Math.cos(leg.angle) * r, y: tensor.y + Math.sin(leg.angle) * r };
}

/** Perna livre: reta da borda da forma até a ponta. */
export function freeLegPath(tensor: Tensor, leg: Leg): string {
  const a = legBase(tensor, leg);
  const b = legTip(tensor, leg);
  return `M${round(a.x)} ${round(a.y)}L${round(b.x)} ${round(b.y)}`;
}

/** Pontos de controle da cúbica de um vínculo: das bordas das duas formas, com
 *  as pontas das pernas como controles, deslocados pela curvatura.
 *
 *  Fonte única de propósito. Antes, `bondPath` e `bondMidpoint` montavam a
 *  curva cada um por conta própria e só o primeiro aplicava a curvatura — a
 *  alça de arrasto se descolava da linha assim que o vínculo era curvado. Duas
 *  contas para a mesma curva sempre acabam discordando; o M4 vai exportar estas
 *  curvas e precisa que a conta seja uma só. */
export function bondCurve(
  network: Network,
  bond: Bond,
): { p0: Point; c1: Point; c2: Point; p3: Point } | undefined {
  const ends = bondEnds(network, bond);
  if (!ends) return undefined;

  const p0 = legBase(ends.from.tensor, ends.from.leg);
  const p3 = legBase(ends.to.tensor, ends.to.leg);
  let c1 = legTip(ends.from.tensor, ends.from.leg);
  let c2 = legTip(ends.to.tensor, ends.to.leg);

  if (bond.curvature !== 0) {
    const { nx, ny, scale } = curvatureFrame(p0, p3, bond.curvature);
    c1 = { x: c1.x + nx * scale, y: c1.y + ny * scale };
    c2 = { x: c2.x + nx * scale, y: c2.y + ny * scale };
  }

  return { p0, c1, c2, p3 };
}

/** Normal à corda e escala da curvatura. Num laço a corda é curta demais para
 *  dar escala; o piso evita que arrastar o meio de um laço não produza efeito. */
function curvatureFrame(p0: Point, p3: Point, curvature: number) {
  const dx = p3.x - p0.x;
  const dy = p3.y - p0.y;
  const chord = Math.hypot(dx, dy);
  return {
    nx: chord > 1e-6 ? -dy / chord : 0,
    ny: chord > 1e-6 ? dx / chord : -1,
    scale: curvature * Math.max(chord, 48),
    chord,
  };
}

/** Vínculo: cúbica de borda a borda, com as pontas das pernas como pontos de
 *  controle. Assim o ângulo e o comprimento de cada perna viram a tangente da
 *  curva em cada extremidade, e um vínculo de um tensor consigo mesmo (traço
 *  parcial) sai como laço sem nenhum caso especial. */
export function bondPath(network: Network, bond: Bond): string | undefined {
  const curve = bondCurve(network, bond);
  if (!curve) return undefined;
  const { p0, c1, c2, p3 } = curve;
  return (
    `M${round(p0.x)} ${round(p0.y)}` +
    `C${round(c1.x)} ${round(c1.y)},${round(c2.x)} ${round(c2.y)},${round(p3.x)} ${round(p3.y)}`
  );
}

/** Ponto da curva em t = 0,5, onde fica a alça de curvatura — da curva de
 *  verdade, curvatura incluída. */
export function bondMidpoint(network: Network, bond: Bond): Point | undefined {
  const curve = bondCurve(network, bond);
  if (!curve) return undefined;
  const { p0, c1, c2, p3 } = curve;
  return {
    x: (p0.x + 3 * c1.x + 3 * c2.x + p3.x) / 8,
    y: (p0.y + 3 * c1.y + 3 * c2.y + p3.y) / 8,
  };
}

/** Vértices da forma, centrados na origem. Círculo e ponto não têm vértice e
 *  devolvem null — quem desenha usa o raio.
 *
 *  Existe para que o exportador de TikZ não recalcule o triângulo por conta
 *  própria: o contorno do SVG e o caminho do TikZ saem daqui, e não podem
 *  discordar de meio grau. */
export function shapeVertices(shape: Shape, tipAngle = 0): Point[] | null {
  const r = SHAPE_RADIUS[shape];
  switch (shape) {
    case 'square':
      return [
        { x: -r, y: -r },
        { x: r, y: -r },
        { x: r, y: r },
        { x: -r, y: r },
      ];
    case 'diamond':
      return [
        { x: 0, y: -r },
        { x: r, y: 0 },
        { x: 0, y: r },
        { x: -r, y: 0 },
      ];
    case 'triangle':
      // Equilátero inscrito, com um vértice no ângulo da ponta.
      return [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].map((d) => ({
        x: round(Math.cos(tipAngle + d) * r),
        y: round(Math.sin(tipAngle + d) * r),
      }));
    default:
      return null;
  }
}

/** Contorno da forma, centrado na origem — quem posiciona é o `transform` do grupo. */
export function shapeOutline(shape: Shape, tipAngle = 0): string {
  const vertices = shapeVertices(shape, tipAngle);
  if (vertices) {
    return vertices.map((p, i) => `${i === 0 ? 'M' : 'L'}${round(p.x)} ${round(p.y)}`).join('') + 'Z';
  }
  // Círculo e ponto como duas semicircunferências: um só tipo de nó no SVG.
  const r = SHAPE_RADIUS[shape];
  return `M${-r} 0A${r} ${r} 0 1 0 ${r} 0A${r} ${r} 0 1 0 ${-r} 0Z`;
}

/** Ângulo da ponta do triângulo, tirado da perna marcada em `isometryTip`. */
export function tipAngle(tensor: Tensor): number {
  if (!tensor.isometryTip) return 0;
  return tensor.legs.find((l) => l.id === tensor.isometryTip)?.angle ?? 0;
}

/** Duas casas decimais em toda saída de caminho: é o que torna os snapshots de
 *  SVG determinísticos apesar do ruído de ponto flutuante (§14). */
export function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export const MIN_LEG_LENGTH = 10;
export const MAX_CURVATURE = 3;

/** Ângulo e comprimento que põem a ponta da perna sob o ponto dado. */
export function legGeometryFor(tensor: Tensor, point: Point): { angle: number; length: number } {
  const dx = point.x - tensor.x;
  const dy = point.y - tensor.y;
  const angle = Math.atan2(dy, dx);
  const length = Math.hypot(dx, dy) - boundaryRadius(tensor.shape, angle);
  return { angle, length: Math.max(MIN_LEG_LENGTH, length) };
}

/** Curvatura que leva o meio da curva até o ponto dado. Inverte a conta de
 *  `bondCurve`: deslocar os dois controles de `s` move o meio em 3/4 de `s`. */
export function curvatureFor(network: Network, bond: Bond, point: Point): number {
  // Referência sem curvatura: é dela que o deslocamento é medido.
  const reta = bondCurve(network, { ...bond, curvature: 0 });
  if (!reta) return bond.curvature;
  const { p0, c1, c2, p3 } = reta;

  const { nx, ny } = curvatureFrame(p0, p3, 1);
  const chord = Math.hypot(p3.x - p0.x, p3.y - p0.y);

  const midX = (p0.x + 3 * c1.x + 3 * c2.x + p3.x) / 8;
  const midY = (p0.y + 3 * c1.y + 3 * c2.y + p3.y) / 8;
  const shift = ((point.x - midX) * nx + (point.y - midY) * ny) / 0.75;
  const k = shift / Math.max(chord, 48);
  return Math.max(-MAX_CURVATURE, Math.min(MAX_CURVATURE, k));
}
