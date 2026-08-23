import { beforeEach, describe, expect, it } from 'vitest';
import { mera, mps, sandwich } from '../generators/index';
import { resetIdCounters } from '../model/id';
import { addBond, createTensor, emptyNetwork } from '../model/network';
import type { Network } from '../model/types';
import { assignIndices, GREEK, LATIN } from './indices';

function rede(fragmento: { tensors: Network['tensors']; bonds: Network['bonds'] }): Network {
  return { ...emptyNetwork(), tensors: fragmento.tensors, bonds: fragmento.bonds };
}

/** Símbolos de cada tensor, na ordem das pernas. */
function porTensor(network: Network, atribuicao: ReturnType<typeof assignIndices>): string[][] {
  return network.tensors.map((t) => t.legs.map((l) => atribuicao.byLeg.get(l.id)!.symbol));
}

describe('atribuição de índices', () => {
  beforeEach(resetIdCounters);

  it('latinas para pernas físicas, gregas para vínculos internos', () => {
    const network = rede(mps({ sites: 4 }));
    const a = assignIndices(network);
    expect(a.free.map((s) => s.symbol)).toEqual(['i', 'j', 'k', 'l']);
    expect(a.summed.map((s) => s.symbol)).toEqual(['\\alpha', '\\beta', '\\gamma']);
    expect(a.free.every((s) => LATIN.includes(s.symbol))).toBe(true);
    expect(a.summed.every((s) => GREEK.includes(s.symbol))).toBe(true);
  });

  it('as duas pernas de um vínculo compartilham o mesmo símbolo', () => {
    const network = rede(mps({ sites: 3 }));
    const a = assignIndices(network);
    for (const bond of network.bonds) {
      expect(a.byLeg.get(bond.a)!.symbol).toBe(a.byLeg.get(bond.b)!.symbol);
      expect(a.byLeg.get(bond.a)).toBe(a.byLeg.get(bond.b));
    }
  });

  it('segue a ordem de leitura: faixa de cima primeiro, depois da esquerda para a direita', () => {
    const network = emptyNetwork();
    // Posições fora de ordem de propósito.
    const baixo = createTensor(0, 200, { legCount: 1 });
    const direita = createTensor(300, 0, { legCount: 1 });
    const esquerda = createTensor(0, 0, { legCount: 1 });
    network.tensors.push(baixo, direita, esquerda);

    const a = assignIndices(network);
    expect(a.byLeg.get(esquerda.legs[0]!.id)!.symbol).toBe('i');
    expect(a.byLeg.get(direita.legs[0]!.id)!.symbol).toBe('j');
    expect(a.byLeg.get(baixo.legs[0]!.id)!.symbol).toBe('k');
    expect(a.factors.map((f) => f.tensor.id)).toEqual([esquerda.id, direita.id, baixo.id]);
  });

  it('mover um tensor não reembaralha as letras de quem ficou parado', () => {
    const network = rede(mps({ sites: 5 }));
    const antes = assignIndices(network);
    const simbolosAntes = new Map(
      [...antes.byLeg].map(([legId, s]) => [legId, s.symbol] as const),
    );

    // Arrasta o último sítio para antes do primeiro.
    network.tensors[4]!.x = -400;
    const depois = assignIndices(network, antes);

    for (const [legId, simbolo] of simbolosAntes) {
      expect(depois.byLeg.get(legId)!.symbol).toBe(simbolo);
    }
    // A ordem de leitura, essa sim, acompanha o canvas.
    expect(depois.free.map((s) => s.symbol)).not.toEqual(antes.free.map((s) => s.symbol));
    expect(new Set(depois.free.map((s) => s.symbol))).toEqual(
      new Set(antes.free.map((s) => s.symbol)),
    );
  });

  it('sem a atribuição anterior, as letras seguem a posição — é o que a torna grudenta', () => {
    const network = rede(mps({ sites: 5 }));
    const antes = assignIndices(network);
    network.tensors[4]!.x = -400;
    const semMemoria = assignIndices(network);
    expect(semMemoria.byLeg.get(network.tensors[4]!.legs[1]!.id)!.symbol).not.toBe(
      antes.byLeg.get(network.tensors[4]!.legs[1]!.id)!.symbol,
    );
  });

  it('é idempotente: realimentar a própria saída não muda nada', () => {
    const network = rede(sandwich({ sites: 4 }));
    const uma = assignIndices(network);
    const outra = assignIndices(network, uma);
    const terceira = assignIndices(network, outra);
    const chapa = (a: typeof uma) => [...a.byLeg].map(([k, v]) => `${k}=${v.symbol}`).sort();
    expect(chapa(outra)).toEqual(chapa(uma));
    expect(chapa(terceira)).toEqual(chapa(uma));
  });

  it('perna nova entra sem tomar a letra de ninguém', () => {
    const network = rede(mps({ sites: 3 }));
    const antes = assignIndices(network);
    const usadas = new Set([...antes.byLeg.values()].map((s) => s.symbol));

    const novo = createTensor(500, 0, { legCount: 2 });
    network.tensors.push(novo);
    const depois = assignIndices(network, antes);

    for (const [legId, s] of antes.byLeg) {
      expect(depois.byLeg.get(legId)!.symbol).toBe(s.symbol);
    }
    for (const leg of novo.legs) {
      expect(usadas.has(depois.byLeg.get(leg.id)!.symbol)).toBe(false);
    }
  });

  it('rótulo escrito pelo usuário vence a letra automática', () => {
    const network = rede(mps({ sites: 3 }));
    network.tensors[0]!.legs.find((l) => l.angle === Math.PI / 2)!.label = 's_1';
    network.bonds[0]!.label = '\\chi';

    const a = assignIndices(network);
    expect(a.free.map((s) => s.symbol)).toContain('s_1');
    expect(a.summed.map((s) => s.symbol)).toContain('\\chi');
    expect(a.byLeg.get(network.bonds[0]!.a)!.custom).toBe(true);
    // E ninguém mais recebe a mesma letra.
    const todos = [...a.byLeg.values()].map((s) => s.symbol);
    expect(todos.filter((s) => s === '\\chi').length).toBe(2); // as duas pernas do vínculo
  });

  it('esgotado o alfabeto, subscreve', () => {
    const network = rede(mps({ sites: 20 }));
    const a = assignIndices(network);
    const livres = a.free.map((s) => s.symbol);
    expect(livres.slice(0, 10)).toEqual(LATIN);
    expect(livres[10]).toBe('i_{1}');
    expect(livres[19]).toBe('s_{1}');
    expect(new Set(livres).size).toBe(20);
  });

  it('laço no mesmo tensor recebe um índice só, repetido nas duas pernas', () => {
    const network = emptyNetwork();
    const t = createTensor(0, 0, { legCount: 3 });
    network.tensors.push(t);
    addBond(network, t.legs[0]!.id, t.legs[1]!.id);

    const a = assignIndices(network);
    const simbolos = porTensor(network, a)[0]!;
    expect(simbolos[0]).toBe(simbolos[1]);
    expect(a.summed).toHaveLength(1);
    expect(a.free).toHaveLength(1);
  });
});

