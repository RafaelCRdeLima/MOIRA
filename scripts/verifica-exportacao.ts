/** Aceite da exportação: o arquivo gerado abre num renderizador que não é o
 *  navegador em que foi produzido.
 *
 *  O `librsvg` é o motor do Inkscape e do GNOME, não compartilha código com o
 *  Chrome e é mais rigoroso: um SVG que ele desenha é um SVG válido, não um SVG
 *  que um navegador tolerou. É o equivalente, para a figura, do que rodar o
 *  `ncon.m` canônico foi para o código.
 *
 *  Rodar com: npm run verifica-exportacao
 */

import { execFile } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

import { toSvg } from '../src/lib/export/svg';
import { toTikz } from '../src/lib/export/tikz';
import { displayNames } from '../src/lib/formula/indices';
import { mera, sandwich } from '../src/lib/generators/index';
import { emptyNetwork } from '../src/lib/model/network';
import type { Network } from '../src/lib/model/types';
import { buildLegend } from '../src/lib/render/legend';
import { computeStyle } from '../src/lib/render/style';

const executar = promisify(execFile);
const RAIZ = path.resolve(import.meta.dirname, '..');
const DESTINO = path.join(RAIZ, 'scripts/fixtures/exportado');

/** As cores saem do próprio `tokens.css`: o script não mantém uma segunda
 *  tabela da paleta, que sairia de sincronia no primeiro ajuste.
 *
 *  Os tokens derivados usam `color-mix`, e aqui não há navegador para resolvê-lo
 *  — a conta em sRGB está escrita à mão logo abaixo, e vale só para este script. */
function paletaDoCss(): (valor: string) => string {
  const css = readFileSync(path.join(RAIZ, 'src/styles/tokens.css'), 'utf8');
  const raiz = /:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
  const tabela = new Map<string, string>();
  for (const linha of raiz.split(';')) {
    const m = /(--[\w-]+)\s*:\s*([\s\S]+)/.exec(linha);
    if (m) tabela.set(m[1]!.trim(), m[2]!.trim());
  }

  const resolver = (valor: string, profundidade = 0): string => {
    if (profundidade > 8) return valor;
    // Substitui todo `var(--x)`, inclusive dentro de `color-mix(...)`.
    const substituido = valor.replace(/var\((--[^)]+)\)/g, (inteiro, nome: string) => {
      const bruto = tabela.get(nome);
      return bruto === undefined ? inteiro : resolver(bruto, profundidade + 1);
    });
    return misturar(substituido);
  };
  return (valor) => resolver(valor);
}

/** `color-mix(in srgb, C p%, D)` em sRGB, com D podendo ser `transparent`.
 *  Suficiente para os tokens do MOIRA; não é uma implementação de CSS. */
