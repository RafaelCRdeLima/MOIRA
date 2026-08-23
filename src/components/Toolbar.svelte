<script lang="ts">
  import { t } from '../lib/i18n/index.svelte';
  import { session } from '../state/session.svelte';

  /** Novo tensor no centro da vista, e não numa coordenada fixa. */
  function addAtViewCenter() {
    const stage = document.querySelector<HTMLElement>('.stage');
    const w = stage?.clientWidth ?? 800;
    const h = stage?.clientHeight ?? 600;
    session.addTensor(
      (w / 2 - session.view.x) / session.view.scale,
      (h / 2 - session.view.y) / session.view.scale,
    );
  }
</script>

<nav class="toolbar" aria-label={t('tool.generators')}>
  <button type="button" onclick={addAtViewCenter} title="{t('tool.addTensor')}">
    <svg class="ic" width="18" height="18" aria-hidden="true"><use href="/assets/moira-icones.svg#ic-tensor" /></svg>
    {t('tool.addTensor')}
  </button>

  <span class="sep" role="separator"></span>

  <!-- Desfazer, refazer, copiar, colar e apagar não têm desenho em notação
       tensorial, então vão como rótulo em texto: é a regra da identidade, não
       uma lacuna na folha de ícones. -->
  <button type="button" disabled={session.historyDepth === 0} onclick={() => session.undo()} title="Ctrl+Z">
    {t('tool.undo')}
  </button>
  <button type="button" disabled={session.redoDepth === 0} onclick={() => session.redo()} title="Ctrl+Shift+Z">
    {t('tool.redo')}
  </button>
  <button type="button" disabled={session.selection.length === 0} onclick={() => session.copy()} title="Ctrl+C">
    {t('tool.copy')}
  </button>
  <button type="button" disabled={!session.hasClipboard} onclick={() => session.paste()} title="Ctrl+V">
    {t('tool.paste')}
  </button>
  <button type="button" disabled={session.selection.length === 0} onclick={() => session.deleteSelection()}>
    {t('tool.delete')}
  </button>

  <span class="sep" role="separator"></span>

  <label class="switch">
    <input type="checkbox" bind:checked={session.grid.on} />
    {t('tool.grid')}
  </label>

  {#if session.pendingLeg}
    <span class="pending">{t('bond.pending')}</span>
  {:else if session.selection.length > 1}
    <span class="count">{session.selection.length} {t('insp.multiple')}</span>
  {/if}
</nav>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    gap: var(--step-2);
    padding: var(--step-2) var(--step-4);
    border-bottom: 1px solid var(--c-rule);
    background: var(--c-panel);
    flex-wrap: wrap;
  }

  button {
    display: inline-flex;
    align-items: center;
    gap: var(--step-2);
    padding: 5px var(--step-3);
    border: 1px solid var(--c-rule);
    border-radius: var(--radius);
    background: var(--c-paper);
    cursor: pointer;
  }

  button:hover:not(:disabled) {
    background: var(--c-hover);
  }

  button:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .sep {
    width: 1px;
    height: 20px;
    background: var(--c-rule);
  }

  .switch {
    display: inline-flex;
    align-items: center;
    gap: var(--step-2);
    color: var(--c-muted);
    cursor: pointer;
  }

  .ic {
    color: var(--c-ink);
  }

  .pending,
  .count {
    margin-left: auto;
    font-family: var(--font-mono);
    font-size: 12px;
  }

  .pending {
    color: var(--c-selection);
  }

  .count {
    color: var(--c-muted);
  }
</style>
