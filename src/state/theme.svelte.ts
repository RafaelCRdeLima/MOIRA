/** Tema claro, escuro ou o do sistema. O modo escuro é sempre escrito em
 *  `data-theme` de forma explícita — resolver `system` aqui em vez de no CSS
 *  deixa a folha de estilo com um seletor só. */

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'moira:tema';

function stored(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  } catch {
    /* armazenamento bloqueado */
  }
  return 'system';
}

function prefersDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
}

class Theme {
  mode = $state<ThemeMode>(stored());

  get resolved(): 'light' | 'dark' {
    if (this.mode === 'system') return prefersDark() ? 'dark' : 'light';
    return this.mode;
  }

  set(mode: ThemeMode): void {
    this.mode = mode;
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* nada a fazer */
    }
    this.apply();
  }

  apply(): void {
    document.documentElement.dataset['theme'] = this.resolved;
  }

  /** Enquanto o modo for `system`, seguir a troca feita no sistema operacional. */
  watchSystem(): () => void {
    if (typeof matchMedia !== 'function') return () => {};
    const query = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (this.mode === 'system') this.apply();
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }
}

export const theme = new Theme();
