/** Aceite do M4, exportação: o SVG do sanduíche de 4 sítios sai do aplicativo
 *  com as cores resolvidas, os textos como texto, e abre no navegador. */

import { abrirPagina, ehEntrada, gerar, Relatorio, rodarSozinho } from './comum.mjs';

/** Intercepta o download e devolve o conteúdo, sem escrever em disco. */
async function baixar(page, acionar) {
  const espera = page.waitForEvent('download');
  await acionar();
  const download = await espera;
  const fluxo = await download.createReadStream();
  const pedacos = [];
  for await (const p of fluxo) pedacos.push(p);
  return { nome: download.suggestedFilename(), conteudo: Buffer.concat(pedacos).toString('utf8') };
}

export async function executar(navegador) {
  const relatorio = new Relatorio('M4 — exportação');
  const { page, erros } = await abrirPagina(navegador, { largura: 1500, altura: 940 });

  await gerar(page, 'Sanduíche ⟨ψ|O|ψ⟩', { sítios: 4 });
  await page.locator('.surface').click({ position: { x: 1050, y: 40 } });
  await page.waitForTimeout(400);

  const svg = await baixar(page, () => page.getByRole('button', { name: 'SVG' }).click());

  relatorio.confere('o arquivo sai com nome e extensão', svg.nome.endsWith('.svg'), svg.nome);
  relatorio.confere('é um SVG', svg.conteudo.startsWith('<svg xmlns='));
  relatorio.confere('sem variável de CSS: elas não existem fora do aplicativo', !svg.conteudo.includes('var(--'));
  relatorio.confere('sem grupo vazio', !/<g[^>]*>\s*<\/g>/.test(svg.conteudo));
  relatorio.confere(
    'classes por papel',
    ['moira-bond', 'moira-leg', 'moira-shape', 'moira-name'].every((c) =>
      svg.conteudo.includes(`class="${c}`),
    ),
  );
  relatorio.confere('rótulos como texto, não como caminho', /<text class="moira-name"[^>]*>A1†<\/text>/.test(svg.conteudo));
  relatorio.confere('a legenda vai junto', svg.conteudo.includes('class="moira-legend"'));
  relatorio.confere(
    'a legenda sai traduzida, não em chave',
    svg.conteudo.includes('>por tag<') && !svg.conteudo.includes('>color.tag<'),
  );

  // ── o arquivo abre no navegador e desenha o mesmo que o canvas ───────────
  const pagina = await navegador.newPage({ viewport: { width: 700, height: 700 } });
  const errosSvg = [];
  pagina.on('pageerror', (e) => errosSvg.push(String(e)));
  await pagina.setContent(svg.conteudo);
  await pagina.waitForTimeout(200);

  const contagem = await pagina.evaluate(() => ({
    vinculos: document.querySelectorAll('.moira-bond').length,
    formas: document.querySelectorAll('.moira-shape').length,
    nomes: document.querySelectorAll('.moira-name').length,
    corDoTraco: getComputedStyle(document.querySelector('.moira-bond')).stroke,
  }));
  relatorio.confere(
    'aberto no navegador, tem os 17 vínculos e os 12 tensores do canvas',
    contagem.vinculos === 17 && contagem.formas === 12 && contagem.nomes === 12,
    contagem,
  );
  relatorio.confere(
    'e o traço sai na tinta concreta, não numa variável vazia',
    contagem.corDoTraco === 'rgb(27, 36, 48)',
    contagem.corDoTraco,
  );
  await pagina.close();

  // ── modo escuro: o arquivo segue o tema da tela ─────────────────────────
  await page.locator('header select').first().selectOption('dark');
  await page.waitForTimeout(300);
  const escuro = await baixar(page, () => page.getByRole('button', { name: 'SVG' }).click());
  relatorio.confere(
    'no modo escuro, o arquivo sai com a tinta clara',
    escuro.conteudo.includes('rgb(242, 240, 236)') && !escuro.conteudo.includes('rgb(27, 36, 48)'),
  );
  relatorio.confere(
    'e sempre em cor concreta: nem var() nem color-mix, que renderizador antigo não lê',
    !/var\(--|color-mix\(/.test(escuro.conteudo) && !/var\(--|color-mix\(/.test(svg.conteudo),
  );
  await page.locator('header select').first().selectOption('light');

  relatorio.semErros([...erros, ...errosSvg]);
  await page.close();
  return relatorio;
}

if (ehEntrada(import.meta.url)) await rodarSozinho(executar);
