/** Preferências de exibição da fórmula, e a memória da atribuição de índices.
 *
 *  A memória é o que torna as letras grudentas: `assignIndices` recebe a
 *  atribuição anterior e mantém o símbolo de toda perna que continua existindo.
 *  Ela fica fora de `$state` de propósito — é cache, não estado observável, e
 *  como a função é idempotente, recomputar não muda nada. */

import type { IndexAssignment } from '../lib/formula/indices';
import { assignIndices } from '../lib/formula/indices';
import type { ConjugateMark, FormulaOptions, Summation } from '../lib/formula/latex';
import { DEFAULT_OPTIONS } from '../lib/formula/latex';
import type { Network } from '../lib/model/types';

const STORAGE_KEY = 'moira:formula';

function stored(): FormulaOptions {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    if (!text) return DEFAULT_OPTIONS;
    const raw = JSON.parse(text) as Partial<FormulaOptions>;
    return {
      summation: raw.summation === 'einstein' ? 'einstein' : 'explicit',
      conjugate: raw.conjugate === 'asterisk' ? 'asterisk' : 'dagger',
    };
  } catch {
    return DEFAULT_OPTIONS;
  }
}

class FormulaStore {
  summation = $state<Summation>(stored().summation);
  conjugate = $state<ConjugateMark>(stored().conjugate);
  /** Faixa recolhida pelo usuário. */
  collapsed = $state(false);

  #previous: IndexAssignment | null = null;

  get options(): FormulaOptions {
    return { summation: this.summation, conjugate: this.conjugate };
  }

  setSummation(summation: Summation): void {
    this.summation = summation;
    this.#save();
  }

  setConjugate(conjugate: ConjugateMark): void {
    this.conjugate = conjugate;
    this.#save();
  }

  assignmentFor(network: Network): IndexAssignment {
    this.#previous = assignIndices(network, this.#previous ?? undefined);
    return this.#previous;
  }

  #save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.options));
    } catch {
      /* armazenamento bloqueado */
    }
  }
}

export const formula = new FormulaStore();
