/** Validação do §11. Devolve diagnósticos com código e parâmetros; quem
 *  traduz é a interface, para a mesma verificação servir aos dois idiomas.
 *
 *  `blocking` só para o que impede gerar código que rode. Rede desconexa não
 *  bloqueia: ela contrai para um produto tensorial, que é resultado legítimo —
 *  só costuma não ser o que a pessoa queria. */

import type { Network } from '../model/types';

export type Severity = 'blocking' | 'warning';

export interface Diagnostic {
  code:
    | 'dimMismatch'
    | 'isolated'
    | 'isometryNoTip'
    | 'disconnected'
    | 'loopWithOrthoCenter'
    | 'empty';
  severity: Severity;
  /** Ids de tensores ou vínculos a que o aviso se refere. */
  targets: string[];
  /** Valores para a mensagem: rótulo do vínculo, dimensões em conflito, etc. */
  params: Record<string, string | number>;
}

export function validate(network: Network): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  if (network.tensors.length === 0) return diagnostics;

  const legOwner = new Map<string, { tensorId: string; dim?: number }>();
  for (const tensor of network.tensors) {
    for (const leg of tensor.legs) {
      legOwner.set(leg.id, { tensorId: tensor.id, ...(leg.dim !== undefined ? { dim: leg.dim } : {}) });
    }
  }

  // ── dimensões incompatíveis nas pontas de um vínculo ─────────────────────
  for (const bond of network.bonds) {
    const a = legOwner.get(bond.a)?.dim;
    const b = legOwner.get(bond.b)?.dim;
    if (a !== undefined && b !== undefined && a !== b) {
      diagnostics.push({
        code: 'dimMismatch',
        severity: 'blocking',
        targets: [bond.id],
        params: { bond: bond.label || bond.id, a, b },
      });
    }
  }

  // ── tensor isolado ───────────────────────────────────────────────────────
  const vinculadas = new Set(network.bonds.flatMap((b) => [b.a, b.b]));
  for (const tensor of network.tensors) {
    if (tensor.legs.every((leg) => !vinculadas.has(leg.id))) {
      diagnostics.push({
        code: 'isolated',
        severity: 'warning',
        targets: [tensor.id],
        params: { tensor: tensor.name || tensor.id },
      });
    }
  }

  // ── triângulo de isometria sem ponta definida ────────────────────────────
  for (const tensor of network.tensors) {
    if (tensor.shape !== 'triangle') continue;
    const apontaParaPernaViva =
      tensor.isometryTip !== undefined && tensor.legs.some((l) => l.id === tensor.isometryTip);
    if (!apontaParaPernaViva) {
      diagnostics.push({
        code: 'isometryNoTip',
        severity: 'warning',
        targets: [tensor.id],
        params: { tensor: tensor.name || tensor.id },
      });
    }
  }

  // ── rede desconexa ───────────────────────────────────────────────────────
  const componentes = countComponents(network);
  if (componentes > 1) {
    diagnostics.push({
      code: 'disconnected',
      severity: 'warning',
      targets: [],
      params: { parts: componentes },
    });
  }

  // ── laço com centro de ortogonalidade marcado ────────────────────────────
  // O gauge por SVD só vale em redes sem laços: com um laço, a decomposição
  // deixa de ser única e o centro não fixa nada.
  if (network.orthogonalityCenter !== undefined && hasLoop(network)) {
    diagnostics.push({
      code: 'loopWithOrthoCenter',
      severity: 'warning',
      targets: [network.orthogonalityCenter],
      params: {},
    });
  }

  return diagnostics;
}

export function countComponents(network: Network): number {
  const dono = new Map<string, string>();
  for (const tensor of network.tensors) for (const leg of tensor.legs) dono.set(leg.id, tensor.id);

  const pai = new Map(network.tensors.map((t) => [t.id, t.id]));
  const raiz = (a: string): string => {
    let r = a;
    while (pai.get(r) !== r) r = pai.get(r)!;
    return r;
  };
  for (const bond of network.bonds) {
    const a = dono.get(bond.a);
    const b = dono.get(bond.b);
    if (!a || !b) continue;
    const ra = raiz(a);
    const rb = raiz(b);
    if (ra !== rb) pai.set(ra, rb);
  }
  return new Set(network.tensors.map((t) => raiz(t.id))).size;
}

/** Ciclo no grafo, contando o laço de um tensor consigo mesmo e o vínculo
 *  duplo entre dois tensores. */
export function hasLoop(network: Network): boolean {
  const dono = new Map<string, string>();
  for (const tensor of network.tensors) for (const leg of tensor.legs) dono.set(leg.id, tensor.id);

  const pai = new Map(network.tensors.map((t) => [t.id, t.id]));
  const raiz = (a: string): string => {
    let r = a;
    while (pai.get(r) !== r) r = pai.get(r)!;
    return r;
  };

  for (const bond of network.bonds) {
    const a = dono.get(bond.a);
    const b = dono.get(bond.b);
    if (!a || !b) continue;
    const ra = raiz(a);
    const rb = raiz(b);
    if (ra === rb) return true; // fecha ciclo, inclusive laço e vínculo duplo
    pai.set(ra, rb);
  }
  return false;
}
