<script lang="ts">
  import { t } from '../lib/i18n/pt';
  import { session } from '../state/session.svelte';

  const tensorCount = $derived(session.network.tensors.length);
  const bondCount = $derived(session.network.bonds.length);
  const freeCount = $derived(session.freeLegCount());
</script>

<aside>
  <dl class="status">
    <div><dt>{t('status.tensors')}</dt><dd>{tensorCount}</dd></div>
    <div><dt>{t('status.bonds')}</dt><dd>{bondCount}</dd></div>
    <div><dt>{t('status.free')}</dt><dd>{freeCount}</dd></div>
  </dl>

  <section>
    <h2>{t('hint.title')}</h2>
    <ul>
      <li>{t('hint.add')}</li>
      <li>{t('hint.drag')}</li>
      <li>{t('hint.bond')}</li>
      <li>{t('hint.unbond')}</li>
      <li>{t('hint.delete')}</li>
      <li>{t('hint.keys')}</li>
    </ul>
  </section>
</aside>

<style>
  aside {
    width: var(--panel-w);
    flex: none;
    padding: var(--step-4);
    border-left: 1px solid var(--c-rule);
    background: var(--c-panel);
    overflow-y: auto;
  }

  .status {
    display: flex;
    gap: var(--step-5);
    margin: 0 0 var(--step-5);
    padding-bottom: var(--step-4);
    border-bottom: 1px solid var(--c-rule);
  }

  .status div {
    display: flex;
    flex-direction: column-reverse;
  }

  dt {
    color: var(--c-muted);
    font-size: 11px;
  }

  dd {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 20px;
  }

  h2 {
    margin: 0 0 var(--step-2);
    font-size: 13px;
    font-weight: 500;
  }

  ul {
    margin: 0;
    padding-left: 1.1em;
    color: var(--c-muted);
  }

  li + li {
    margin-top: var(--step-2);
  }

  @media (max-width: 900px) {
    aside {
      display: none;
    }
  }
</style>
