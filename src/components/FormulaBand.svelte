<script lang="ts">
  import katex from 'katex';
  import { t } from '../lib/i18n/index.svelte';
  import { buildFormula } from '../lib/formula/latex';
  import { formula } from '../state/formula.svelte';
  import { session } from '../state/session.svelte';

  const expressao = $derived(
    buildFormula(session.network, formula.assignmentFor(session.network), formula.options),
  );

  /** O KaTeX lança em expressão malformada; a faixa mostra o motivo em vez de
   *  sumir, porque uma fórmula que desaparece em silêncio é pior que uma errada. */
  const renderizada = $derived.by(() => {
    if (expressao.empty) return null;
    try {
      return {
        html: katex.renderToString(expressao.latex, { displayMode: false, throwOnError: true }),
        erro: null,
      };
    } catch (erro) {
      return { html: null, erro: erro instanceof Error ? erro.message : String(erro) };
    }
  });

  let copiado = $state(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(expressao.latex);
      copiado = true;
      setTimeout(() => (copiado = false), 1400);
    } catch {
      copiado = false;
    }
  }
</script>

<section class="faixa" class:recolhida={formula.collapsed} aria-label={t('formula.title')}>
  <div class="controles">
    <button
      type="button"
      class="recolher"
      aria-expanded={!formula.collapsed}
      onclick={() => (formula.collapsed = !formula.collapsed)}
    >
      <svg class="ic" width="16" height="16" aria-hidden="true">
        <use href="/assets/moira-icones.svg#ic-formula" />
      </svg>
      {t('formula.title')}
    </button>

    {#if !formula.collapsed}
      <!-- O botão que alterna somatório e Einstein fica aqui à vista, não num
           menu: é escolha de notação, e o §8.1 pede que seja visível. -->
      <div class="alternar" role="radiogroup" aria-label={t('formula.summation')}>
        <button
          type="button"
          role="radio"
          aria-checked={formula.summation === 'explicit'}
          class:on={formula.summation === 'explicit'}
          onclick={() => formula.setSummation('explicit')}>{t('formula.explicit')}</button
        >
        <button
          type="button"
          role="radio"
          aria-checked={formula.summation === 'einstein'}
          class:on={formula.summation === 'einstein'}
          onclick={() => formula.setSummation('einstein')}>{t('formula.einstein')}</button
        >
      </div>

      <div class="alternar" role="radiogroup" aria-label={t('formula.conjugate')}>
        <button
          type="button"
          role="radio"
          aria-checked={formula.conjugate === 'dagger'}
          class:on={formula.conjugate === 'dagger'}
          onclick={() => formula.setConjugate('dagger')}>†</button
        >
        <button
          type="button"
          role="radio"
          aria-checked={formula.conjugate === 'asterisk'}
          class:on={formula.conjugate === 'asterisk'}
          onclick={() => formula.setConjugate('asterisk')}>∗</button
        >
      </div>

      <button type="button" class="copiar" disabled={expressao.empty} onclick={copiar}>
        {copiado ? t('formula.copied') : t('formula.copy')}
      </button>
    {/if}
  </div>

  {#if !formula.collapsed}
    <div class="expressao">
      {#if expressao.empty}
        <p class="vazio">{t('formula.emptyNetwork')}</p>
      {:else if renderizada?.erro}
        <p class="erro">{t('formula.error')} {renderizada.erro}</p>
      {:else}
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html renderizada?.html}
      {/if}
    </div>
  {/if}
</section>

<style>
  .faixa {
    border-bottom: 1px solid var(--c-rule);
    background: var(--c-paper);
  }

  .controles {
    display: flex;
    align-items: center;
    gap: var(--step-3);
    padding: var(--step-2) var(--step-4);
  }

  .recolher {
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

  .recolher:hover {
    color: var(--c-ink);
  }

  .alternar {
    display: inline-flex;
    border: 1px solid var(--c-rule);
    border-radius: var(--radius);
    overflow: hidden;
  }

  .alternar button {
    padding: 2px var(--step-2);
    border: none;
    background: var(--c-paper);
    font-size: 12px;
    cursor: pointer;
  }

  .alternar button:hover {
    background: var(--c-hover);
  }

  .alternar button.on {
    background: var(--c-hover);
    color: var(--c-selection);
  }

  .copiar {
    margin-left: auto;
    padding: 3px var(--step-3);
    border: 1px solid var(--c-rule);
    border-radius: var(--radius);
    background: var(--c-paper);
    font-size: 12px;
    cursor: pointer;
  }

  .copiar:hover:not(:disabled) {
    background: var(--c-hover);
  }

  .copiar:disabled {
    opacity: 0.4;
    cursor: default;
  }

  /* A expressão de uma rede grande é longa por natureza: rola na horizontal
     dentro da faixa, e nunca empurra a largura da página. */
  .expressao {
    max-width: 100%;
    padding: 0 var(--step-4) var(--step-3);
    overflow-x: auto;
    overflow-y: hidden;
    white-space: nowrap;
    color: var(--c-ink);
  }

  /* O HTML do KaTeX entra por {@html} e não recebe o escopo do componente,
     então o alcance precisa ser global. A fórmula é o par simétrico do painel
     de código: compõe um pouco maior que o texto da interface. */
  .expressao :global(.katex) {
    font-size: 1.25em;
  }

  .vazio,
  .erro {
    margin: 0;
    color: var(--c-muted);
    font-size: 13px;
  }

  .erro {
    color: var(--c-warning);
    font-family: var(--font-mono);
    font-size: 12px;
    white-space: normal;
  }

  .ic {
    color: currentColor;
  }
</style>
