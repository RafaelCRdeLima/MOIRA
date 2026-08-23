/** Aceite do M1: gerar uma MERA binária de 16 folhas num clique e reposicionar
 *  um ramo inteiro sem quebrar vínculos. Junto, os gestos finos do marco —
 *  ponta de perna, curvatura, grade, inspetor, desfazer, copiar e colar. */

import {
  abrirPagina,
  arrastar,
  assinaturaDosVinculos,
  centroDe,
  contadores,
  ehEntrada,
  gerar,
  Relatorio,
  rodarSozinho,
  sessao,
} from './comum.mjs';

export async function executar(navegador) {
  const relatorio = new Relatorio('M1 — MERA e gestos');
  const { page, erros } = await abrirPagina(navegador);

  // ── um clique: MERA binária de 16 folhas ─────────────────────────────────
  await gerar(page, 'MERA binária', { folhas: 16 });

  const geradas = await contadores(page);
  relatorio.confere(
    'MERA de 16 folhas: 26 tensores, 36 vínculos, 17 pernas livres',
    geradas[0] === 26 && geradas[1] === 36 && geradas[2] === 17,
    geradas,
  );

  // ── reposicionar um ramo inteiro ─────────────────────────────────────────
  const antesDoArrasto = await assinaturaDosVinculos(page);
  const caixa = await page.locator('.surface').boundingBox();
  const em = (x, y) => ({ x: caixa.x + x, y: caixa.y + y });

  await page.keyboard.down('Shift');
  await arrastar(
    page,
    em(caixa.width * 0.06, caixa.height * 0.45),
    em(caixa.width * 0.32, caixa.height * 0.99),
    12,
  );
  await page.keyboard.up('Shift');

  const selecionados = await page.evaluate(
    () => document.querySelectorAll('.moira-tensor.selected').length,
  );
  relatorio.confere(
    'retângulo com Shift seleciona um ramo, não a rede toda',
    selecionados > 2 && selecionados < 26,
    `${selecionados} tensores`,
  );

  const alvo = await centroDe(page, '.moira-tensor.selected .moira-body');
  await arrastar(page, alvo, { x: alvo.x - 170, y: alvo.y + 130 }, 18);

  const depoisDoArrasto = await contadores(page);
  const vinculosDepois = await assinaturaDosVinculos(page);
  relatorio.confere(
    'ramo reposicionado sem quebrar vínculo',
    JSON.stringify(antesDoArrasto) === JSON.stringify(vinculosDepois) &&
      depoisDoArrasto[1] === 36 &&
      depoisDoArrasto[2] === 17,
    depoisDoArrasto,
  );

  // ── desfazer, refazer, copiar e colar ────────────────────────────────────
  await page.locator('.surface').click({ position: { x: caixa.width * 0.9, y: 30 } });
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(250);
  const aposDesfazer = await contadores(page);
  await page.keyboard.press('Control+Shift+z');
  await page.waitForTimeout(250);
  const aposRefazer = await contadores(page);
  relatorio.confere(
    'desfazer e refazer preservam a rede',
    aposDesfazer[0] === 26 && aposRefazer[0] === 26,
    [aposDesfazer[0], aposRefazer[0]],
  );

  await page.keyboard.press('Control+a');
  await page.keyboard.press('Control+c');
  await page.keyboard.press('Control+v');
  await page.waitForTimeout(400);
  const aposColar = await contadores(page);
  relatorio.confere(
    'copiar e colar duplicam a rede sem colidir ids',
    aposColar[0] === 52 && aposColar[1] === 72,
    aposColar,
  );

  // ── idioma ───────────────────────────────────────────────────────────────
  await page.locator('header select').last().selectOption('en');
  const rotulo = await page.locator('.status dt').first().textContent();
  relatorio.confere('troca de idioma sem recarregar', rotulo === 'tensors', rotulo);
  await page.locator('header select').last().selectOption('pt');

  await page.close();

  // ── gestos finos, numa página limpa ──────────────────────────────────────
  const gestos = await abrirPagina(navegador);
  await conferirGestos(gestos.page, relatorio);
  relatorio.semErros([...erros, ...gestos.erros]);
  await gestos.page.close();

  return relatorio;
}

async function conferirGestos(page, relatorio) {
  await gerar(page, 'MPS', { sítios: 4 });

  // ── arrastar a ponta de uma perna livre ──────────────────────────────────
  const antes = await sessao(page);
  const pontaDaPerna = await centroDe(page, '.leg-hit');
  await arrastar(page, pontaDaPerna, { x: pontaDaPerna.x + 60, y: pontaDaPerna.y + 40 });
  const depois = await sessao(page);

  relatorio.confere(
    'arrastar a ponta muda ângulo e comprimento',
    JSON.stringify(antes.tensors) !== JSON.stringify(depois.tensors),
  );
  relatorio.confere(
    'e não mexe em vínculo nenhum',
    JSON.stringify(antes.bonds.map((b) => [b.a, b.b])) ===
      JSON.stringify(depois.bonds.map((b) => [b.a, b.b])),
  );

  // ── curvar um vínculo pela alça do meio ──────────────────────────────────
  const alca = await centroDe(page, '.bond-handle');
  await arrastar(page, alca, { x: alca.x, y: alca.y - 70 });
  const curvaturas = (await sessao(page)).bonds.map((b) => b.curvature);
  relatorio.confere(
    'alça do meio curva o vínculo',
    curvaturas.some((c) => Math.abs(c) > 0.05),
    curvaturas,
  );

  // ── grade com encaixe ────────────────────────────────────────────────────
  await page.getByLabel('Grade com encaixe').check();
  const corpo = await centroDe(page, '.moira-body');
  await arrastar(page, corpo, { x: corpo.x + 97, y: corpo.y + 53 });
  const posicoes = (await sessao(page)).tensors.map((t) => [t.x, t.y]);
  relatorio.confere(
    'com a grade ligada, o tensor encaixa',
    posicoes.every(([x, y]) => x % 24 === 0 && y % 24 === 0),
    posicoes,
  );

  // ── inspetor por duplo clique ────────────────────────────────────────────
  const ondeParou = await centroDe(page, '.moira-body');
  await page.mouse.dblclick(ondeParou.x, ondeParou.y);
  await page.waitForTimeout(200);
  relatorio.confere('duplo clique num tensor abre o inspetor', await page.locator('.inspector').isVisible());

  await page.locator('.inspector .row input').first().fill('Γ');
  await page.locator('.inspector select').first().selectOption('triangle');
  await page.waitForTimeout(300);
  const inspecionado = (await sessao(page)).tensors.find((t) => t.name === 'Γ');
  relatorio.confere(
    'o inspetor renomeia e troca a forma',
    inspecionado?.shape === 'triangle',
    inspecionado?.shape,
  );

  await page.locator('.surface').click({ position: { x: 40, y: 20 } });
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(300);
  const revertido = (await sessao(page)).tensors.find((t) => t.name === 'Γ');
  relatorio.confere('dois desfazer revertem nome e forma', revertido === undefined);
}

if (ehEntrada(import.meta.url)) await rodarSozinho(executar);
