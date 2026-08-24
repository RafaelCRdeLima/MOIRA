<script lang="ts">
  import { cssColorResolver, fileName, saveText } from '../lib/export/colors';
  import { toSvg } from '../lib/export/svg';
  import { displayNames } from '../lib/formula/indices';
  import { t, type StringKey } from '../lib/i18n/index.svelte';
  import { buildLegend } from '../lib/render/legend';
  import { computeStyle } from '../lib/render/style';
  import { session } from '../state/session.svelte';

  let comFundo = $state(true);
  let comLegenda = $state(true);

  const vazia = $derived(session.network.tensors.length === 0);

  function exportarSvg() {
    const network = $state.snapshot(session.network) as typeof session.network;
    const style = computeStyle(network);
    const svg = toSvg(network, style, {
      resolveColor: cssColorResolver(),
      translate: (key) => t(key as StringKey),
      names: displayNames(network),
      legend: comLegenda ? buildLegend(network, style) : null,
      background: comFundo,
      title: network.meta.title || 'Rede tensorial',
    });
    saveText(fileName(network.meta.title, 'svg'), svg, 'image/svg+xml');
  }
</script>

<section class="exportar">
  <h2>{t('export.title')}</h2>

  <label class="check">
    <input type="checkbox" bind:checked={comLegenda} />
    <span>{t('export.legend')}</span>
  </label>
  <label class="check">
    <input type="checkbox" bind:checked={comFundo} />
    <span>{t('export.background')}</span>
  </label>

  <div class="botoes">
    <button type="button" disabled={vazia} onclick={exportarSvg}>
      <svg class="ic" width="16" height="16" aria-hidden="true">
        <use href="/assets/moira-icones.svg#ic-exportar" />
      </svg>
      SVG
    </button>
  </div>

  <p class="nota">{t('export.themeNote')}</p>
</section>

<style>
  .exportar {
    margin-bottom: var(--step-5);
  }

  h2 {
    margin: 0 0 var(--step-2);
    font-size: 13px;
    font-weight: 500;
  }

  .check {
    display: flex;
    align-items: center;
    gap: var(--step-2);
    color: var(--c-muted);
    cursor: pointer;
  }

  .botoes {
    display: flex;
    gap: var(--step-2);
    margin-top: var(--step-2);
  }

  button {
    display: inline-flex;
    align-items: center;
    gap: var(--step-2);
    padding: 4px var(--step-3);
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

  .nota {
    margin: var(--step-2) 0 0;
    color: var(--c-muted);
    font-size: 11px;
  }
</style>
