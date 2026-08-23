<script lang="ts">
  import { t, type StringKey } from '../lib/i18n/index.svelte';
  import type { Legend } from '../lib/render/legend';
  import { viridis } from '../lib/render/palette';

  /** Desenhada dentro do próprio SVG, em coordenadas de tela: assim ela não
   *  escala com o zoom e vai junto na exportação do M4. */
  let { legend }: { legend: Legend } = $props();

  const ROW = 18;
  const RAMP_W = 128;
  const STOPS = 12;

  const stops = Array.from({ length: STOPS }, (_, i) => ({
    offset: `${(i / (STOPS - 1)) * 100}%`,
    color: viridis(i / (STOPS - 1)),
  }));

  const label = (item: { text?: string; key?: string }) =>
    item.text ?? (item.key ? t(item.key as StringKey) : '');

  const round = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

  /** Alturas acumuladas, para que os blocos não se sobreponham quando a
   *  legenda tem amostras e rampa ao mesmo tempo. */
  const swatchesTop = 22;
  const rampTop = $derived(swatchesTop + legend.swatches.length * ROW + 4);
  const valueTop = $derived(rampTop + (legend.ramp ? 44 : 0) + 12);
  const height = $derived(
    (legend.valueRamp ? valueTop + 42 : legend.ramp ? rampTop + 34 : rampTop + 2) + 6,
  );

  /** Largura pelo rótulo mais comprido: 6.7 px por caractere na mono de 11 px.
   *  Aproximação, mas é uma caixa de fundo, não uma coluna de tabela. */
  const width = $derived(
    Math.max(
      92,
      RAMP_W + 16,
      ...legend.swatches.map((item) => 17 + label(item).length * 6.7 + 12),
      t(legend.titleKey as StringKey).length * 6 + 12,
      legend.valueRamp ? t(legend.valueRamp.key as StringKey).length * 6.7 + 12 : 0,
    ),
  );
</script>

<g class="moira-legend" transform="translate(16 16)">
  <rect class="fundo" x="-9" y="-9" width={width} height={height} rx="4" />
  <text class="titulo" x="0" y="10">{t(legend.titleKey as StringKey)}</text>

  {#each legend.swatches as swatch, i (swatch.text ?? swatch.key ?? i)}
    <g transform="translate(0 {22 + i * ROW})">
      <rect class="amostra" width="11" height="11" rx="2" fill={swatch.color} />
      <text class="rotulo" x="17" y="9.5">{label(swatch)}</text>
    </g>
  {/each}

  {#if legend.ramp}
    <g transform="translate(0 {rampTop})">
      <defs>
        <linearGradient id="moira-rampa" x1="0" x2="1" y1="0" y2="0">
          {#each stops as stop (stop.offset)}
            <stop offset={stop.offset} stop-color={stop.color} />
          {/each}
        </linearGradient>
      </defs>
      <rect class="barra" width={RAMP_W} height="9" rx="2" fill="url(#moira-rampa)" />
      <text class="rotulo" x="0" y="21">
        {legend.ramp.labels ? t(legend.ramp.labels[0] as StringKey) : round(legend.ramp.min)}
      </text>
      <text class="rotulo fim" x={RAMP_W} y="21">
        {legend.ramp.labels ? t(legend.ramp.labels[1] as StringKey) : round(legend.ramp.max)}
      </text>
    </g>
  {/if}

  {#if legend.valueRamp}
    <g transform="translate(0 {valueTop})">
      <defs>
        <linearGradient id="moira-rampa-valor" x1="0" x2="1" y1="0" y2="0">
          {#each stops as stop (stop.offset)}
            <stop offset={stop.offset} stop-color={stop.color} />
          {/each}
        </linearGradient>
      </defs>
      <text class="titulo" x="0" y="0">{t(legend.valueRamp.key as StringKey)}</text>
      <rect class="barra" y="8" width={RAMP_W} height="9" rx="2" fill="url(#moira-rampa-valor)" />
      <text class="rotulo" x="0" y="29">{round(legend.valueRamp.min)}</text>
      <text class="rotulo fim" x={RAMP_W} y="29">{round(legend.valueRamp.max)}</text>
    </g>
  {/if}
</g>

<style>
  .moira-legend {
    pointer-events: none;
  }

  .fundo {
    fill: var(--c-paper);
    fill-opacity: 0.92;
    stroke: var(--c-rule);
    stroke-width: 1;
  }

  .titulo {
    font-family: var(--font-ui);
    font-size: 11px;
    fill: var(--c-muted);
  }

  .rotulo {
    font-family: var(--font-mono);
    font-size: 11px;
    fill: var(--c-ink);
  }

  .fim {
    text-anchor: end;
  }

  .amostra,
  .barra {
    stroke: var(--c-rule);
    stroke-width: 1;
  }
</style>
