<script lang="ts">
  import katex from 'katex';
  import { t } from '../lib/i18n/index.svelte';
  import { buildFormula } from '../lib/formula/latex';
  import { formula } from '../state/formula.svelte';
  import { session } from '../state/session.svelte';

  const expressao = $derived(
    buildFormula(session.network, formula.assignmentFor(session.network), formula.options),
  );

  /** Cada pedaço é composto por si para que o fator seja um alvo próprio de
   *  cursor. Compor a expressão inteira de uma vez daria um bloco só, e não
   *  haveria como realçar o fator que corresponde ao nó sob o cursor.
   *
   *  O cache é pelo LaTeX do pedaço: durante um arrasto os fatores mudam de
   *  ordem mas não de conteúdo, então uma rede grande não recompõe nada. */
  const cache = new Map<string, string>();
  const LIMITE_CACHE = 2000;

  function compor(latex: string): { html: string | null; erro: string | null } {
    const guardado = cache.get(latex);
    if (guardado !== undefined) return { html: guardado, erro: null };
    try {
      const html = katex.renderToString(latex, { displayMode: false, throwOnError: true });
      if (cache.size > LIMITE_CACHE) cache.clear();
      cache.set(latex, html);
      return { html, erro: null };
    } catch (erro) {
      return { html: null, erro: erro instanceof Error ? erro.message : String(erro) };
    }
  }

  /** O KaTeX lança em expressão malformada; a faixa mostra o motivo em vez de
   *  sumir, porque uma fórmula que desaparece em silêncio é pior que uma errada. */
  const composta = $derived.by(() => {
    if (expressao.empty) return null;
    const pedacos = [
      compor(`${expressao.lhs} =`),
      ...(expressao.sum ? [compor(expressao.sum)] : []),
      ...expressao.factors.map((f) => compor(f.latex)),
    ];
    const falha = pedacos.find((p) => p.erro);
    return {
      erro: falha?.erro ?? null,
      lhs: pedacos[0]!.html,
      sum: expressao.sum ? pedacos[1]!.html : null,
      fatores: expressao.factors.map((f, i) => ({
        ...f,
        html: pedacos[(expressao.sum ? 2 : 1) + i]!.html,
      })),
    };
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
      {:else if composta?.erro}
        <p class="erro">{t('formula.error')} {composta.erro}</p>
      {:else if composta}
        <!-- eslint-disable svelte/no-at-html-tags -->
        <span class="pedaco">{@html composta.lhs}</span>
        {#if composta.sum}<span class="pedaco">{@html composta.sum}</span>{/if}
        {#each composta.fatores as fator (fator.tensorId)}
          <span
            class="fator"
            class:realcado={session.hovered === fator.tensorId}
            role="button"
            tabindex="-1"
            aria-label={fator.name}
            onpointerenter={() => (session.hovered = fator.tensorId)}
            onpointerleave={() => session.hovered === fator.tensorId && (session.hovered = null)}
            onclick={() => {
              session.select(fator.tensorId);
              session.inspecting = fator.tensorId;
            }}
            onkeydown={(e) => e.key === 'Enter' && (session.inspecting = fator.tensorId)}
          >{@html fator.html}</span>
        {/each}
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

  .pedaco {
    margin-right: 0.35em;
  }

  /* Alvo de cursor por fator: passar por ele realça o nó no diagrama, e passar
     pelo nó realça o fator. É o que torna a faixa conferível contra o desenho. */
  .fator {
    display: inline-block;
    margin-right: 0.4em;
    padding: 0 2px;
    border-radius: 3px;
    cursor: pointer;
  }

  .fator.realcado {
    background: color-mix(in srgb, var(--c-selection) 18%, transparent);
    color: var(--c-selection);
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
