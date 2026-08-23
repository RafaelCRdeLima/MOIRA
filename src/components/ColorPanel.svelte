<script lang="ts">
  import { t, type StringKey } from '../lib/i18n/index.svelte';
  import type { ColorMode } from '../lib/model/types';
  import { COLOR_MODES } from '../lib/render/style';
  import { session } from '../state/session.svelte';

  const network = $derived(session.network);
  const hasValues = $derived(network.bonds.some((b) => b.value !== undefined));
</script>

<section class="cores">
  <h2>{t('color.title')}</h2>

  <div class="modos" role="radiogroup" aria-label={t('color.title')}>
    {#each COLOR_MODES as mode (mode)}
      <button
        type="button"
        role="radio"
        aria-checked={network.colorMode === mode}
        class:on={network.colorMode === mode}
        onclick={() => session.setColorMode(mode as ColorMode)}
      >
        {t(`color.${mode}` as StringKey)}
      </button>
    {/each}
  </div>

  <label class="check">
    <input
      type="checkbox"
      checked={network.showLegend !== false}
      onchange={() => session.toggleLegend()}
    />
    <span>{t('color.legend')}</span>
  </label>

  <label class="check" class:off={!hasValues}>
    <input
      type="checkbox"
      checked={network.edgeColorByValue ?? false}
      disabled={!hasValues}
      onchange={() => session.toggleEdgeColorByValue()}
    />
    <span>{t('color.byValue')}</span>
  </label>
</section>

<style>
  h2 {
    margin: 0 0 var(--step-2);
    font-size: 13px;
    font-weight: 500;
  }

  .cores {
    margin-bottom: var(--step-5);
  }

  .modos {
    display: flex;
    flex-wrap: wrap;
    gap: var(--step-1);
    margin-bottom: var(--step-2);
  }

  button {
    padding: 3px var(--step-2);
    border: 1px solid var(--c-rule);
    border-radius: var(--radius);
    background: var(--c-paper);
    font-size: 12px;
    cursor: pointer;
  }

  button:hover {
    background: var(--c-hover);
  }

  button.on {
    border-color: var(--c-selection);
    color: var(--c-selection);
  }

  .check {
    display: flex;
    align-items: center;
    gap: var(--step-2);
    color: var(--c-muted);
    cursor: pointer;
  }

  .check.off {
    opacity: 0.45;
    cursor: default;
  }
</style>
