<script lang="ts">
  import { t } from '../lib/i18n/index.svelte';
  import { bondOfLeg } from '../lib/model/network';
  import type { Shape } from '../lib/model/types';
  import { session } from '../state/session.svelte';

  const SHAPES: Shape[] = ['circle', 'square', 'triangle', 'dot', 'diamond'];
  const ARROWS: ('none' | 'in' | 'out')[] = ['none', 'in', 'out'];

  const tensor = $derived(session.tensor(session.inspecting));

  const deg = (rad: number) => Math.round((rad * 180) / Math.PI);
  const rad = (d: number) => (d * Math.PI) / 180;

  function setTags(value: string) {
    if (!tensor) return;
    session.updateTensor(tensor.id, { tags: value.split(/\s+/).filter(Boolean) });
  }
</script>

{#if tensor}
  <section class="inspector">
    <header>
      <h2>{t('insp.title')}</h2>
      <button type="button" class="close" onclick={() => (session.inspecting = null)}>
        {t('insp.close')}
      </button>
    </header>

    <label class="row">
      <span>{t('insp.name')}</span>
      <input
        class="mono"
        value={tensor.name}
        oninput={(e) => session.updateTensor(tensor.id, { name: e.currentTarget.value })}
      />
    </label>

    <label class="row">
      <span>{t('insp.shape')}</span>
      <select
        value={tensor.shape}
        onchange={(e) => session.setShape(tensor.id, e.currentTarget.value as Shape)}
      >
        {#each SHAPES as shape (shape)}
          <option value={shape}>{t(`shape.${shape}`)}</option>
        {/each}
      </select>
    </label>

    <label class="row">
      <span>{t('insp.tags')}</span>
      <input
        class="mono"
        placeholder={t('insp.tagsHint')}
        value={tensor.tags.join(' ')}
        onchange={(e) => setTags(e.currentTarget.value)}
      />
    </label>

    <label class="row">
      <span>{t('insp.color')}</span>
      <span class="cor">
        <input
          type="color"
          value={tensor.color ?? '#bbbbbb'}
          onchange={(e) => session.setTensorColor(tensor.id, e.currentTarget.value)}
        />
        <button
          type="button"
          class="limpar"
          disabled={!tensor.color}
          onclick={() => session.setTensorColor(tensor.id, undefined)}
        >
          {t('insp.clearColor')}
        </button>
      </span>
    </label>

    <label class="check">
      <input
        type="checkbox"
        checked={tensor.conjugate ?? false}
        onchange={(e) => session.updateTensor(tensor.id, { conjugate: e.currentTarget.checked })}
      />
      <span>{t('insp.conjugate')}</span>
    </label>

    <label class="check">
      <input
        type="checkbox"
        checked={tensor.frozen ?? false}
        onchange={(e) => session.updateTensor(tensor.id, { frozen: e.currentTarget.checked })}
      />
      <span>{t('insp.frozen')}</span>
    </label>

    <label class="check">
      <input
        type="checkbox"
        checked={session.network.orthogonalityCenter === tensor.id}
        onchange={() => session.toggleOrthogonalityCenter(tensor.id)}
      />
      <span>{t('insp.orthocenter')}</span>
    </label>

    <h3>{t('insp.legs')}</h3>
    <table>
      <thead>
        <tr>
          <th></th>
          <th>{t('insp.dim')}</th>
          <th>{t('insp.label')}</th>
          <th>{t('insp.angle')}</th>
          <th>{t('insp.length')}</th>
          <th>{t('insp.arrow')}</th>
          {#if tensor.shape === 'triangle'}<th>{t('insp.tip')}</th>{/if}
        </tr>
      </thead>
      <tbody>
        {#each tensor.legs as leg (leg.id)}
          {@const bound = bondOfLeg(session.network, leg.id) !== undefined}
          <tr>
            <td class="legid" title={bound ? t('insp.bound') : t('insp.free')}>
              <span class="dot" class:bound></span>{leg.id}
            </td>
            <td>
              <input
                class="mono num"
                type="number"
                min="1"
                value={leg.dim ?? ''}
                oninput={(e) =>
                  session.updateLeg(leg.id, {
                    dim: e.currentTarget.value === '' ? undefined : Number(e.currentTarget.value),
                  })}
              />
            </td>
            <td>
              <input
                class="mono"
                value={leg.label ?? ''}
                onchange={(e) => session.updateLeg(leg.id, { label: e.currentTarget.value })}
              />
            </td>
            <td>
              <input
                class="mono num"
                type="number"
                step="5"
                value={deg(leg.angle)}
                oninput={(e) => session.setLegGeometry(leg.id, rad(Number(e.currentTarget.value)), leg.length)}
              />
            </td>
            <td>
              <input
                class="mono num"
                type="number"
                min="10"
                step="2"
                value={Math.round(leg.length)}
                oninput={(e) => session.setLegGeometry(leg.id, leg.angle, Number(e.currentTarget.value))}
              />
            </td>
            <td>
              <select
                value={leg.arrow ?? 'none'}
                onchange={(e) =>
                  session.updateLeg(leg.id, {
                    arrow: e.currentTarget.value === 'none' ? null : (e.currentTarget.value as 'in' | 'out'),
                  })}
              >
                {#each ARROWS as arrow (arrow)}
                  <option value={arrow}>{t(`arrow.${arrow}`)}</option>
                {/each}
              </select>
            </td>
            {#if tensor.shape === 'triangle'}
              <td>
                <input
                  type="radio"
                  name="tip-{tensor.id}"
                  checked={tensor.isometryTip === leg.id}
                  onchange={() => session.updateTensor(tensor.id, { isometryTip: leg.id })}
                />
              </td>
            {/if}
          </tr>
        {/each}
      </tbody>
    </table>
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

  h3 {
    margin: var(--step-3) 0 0;
    font-size: 12px;
    font-weight: 500;
    color: var(--c-muted);
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

  .check {
    display: flex;
    align-items: center;
    gap: var(--step-2);
    color: var(--c-muted);
    cursor: pointer;
  }

  input,
  select {
    min-width: 0;
    padding: 3px var(--step-2);
    border: 1px solid var(--c-rule);
    border-radius: var(--radius);
    background: var(--c-paper);
    color: var(--c-ink);
    font: inherit;
    font-size: 13px;
  }

  .row input,
  .row select {
    width: 148px;
  }

  .mono {
    font-family: var(--font-mono);
  }

  .cor {
    display: flex;
    align-items: center;
    gap: var(--step-2);
    width: 148px;
  }

  .cor input[type='color'] {
    width: 32px;
    height: 24px;
    padding: 1px;
  }

  .limpar {
    padding: 0;
    border: none;
    background: none;
    color: var(--c-muted);
    font-size: 11px;
    cursor: pointer;
  }

  .limpar:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .limpar:hover:not(:disabled) {
    color: var(--c-ink);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }

  th {
    padding: var(--step-1) 2px;
    text-align: left;
    font-weight: 400;
    color: var(--c-muted);
  }

  td {
    padding: 1px 2px;
  }

  .num {
    width: 46px;
  }

  td input:not(.num),
  td select {
    width: 100%;
  }

  .legid {
    white-space: nowrap;
    color: var(--c-muted);
    font-family: var(--font-mono);
  }

  /* Ponto cheio: perna vinculada. Vazio: perna livre. */
  .dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    margin-right: 4px;
    border: 1px solid var(--c-ink);
    border-radius: 50%;
  }

  .dot.bound {
    background: var(--c-ink);
  }
</style>
