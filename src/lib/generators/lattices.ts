/** Redes em grade: PEPS. */

import type { Fragment } from './common';
import { DOWN, LEFT, RIGHT, SITE_DX, UP, centerFragment, emptyFragment, link, node } from './common';
import type { Leg, Tensor } from '../model/types';

/** Perna física na diagonal, para não brigar com as quatro pernas de vínculo. */
const PHYSICAL = (-3 * Math.PI) / 4;

export function peps(options: { rows: number; cols: number }): Fragment {
  const { rows, cols } = options;
  const fragment = emptyFragment();
  const grid: Tensor[][] = [];
  const legOf = new Map<string, Map<number, Leg>>();

  for (let r = 0; r < rows; r++) {
    const line: Tensor[] = [];
    for (let c = 0; c < cols; c++) {
      const angles = [
        ...(c > 0 ? [LEFT] : []),
        ...(c < cols - 1 ? [RIGHT] : []),
        ...(r > 0 ? [UP] : []),
        ...(r < rows - 1 ? [DOWN] : []),
        PHYSICAL,
      ];
      const tensor = node(fragment, c * SITE_DX, r * SITE_DX, angles, {
        name: `A${r + 1}${c + 1}`,
        tags: ['peps'],
        legLength: 22,
      });
      const byAngle = new Map<number, Leg>();
      angles.forEach((angle, i) => byAngle.set(angle, tensor.legs[i]!));
      legOf.set(tensor.id, byAngle);
      line.push(tensor);
    }
    grid.push(line);
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const here = grid[r]![c]!;
      if (c < cols - 1) {
        link(fragment, legOf.get(here.id)!.get(RIGHT)!, legOf.get(grid[r]![c + 1]!.id)!.get(LEFT)!);
      }
      if (r < rows - 1) {
        link(fragment, legOf.get(here.id)!.get(DOWN)!, legOf.get(grid[r + 1]![c]!.id)!.get(UP)!);
      }
    }
  }

  return centerFragment(fragment);
}
