/** Aceite do M0: montar à mão uma cadeia de 5 tensores, recarregar a página e
 *  reencontrá-la. */

import { abrirPagina, contadores, ehEntrada, Relatorio, rodarSozinho } from './comum.mjs';

const RAIO = 12; // raio da forma circular
const PERNA = 26; // comprimento da perna gerada
const PONTA = RAIO + PERNA;

/** Ângulo da i-ésima perna de um tensor criado com três pernas. */
const direcao = (i, n = 3) => (i / n) * 2 * Math.PI;

export async function executar(navegador) {
  const relatorio = new Relatorio('M0 — persistência');
  const { page, erros } = await abrirPagina(navegador);

  const caixa = await page.locator('.surface').boundingBox();
  const em = (x, y) => ({ x: caixa.x + x, y: caixa.y + y });
  const ponta = (cx, cy, i) =>
    em(cx + Math.cos(direcao(i)) * PONTA, cy + Math.sin(direcao(i)) * PONTA);

  const xs = [140, 300, 460, 620, 780];
  const y = 380;
  for (const x of xs) {
    const p = em(x, y);
    await page.mouse.dblclick(p.x, p.y);
  }

  // Cadeia: perna 0 (à direita) de cada tensor na perna 2 (acima e à esquerda)
  // do seguinte.
  for (let i = 0; i < xs.length - 1; i++) {
    const a = ponta(xs[i], y, 0);
    const b = ponta(xs[i + 1], y, 2);
    await page.mouse.click(a.x, a.y);
    await page.mouse.click(b.x, b.y);
  }

  const antes = await contadores(page);
  relatorio.confere('cadeia de 5 montada à mão', antes[0] === 5 && antes[1] === 4, antes);

  await page.waitForTimeout(400); // deixa a gravação com atraso disparar
  await page.reload();
  await page.waitForSelector('.surface');

  const depois = await contadores(page);
  relatorio.confere(
    'recarregada, a cadeia continua lá',
    depois[0] === 5 && depois[1] === 4 && depois[2] === 7,
    depois,
  );
  relatorio.semErros(erros);

  await page.close();
  return relatorio;
}

if (ehEntrada(import.meta.url)) await rodarSozinho(executar);
