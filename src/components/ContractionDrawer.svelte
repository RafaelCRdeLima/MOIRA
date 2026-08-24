<script lang="ts">
  import { DIALECTS, generate, formatCount, formatFlops, scalingLabel } from '../lib/codegen/index';
  import type { Dialect } from '../lib/codegen/index';
  import { t, type StringKey } from '../lib/i18n/index.svelte';
  import { validate } from '../lib/validate/checks';
  import { contraction } from '../state/contraction.svelte';
  import { formula } from '../state/formula.svelte';
  import { session } from '../state/session.svelte';

  const net = $derived(
    contraction.networkFor(session.network, formula.assignmentFor(session.network)),
  );
  const automatico = $derived(contraction.pathFor(net));
  const manual = $derived(contraction.manualPathFor(net));
  const ativo = $derived(contraction.activePathFor(net));
  const diagnostics = $derived(validate(session.network));
  const codigo = $derived(
    generate(contraction.dialect, net, ativo, diagnostics, { examples: contraction.examples }),
  );

  const metodo = $derived(
    t(`cost.${ativo.method === 'exhaustive' ? 'exhaustive' : ativo.method === 'greedy' ? 'greedy' : 'manual'}` as StringKey),
  );

  let editandoOrdem = $state(false);
  let textoOrdem = $state('');
  let copiado = $state(false);

  /** A ordem se digita pelos nomes de variável do código gerado, não pelos
   *  nomes exibidos: num sanduíche, bra e ket mostram o mesmo `A1` no canvas e
   *  a lista ficaria ambígua. No código eles são `A1c` e `A1`. */
  function abrirOrdem() {
    textoOrdem = net.tensors.map((tensor) => tensor.code).join(' ');
    editandoOrdem = true;
  }

  function aplicarOrdem() {
    const nomes = textoOrdem.split(/\s+/).filter(Boolean);
    const porCodigo = new Map(net.tensors.map((tensor) => [tensor.code, tensor.id]));
    // Nome desconhecido vira entrada vazia: o comprimento continua batendo e a
    // validação da ordem recusa, em vez de aceitar uma lista incompleta.
    contraction.manual = nomes.map((n) => porCodigo.get(n) ?? '');
    contraction.useManual = true;
  }

  async function copiar() {
    if (!codigo.source) return;
    try {
      await navigator.clipboard.writeText(codigo.source);
      copiado = true;
      setTimeout(() => (copiado = false), 1400);
    } catch {
      copiado = false;
    }
  }

  function mensagemDoBloqueio(): string {
    const bloqueio = diagnostics.find((d) => d.severity === 'blocking');
    if (!bloqueio) return t('code.empty');
    let texto = t(`valid.${bloqueio.code}` as StringKey);
    for (const [chave, valor] of Object.entries(bloqueio.params)) {
      texto = texto.replace(`{${chave}}`, String(valor));
    }
    return texto;
  }
</script>

