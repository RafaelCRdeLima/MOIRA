/** Aceite da exportação SVG. Determinístico: as posições já saem arredondadas
 *  a duas casas, e o resolvedor de cor é uma tabela fixa em vez do
 *  `getComputedStyle` do navegador. */

import { beforeEach, describe, expect, it } from 'vitest';
import { toSvg } from '../src/lib/export/svg';
import { displayNames } from '../src/lib/formula/indices';
import { mera, mps, sandwich } from '../src/lib/generators/index';
import { resetIdCounters } from '../src/lib/model/id';
import { addBond, createTensor, emptyNetwork } from '../src/lib/model/network';
import type { Network } from '../src/lib/model/types';
import { buildLegend } from '../src/lib/render/legend';
import { computeStyle } from '../src/lib/render/style';

/** A mesma tabela do `tokens.css`, no modo claro. */
const PALETA: Record<string, string> = {
  '--c-ink': '#1b2430',
  '--c-paper': '#ffffff',
  '--c-generic': '#bbbbbb',
  '--c-isometry': '#4477aa',
  '--c-unitary': '#228833',
  '--c-orthocenter': '#ccbb44',
  '--c-rule': '#dddddd',
  '--c-muted': '#6b7280',
  '--purple': '#aa3377',
  '--blue': '#4477aa',
  '--green': '#228833',
  '--amber': '#ccbb44',
  '--cyan': '#66ccee',
  '--red': '#ee6677',
  '--grey': '#bbbbbb',
};

const resolveColor = (valor: string) => {
  const m = /^var\((--[a-z-]+)\)$/.exec(valor);
  return m ? (PALETA[m[1]!] ?? '#000000') : valor;
};

/** Chaves de tradução: no teste, a própria chave sem o prefixo. */
const translate = (k: string) => k.split('.').pop()!;

function comoRede(f: { tensors: Network['tensors']; bonds: Network['bonds'] }): Network {
  return { ...emptyNetwork(), tensors: f.tensors, bonds: f.bonds };
}

function exportar(network: Network, opcoes: { legenda?: boolean; fundo?: boolean } = {}) {
  const style = computeStyle(network);
  return toSvg(network, style, {
    resolveColor,
    translate,
    names: displayNames(network),
    legend: opcoes.legenda === false ? null : buildLegend(network, style),
    background: opcoes.fundo,
    title: 'teste',
  });
}

describe('SVG exportado', () => {
  beforeEach(resetIdCounters);

  it('não tem grupo vazio nem variável de CSS', () => {
    const svg = exportar(comoRede(sandwich({ sites: 4 })));
    expect(svg).not.toMatch(/<g[^>]*>\s*<\/g>/);
    expect(svg).not.toContain('var(--');
    expect(svg).toContain('#1b2430');
  });

  it('classes por papel, uma regra alcançando todos do tipo', () => {
    const svg = exportar(comoRede(sandwich({ sites: 3 })));
    for (const classe of ['moira-bond', 'moira-leg', 'moira-shape', 'moira-name']) {
      expect(svg).toContain(`class="${classe}`);
      expect(svg).toMatch(new RegExp(`\\.${classe} \\{`));
    }
    // A cor do traço fica na regra, e não repetida em cada elemento: é isso que
    // deixa "pinte todos os vínculos de vermelho" ser uma linha só.
    expect(svg).toMatch(/\.moira-bond \{[^}]*stroke: #1b2430/);
    expect(svg.match(/<path class="moira-bond"[^>]*stroke="/g)).toBeNull();
  });

  it('fontes como texto, não como caminho', () => {
    const svg = exportar(comoRede(mps({ sites: 3 })));
    expect(svg).toMatch(/<text class="moira-name"[^>]*>A1<\/text>/);
    expect(svg).toMatch(/font-family: 'IBM Plex Mono'/);
  });

  it('o conjugado leva a daga no rótulo', () => {
    const svg = exportar(comoRede(sandwich({ sites: 2 })));
    expect(svg).toContain('>A1†</text>');
  });

  it('a caixa se ajusta ao conteúdo, não à janela', () => {
    const svg = exportar(comoRede(mps({ sites: 3 })), { legenda: false });
    const [x, y, w, h] = /viewBox="([^"]+)"/.exec(svg)![1]!.split(' ').map(Number);
    // Três sítios espaçados de 64, mais pernas e margem: largura na casa das
    // centenas, e nada perto do tamanho de uma janela.
    expect(w).toBeGreaterThan(150);
    expect(w).toBeLessThan(400);
    expect(h!).toBeLessThan(w!);
    expect(Number.isFinite(x!) && Number.isFinite(y!)).toBe(true);
  });

  it('a caixa cobre a barriga de um vínculo muito curvado', () => {
    const network = emptyNetwork();
    const a = createTensor(0, 0, { legCount: 2, name: 'A' });
    const b = createTensor(200, 0, { legCount: 2, name: 'B' });
    network.tensors.push(a, b);
    const bond = addBond(network, a.legs[0]!.id, b.legs[1]!.id)!;

    const reto = /viewBox="([^"]+)"/.exec(exportar(network, { legenda: false }))![1]!.split(' ').map(Number);
    bond.curvature = 1.4;
    const curvo = /viewBox="([^"]+)"/.exec(exportar(network, { legenda: false }))![1]!.split(' ').map(Number);
    expect(curvo[3]!).toBeGreaterThan(reto[3]! + 60);
  });

  it('a legenda vai junto quando ligada, e some quando não', () => {
    const rede = comoRede(sandwich({ sites: 3 }));
    expect(exportar(rede)).toContain('class="moira-legend"');
    expect(exportar(rede, { legenda: false })).not.toContain('moira-legend"');
  });

  it('a rampa da legenda usa as mesmas paradas de viridis do canvas', () => {
    const rede = comoRede(mera({ leaves: 8 }));
    rede.colorMode = 'layer';
    const svg = exportar(rede);
    expect(svg).toContain('<linearGradient id="moira-rampa-0"');
    expect(svg).toContain('stop-color="rgb(68 1 84)"');
    expect(svg).toContain('stop-color="rgb(253 231 37)"');
  });

  it('o fundo é opcional: sem ele, o SVG entra transparente noutro documento', () => {
    const rede = comoRede(mps({ sites: 2 }));
    expect(exportar(rede)).toContain('class="moira-paper"');
    expect(exportar(rede, { fundo: false })).not.toContain('moira-paper');
  });

  it('rede vazia não quebra', () => {
    const svg = exportar(emptyNetwork());
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });

  it('é determinístico e arredondado a duas casas', () => {
    const rede = comoRede(mps({ sites: 4 }));
    rede.tensors[1]!.x = 64.123456789;
    const svg = exportar(rede);
    expect(svg).toBe(exportar(rede));
    for (const n of svg.match(/(?:x|y|cx|cy|d)="[^"]*"/g) ?? []) {
      for (const numero of n.match(/-?\d+\.\d+/g) ?? []) {
        expect(numero.split('.')[1]!.length).toBeLessThanOrEqual(2);
      }
    }
  });

  it('instantâneo do sanduíche de 4 sítios', () => {
    expect(exportar(comoRede(sandwich({ sites: 4 })))).toMatchSnapshot();
  });
});
