<script lang="ts">
  import { t } from '../lib/i18n/pt';
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

<nav class="toolbar" aria-label="Ferramentas">
  <button type="button" onclick={addAtViewCenter}>
    <svg class="ic" width="18" height="18" aria-hidden="true"><use href="/assets/moira-icones.svg#ic-tensor" /></svg>
    {t('tool.addTensor')}
  </button>

  <!-- Apagar não tem desenho em notação, então vai como rótulo em texto: é a
       regra da identidade, não uma lacuna na folha de ícones. -->
  <button type="button" disabled={session.selection.length === 0} onclick={() => session.deleteSelection()}>
    {t('tool.delete')}
  </button>

  {#if session.pendingLeg}
    <span class="pending">{t('bond.pending')}</span>
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

  .ic {
    color: var(--c-ink);
  }

  .pending {
    margin-left: auto;
    color: var(--c-selection);
    font-family: var(--font-mono);
    font-size: 12px;
  }
</style>
