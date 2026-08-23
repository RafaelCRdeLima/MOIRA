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

/** Vínculo: cúbica de borda a borda, com as pontas das pernas como pontos de
 *  controle. Assim o ângulo e o comprimento de cada perna viram a tangente da
 *  curva em cada extremidade, e um vínculo de um tensor consigo mesmo (traço
 *  parcial) sai como laço sem nenhum caso especial. */
export function bondPath(network: Network, bond: Bond): string | undefined {
  const ends = bondEnds(network, bond);
  if (!ends) return undefined;
  const p0 = legBase(ends.from.tensor, ends.from.leg);
  const p3 = legBase(ends.to.tensor, ends.to.leg);
  let c1 = legTip(ends.from.tensor, ends.from.leg);
  let c2 = legTip(ends.to.tensor, ends.to.leg);

  if (bond.curvature !== 0) {
    const dx = p3.x - p0.x;
    const dy = p3.y - p0.y;
    const chord = Math.hypot(dx, dy);
    // Num laço a corda é curta demais para dar escala à curvatura; o piso evita
    // que arrastar o ponto médio de um laço não produza efeito nenhum.
    const scale = bond.curvature * Math.max(chord, 48);
    const nx = chord > 1e-6 ? -dy / chord : 0;
    const ny = chord > 1e-6 ? dx / chord : -1;
    c1 = { x: c1.x + nx * scale, y: c1.y + ny * scale };
    c2 = { x: c2.x + nx * scale, y: c2.y + ny * scale };
  }

  return (
    `M${round(p0.x)} ${round(p0.y)}` +
    `C${round(c1.x)} ${round(c1.y)},${round(c2.x)} ${round(c2.y)},${round(p3.x)} ${round(p3.y)}`
  );
}

/** Ponto médio da curva do vínculo (t = 0.5), onde fica a alça de curvatura. */
export function bondMidpoint(network: Network, bond: Bond): Point | undefined {
  const ends = bondEnds(network, bond);
  if (!ends) return undefined;
  const p0 = legBase(ends.from.tensor, ends.from.leg);
  const p3 = legBase(ends.to.tensor, ends.to.leg);
  const c1 = legTip(ends.from.tensor, ends.from.leg);
  const c2 = legTip(ends.to.tensor, ends.to.leg);
  return {
    x: (p0.x + 3 * c1.x + 3 * c2.x + p3.x) / 8,
    y: (p0.y + 3 * c1.y + 3 * c2.y + p3.y) / 8,
  };
}

/** Contorno da forma, centrado na origem — quem posiciona é o `transform` do grupo. */
export function shapeOutline(shape: Shape, tipAngle = 0): string {
  const r = SHAPE_RADIUS[shape];
  switch (shape) {
    case 'square':
      return `M${-r} ${-r}H${r}V${r}H${-r}Z`;
    case 'diamond':
      return `M0 ${-r}L${r} 0L0 ${r}L${-r} 0Z`;
    case 'triangle': {
      // Vértices do triângulo equilátero inscrito, com um deles no ângulo da ponta.
      const pts = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].map((d) => ({
        x: Math.cos(tipAngle + d) * r,
        y: Math.sin(tipAngle + d) * r,
      }));
      return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${round(p.x)} ${round(p.y)}`).join('') + 'Z';
    }
    default: {
      // Círculo e ponto como duas semicircunferências: um só tipo de nó no SVG.
      const rr = SHAPE_RADIUS[shape];
      return `M${-rr} 0A${rr} ${rr} 0 1 0 ${rr} 0A${rr} ${rr} 0 1 0 ${-rr} 0Z`;
    }
  }
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
