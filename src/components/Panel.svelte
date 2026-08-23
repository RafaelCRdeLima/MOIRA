<script lang="ts">
  import { t } from '../lib/i18n/index.svelte';
  import { session } from '../state/session.svelte';
  import Generators from './Generators.svelte';
  import Inspector from './Inspector.svelte';

  const tensorCount = $derived(session.network.tensors.length);
  const bondCount = $derived(session.network.bonds.length);
  const freeCount = $derived(session.freeLegCount());
  const inspecting = $derived(session.tensor(session.inspecting) !== undefined);

  let bulkTags = $state('');
</script>

<aside>
  <dl class="status">
    <div><dt>{t('status.tensors')}</dt><dd>{tensorCount}</dd></div>
    <div><dt>{t('status.bonds')}</dt><dd>{bondCount}</dd></div>
    <div><dt>{t('status.free')}</dt><dd>{freeCount}</dd></div>
  </dl>

  {#if inspecting}
    <Inspector />
  {:else}
    {#if session.selection.length > 1}
      <section class="bulk">
        <h2>{session.selection.length} {t('insp.multiple')}</h2>
        <label class="row">
          <span>{t('insp.tags')}</span>
          <input
            class="mono"
            placeholder={t('insp.tagsHint')}
            bind:value={bulkTags}
            onchange={() => session.setTagsOnSelection(bulkTags.split(/\s+/).filter(Boolean))}
          />
        </label>
        <p class="hint">{t('insp.bulkTags')}</p>
      </section>
    {/if}

    <Generators />

    <section class="help">
      <h2>{t('hint.title')}</h2>
      <ul>
        <li>{t('hint.add')}</li>
        <li>{t('hint.drag')}</li>
        <li>{t('hint.rect')}</li>
        <li>{t('hint.bond')}</li>
        <li>{t('hint.legDrag')}</li>
        <li>{t('hint.curve')}</li>
        <li>{t('hint.keys')}</li>
      </ul>
    </section>
  {/if}
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
    margin: 0 0 var(--step-4);
    padding-bottom: var(--step-3);
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

  .bulk,
  .help {
    margin-bottom: var(--step-5);
  }

  .help {
    margin-top: var(--step-5);
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--step-3);
  }

  .row span {
    color: var(--c-muted);
  }

  .row input {
    width: 148px;
    padding: 3px var(--step-2);
    border: 1px solid var(--c-rule);
    border-radius: var(--radius);
    background: var(--c-paper);
    color: var(--c-ink);
    font-size: 13px;
  }

  .mono {
    font-family: var(--font-mono);
  }

  .hint {
    margin: var(--step-2) 0 0;
    color: var(--c-muted);
    font-size: 12px;
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
