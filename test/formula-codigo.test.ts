/** A faixa da equação e os quatro dialetos falam do mesmo tensor com os mesmos
 *  índices, na mesma ordem.
 *
 *  Se divergirem, o programa passa a exibir uma equação que o próprio código
 *  dele não obedece, e a faixa deixa de ser verificação para virar decoração.
 *  Por isso o teste lê os índices de volta do LaTeX composto, e não da estrutura
 *  que o gerou. */

import { beforeEach, describe, expect, it } from 'vitest';
import { buildContractNetwork } from '../src/lib/contract/network';
import { findPath } from '../src/lib/contract/order';
import { einsumLetters } from '../src/lib/codegen/einsum';
import { nconLabels } from '../src/lib/codegen/ncon';
import { generate } from '../src/lib/codegen/index';
import { assignIndices } from '../src/lib/formula/indices';
import { buildFormula } from '../src/lib/formula/latex';
import { mera, mps, sandwich } from '../src/lib/generators/index';
import { resetIdCounters } from '../src/lib/model/id';
import { emptyNetwork } from '../src/lib/model/network';
import type { Network } from '../src/lib/model/types';
import { validate } from '../src/lib/validate/checks';
import { doisVinculos } from './redes';

function comoRede(f: { tensors: Network['tensors']; bonds: Network['bonds'] }): Network {
  return { ...emptyNetwork(), tensors: f.tensors, bonds: f.bonds };
}

/** Os símbolos do subscrito de um fator, lidos do LaTeX com chaves casadas. */
function indicesDoFator(latex: string): string[] {
  let profundidade = 0;
  for (let i = 0; i < latex.length; i++) {
    const c = latex[i];
    if (c === '{') profundidade++;
    else if (c === '}') profundidade--;
    else if (c === '_' && profundidade === 0 && latex[i + 1] === '{') {
      let d = 0;
      for (let j = i + 1; j < latex.length; j++) {
        if (latex[j] === '{') d++;
        else if (latex[j] === '}') {
          d--;
          if (d === 0) return dividir(latex.slice(i + 2, j));
        }
      }
    }
  }
  return [];
}

function dividir(grupo: string): string[] {
  const saida: string[] = [];
  let atual = '';
  let profundidade = 0;
  for (const c of grupo) {
    if (c === '{') profundidade++;
    if (c === '}') profundidade--;
    if (c === ' ' && profundidade === 0) {
      if (atual) saida.push(atual);
      atual = '';
    } else atual += c;
  }
  if (atual) saida.push(atual);
  return saida;
}

function conferirAcordo(network: Network) {
  const assignment = assignIndices(network);
  const contract = buildContractNetwork(network, assignment);
  const path = findPath(contract);
  const formula = buildFormula(network, assignment);

  const rotulos = nconLabels(contract, path);
  const chavePorRotulo = new Map([...rotulos].map(([k, n]) => [n, k]));
  const letras = einsumLetters(contract);
  const chavePorLetra = letras ? new Map([...letras].map(([k, l]) => [l, k])) : null;

  for (const tensor of contract.tensors) {
    const daFormula = indicesDoFator(
      formula.factors.find((f) => f.tensorId === tensor.id)!.latex,
    );
    const doModelo = tensor.axes.map((a) => a.symbol);
    expect(daFormula).toEqual(doModelo);

    // ncon: os inteiros daquele tensor, na mesma ordem, apontam para os mesmos
    // índices.
    const doNcon = tensor.axes.map((a) => chavePorRotulo.get(rotulos.get(a.key)!)!);
    expect(doNcon).toEqual(tensor.axes.map((a) => a.key));

    if (chavePorLetra) {
      const doEinsum = tensor.axes.map((a) => chavePorLetra.get(letras!.get(a.key)!)!);
      expect(doEinsum).toEqual(tensor.axes.map((a) => a.key));
    }
  }
  return { contract, path, formula };
}

