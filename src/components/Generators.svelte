<script lang="ts">
  import { GENERATORS, type GeneratorSpec } from '../lib/generators/index';
  import { t, type StringKey } from '../lib/i18n/index.svelte';
  import { session } from '../state/session.svelte';

  /** Valores correntes de cada gerador, guardados por id para que fechar e
   *  reabrir a seção não perca o que já foi digitado. */
  let params = $state<Record<string, Record<string, number>>>(
    Object.fromEntries(
      GENERATORS.map((spec) => [spec.id, Object.fromEntries(spec.params.map((p) => [p.key, p.default]))]),
    ),
  );
  let periodic = $state<Record<string, boolean>>({});
  let open = $state<string | null>(GENERATORS[0]!.id);

  function insert(spec: GeneratorSpec) {
    session.insertFragment(spec.build(params[spec.id]!, periodic[spec.id] ?? false));
    const stage = document.querySelector<HTMLElement>('.stage');
    if (stage) session.fitTo({ w: stage.clientWidth, h: stage.clientHeight }, session.selection);
  }
</script>

<section class="generators">
  <h2>{t('gen.title')}</h2>

  <ul>
    {#each GENERATORS as spec (spec.id)}
      <li class:open={open === spec.id}>
        <button
          type="button"
          class="head"
          aria-expanded={open === spec.id}
          onclick={() => (open = open === spec.id ? null : spec.id)}
        >
          <svg class="ic" width="18" height="18" aria-hidden="true">
            <use href="/assets/moira-icones.svg#{spec.icon}" />
          </svg>
          {t(spec.labelKey as StringKey)}
        </button>

        {#if open === spec.id}
          <div class="body">
            {#each spec.params as param (param.key)}
              <label>
                <span>{t(param.labelKey as StringKey)}</span>
                <input
                  type="number"
                  min={param.min}
                  max={param.max}
                  step={param.step ?? 1}
                  bind:value={params[spec.id]![param.key]}
                />
              </label>
            {/each}

            {#if spec.periodic}
              <label class="check">
                <input type="checkbox" bind:checked={periodic[spec.id]} />
                <span>{t('gen.periodic')}</span>
              </label>
            {/if}

            <button type="button" class="insert" onclick={() => insert(spec)}>{t('gen.insert')}</button>
          </div>
        {/if}
      </li>
    {/each}
  </ul>
</section>

<style>
  h2 {
    margin: 0 0 var(--step-3);
    font-size: 13px;
    font-weight: 500;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li + li {
    margin-top: 2px;
  }

  .head {
    display: flex;
    align-items: center;
    gap: var(--step-2);
    width: 100%;
    padding: 6px var(--step-2);
    border: 1px solid transparent;
    border-radius: var(--radius);
    background: transparent;
    text-align: left;
    cursor: pointer;
  }

  .head:hover {
    background: var(--c-hover);
  }

  li.open > .head {
    border-color: var(--c-rule);
    background: var(--c-paper);
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: var(--step-2);
    padding: var(--step-3) var(--step-2) var(--step-4) 30px;
  }

  label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--step-3);
    color: var(--c-muted);
  }

  .check {
    justify-content: flex-start;
  }

  input[type='number'] {
    width: 68px;
    padding: 3px var(--step-2);
    border: 1px solid var(--c-rule);
    border-radius: var(--radius);
    background: var(--c-paper);
    color: var(--c-ink);
    font-family: var(--font-mono);
    font-size: 13px;
  }

  .insert {
    align-self: flex-start;
    margin-top: var(--step-1);
    padding: 5px var(--step-3);
    border: 1px solid var(--c-rule);
    border-radius: var(--radius);
    background: var(--c-paper);
    cursor: pointer;
  }

  .insert:hover {
    background: var(--c-hover);
  }

  .ic {
    color: var(--c-ink);
    flex: none;
  }
</style>