<section class="gaveta" class:fechada={!contraction.open}>
  <header>
    <button type="button" class="titulo" aria-expanded={contraction.open} onclick={() => contraction.toggleOpen()}>
      <svg class="ic" width="16" height="16" aria-hidden="true">
        <use href="/assets/moira-icones.svg#ic-ordem" />
      </svg>
      {t('cost.title')}
    </button>

    {#if contraction.open && net.tensors.length > 0}
      <dl class="numeros">
        <div><dt>{t('cost.flops')}</dt><dd>{formatFlops(ativo.flops)}</dd></div>
        <div><dt>{t('cost.scaling')}</dt><dd>{scalingLabel(ativo, true)}</dd></div>
        <div>
          <dt>{t('cost.peak')}</dt>
          <dd>{formatCount(ativo.peakElements)} <span class="unidade">{t('cost.elements')}</span></dd>
        </div>
        <div><dt>{t('cost.method')}</dt><dd class="texto">{metodo}</dd></div>
      </dl>
    {/if}
  </header>

  {#if contraction.open}
    <div class="corpo">
      {#if net.tensors.length === 0}
        <p class="vazio">{t('code.empty')}</p>
      {:else}
        <div class="ordem">
          {#if !editandoOrdem}
            <button type="button" class="ligacao" onclick={abrirOrdem}>{t('cost.fixOrder')}</button>
          {:else}
            <label>
              <span class="rotulo">{t('cost.manualHint')}</span>
              <input class="mono" bind:value={textoOrdem} oninput={aplicarOrdem} />
            </label>
            <label class="check">
              <input type="checkbox" bind:checked={contraction.useManual} />
              <span>{t('cost.useManual')}</span>
            </label>
            <button
              type="button"
              class="ligacao"
              onclick={() => {
                contraction.clearManual();
                editandoOrdem = false;
              }}>{t('cost.dropManual')}</button
            >
            {#if contraction.manual && !manual}
              <p class="erro">{t('cost.manualInvalid')}</p>
            {:else if manual}
              <p class="comparacao">
                {t('cost.comparison')}: {formatFlops(automatico.flops)} × {formatFlops(manual.flops)} —
                {manual.flops > automatico.flops
                  ? t('cost.cheaper')
                  : manual.flops === automatico.flops
                    ? t('cost.same')
                    : t('cost.worse')}
              </p>
            {/if}
          {/if}

          {#if net.assumed > 0}
            <p class="suposto">{net.assumed} {t('cost.assumed')}</p>
          {/if}
        </div>

        <div class="abas" role="tablist" aria-label={t('code.title')}>
          {#each DIALECTS as dialeto (dialeto.id)}
            <button
              type="button"
              role="tab"
              aria-selected={contraction.dialect === dialeto.id}
              class:on={contraction.dialect === dialeto.id}
              onclick={() => contraction.setDialect(dialeto.id as Dialect)}>{dialeto.label}</button
            >
          {/each}
          <label class="check exemplos">
            <input type="checkbox" checked={contraction.examples} onchange={() => contraction.toggleExamples()} />
            <span>{t('code.examples')}</span>
          </label>
          <button type="button" class="copiar" disabled={!codigo.source} onclick={copiar}>
            {copiado ? t('code.copied') : t('code.copy')}
          </button>
        </div>

        {#if codigo.source}
          <pre class="codigo"><code>{codigo.source}</code></pre>
        {:else}
          <p class="bloqueado">
            <strong>{t('code.blocked')}</strong>
            {mensagemDoBloqueio()}
          </p>
        {/if}
      {/if}
    </div>
  {/if}
</section>

<style>
  /* Altura fixa quando aberta, e não conforme o conteúdo: uma gaveta que cresce
     ao receber código encolhe o canvas depois de a vista já ter sido enquadrada
     para o tamanho anterior, e a rede acaba metade fora da tela. */
  .gaveta {
    display: flex;
    flex-direction: column;
    flex: none;
    height: 32vh;
    min-height: 200px;
    border-top: 1px solid var(--c-rule);
    background: var(--c-panel);
  }

  .gaveta.fechada {
    height: auto;
    min-height: 0;
  }

  header {
    display: flex;
    align-items: center;
    gap: var(--step-5);
    padding: var(--step-2) var(--step-4);
    flex-wrap: wrap;
  }

  .titulo {
    display: inline-flex;
    align-items: center;
    gap: var(--step-2);
    padding: 0;
    border: none;
    background: none;
    color: var(--c-muted);
    font-size: 12px;
    cursor: pointer;
  }

  .titulo:hover {
    color: var(--c-ink);
  }

  .numeros {
    display: flex;
    gap: var(--step-5);
    margin: 0;
  }

  .numeros div {
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
    font-size: 14px;
  }

  .unidade {
    color: var(--c-muted);
    font-family: var(--font-ui);
    font-size: 11px;
  }

  dd.texto {
    font-family: var(--font-ui);
    font-size: 12px;
  }

  .corpo {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    padding: 0 var(--step-4) var(--step-3);
  }

  .ordem {
    display: flex;
    align-items: center;
    gap: var(--step-3);
    flex-wrap: wrap;
    margin-bottom: var(--step-2);
    font-size: 12px;
  }

  .ordem label {
    display: inline-flex;
    align-items: center;
    gap: var(--step-2);
  }

  .rotulo,
  .check span {
    color: var(--c-muted);
  }

  .ordem input:not([type='checkbox']) {
    width: 280px;
    padding: 2px var(--step-2);
    border: 1px solid var(--c-rule);
    border-radius: var(--radius);
    background: var(--c-paper);
    color: var(--c-ink);
    font-size: 12px;
  }

  .ligacao {
    padding: 0;
    border: none;
    background: none;
    color: var(--c-selection);
    font-size: 12px;
    cursor: pointer;
  }

  .abas {
    display: flex;
    align-items: center;
    gap: var(--step-1);
    margin-bottom: var(--step-2);
  }

  .abas button {
    padding: 3px var(--step-2);
    border: 1px solid var(--c-rule);
    border-radius: var(--radius);
    background: var(--c-paper);
    font-size: 12px;
    cursor: pointer;
  }

  .abas button:hover:not(:disabled) {
    background: var(--c-hover);
  }

  .abas button.on {
    border-color: var(--c-selection);
    color: var(--c-selection);
  }

  .exemplos {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    gap: var(--step-2);
    font-size: 12px;
    cursor: pointer;
  }

  .copiar:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .codigo {
    margin: 0;
    padding: var(--step-3);
    border: 1px solid var(--c-rule);
    border-radius: var(--radius);
    background: var(--c-paper);
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 1.5;
    overflow: auto;
    min-height: 0;
    white-space: pre;
    tab-size: 2;
  }

  .vazio,
  .suposto,
  .comparacao {
    margin: 0;
    color: var(--c-muted);
    font-size: 12px;
  }

  .erro,
  .bloqueado {
    margin: 0;
    color: var(--c-warning);
    font-size: 12px;
  }
</style>
