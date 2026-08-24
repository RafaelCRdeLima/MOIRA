<script lang="ts">
  import { cssColorResolver, fileName, saveText } from '../lib/export/colors';
  import { isLight, toSvg } from '../lib/export/svg';
  import { toTikz } from '../lib/export/tikz';
  import { displayNames } from '../lib/formula/indices';
  import { t, type StringKey } from '../lib/i18n/index.svelte';
  import { buildLegend } from '../lib/render/legend';
  import { computeStyle } from '../lib/render/style';
  import { session } from '../state/session.svelte';
  import { theme } from '../state/theme.svelte';

  let comFundo = $state(true);
  let comLegenda = $state(true);
  /** Documento completo compila direto; trecho se cola num artigo existente. */
  let documentoCompleto = $state(true);

  const vazia = $derived(session.network.tensors.length === 0);

  /** Traço claro sem fundo some num documento branco. Olha a cor de verdade,
   *  e não o seletor de tema: uma paleta manual clara cai no mesmo caso. */
  const tintaClara = $derived.by(() => {
    void theme.mode; // reavalia quando o tema muda
    if (typeof document === 'undefined') return false;
    return isLight(cssColorResolver()('var(--c-ink)'));
  });
  const somemNoBranco = $derived(!comFundo && tintaClara);

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

  function exportarTikz() {
    const network = $state.snapshot(session.network) as typeof session.network;
    const tex = toTikz(network, computeStyle(network), {
      resolveColor: cssColorResolver(),
      names: displayNames(network),
      title: network.meta.title || 'Rede tensorial',
      standalone: documentoCompleto,
    });
    saveText(fileName(network.meta.title, 'tex'), tex, 'text/x-tex');
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

  <label class="check">
    <input type="checkbox" bind:checked={documentoCompleto} />
    <span>{t('export.standalone')}</span>
  </label>

  <div class="botoes">
    <button type="button" disabled={vazia} onclick={exportarSvg}>
      <svg class="ic" width="16" height="16" aria-hidden="true">
        <use href="/assets/moira-icones.svg#ic-exportar" />
      </svg>
      SVG
    </button>
    <button type="button" disabled={vazia} onclick={exportarTikz}>
      <svg class="ic" width="16" height="16" aria-hidden="true">
        <use href="/assets/moira-icones.svg#ic-exportar" />
      </svg>
      TikZ
    </button>
  </div>

  {#if somemNoBranco}
    <p class="aviso">{t('export.darkWarning')}</p>
  {:else}
    <p class="nota">{t('export.themeNote')}</p>
  {/if}
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

  .aviso {
    margin: var(--step-2) 0 0;
    color: var(--c-warning);
    font-size: 11px;
  }
</style>
