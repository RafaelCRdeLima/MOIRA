/** Aceite do M3b: ordem de contração, custo, os quatro dialetos e o painel de
 *  validação, verificados na interface. A matemática já é verificada no
 *  `vitest` contra a força bruta (§14.1, camada A); aqui se confere que ela
 *  chega à tela. */

import {
  abrirPagina,
  centroDe,
  ehEntrada,
  gerar,
  Relatorio,
  rodarSozinho,
} from './comum.mjs';

const codigoNaTela = (page) => page.locator('.codigo').textContent();

export async function executar(navegador) {
  const relatorio = new Relatorio('M3b — contração e código');
  const { page, erros } = await abrirPagina(navegador, { largura: 1500, altura: 940 });

  await gerar(page, 'Sanduíche ⟨ψ|O|ψ⟩', { sítios: 4 });
  await page.locator('.surface').click({ position: { x: 1050, y: 40 } });
  await page.waitForTimeout(400);

  // ── custo ────────────────────────────────────────────────────────────────
  const numeros = await page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll('.gaveta .numeros div')].map((d) => [
        d.querySelector('dt').textContent.trim(),
        d.querySelector('dd').textContent.trim(),
      ]),
    ),
  );
  relatorio.confere('o painel mostra operações, escalonamento e intermediário', 
    Boolean(numeros['operações'] && numeros['escalonamento'] && numeros['maior intermediário']),
    numeros);
  relatorio.confere(
    'o escalonamento sai em χ',
    numeros['escalonamento']?.includes('χ'),
    numeros['escalonamento'],
  );
  relatorio.confere(
    'doze tensores passam do limite exaustivo: ordem gulosa',
    numeros['ordem'] === 'gulosa',
    numeros['ordem'],
  );

  // ── os quatro dialetos ───────────────────────────────────────────────────
  const abas = {
    'ncon (MATLAB)': [/R = ncon\(tensores, indices, sequencia\);/, /^%/m],
    'ncon (Julia)': [/using TensorOperations/, /R = ncon\(tensores, indices, sequencia\)/],
    'numpy.einsum': [/np\.einsum\('/, /from opt_einsum import contract/],
    quimb: [/qtn\.TensorNetwork\(\[/, /tags=\('bra', 'mps'\)/],
    ITensor: [/using ITensors/, /= Index\(\d+, "/],
  };
  for (const [aba, padroes] of Object.entries(abas)) {
    await page.getByRole('tab', { name: aba, exact: true }).click();
    await page.waitForTimeout(150);
    const fonte = await codigoNaTela(page);
    relatorio.confere(`${aba}: gera código do dialeto`, padroes.every((r) => r.test(fonte)));
    relatorio.confere(`${aba}: traz o custo no cabeçalho`, /Estimated cost/.test(fonte));
  }

  // ── ordem fixada à mão, comparada com a automática ───────────────────────
  await page.getByRole('button', { name: 'Fixar a ordem à mão' }).click();
  const campo = page.locator('.ordem input:not([type=checkbox])');
  const automatica = (await codigoNaTela(page)).match(/Estimated cost: ([^ ]+)/)[1];

  const nomes = (await campo.inputValue()).split(/\s+/);
  await campo.fill([...nomes].reverse().join(' '));
  await page.waitForTimeout(300);
  const comparacao = await page.locator('.comparacao').textContent();
  relatorio.confere(
    'a ordem fixada aparece comparada com a automática',
    comparacao.includes('×'),
    comparacao.trim(),
  );

  const fixada = (await codigoNaTela(page)).match(/Contraction order: ([^.]+)/)[1];
  relatorio.confere('e o código passa a usá-la', fixada === 'fixed by hand', fixada);

  await page.getByRole('button', { name: 'Voltar à automática' }).click();
  await page.waitForTimeout(250);
  relatorio.confere(
    'voltar à automática restaura o custo de antes',
    (await codigoNaTela(page)).includes(`Estimated cost: ${automatica}`),
  );

  await page.close();

  // ── validação ────────────────────────────────────────────────────────────
  const aviso = await abrirPagina(navegador, { largura: 1400, altura: 900 });
  await conferirValidacao(aviso.page, relatorio);
  relatorio.semErros([...erros, ...aviso.erros]);
  await aviso.page.close();

  return relatorio;
}

async function conferirValidacao(page, relatorio) {
  await gerar(page, 'MPS', { sítios: 4 });
  await page.locator('.surface').click({ position: { x: 1000, y: 40 } });
  await page.waitForTimeout(300);
  relatorio.confere('rede limpa não mostra aviso', (await page.locator('.avisos').count()) === 0);

  // Tensor solto: aviso, mas o código continua saindo. A gaveta encurtou o
  // canvas, então o ponto sai da caixa do próprio canvas, não da página.
  const caixa = await page.locator('.surface').boundingBox();
  await page.mouse.dblclick(caixa.x + 120, caixa.y + 80);
  await page.waitForTimeout(500);
  const textoAviso = await page.locator('.avisos li').first().textContent();
  relatorio.confere(
    'tensor isolado gera aviso não bloqueante',
    textoAviso.includes('não tem vínculo'),
    textoAviso.trim(),
  );
  relatorio.confere('e o código continua sendo gerado', (await page.locator('.codigo').count()) === 1);

  // Dimensões incompatíveis: bloqueiam.
  const corpo = await centroDe(page, '.moira-body');
  await page.mouse.dblclick(corpo.x, corpo.y);
  await page.waitForTimeout(250);
  await page.locator('.inspector td input.num').first().fill('7');
  await page.waitForTimeout(400);

  const bloqueio = await page.locator('.avisos li.bloqueio').count();
  relatorio.confere('dimensões incompatíveis entram como bloqueio', bloqueio >= 1);
  relatorio.confere(
    'e o painel mostra o motivo em vez de gerar código quebrado',
    (await page.locator('.codigo').count()) === 0 &&
      (await page.locator('.bloqueado').textContent()).includes('Dimensões incompatíveis'),
  );
}

if (ehEntrada(import.meta.url)) await rodarSozinho(executar);