describe('contabilidade de índices nas redes canônicas', () => {
  beforeEach(resetIdCounters);

  /** Todo índice somado aparece exatamente duas vezes; todo livre, uma só. */
  function conferirContabilidade(network: Network) {
    const a = assignIndices(network);
    const contagem = new Map<string, number>();
    for (const linha of porTensor(network, a)) {
      for (const simbolo of linha) contagem.set(simbolo, (contagem.get(simbolo) ?? 0) + 1);
    }
    for (const s of a.summed) expect([s.symbol, contagem.get(s.symbol)]).toEqual([s.symbol, 2]);
    for (const s of a.free) expect([s.symbol, contagem.get(s.symbol)]).toEqual([s.symbol, 1]);
    expect(new Set([...a.free, ...a.summed].map((s) => s.symbol)).size).toBe(
      a.free.length + a.summed.length,
    );
  }

  it('MPS de 20 sítios', () => conferirContabilidade(rede(mps({ sites: 20 }))));
  it('MPS periódica', () => conferirContabilidade(rede(mps({ sites: 8, periodic: true }))));
  it('sanduíche de 4 sítios', () => conferirContabilidade(rede(sandwich({ sites: 4 }))));

  it('MERA de 16 folhas: nenhum índice três vezes, nenhum livre duplicado', () => {
    const network = rede(mera({ leaves: 16 }));
    conferirContabilidade(network);
    const a = assignIndices(network);
    expect(a.free).toHaveLength(17);
    expect(a.summed).toHaveLength(36);
  });
});
