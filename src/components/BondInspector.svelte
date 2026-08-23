<script lang="ts">
  import { t } from '../lib/i18n/index.svelte';
  import { bondWidth } from '../lib/render/style';
  import { session } from '../state/session.svelte';

  const bond = $derived(session.bond(session.inspectingBond));
  const width = $derived(bond ? bondWidth(session.network, bond) : 0);

  const num = (v: string) => (v === '' ? undefined : Number(v));
</script>

{#if bond}
  <section class="inspector">
    <header>
      <h2>{t('insp.bond')} <span class="mono id">{bond.id}</span></h2>
      <button type="button" class="close" onclick={() => (session.inspectingBond = null)}>
        {t('insp.close')}
      </button>
    </header>

    <label class="row">
      <span>{t('insp.dim')}</span>
      <input
        class="mono"
        type="number"
        min="1"
        value={bond.dim ?? ''}
        oninput={(e) => session.updateBond(bond.id, { dim: num(e.currentTarget.value) })}
      />
    </label>

    <label class="row">
      <span>{t('insp.label')}</span>
      <input
        class="mono"
        value={bond.label ?? ''}
        onchange={(e) => session.updateBond(bond.id, { label: e.currentTarget.value || undefined })}
      />
    </label>

    <label class="row">
      <span>{t('insp.value')}</span>
      <input
        class="mono"
        type="number"
        step="0.01"
        value={bond.value ?? ''}
        oninput={(e) => session.updateBond(bond.id, { value: num(e.currentTarget.value) })}
      />
    </label>

    <label class="row">
      <span>{t('insp.curvature')}</span>
      <input
        class="mono"
        type="range"
        min="-1.5"
        max="1.5"
        step="0.05"
        value={bond.curvature}
        oninput={(e) => session.updateBond(bond.id, { curvature: Number(e.currentTarget.value) })}
      />
    </label>

    <!-- A espessura não se edita: ela é log(D) e sai da dimensão. Mostrá-la
         deixa claro que a aresta grossa quer dizer alguma coisa. -->
    <p class="derivada">espessura {width} px ∝ log(D)</p>
  </section>
{/if}

<style>
  .inspector {
    display: flex;
    flex-direction: column;
    gap: var(--step-2);
  }

  header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }

  h2 {
    margin: 0;
    font-size: 13px;
    font-weight: 500;
  }

  .id {
    color: var(--c-muted);
    font-size: 12px;
  }

  .close {
    border: none;
    background: none;
    color: var(--c-muted);
    cursor: pointer;
    padding: 0;
  }

  .close:hover {
    color: var(--c-ink);
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
    font: inherit;
    font-size: 13px;
  }

  .row input[type='range'] {
    padding: 0;
    border: none;
    background: none;
  }

  .mono {
    font-family: var(--font-mono);
  }

  .derivada {
    margin: var(--step-2) 0 0;
    color: var(--c-muted);
    font-family: var(--font-mono);
    font-size: 11px;
  }
</style>