describe('fórmula e código dizem a mesma coisa', () => {
  beforeEach(resetIdCounters);

  it('MPS aberta', () => conferirAcordo(comoRede(mps({ sites: 5 }))));
  it('MPS periódica', () => conferirAcordo(comoRede(mps({ sites: 6, periodic: true }))));
  it('sanduíche de 4 sítios', () => conferirAcordo(comoRede(sandwich({ sites: 4 }))));
  it('dois tensores, dois vínculos de dimensões diferentes', () => conferirAcordo(doisVinculos()));

  it('MERA de 16 folhas — passa do alfabeto do einsum', () => {
    const { contract } = conferirAcordo(comoRede(mera({ leaves: 16 })));
    expect(contract.byKey.size).toBeGreaterThan(52);
    expect(einsumLetters(contract)).toBeNull();
  });
});

describe('os dialetos gerados', () => {
  beforeEach(resetIdCounters);

  function gerarTudo(network: Network) {
    const assignment = assignIndices(network);
    const contract = buildContractNetwork(network, assignment);
    const path = findPath(contract);
    const diagnostics = validate(network);
    return {
      contract,
      path,
      codigo: {
        'ncon-matlab': generate('ncon-matlab', contract, path, diagnostics),
        'ncon-julia': generate('ncon-julia', contract, path, diagnostics),
        einsum: generate('einsum', contract, path, diagnostics),
        quimb: generate('quimb', contract, path, diagnostics),
        itensor: generate('itensor', contract, path, diagnostics),
      },
    };
  }

  it('os dois vínculos de dimensões diferentes saem sem transposição inventada', () => {
    const { codigo, contract } = gerarTudo(doisVinculos());

    // A ordem dos eixos vem do modelo: A tem (χ2, χ3, livre) e B tem
    // (χ3, χ2, livre), e é assim que os dois têm de aparecer.
    const a = contract.tensors.find((t) => t.name === 'A')!;
    const b = contract.tensors.find((t) => t.name === 'B')!;
    expect(a.axes.map((x) => x.dim)).toEqual([2, 3, 2]);
    expect(b.axes.map((x) => x.dim)).toEqual([3, 2, 3]);

    // O einsum reflete essa ordem, e não uma suposta.
    const linha = codigo.einsum.source!.split('\n').find((l) => l.startsWith('R = np.einsum'))!;
    const [entradas, saida] = /'([^']+)'/.exec(linha)![1]!.split('->');
    const [ia, ib] = entradas!.split(',');
    expect(ia![0]).toBe(ib![1]); // o vínculo χ=2: eixo 0 de A com eixo 1 de B
    expect(ia![1]).toBe(ib![0]); // o vínculo χ=3: eixo 1 de A com eixo 0 de B
    expect(saida).toHaveLength(2);
    expect(new Set(saida!.split(''))).toEqual(new Set([ia![2], ib![2]]));

    // Nenhum dialeto emite transposição: a ordem dos eixos já é a do diagrama.
    for (const gerado of Object.values(codigo)) {
      expect(gerado.source).not.toMatch(/transpose|permutedims|np\.moveaxis/);
    }
  });

  it('ncon: livres negativos na ordem da saída, contraídos positivos', () => {
    const { codigo, contract, path } = gerarTudo(comoRede(mps({ sites: 4 })));
    const rotulos = nconLabels(contract, path);
    expect(contract.free.map((a) => rotulos.get(a.key))).toEqual([-1, -2, -3, -4]);
    expect(contract.summed.every((a) => rotulos.get(a.key)! > 0)).toBe(true);
    expect(codigo['ncon-matlab'].source).toContain('R = ncon(tensores, indices, sequencia);');
    expect(codigo['ncon-julia'].source).toContain('using TensorOperations');
  });

  it('quimb preserva as tags do diagrama', () => {
    const { codigo } = gerarTudo(comoRede(sandwich({ sites: 3 })));
    expect(codigo.quimb.source).toContain("tags=('bra', 'mps')");
    expect(codigo.quimb.source).toContain("tags=('ket', 'mps')");
    expect(codigo.quimb.source).toContain("tags=('mpo',)");
  });

  it('ITensor usa nomes de índice, não posições', () => {
    const { codigo, contract } = gerarTudo(comoRede(mps({ sites: 3 })));
    for (const axis of contract.byKey.values()) {
      expect(codigo.itensor.source).toContain(`${axis.code} = Index(${axis.dim}, "${axis.code}")`);
    }
    expect(codigo.itensor.source).toMatch(/R1 = \w+ \* \w+/);
  });

  it('o cabeçalho traz o custo estimado', () => {
    const { codigo } = gerarTudo(comoRede(mps({ sites: 4 })));
    for (const gerado of Object.values(codigo)) {
      expect(gerado.source).toMatch(/Estimated cost/);
      expect(gerado.source).toMatch(/scaling O\(/);
    }
  });

  it('rede com dimensões incompatíveis não gera código: mostra o motivo', () => {
    const network = comoRede(mps({ sites: 3 }));
    network.tensors[0]!.legs[0]!.dim = 5;
    network.tensors[1]!.legs[0]!.dim = 7;

    const diagnostics = validate(network);
    expect(diagnostics.some((d) => d.code === 'dimMismatch' && d.severity === 'blocking')).toBe(true);

    const assignment = assignIndices(network);
    const contract = buildContractNetwork(network, assignment);
    const gerado = generate('einsum', contract, findPath(contract), diagnostics);
    expect(gerado.source).toBeNull();
    expect(gerado.problem).toBe('dimMismatch');
  });

  it('o código roda ao colar: declara os tensores e imprime o resultado', () => {
    const { codigo } = gerarTudo(comoRede(sandwich({ sites: 3 })));

    // Sem o bloco de exemplo, o primeiro erro de quem cola é NameError.
    expect(codigo.einsum.source).toMatch(/A1c = np\.random\.rand\(/);
    expect(codigo.quimb.source).toMatch(/A1c = np\.random\.rand\(/);
    expect(codigo['ncon-matlab'].source).toMatch(/A1c = rand\(\[/);
    expect(codigo['ncon-julia'].source).toMatch(/A1c = randn\(/);
    expect(codigo.itensor.source).toMatch(/dados_A1c = randn\(/);

    // E o segundo é não ver resultado nenhum.
    expect(codigo.einsum.source).toMatch(/^print\(R\)$/m);
    expect(codigo.quimb.source).toMatch(/^print\(R\)$/m);
    expect(codigo['ncon-matlab'].source).toMatch(/^disp\(R\)$/m);
    expect(codigo['ncon-julia'].source).toMatch(/^println\(R\)$/m);
    expect(codigo.itensor.source).toMatch(/^println\(scalar\(R\)\)$/m);

    // O cabeçalho diz que os dados são entrada de quem usa.
    for (const gerado of Object.values(codigo)) {
      expect(gerado.source).toMatch(/YOUR input/);
    }
  });

  it('sem o bloco de exemplo, o cabeçalho manda declarar os tensores', () => {
    const network = comoRede(sandwich({ sites: 3 }));
    const assignment = assignIndices(network);
    const contract = buildContractNetwork(network, assignment);
    const gerado = generate('einsum', contract, findPath(contract), [], { examples: false });

    expect(gerado.source).not.toMatch(/np\.random\.rand/);
    expect(gerado.source).toMatch(/Declare them before running/);
    expect(gerado.source).toMatch(/^print\(R\)$/m); // a impressão fica
  });

  it('o einsum leva a ordem de contração dentro da chamada', () => {
    // Sem `optimize`, o numpy contrai ingenuamente e uma rede deste tamanho
    // não termina. O caminho vai no formato que o próprio numpy aceita.
    const { codigo } = gerarTudo(comoRede(sandwich({ sites: 4 })));
    expect(codigo.einsum.source).toMatch(/caminho = \['einsum_path', \(\d+, \d+\)/);
    expect(codigo.einsum.source).toMatch(/optimize=caminho/);
  });

  it('rede vazia também não gera', () => {
    const network = emptyNetwork();
    const contract = buildContractNetwork(network, assignIndices(network));
    const gerado = generate('quimb', contract, findPath(contract), []);
    expect(gerado.source).toBeNull();
    expect(gerado.problem).toBe('empty');
  });
});