function misturar(valor: string): string {
  const m = /^color-mix\(\s*in\s+srgb\s*,\s*(#[0-9a-fA-F]{3,8})\s+([\d.]+)%\s*,\s*([^)]+)\)$/.exec(
    valor.trim(),
  );
  if (!m) return valor;
  const [, hex, pct, outro] = m;
  const p = Number(pct) / 100;
  const a = hexParaRgb(hex!);
  if (outro!.trim() === 'transparent') {
    return `rgba(${a[0]}, ${a[1]}, ${a[2]}, ${round3(p)})`;
  }
  const b = hexParaRgb(misturar(outro!.trim()));
  const mistura = a.map((c, i) => Math.round(c * p + b[i]! * (1 - p)));
  return `rgb(${mistura[0]}, ${mistura[1]}, ${mistura[2]})`;
}

function hexParaRgb(valor: string): [number, number, number] {
  const rgb = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(valor.trim());
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  let hex = valor.trim().replace('#', '');
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  return [
    parseInt(hex.slice(0, 2), 16) || 0,
    parseInt(hex.slice(2, 4), 16) || 0,
    parseInt(hex.slice(4, 6), 16) || 0,
  ];
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function comoRede(f: { tensors: Network['tensors']; bonds: Network['bonds'] }): Network {
  return { ...emptyNetwork(), tensors: f.tensors, bonds: f.bonds };
}

const RSVG = (process.env['MOIRA_RSVG'] ?? 'rsvg-convert').split(/\s+/);
const LATEX = (process.env['MOIRA_LATEX'] ?? 'pdflatex').split(/\s+/);
const cor = paletaDoCss();
const traduzir = (k: string) => k.split('.').pop()!;

const CASOS: [string, () => Network][] = [
  ['sanduiche-4', () => comoRede(sandwich({ sites: 4 }))],
  ['mera-16', () => comoRede(mera({ leaves: 16 }))],
];

mkdirSync(DESTINO, { recursive: true });
console.log('\nExportação conferida fora do aplicativo\n');

let falhas = 0;
let pendentes = 0;

for (const [nome, construir] of CASOS) {
  const network = construir();
  const style = computeStyle(network);

  // ── SVG, desenhado pelo librsvg ───────────────────────────────────────────
  const svg = toSvg(network, style, {
    resolveColor: cor,
    translate: traduzir,
    names: displayNames(network),
    legend: buildLegend(network, style),
    title: nome,
  });
  const arquivoSvg = path.join(DESTINO, `${nome}.svg`);
  writeFileSync(arquivoSvg, `${svg}\n`);

  const cru = /var\(--|color-mix\(/.exec(svg);
  if (cru) {
    console.log(`  ✗ ${nome}.svg: sobrou ${cru[0]} sem resolver no arquivo`);
    falhas += 1;
  } else {
    const r = await rodar(RSVG, [
      '-f',
      'png',
      '-o',
      path.join(DESTINO, `${nome}.svg.png`),
      arquivoSvg,
    ]);
    if (r === 'ok') console.log(`  ✓ ${nome}.svg: ${svg.length} bytes, desenhado pelo librsvg`);
    else if (r === 'ausente') {
      console.log(`  · ${nome}.svg: rsvg-convert não está instalado — pendente`);
      pendentes += 1;
    } else {
      console.log(`  ✗ ${nome}.svg: ${r}`);
      falhas += 1;
    }
  }

  // ── TikZ, compilado por pdflatex ──────────────────────────────────────────
  const tex = toTikz(network, style, {
    resolveColor: cor,
    names: displayNames(network),
    title: nome,
  });
  const arquivoTex = path.join(DESTINO, `${nome}.tex`);
  writeFileSync(arquivoTex, `${tex}\n`);

  const r = await rodar(LATEX, [
    '-interaction=nonstopmode',
    '-halt-on-error',
    `-output-directory=${DESTINO}`,
    arquivoTex,
  ]);
  if (r === 'ok') {
    console.log(`  ✓ ${nome}.tex: ${tex.length} bytes, compilado em pdflatex sem edição`);
  } else if (r === 'ausente') {
    console.log(`  · ${nome}.tex: pdflatex não está instalado — pendente`);
    pendentes += 1;
  } else {
    console.log(`  ✗ ${nome}.tex: ${r}`);
    falhas += 1;
  }
}

console.log(
  `\n${falhas === 0 ? 'A exportação abre e compila fora do aplicativo.' : `${falhas} caso(s) falharam.`}` +
    (pendentes > 0 ? ` ${pendentes} pendente(s).` : '') +
    `\nArquivos em ${path.relative(process.cwd(), DESTINO)}\n`,
);
process.exit(falhas === 0 ? 0 : 1);

/** 'ok', 'ausente' quando a ferramenta não existe, ou a mensagem de erro. */
async function rodar(comando: string[], args: string[]): Promise<string> {
  try {
    await executar(comando[0]!, [...comando.slice(1), ...args], { timeout: 120_000 });
    return 'ok';
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    if (/ENOENT/.test(mensagem)) return 'ausente';
    // O pdflatex escreve o motivo no meio de páginas de log; a linha do erro
    // começa com "!" e é a única que interessa.
    const linha = mensagem.split('\n').find((l) => l.startsWith('!'));
    return (linha ?? mensagem.split('\n').slice(0, 2).join(' ')).slice(0, 200);
  }
}
