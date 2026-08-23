<script lang="ts">
  import { i18n, LOCALES, t, type Locale } from '../lib/i18n/index.svelte';
  import { theme, type ThemeMode } from '../state/theme.svelte';

  const THEMES: ThemeMode[] = ['system', 'light', 'dark'];
</script>

<header>
  <img class="logo claro" src="/assets/moira-logo.svg" alt="MOIRA" width="170" height="40" />
  <img class="logo escuro" src="/assets/moira-logo-dark.svg" alt="MOIRA" width="170" height="40" />
  <p class="tagline">{t('app.tagline')}</p>

  <label class="lang tema">
    <span class="sr">{t('theme.title')}</span>
    <select value={theme.mode} onchange={(e) => theme.set(e.currentTarget.value as ThemeMode)}>
      {#each THEMES as mode (mode)}
        <option value={mode}>{t(`theme.${mode}`)}</option>
      {/each}
    </select>
  </label>

  <label class="lang">
    <span class="sr">{t('tool.language')}</span>
    <select value={i18n.locale} onchange={(e) => i18n.set(e.currentTarget.value as Locale)}>
      {#each LOCALES as locale (locale.id)}
        <option value={locale.id}>{locale.label}</option>
      {/each}
    </select>
  </label>
</header>

<style>
  header {
    display: flex;
    align-items: center;
    gap: var(--step-4);
    height: var(--header-h);
    padding: 0 var(--step-4);
    border-bottom: 1px solid var(--c-rule);
    background: var(--c-panel);
  }

  /* Área de respiro mínima ao redor do logotipo: a altura do nó. */
  .logo {
    height: 34px;
    width: auto;
  }

  /* Os dois arquivos da identidade, um por modo. O logotipo escuro traz o
     próprio fundo #121821, então o cabeçalho usa esse mesmo fundo no escuro. */
  .escuro {
    display: none;
  }

  :global(:root[data-theme='dark']) .claro {
    display: none;
  }

  :global(:root[data-theme='dark']) .escuro {
    display: block;
  }

  :global(:root[data-theme='dark']) header {
    background: var(--bg-dark);
  }

  .tagline {
    margin: 0;
    color: var(--c-muted);
  }

  .lang {
    margin-left: var(--step-2);
  }

  .tema {
    margin-left: auto;
  }

  .lang select {
    padding: 3px var(--step-2);
    border: 1px solid var(--c-rule);
    border-radius: var(--radius);
    background: var(--c-paper);
    color: var(--c-ink);
    font: inherit;
    font-size: 13px;
  }

  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }

  @media (max-width: 720px) {
    .tagline {
      display: none;
    }
  }
</style>
