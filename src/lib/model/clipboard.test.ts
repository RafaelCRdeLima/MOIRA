import { beforeEach, describe, expect, it } from 'vitest';
import { boundingBox, extractSubnetwork, pasteFragment } from './clipboard';
import { resetIdCounters } from './id';
import { addBond, createTensor, emptyNetwork } from './network';
import type { Network } from './types';

function chain(n: number): Network {
  const network = emptyNetwork();
  for (let i = 0; i < n; i++) network.tensors.push(createTensor(i * 60, 0, { name: `A${i}` }));
  for (let i = 0; i < n - 1; i++) {
    addBond(network, network.tensors[i]!.legs[0]!.id, network.tensors[i + 1]!.legs[1]!.id);
  }
  return network;
}

describe('copiar e colar sub-redes', () => {
  beforeEach(resetIdCounters);

  it('leva só os vínculos internos à seleção', () => {
    const network = chain(4);
    const recorte = extractSubnetwork(network, [network.tensors[1]!.id, network.tensors[2]!.id]);
    expect(recorte.tensors).toHaveLength(2);
    expect(recorte.bonds).toHaveLength(1); // o vínculo 1–2; os de fora ficam
  });

  it('colar renomeia tudo e não colide com a rede nem consigo mesmo', () => {
    const network = chain(3);
    const recorte = extractSubnetwork(network, network.tensors.map((t) => t.id));
    const antes = new Set(network.tensors.flatMap((t) => [t.id, ...t.legs.map((l) => l.id)]));

    const primeira = pasteFragment(network, recorte, { x: 20, y: 20 });
    const segunda = pasteFragment(network, recorte, { x: 40, y: 40 });

    expect(network.tensors).toHaveLength(9);
    expect(network.bonds).toHaveLength(6);
    for (const id of [...primeira, ...segunda]) expect(antes.has(id)).toBe(false);
    expect(new Set([...primeira, ...segunda]).size).toBe(6);

    // Nenhuma perna acabou em dois vínculos depois de duas colagens.
    const usadas = network.bonds.flatMap((b) => [b.a, b.b]);
    expect(new Set(usadas).size).toBe(usadas.length);
  });

  it('a ponta do triângulo continua apontando para a perna certa depois da cópia', () => {
    const network = emptyNetwork();
    const tensor = createTensor(0, 0, { shape: 'triangle' });
    tensor.isometryTip = tensor.legs[2]!.id;
    network.tensors.push(tensor);

    const recorte = extractSubnetwork(network, [tensor.id]);
    const [novoId] = pasteFragment(network, recorte, { x: 0, y: 0 });
    const copia = network.tensors.find((t) => t.id === novoId)!;

    expect(copia.isometryTip).toBeDefined();
    expect(copia.isometryTip).not.toBe(tensor.isometryTip);
    expect(copia.legs.map((l) => l.id)).toContain(copia.isometryTip);
    expect(copia.legs.indexOf(copia.legs.find((l) => l.id === copia.isometryTip)!)).toBe(2);
  });

  it('desloca o que foi colado para não empilhar sobre o original', () => {
    const network = chain(2);
    const recorte = extractSubnetwork(network, [network.tensors[0]!.id]);
    const [novoId] = pasteFragment(network, recorte, { x: 32, y: 32 });
    const copia = network.tensors.find((t) => t.id === novoId)!;
    expect(copia.x).toBe(32);
    expect(copia.y).toBe(32);
  });

  it('a caixa envolvente serve para pôr o que vem de fora ao lado', () => {
    const network = chain(3);
    const caixa = boundingBox(network.tensors);
    expect(caixa).toEqual({ x: 0, y: 0, w: 120, h: 0 });
    expect(boundingBox([])).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });
});
