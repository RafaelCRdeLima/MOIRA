/** Aceite da Tarefa 1 do M4: o código gerado roda ao colar, sem edição.
 *
 *  Gera os cinco dialetos para uma rede fixa, grava em `fixtures/gerado/` e
 *  executa os que este ambiente sabe executar. MATLAB e Julia ficam gravados
 *  para conferência à mão — a ausência deles é relatada, não escondida.
 *
 *  Rodar com: npm run verifica-codigo
 */

import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

import { DEFAULT_CODE_OPTIONS, generate, type Dialect } from '../src/lib/codegen/index';
import { buildContractNetwork } from '../src/lib/contract/network';
import { findPath } from '../src/lib/contract/order';
import { assignIndices } from '../src/lib/formula/indices';
import { sandwich } from '../src/lib/generators/index';
import { emptyNetwork } from '../src/lib/model/network';
import { validate } from '../src/lib/validate/checks';

const executar = promisify(execFile);
const DESTINO = path.resolve(import.meta.dirname, 'fixtures/gerado');
const CACHE = path.resolve(import.meta.dirname, '.cache');

/** O `ncon.m` canônico é de terceiros — Pfeifer, Evenbly, Singh & Vidal,
 *  arXiv:1402.0939 — e não vai no repositório. Baixa uma vez para o cache.
 *
 *  Usar o de verdade é o ponto: escrever um `ncon` próprio para testar o
 *  gerador seria comparar o programa com a minha leitura da convenção, que é
 *  exatamente o que deixou passar o erro do `order=` no dialeto de Julia. */
async function buscaNcon(): Promise<boolean> {
  const destino = path.join(CACHE, 'ncon.m');
  if (existsSync(destino)) return true;
  mkdirSync(CACHE, { recursive: true });
  try {
    const resposta = await fetch('https://arxiv.org/src/1402.0939', {
      signal: AbortSignal.timeout(60_000),
    });
    if (!resposta.ok) return false;
    const tgz = path.join(CACHE, 'ncon-src.tar.gz');
    writeFileSync(tgz, Buffer.from(await resposta.arrayBuffer()));
    await executar('tar', ['-xzf', tgz, '-C', CACHE, 'ncon.m']);
    return existsSync(destino);
  } catch {
    return false;
  }
}

const EXTENSAO: Record<Dialect, string> = {
  'ncon-matlab': 'm',
  'ncon-julia': 'jl',
  einsum: 'py',
  quimb: 'py',
  itensor: 'jl',
};

/** Quem sabe rodar cada dialeto neste ambiente. `MOIRA_PYTHON` aponta para um
 *  interpretador com quimb instalado, quando ele não estiver no do sistema. */
const PYTHON = process.env['MOIRA_PYTHON'] ?? 'python3';
/** `MOIRA_OCTAVE` aceita comando com argumentos, para quem tem o Octave num
 *  ambiente isolado: `MOIRA_OCTAVE='micromamba run -n moira-octave octave'`. */
const OCTAVE = (process.env['MOIRA_OCTAVE'] ?? 'octave').split(/\s+/);

const EXECUTOR: Partial<Record<Dialect, { comando: string; args: (arquivo: string) => string[] }>> = {
  einsum: { comando: PYTHON, args: (a) => [a] },
  quimb: { comando: PYTHON, args: (a) => [a] },
  'ncon-julia': { comando: 'julia', args: (a) => [a] },
  itensor: { comando: 'julia', args: (a) => [a] },
  'ncon-matlab': {
    comando: OCTAVE[0]!,
    args: (a) => [...OCTAVE.slice(1), '--no-gui', '--quiet', '--path', CACHE, a],
  },
};

/** Biblioteca ausente não é defeito do código gerado: é ambiente. Fica
 *  pendente e visível, em vez de contar como falha e esconder uma de verdade. */
function ambienteIncompleto(mensagem: string): boolean {
  return (
    /ENOENT/.test(mensagem) ||
    /ModuleNotFoundError/.test(mensagem) ||
    /not found in current path/.test(mensagem) ||
    /Package .* not found/.test(mensagem)
  );
}

const rede = { ...emptyNetwork(), ...sandwich({ sites: 4 }) };
const assignment = assignIndices(rede);
const net = buildContractNetwork(rede, assignment);
const path_ = findPath(net);
const diagnostics = validate(rede);

mkdirSync(DESTINO, { recursive: true });
const temNcon = await buscaNcon();
console.log(`\nRede: sanduíche de 4 sítios — ${net.tensors.length} tensores, escalar na saída.`);
console.log(temNcon ? '' : 'ncon.m não pôde ser baixado; o dialeto MATLAB fica pendente.\n');

let falhas = 0;
let pendentes = 0;

for (const dialect of Object.keys(EXTENSAO) as Dialect[]) {
  const gerado = generate(dialect, net, path_, diagnostics, DEFAULT_CODE_OPTIONS);
  if (!gerado.source) {
    console.log(`  ✗ ${dialect}: não gerou (${gerado.problem})`);
    falhas += 1;
    continue;
  }

  const arquivo = path.join(DESTINO, `sanduiche-4.${dialect}.${EXTENSAO[dialect]}`);
  writeFileSync(arquivo, `${gerado.source}\n`);

  if (dialect === 'ncon-matlab' && !temNcon) {
    console.log(`  · ${dialect}: gravado, sem o ncon.m para executar`);
    pendentes += 1;
    continue;
  }

  const executor = EXECUTOR[dialect];
  if (!executor) {
    console.log(`  · ${dialect}: gravado, sem executor conhecido`);
    pendentes += 1;
    continue;
  }

  try {
    const { stdout } = await executar(executor.comando, executor.args(arquivo), { timeout: 90_000 });
    const numero = Number(stdout.trim().split(/\s+/).pop());
    const ok = Number.isFinite(numero);
    console.log(`  ${ok ? '✓' : '✗'} ${dialect}: ${ok ? `escalar ${numero}` : `saída inesperada: ${stdout.trim().slice(0, 80)}`}`);
    if (!ok) falhas += 1;
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    if (ambienteIncompleto(mensagem)) {
      const falta = /ENOENT/.test(mensagem)
        ? `${executor.comando} não está instalado`
        : (/(?:ModuleNotFoundError: No module named '([^']+)'|Package (\w+) not found)/.exec(mensagem)?.slice(1).find(Boolean) ?? 'biblioteca') + ' não está instalado';
      console.log(`  · ${dialect}: ${falta} — pendente`);
      pendentes += 1;
    } else {
      console.log(`  ✗ ${dialect}: ${mensagem.split('\n').slice(0, 3).join(' ').slice(0, 200)}`);
      falhas += 1;
    }
  }
}

console.log(
  `\n${falhas === 0 ? 'Todos os dialetos executáveis aqui rodaram ao colar.' : `${falhas} dialeto(s) falharam.`}` +
    (pendentes > 0 ? ` ${pendentes} pendente(s), sem intérprete neste ambiente.` : '') +
    `\nArquivos em ${path.relative(process.cwd(), DESTINO)}\n`,
);
process.exit(falhas === 0 ? 0 : 1);
