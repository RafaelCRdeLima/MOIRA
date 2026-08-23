/** Aceite do M3a: o sanduíche ⟨ψ|O|ψ⟩ de 4 sítios exibe a fórmula em índices;
 *  mover um tensor não reembaralha as letras de quem ficou parado; a MERA de
 *  16 folhas sai sem índice repetido três vezes nem livre duplicado. */

import {
  abrirPagina,
  arrastar,
  centroDe,
  ehEntrada,
  gerar,
  Relatorio,
  rodarSozinho,
} from './comum.mjs';

/** O KaTeX guarda a fonte LaTeX numa anotação MathML — é de lá que sai o que
 *  foi realmente composto, e não o texto desenhado. */
async function latexNaTela(page) {
  return page.evaluate(
    () => document.querySelector('.expressao annotation[encoding="application/x-tex"]')?.textContent ?? '',
  );
}

/** Conta quantas vezes cada índice aparece nos fatores, ignorando o somatório.
 *  Os subscritos têm chaves aninhadas (`_{\alpha_{1} \beta}`), então a
 *  extração casa as chaves em vez de confiar em expressão regular. */
function contarIndices(latex) {
  const produto = semSomatorio(latex);
  const contagem = new Map();
  for (const fator of produto.split('\\,')) {
    const grupo = subscritoFinal(fator);
    if (grupo === null) continue;
    for (const simbolo of dividirIndices(grupo)) {
      contagem.set(simbolo, (contagem.get(simbolo) ?? 0) + 1);
    }
  }
  return contagem;
}

/** Corta o `\\sum_{...}` da frente casando as chaves. Cortar no primeiro `} `
 *  não serve: a lista de mudos tem `\\alpha_{1} `, e o corte cairia no meio dela. */
function semSomatorio(latex) {
  const inicio = latex.indexOf('\\sum_{');
  if (inicio === -1) return latex;
  let profundidade = 0;
  for (let i = inicio + 5; i < latex.length; i++) {
    if (latex[i] === '{') profundidade += 1;
    else if (latex[i] === '}') {
      profundidade -= 1;
      if (profundidade === 0) return latex.slice(i + 1).trim();
    }
  }
  return latex;
}

/** O grupo `{...}` do primeiro `_` que esteja fora de qualquer chave. Procurar
 *  o último não serve: `\\gamma_{1}` tem um `_{` dentro do próprio subscrito. */
function subscritoFinal(fator) {
  let profundidade = 0;
  for (let i = 0; i < fator.length; i++) {
    const c = fator[i];
    if (c === '{') profundidade += 1;
    else if (c === '}') profundidade -= 1;
    else if (c === '_' && profundidade === 0 && fator[i + 1] === '{') {
      let d = 0;
      for (let j = i + 1; j < fator.length; j++) {
        if (fator[j] === '{') d += 1;
        else if (fator[j] === '}') {
          d -= 1;
          if (d === 0) return fator.slice(i + 2, j);
        }
      }
    }
  }
  return null;
}

/** Separa por espaço de topo: `\alpha_{1} \beta` dá dois índices, não três. */
function dividirIndices(grupo) {
  const indices = [];
  let atual = '';
  let profundidade = 0;
  for (const c of grupo) {
    if (c === '{') profundidade += 1;
    if (c === '}') profundidade -= 1;
    if (c === ' ' && profundidade === 0) {
      if (atual) indices.push(atual);
      atual = '';
    } else {
      atual += c;
    }
  }
  if (atual) indices.push(atual);
  return indices;
}

export async function executar(navegador) {
  const relatorio = new Relatorio('M3a — fórmula em índices');
  const { page, erros } = await abrirPagina(navegador);

  // ── sanduíche de 4 sítios ────────────────────────────────────────────────
  await gerar(page, 'Sanduíche ⟨ψ|O|ψ⟩', { sítios: 4 });
  await page.waitForTimeout(300);

  const latex = await latexNaTela(page);
  relatorio.confere('a faixa compõe a fórmula do sanduíche', latex.startsWith('M = \\sum'));
  relatorio.confere(
    'lado esquerdo escalar: a rede não tem perna livre',
    !latex.startsWith('M_{'),
    latex.slice(0, 12),
  );
  relatorio.confere(
    'ordem dos fatores: bra em cima, operador, ket — ∑ A† W A',
    /A\^\{\[1\]\\dagger\}.*W\^\{\[1\]\}.*A\^\{\[1\]\}_/s.test(latex),
  );

  const contagem = contarIndices(latex);
  relatorio.confere(
    'todo índice do sanduíche aparece exatamente duas vezes',
    [...contagem.values()].every((n) => n === 2),
    [...contagem.entries()].filter(([, n]) => n !== 2),
  );

  // ── estabilidade das letras ──────────────────────────────────────────────
  // A rede recém-gerada vem inteira selecionada, e arrastar um tensor de dentro
  // de uma seleção move o bloco todo — o que não mudaria ordem nenhuma.
  await page.locator('.surface').click({ position: { x: 40, y: 640 } });
  const alvo = await centroDe(page, '.moira-tensor:nth-child(3) .moira-body');
  await arrastar(page, alvo, { x: alvo.x - 260, y: alvo.y + 40 }, 16);
  const depois = await latexNaTela(page);

  const letras = (s) => new Set([...contarIndices(s).keys()]);
  relatorio.confere(
    'mover um tensor não reembaralha as letras',
    JSON.stringify([...letras(latex)].sort()) === JSON.stringify([...letras(depois)].sort()),
  );
  relatorio.confere('mas a fórmula acompanha o canvas', depois !== latex);

  // ── convenção de Einstein ────────────────────────────────────────────────
  await page.getByRole('radio', { name: 'Einstein' }).click();
  await page.waitForTimeout(200);
  const einstein = await latexNaTela(page);
  relatorio.confere('Einstein some com o somatório', !einstein.includes('\\sum'));
  await page.getByRole('radio', { name: 'Σ explícito' }).click();

  // ── asterisco no lugar da daga ───────────────────────────────────────────
  await page.getByRole('radio', { name: '∗' }).click();
  await page.waitForTimeout(200);
  const asterisco = await latexNaTela(page);
  relatorio.confere(
    'a marca de conjugação troca para asterisco',
    asterisco.includes('^{[1]*}') && !asterisco.includes('\\dagger'),
  );
  await page.getByRole('radio', { name: '†' }).click();

  await page.close();

  // ── MERA de 16 folhas ────────────────────────────────────────────────────
  const mera = await abrirPagina(navegador);
  await gerar(mera.page, 'MERA binária', { folhas: 16 });
  await mera.page.waitForTimeout(400);

  const latexMera = await latexNaTela(mera.page);
  const contagemMera = contarIndices(latexMera);
  const somados = [...contagemMera.entries()].filter(([, n]) => n === 2);
  const livres = [...contagemMera.entries()].filter(([, n]) => n === 1);
  relatorio.confere(
    'MERA de 16 folhas: nenhum índice três vezes',
    [...contagemMera.values()].every((n) => n <= 2),
    [...contagemMera.entries()].filter(([, n]) => n > 2),
  );
  relatorio.confere(
    'e 17 livres contra 36 somados',
    livres.length === 17 && somados.length === 36,
    `${livres.length} livres, ${somados.length} somados`,
  );

  relatorio.semErros([...erros, ...mera.erros]);
  await mera.page.close();
  return relatorio;
}

if (ehEntrada(import.meta.url)) await rodarSozinho(executar);
