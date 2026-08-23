<script lang="ts">
  import { t } from '../lib/i18n/pt';
</script>

<header>
  <img class="logo" src="/assets/moira-logo.svg" alt={t('app.title')} width="170" height="40" />
  <p class="tagline">{t('app.tagline')}</p>
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

  .tagline {
    margin: 0;
    color: var(--c-muted);
  }

  @media (max-width: 720px) {
    .tagline {
      display: none;
    }
  }
</style>
