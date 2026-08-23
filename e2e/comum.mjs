/** Peças comuns aos roteiros de aceite.
 *
 *  Os aceites de marco rodam em navegador porque os erros que mais importam
 *  nesta aplicação não aparecem em teste de unidade: a captura de ponteiro que
 *  redirecionava o duplo clique, o alvo de um gesto, a cor que o CSS de fato
 *  computou. Ver §14 da especificação. */

import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

export const URL_BASE = process.env['MOIRA_URL'] ?? 'http://localhost:5173';

/** Chaves que a aplicação escreve; o roteiro começa sempre do zero. */
const CHAVES = ['moira:sessao', 'moira:vista', 'moira:idioma', 'moira:tema'];

export async function servidorNoAr(url = URL_BASE) {
  try {
    const resposta = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return resposta.ok;
  } catch {
    return false;
  }
}

/** Tenta o Chromium que o Playwright baixa e, se ele não estiver instalado,
 *  o Chrome do sistema. Sem isto o roteiro falha por motivo errado. */
export async function abrirNavegador() {
  try {
    return await chromium.launch();
  } catch (primeiro) {
    try {
      return await chromium.launch({ channel: 'chrome' });
    } catch {
      throw new Error(
        `Nenhum navegador disponível. Rode \`npx playwright install chromium\`.\n${primeiro.message}`,
      );
    }
  }
}

/** Página limpa: sem sessão anterior, com os erros de console recolhidos. */
export async function abrirPagina(navegador, { largura = 1440, altura = 900 } = {}) {
  const page = await navegador.newPage({ viewport: { width: largura, height: altura } });
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && erros.push(m.text()));

  await page.goto(URL_BASE);
  await page.waitForSelector('.surface');
  await page.evaluate((chaves) => chaves.forEach((c) => localStorage.removeItem(c)), CHAVES);
  await page.reload();
  await page.waitForSelector('.surface');
  return { page, erros };
}

/** Página com uma sessão injetada antes do carregamento. Escrever no
 *  localStorage de uma página já aberta não serve: a descarga do `pagehide`
 *  sobrescreve o que foi injetado. */
export async function abrirPaginaCom(navegador, rede, { largura = 1200, altura = 700 } = {}) {
  const page = await navegador.newPage({ viewport: { width: largura, height: altura } });
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && erros.push(m.text()));

  await page.addInitScript(
    ([chave, valor]) => localStorage.setItem(chave, valor),
    ['moira:sessao', JSON.stringify(rede)],
  );
  await page.goto(URL_BASE);
  await page.waitForSelector('.surface');
  return { page, erros };
}

/** Os três números do painel: tensores, vínculos, pernas livres. */
export async function contadores(page) {
  return (await page.locator('.status dd').allTextContents()).map(Number);
}

/** A rede como o programa a gravou. */
export async function sessao(page) {
  const texto = await page.evaluate(() => localStorage.getItem('moira:sessao'));
  return texto ? JSON.parse(texto) : null;
}

/** Assinatura dos vínculos: o par de pernas de cada um, em ordem estável.
 *  É o que diz se um vínculo se rompeu ou se ligou noutro lugar. */
export async function assinaturaDosVinculos(page) {
  const rede = await sessao(page);
  return (rede?.bonds ?? []).map((b) => [b.a, b.b].sort().join('~')).sort();
}

/** Abre uma seção do painel de geradores sem fechá-la caso já esteja aberta. */
export async function abrirGerador(page, nome) {
  const botao = page.getByRole('button', { name: nome, exact: true });
  if ((await botao.getAttribute('aria-expanded')) !== 'true') await botao.click();
  return botao;
}

export async function gerar(page, nome, valores = {}) {
  await abrirGerador(page, nome);
  for (const [rotulo, valor] of Object.entries(valores)) {
    await page.locator('li.open label', { hasText: rotulo }).locator('input').fill(String(valor));
  }
  await page.getByRole('button', { name: 'Inserir', exact: true }).click();
  await page.waitForTimeout(400);
}

/** Centro de um elemento, em coordenadas de página. */
export async function centroDe(page, seletor) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, seletor);
}

export async function arrastar(page, de, ate, passos = 14) {
  await page.mouse.move(de.x, de.y);
  await page.mouse.down();
  await page.mouse.move(ate.x, ate.y, { steps: passos });
  await page.mouse.up();
  await page.waitForTimeout(300);
}

/** Relatório de um roteiro: cada verificação imprime uma linha, e o conjunto
 *  decide o código de saída. Falhar cedo esconderia as outras verificações. */
export class Relatorio {
  constructor(marco) {
    this.marco = marco;
    this.falhas = 0;
    this.total = 0;
  }

  confere(rotulo, condicao, detalhe) {
    this.total += 1;
    const passou = Boolean(condicao);
    if (!passou) this.falhas += 1;
    const sufixo = detalhe === undefined ? '' : `  ${formatar(detalhe)}`;
    console.log(`  ${passou ? '✓' : '✗'} ${rotulo}${sufixo}`);
    return passou;
  }

  semErros(erros) {
    return this.confere('sem erro de console', erros.length === 0, erros.length ? erros : undefined);
  }

  get passou() {
    return this.falhas === 0;
  }

  encerrar() {
    const veredito = this.passou ? 'passou' : `FALHOU (${this.falhas} de ${this.total})`;
    console.log(`  ${this.marco}: ${veredito}\n`);
    return this.passou;
  }
}

function formatar(valor) {
  if (typeof valor === 'string') return valor;
  return JSON.stringify(valor);
}

/** Verdadeiro quando o módulo foi chamado direto na linha de comando, e não
 *  importado pelo executor. */
export function ehEntrada(metaUrl) {
  return process.argv[1] !== undefined && metaUrl === pathToFileURL(process.argv[1]).href;
}

/** Permite rodar um roteiro isolado: `node e2e/m1-mera-e-gestos.mjs`. */
export async function rodarSozinho(executar) {
  if (!(await servidorNoAr())) {
    console.error(`Servidor fora do ar em ${URL_BASE}. Rode \`npm run dev\` noutro terminal.`);
    process.exit(2);
  }
  const navegador = await abrirNavegador();
  try {
    const relatorio = await executar(navegador);
    process.exit(relatorio.encerrar() ? 0 : 1);
  } finally {
    await navegador.close();
  }
}
