/** Aceite da exportação TikZ. O critério que não se vê no PDF é a
 *  ajustabilidade: mover um tensor tem de ser mudar uma linha, e é isso que a
 *  maior parte destes testes verifica. */

import { beforeEach, describe, expect, it } from 'vitest';
import { toTikz } from '../src/lib/export/tikz';
import { displayNames } from '../src/lib/formula/indices';
import { mera, mps, sandwich } from '../src/lib/generators/index';
import { resetIdCounters } from '../src/lib/model/id';
import { createTensor, emptyNetwork } from '../src/lib/model/network';
import type { Network } from '../src/lib/model/types';
import { computeStyle } from '../src/lib/render/style';

const PALETA: Record<string, string> = {
  '--c-ink': '#1b2430',
  '--c-paper': '#ffffff',
  '--c-generic': '#bbbbbb',
  '--c-isometry': '#4477aa',
  '--c-unitary': '#228833',
  '--c-orthocenter': '#ccbb44',
  '--purple': '#aa3377',
  '--blue': '#4477aa',
  '--green': '#228833',
  '--amber': '#ccbb44',
  '--cyan': '#66ccee',
  '--red': '#ee6677',
  '--grey': '#bbbbbb',
};
const resolveColor = (v: string) => PALETA[/^var\((--[a-z-]+)\)$/.exec(v)?.[1] ?? ''] ?? v;

function comoRede(f: { tensors: Network['tensors']; bonds: Network['bonds'] }): Network {
  return { ...emptyNetwork(), tensors: f.tensors, bonds: f.bonds };
}

function exportar(network: Network, standalone = true) {
  return toTikz(network, computeStyle(network), {
    resolveColor,
    names: displayNames(network),
    standalone,
    title: 'teste',
  });
}

describe('TikZ exportado', () => {
  beforeEach(resetIdCounters);

  it('as posições são coordenadas nomeadas, uma por tensor', () => {
    const rede = comoRede(mps({ sites: 4 }));
    const tex = exportar(rede);
    for (const tensor of rede.tensors) {
      expect(tex).toContain(`\\coordinate (t-${tensor.id}) at (`);
    }
    expect(tex.match(/\\coordinate \(/g)).toHaveLength(4);
  });

  it('mover um tensor é mudar uma linha: nada o repete em número fixo', () => {
    const rede = comoRede(mps({ sites: 3 }));
    const tex = exportar(rede);
    const alvo = rede.tensors[1]!;
    const posicao = `at (${alvo.x},${alvo.y})`;

    // A coordenada aparece uma vez só; tudo o mais é deslocamento a partir dela.
    expect(tex.split(posicao)).toHaveLength(2);
    const deslocamentos = tex.split(`$(t-${alvo.id})+`).length - 1;
    expect(deslocamentos).toBeGreaterThan(2);
  });

  it('as curvas usam os mesmos pontos de controle do SVG, como deslocamento', () => {
    const rede = comoRede(mps({ sites: 2 }));
    const tex = exportar(rede);
    // Borda em 12, ponta em 38: os mesmos números que `bondCurve` devolve.
    expect(tex).toMatch(/\.\. controls \(\$\(t-t1\)\+\(38,0\)\$\) and \(\$\(t-t2\)\+\(-38,0\)\$\) \.\./);
  });

  it('as cores saem como \\definecolor com os nomes da identidade', () => {
    const tex = exportar(comoRede(sandwich({ sites: 2 })));
    expect(tex).toContain('\\definecolor{moiraInk}{HTML}{1B2430}');
    expect(tex).toContain('\\definecolor{moiraAmber}{HTML}{CCBB44}');
    // Nenhuma cor solta no corpo: tudo por nome.
    expect(tex).not.toMatch(/(?:draw|fill)=#/);
    expect(tex).not.toMatch(/(?:draw|fill)=rgb/);
  });

  it('as espessuras saem em pt, da mesma função do canvas', () => {
    const tex = exportar(comoRede(mps({ sites: 3 })));
    expect(tex).toMatch(/line width=2\.51pt/); // χ = 16
    expect(tex).toMatch(/line width=[\d.]+pt/);
  });

  it('o eixo vertical é invertido uma vez só, na caixa', () => {
    const tex = exportar(comoRede(mps({ sites: 2 })));
    expect(tex).toContain('x=1pt, y=-1pt');
    // As coordenadas são as do modelo, sem sinal trocado à mão.
    expect(tex).toContain('\\coordinate (t-t1) at (0,0);');
  });

  it('os rótulos vão em modo matemático, com o símbolo da fórmula', () => {
    const tex = exportar(comoRede(sandwich({ sites: 2 })));
    expect(tex).toContain('{$A^{[1]\\dagger}$}');
    expect(tex).toContain('{$W^{[1]}$}');
  });

  it('documento completo compila sozinho; trecho traz o preâmbulo em comentário', () => {
    const rede = comoRede(mps({ sites: 2 }));
    const completo = exportar(rede, true);
    expect(completo).toContain('\\documentclass[tikz,border=6pt]{standalone}');
    expect(completo).toContain('\\begin{document}');
    expect(completo).toContain('\\end{document}');

    const trecho = exportar(rede, false);
    expect(trecho).not.toContain('\\documentclass');
    expect(trecho).toContain('%   \\usepackage{tikz}');
    expect(trecho).toContain('%   \\usetikzlibrary{calc}');
    expect(trecho).toContain('\\begin{tikzpicture}');
  });

  it('as formas com vértice saem do mesmo cálculo do SVG', () => {
    const rede = emptyNetwork();
    const quadrado = createTensor(0, 0, { shape: 'square', name: 'U' });
    const triangulo = createTensor(80, 0, { shape: 'triangle', name: 'W' });
    triangulo.isometryTip = triangulo.legs[0]!.id;
    rede.tensors.push(quadrado, triangulo);

    const tex = exportar(rede);
    expect(tex).toContain('($(t-t1)+(-11,-11)$) -- ($(t-t1)+(11,-11)$)');
    expect(tex).toMatch(/\(\$\(t-t2\)\+\(13,0\)\$\)/); // ponta no ângulo 0
    expect(tex).toContain('-- cycle;');
  });

  it('o círculo sai como circle, e não como polígono', () => {
    const tex = exportar(comoRede(mps({ sites: 1 })));
    expect(tex).toMatch(/circle\[radius=12pt\]/);
  });

  it('a MERA de 16 folhas não repete coordenada nem perde tensor', () => {
    const rede = comoRede(mera({ leaves: 16 }));
    const tex = exportar(rede);
    expect(tex.match(/\\coordinate \(/g)).toHaveLength(26);
    expect(tex.match(/\\node\[moira name/g)).toHaveLength(26);
  });

  it('é determinístico', () => {
    const rede = comoRede(sandwich({ sites: 3 }));
    expect(exportar(rede)).toBe(exportar(rede));
  });

  it('instantâneo do sanduíche de 4 sítios', () => {
    expect(exportar(comoRede(sandwich({ sites: 4 })))).toMatchSnapshot();
  });
});
