/** Ids curtos e legíveis (`t3`, `l12`, `b4`): saem limpos no JSON, no SVG e no TikZ.
 *  O contador é global à sessão; ao carregar uma rede é preciso empurrá-lo para
 *  além do maior id já usado, senão a próxima criação colide com o que veio do
 *  localStorage. */

import type { Network } from './types';

const counters: Record<string, number> = {};

export function nextId(prefix: string): string {
  const n = (counters[prefix] ?? 0) + 1;
  counters[prefix] = n;
  return `${prefix}${n}`;
}

/** Empurra cada contador para além do maior sufixo numérico presente na rede. */
export function syncIdCounters(network: Network): void {
  const bump = (id: string) => {
    const m = /^([a-z]+)(\d+)$/.exec(id);
    if (!m) return;
    const [, prefix, digits] = m as unknown as [string, string, string];
    const n = Number(digits);
    if (n > (counters[prefix] ?? 0)) counters[prefix] = n;
  };
  for (const t of network.tensors) {
    bump(t.id);
    for (const leg of t.legs) bump(leg.id);
  }
  for (const b of network.bonds) bump(b.id);
}

/** Só para os testes: zera os contadores para que os ids fiquem determinísticos. */
export function resetIdCounters(): void {
  for (const key of Object.keys(counters)) delete counters[key];
}
