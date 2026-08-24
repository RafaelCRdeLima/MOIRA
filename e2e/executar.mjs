/** Roda os aceites de marco contra o servidor de desenvolvimento.
 *
 *  Fora do `npm test` de propósito: o `vitest` é rápido e roda sempre; isto
 *  aqui é ritual de fechamento de marco. Ver §14 da especificação. */

import { abrirNavegador, servidorNoAr, URL_BASE } from './comum.mjs';
import { executar as m0 } from './m0-persistencia.mjs';
import { executar as m1 } from './m1-mera-e-gestos.mjs';
import { executar as m2 } from './m2-cor.mjs';
import { executar as m3a } from './m3a-formula.mjs';
import { executar as m3b } from './m3b-contracao.mjs';
import { executar as m4 } from './m4-exportacao.mjs';

const ROTEIROS = [
  ['m0', m0],
  ['m1', m1],
  ['m2', m2],
  ['m3a', m3a],
  ['m3b', m3b],
  ['m4', m4],
];

const pedidos = process.argv.slice(2);
const escolhidos = pedidos.length > 0 ? ROTEIROS.filter(([nome]) => pedidos.includes(nome)) : ROTEIROS;

if (escolhidos.length === 0) {
  console.error(`Nenhum roteiro chamado ${pedidos.join(', ')}. Disponíveis: ${ROTEIROS.map(([n]) => n).join(', ')}.`);
  process.exit(2);
}

if (!(await servidorNoAr())) {
  console.error(
    `\nServidor fora do ar em ${URL_BASE}.\n` +
      `Rode \`npm run dev\` noutro terminal, ou aponte para outro endereço com MOIRA_URL.\n`,
  );
  process.exit(2);
}

console.log(`\nAceites de marco em ${URL_BASE}\n`);

const navegador = await abrirNavegador();
const falharam = [];
try {
  for (const [nome, executar] of escolhidos) {
    const relatorio = await executar(navegador);
    if (!relatorio.encerrar()) falharam.push(nome);
  }
} finally {
  await navegador.close();
}

if (falharam.length > 0) {
  console.error(`Marcos com falha: ${falharam.join(', ')}\n`);
  process.exit(1);
}
console.log('Todos os aceites passaram.\n');
