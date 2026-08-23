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
  return page.evaluate(() =>
    [...document.querySelectorAll('.expressao annotation[encoding="application/x-tex"]')]
      .map((a) => a.textContent)
      .join(' '),
  );
}

/** O LaTeX de cada fator, direto do pedaço que a faixa compôs para ele. */
async function fatoresNaTela(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('.fator annotation[encoding="application/x-tex"]')].map(
      (a) => a.textContent,
    ),
  );
}

/** Conta quantas vezes cada índice aparece nos fatores. Os subscritos têm
 *  chaves aninhadas (`_{\alpha_{1} \beta}`), então a extração casa as chaves
 *  em vez de confiar em expressão regular. */
function contarIndices(fatores) {
  const contagem = new Map();
  for (const fator of fatores) {
    const grupo = subscritoFinal(fator);
    if (grupo === null) continue;
    for (const simbolo of dividirIndices(grupo)) {
      contagem.set(simbolo, (contagem.get(simbolo) ?? 0) + 1);
    }
  }
  return contagem;
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

  const contagem = contarIndices(await fatoresNaTela(page));
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

  const letrasAntes = [...contagem.keys()].sort();
  const letrasDepois = [...contarIndices(await fatoresNaTela(page)).keys()].sort();
  relatorio.confere(
    'mover um tensor não reembaralha as letras',
    JSON.stringify(letrasAntes) === JSON.stringify(letrasDepois),
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

  const contagemMera = contarIndices(await fatoresNaTela(mera.page));
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

  await conferirLigacaoComOCanvas(navegador, relatorio);
  return relatorio;
}

/** A faixa só é conferível se der para casar fator com nó. Duas coisas provam
 *  isso: todo tensor aparece nomeado no canvas, e o realce vai de um lado ao
 *  outro. */
async function conferirLigacaoComOCanvas(navegador, relatorio) {
  const { page, erros } = await abrirPagina(navegador);

  // Dois tensores criados à mão, sem nome nenhum — o caso que motivou isto.
  const caixa = await page.locator('.surface').boundingBox();
  await page.mouse.dblclick(caixa.x + 380, caixa.y + 220);
  await page.mouse.dblclick(caixa.x + 620, caixa.y + 300);
  await page.waitForTimeout(300);

  const nomes = await page.evaluate(() =>
    [...document.querySelectorAll('.moira-name')].map((t) => t.textContent.trim()),
  );
  relatorio.confere(
    'tensor sem nome aparece nomeado no canvas',
    nomes.length === 2 && nomes.every(Boolean),
    nomes,
  );

  const naFormula = await page.evaluate(() =>
    [...document.querySelectorAll('.fator')].map((f) => f.getAttribute('aria-label')),
  );
  relatorio.confere(
    'e com o mesmo nome que a fórmula usa',
    JSON.stringify([...nomes].sort()) === JSON.stringify([...naFormula].sort()),
    { canvas: nomes, formula: naFormula },
  );

  // Cursor sobre o fator realça o nó.
  await page.locator('.fator').first().hover();
  await page.waitForTimeout(120);
  relatorio.confere(
    'cursor no fator realça o nó no diagrama',
    (await page.locator('.moira-body.hovered').count()) === 1,
  );

  // Cursor sobre o nó realça o fator.
  await page.locator('.surface').hover({ position: { x: 10, y: 10 } });
  await page.locator('.moira-body').first().hover();
  await page.waitForTimeout(120);
  relatorio.confere(
    'e cursor no nó realça o fator na faixa',
    (await page.locator('.fator.realcado').count()) === 1,
  );

  // Legenda de uma entrada só, "sem tag", não aparece.
  relatorio.confere(
    'legenda com só "sem tag" não é desenhada',
    (await page.locator('.moira-legend').count()) === 0,
  );

  relatorio.semErros(erros);
  await page.close();
}

if (ehEntrada(import.meta.url)) await rodarSozinho(executar);
