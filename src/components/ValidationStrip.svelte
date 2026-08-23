<script lang="ts">
  import { t, type StringKey } from '../lib/i18n/index.svelte';
  import type { Diagnostic } from '../lib/validate/checks';
  import { validate } from '../lib/validate/checks';
  import { session } from '../state/session.svelte';

  const diagnostics = $derived(validate(session.network));

  /** A mensagem vem do dicionário com os valores substituídos: a verificação
   *  devolve código e parâmetros, e serve aos dois idiomas sem saber de nenhum. */
  function mensagem(d: Diagnostic): string {
    let texto = t(`valid.${d.code}` as StringKey);
    for (const [chave, valor] of Object.entries(d.params)) {
      texto = texto.replace(`{${chave}}`, String(valor));
    }
    return texto;
  }

  function realcar(d: Diagnostic) {
    const tensores = d.targets.filter((id) => session.network.tensors.some((t) => t.id === id));
    if (tensores.length > 0) session.selectMany(tensores);
  }
</script>

{#if diagnostics.length > 0}
  <!-- Sempre visível, nunca modal: o §11 é explícito. Fica na base do canvas,
       onde não cobre o diagrama e não exige ser fechado para trabalhar. -->
  <aside class="avisos" aria-label={t('valid.title')}>
    <ul>
      {#each diagnostics as d, i (d.code + i)}
        <li class:bloqueio={d.severity === 'blocking'}>
          <button type="button" onclick={() => realcar(d)}>{mensagem(d)}</button>
        </li>
      {/each}
    </ul>
  </aside>
{/if}

<style>
  /* Sobrepõe o canvas sem bloqueá-lo: só o texto do aviso recebe o cursor, e
     o resto da faixa deixa o clique passar para o diagrama embaixo. Uma tarja
     que engole clique é modal na prática, e o §11 diz que não pode ser. */
  .avisos {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    max-height: 26%;
    overflow-y: auto;
    padding: var(--step-2) var(--step-4);
    border-top: 1px solid var(--c-rule);
    background: color-mix(in srgb, var(--c-paper) 92%, transparent);
    backdrop-filter: blur(2px);
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    align-items: baseline;
    gap: var(--step-2);
    font-size: 12px;
  }

  li::before {
    content: '';
    flex: none;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--c-orthocenter);
  }

  li.bloqueio::before {
    background: var(--c-warning);
  }

  button {
    pointer-events: auto;
    padding: 1px 0;
    border: none;
    background: none;
    text-align: left;
    color: var(--c-muted);
    cursor: pointer;
  }

  button:hover {
    color: var(--c-ink);
  }

  li.bloqueio button {
    color: var(--c-warning);
  }
</style>
