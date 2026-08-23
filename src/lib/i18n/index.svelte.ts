/** Seleção de idioma. Português e inglês agora; francês e italiano entram como
 *  mais um dicionário nesta tabela, sem tocar em componente algum. */

import { en } from './en';
import type { Dictionary, StringKey } from './pt';
import { pt } from './pt';

export type Locale = 'pt' | 'en';

export const LOCALES: { id: Locale; label: string }[] = [
  { id: 'pt', label: 'português' },
  { id: 'en', label: 'english' },
];

const dictionaries: Record<Locale, Dictionary> = { pt, en };
const STORAGE_KEY = 'moira:idioma';

function initial(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'pt' || saved === 'en') return saved;
  } catch {
    /* armazenamento bloqueado: fica o idioma do navegador */
  }
  return typeof navigator !== 'undefined' && navigator.language.startsWith('pt') ? 'pt' : 'en';
}

class I18n {
  locale = $state<Locale>(initial());

  set(locale: Locale): void {
    this.locale = locale;
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      /* nada a fazer */
    }
    document.documentElement.lang = locale === 'pt' ? 'pt-BR' : 'en';
  }

  t(key: StringKey): string {
    return dictionaries[this.locale][key];
  }
}

export const i18n = new I18n();

/** Ler `i18n.locale` aqui dentro é o que faz a troca de idioma repintar a tela. */
export function t(key: StringKey): string {
  return i18n.t(key);
}

export type { StringKey };
