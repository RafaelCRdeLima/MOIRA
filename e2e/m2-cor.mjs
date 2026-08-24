/** Aceite do M2: alternar os cinco modos de cor sem recarregar, e uma figura
 *  que aguente comparação com uma do quimb — espessura por dimensão, legenda
 *  automática, modo escuro e arestas coloridas por valor. */

import {
  abrirPagina,
  abrirPaginaCom,
  contadores,
  ehEntrada,
  gerar,
  Relatorio,
  rodarSozinho,
  sessao,
} from './comum.mjs';

const MODOS = {
  tag: 'por tag',
  role: 'por papel',
  layer: 'por camada',
  degree: 'por grau',
  manual: 'manual',
};

export async function executar(navegador) {
  const relatorio = new Relatorio('M2 — linguagem visual');
  const { page, erros } = await abrirPagina(navegador);

  // O sanduíche traz três tags, duas formas e tensores conjugados: é a rede
  // que exercita mais coisa da linguagem visual de uma vez.
  await gerar(page, 'Sanduíche ⟨ψ|O|ψ⟩', { sítios: 6 });
  await page.locator('.surface').click({ position: { x: 700, y: 60 } });

  const gerada = await contadores(page);
  relatorio.confere(
    'sanduíche de 6 sítios contrai para escalar: nenhuma perna livre',
    gerada[0] === 18 && gerada[2] === 0,
    gerada,
  );

  // ── os cinco modos ───────────────────────────────────────────────────────
  const pinturas = {};
  for (const [modo, rotulo] of Object.entries(MODOS)) {
    await page.getByRole('radio', { name: rotulo, exact: true }).click();
    await page.waitForTimeout(180);
    pinturas[modo] = JSON.stringify(
      await page.evaluate(() =>
        [...document.querySelectorAll('.moira-shape')].map((el) => getComputedStyle(el).fill),
      ),
    );
  }
  const distintas = new Set(Object.values(pinturas)).size;
  relatorio.confere(
    'os cinco modos pintam de maneira distinta, sem recarregar',
    distintas === 5,
    `${distintas} pinturas distintas`,
  );

  // ── espessura por dimensão ───────────────────────────────────────────────
  await page.getByRole('radio', { name: MODOS.tag, exact: true }).click();
  await page.waitForTimeout(180);
  const larguras = await page.evaluate(() =>
    [...document.querySelectorAll('.moira-bond')].map((el) =>
      Number(getComputedStyle(el).strokeWidth.replace('px', '')),
    ),
  );
  relatorio.confere(
    'a aresta de χ=16 é mais grossa que a de d=2',
    Math.max(...larguras) > Math.min(...larguras),
    [...new Set(larguras)].sort((a, b) => a - b),
  );

  // ── legenda ──────────────────────────────────────────────────────────────
  const amostras = await page.locator('.moira-legend rect').count();
  relatorio.confere('legenda automática lista as tags presentes', amostras >= 3, `${amostras} amostras`);

  await page.getByLabel('legenda', { exact: true }).uncheck();
  await page.waitForTimeout(180);
  relatorio.confere('e desliga', (await page.locator('.moira-legend').count()) === 0);
  await page.getByLabel('legenda', { exact: true }).check();

  // ── modo escuro ──────────────────────────────────────────────────────────
  await page.locator('header select').first().selectOption('dark');
  await page.waitForTimeout(250);
  const tema = await page.evaluate(() => document.documentElement.dataset.theme);
  const fundo = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  relatorio.confere(
    'modo escuro aplica o segundo par de paletas',
    tema === 'dark' && fundo === 'rgb(18, 24, 33)',
    fundo,
  );
  await page.locator('header select').first().selectOption('light');

  await page.close();

  // ── arestas coloridas por valor ──────────────────────────────────────────
  const comValores = await conferirArestasPorValor(navegador, relatorio);
  relatorio.semErros([...erros, ...comValores]);

  return relatorio;
}

/** Entropia de emaranhamento com pico no meio da cadeia, como numa MPS crítica.
 *  A sessão é injetada antes do carregamento: escrever no localStorage de uma
 *  página aberta não adianta, a descarga do `pagehide` sobrescreve. */
async function conferirArestasPorValor(navegador, relatorio) {
  const { page } = await abrirPagina(navegador, { largura: 1200, altura: 700 });
  await gerar(page, 'MPS', { sítios: 9 });
  const rede = await sessao(page);
  await page.close();

  const meio = (rede.bonds.length - 1) / 2;
  rede.bonds.forEach((b, i) => {
    b.value = Number((1.45 - 0.19 * Math.abs(i - meio) ** 1.5).toFixed(2));
  });
  rede.edgeColorByValue = true;

  const { page: comValor, erros } = await abrirPaginaCom(navegador, rede);
  await comValor.waitForTimeout(400);

  const cores = await comValor.evaluate(() =>
    [...document.querySelectorAll('.moira-bond')].map((el) => getComputedStyle(el).stroke),
  );
  relatorio.confere(
    'as arestas se colorem pelo valor, numa rampa contínua',
    new Set(cores).size >= 4,
    `${new Set(cores).size} cores em ${cores.length} arestas`,
  );
  relatorio.confere(
    'e a barra de cor do valor aparece na legenda',
    (await comValor.locator('.moira-legend').count()) === 1,
  );

  await comValor.close();
  return erros;
}

if (ehEntrada(import.meta.url)) await rodarSozinho(executar);
