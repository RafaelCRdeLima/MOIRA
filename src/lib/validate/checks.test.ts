import { beforeEach, describe, expect, it } from 'vitest';
import { mera, mps, sandwich } from '../generators/index';
import { resetIdCounters } from '../model/id';
import { addBond, createTensor, emptyNetwork } from '../model/network';
import type { Network } from '../model/types';
import { countComponents, hasLoop, validate } from './checks';

function comoRede(f: { tensors: Network['tensors']; bonds: Network['bonds'] }): Network {
  return { ...emptyNetwork(), tensors: f.tensors, bonds: f.bonds };
}

const codigos = (network: Network) => validate(network).map((d) => d.code);

describe('validação do §11', () => {
  beforeEach(resetIdCounters);

  it('rede limpa não gera aviso nenhum', () => {
    expect(codigos(comoRede(sandwich({ sites: 4 })))).toEqual([]);
  });

  it('dimensões incompatíveis nas pontas bloqueiam', () => {
    const network = comoRede(mps({ sites: 3 }));
    network.tensors[0]!.legs[0]!.dim = 5;
    network.tensors[1]!.legs[0]!.dim = 7;

    const aviso = validate(network).find((d) => d.code === 'dimMismatch')!;
    expect(aviso.severity).toBe('blocking');
    expect(aviso.params).toMatchObject({ a: 5, b: 7 });
  });

  it('tensor isolado é aviso, não bloqueio', () => {
    const network = comoRede(mps({ sites: 3 }));
    network.tensors.push(createTensor(500, 0, { name: 'Z' }));
    const aviso = validate(network).find((d) => d.code === 'isolated')!;
    expect(aviso.severity).toBe('warning');
    expect(aviso.params['tensor']).toBe('Z');
  });

  it('triângulo sem ponta definida', () => {
    const network = emptyNetwork();
    const t = createTensor(0, 0, { shape: 'triangle', name: 'W' });
    network.tensors.push(t);
    expect(codigos(network)).toContain('isometryNoTip');

    t.isometryTip = t.legs[0]!.id;
    expect(codigos(network)).not.toContain('isometryNoTip');
  });

  it('a MERA gerada já vem com a ponta de toda isometria definida', () => {
    // Se o gerador esquecesse, o painel gritaria quinze vezes de uma vez.
    expect(codigos(comoRede(mera({ leaves: 16 })))).not.toContain('isometryNoTip');
  });

  it('rede desconexa avisa que a contração dará produto tensorial', () => {
    const network = comoRede(mps({ sites: 3 }));
    const solto = createTensor(500, 0, { name: 'Z' });
    const outro = createTensor(560, 0, { name: 'Y' });
    network.tensors.push(solto, outro);
    addBond(network, solto.legs[0]!.id, outro.legs[1]!.id);

    const aviso = validate(network).find((d) => d.code === 'disconnected')!;
    expect(aviso.severity).toBe('warning');
    expect(aviso.params['parts']).toBe(2);
    expect(countComponents(network)).toBe(2);
  });

  it('laço com centro de ortogonalidade marcado: o gauge por SVD não vale', () => {
    const network = comoRede(mps({ sites: 4, periodic: true }));
    expect(hasLoop(network)).toBe(true);
    expect(codigos(network)).not.toContain('loopWithOrthoCenter');

    network.orthogonalityCenter = network.tensors[1]!.id;
    expect(codigos(network)).toContain('loopWithOrthoCenter');
  });

  it('cadeia aberta com centro marcado não avisa: ali o gauge vale', () => {
    const network = comoRede(mps({ sites: 4 }));
    network.orthogonalityCenter = network.tensors[1]!.id;
    expect(hasLoop(network)).toBe(false);
    expect(codigos(network)).not.toContain('loopWithOrthoCenter');
  });

  it('vínculo duplo entre dois tensores conta como laço', () => {
    const network = emptyNetwork();
    const a = createTensor(0, 0, { legCount: 3 });
    const b = createTensor(120, 0, { legCount: 3 });
    network.tensors.push(a, b);
    addBond(network, a.legs[0]!.id, b.legs[1]!.id);
    addBond(network, a.legs[1]!.id, b.legs[0]!.id);
    expect(hasLoop(network)).toBe(true);
  });

  it('rede vazia não gera diagnóstico', () => {
    expect(validate(emptyNetwork())).toEqual([]);
  });
});
