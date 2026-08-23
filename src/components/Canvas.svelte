<script lang="ts">
  import { bondPath, freeLegPath, legTip, shapeOutline, tipAngle } from '../lib/model/geometry';
  import { bondOfLeg } from '../lib/model/network';
  import { t } from '../lib/i18n/pt';
  import { session } from '../state/session.svelte';

  const KEY_STEP = 4;
  const KEY_STEP_FINE = 1;
  const ZOOM_MIN = 0.2;
  const ZOOM_MAX = 4;

  /** As ações do fundo — deslocar, aproximar, teclado — ficam no <div> que
   *  envolve o SVG: um <svg> não é elemento interativo e não deve carregar
   *  esses ouvintes. Os alvos de dentro (pernas, vínculos, corpo do tensor)
   *  têm papel próprio e tratam os seus.  */
  let surface: HTMLDivElement;
  let drag: { kind: 'tensor' | 'pan'; pointerId: number; x: number; y: number } | null = null;
  /** Distingue clique de arrasto: só o clique limpo no fundo desfaz a seleção. */
  let moved = false;

  const network = $derived(session.network);
  const isEmpty = $derived(network.tensors.length === 0);

  function toCanvas(event: PointerEvent | MouseEvent): { x: number; y: number } {
    const rect = surface.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left - session.view.x) / session.view.scale,
      y: (event.clientY - rect.top - session.view.y) / session.view.scale,
    };
  }

  function onBackgroundPointerDown(event: PointerEvent) {
    if (event.button !== 0) return;
    drag = { kind: 'pan', pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    moved = false;
    surface.setPointerCapture(event.pointerId);
  }

  function onTensorPointerDown(event: PointerEvent, tensorId: string) {
    if (event.button !== 0) return;
    event.stopPropagation();
    if (!session.selection.includes(tensorId)) session.select(tensorId, event.shiftKey);
    else if (event.shiftKey) session.select(tensorId, true);
    drag = { kind: 'tensor', pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    moved = false;
    surface.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (dx !== 0 || dy !== 0) moved = true;
    drag.x = event.clientX;
    drag.y = event.clientY;
    if (drag.kind === 'pan') {
      session.view = { ...session.view, x: session.view.x + dx, y: session.view.y + dy };
    } else {
      session.moveSelection(dx / session.view.scale, dy / session.view.scale);
    }
  }

  function onPointerUp(event: PointerEvent) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (drag.kind === 'pan' && !moved) {
      session.clearSelection();
      session.cancelPending();
    }
    if (surface.hasPointerCapture(event.pointerId)) surface.releasePointerCapture(event.pointerId);
    drag = null;
  }

  function onDoubleClick(event: MouseEvent) {
    const point = toCanvas(event);
    session.addTensor(point.x, point.y);
  }

  /** Zoom ancorado no cursor: o ponto sob o ponteiro não se mexe. */
  function onWheel(event: WheelEvent) {
    event.preventDefault();
    const rect = surface.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    const factor = Math.exp(-event.deltaY * 0.0015);
    const scale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, session.view.scale * factor));
    const k = scale / session.view.scale;
    session.view = {
      scale,
      x: px - (px - session.view.x) * k,
      y: py - (py - session.view.y) * k,
    };
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      session.cancelPending();
      session.clearSelection();
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (session.selection.length === 0) return;
      event.preventDefault();
      session.deleteSelection();
      return;
    }
    const step = event.shiftKey ? KEY_STEP_FINE : KEY_STEP;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const delta = moves[event.key];
    if (delta && session.selection.length > 0) {
      event.preventDefault();
      session.moveSelection(delta[0], delta[1]);
    }
  }

  function onTensorKeyDown(event: KeyboardEvent, tensorId: string) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      session.select(tensorId, event.shiftKey);
    }
  }

  function tensorLabel(id: string, name: string): string {
    return name ? `Tensor ${name}` : `Tensor ${id}`;
  }
</script>

<!-- Superfície de manipulação direta: precisa de foco e de teclado para a
     navegação exigida no §4. `role="application"` é o papel certo, mas o
     verificador do Svelte não o conta como interativo. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  bind:this={surface}
  class="surface"
  role="application"
  aria-label={t('canvas.label')}
  tabindex="0"
  onpointerdown={onBackgroundPointerDown}
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
  onpointercancel={onPointerUp}
  ondblclick={onDoubleClick}
  onwheel={onWheel}
  onkeydown={onKeyDown}
>
<svg class="canvas">
  <g transform="translate({session.view.x} {session.view.y}) scale({session.view.scale})">
    <g class="moira-bonds">
      {#each network.bonds as bond (bond.id)}
        {@const d = bondPath(network, bond)}
        {#if d}
          <g class="bond-group">
            <path class="moira-bond" {d} />
            <path
              class="bond-hit"
              {d}
              role="button"
              tabindex="-1"
              aria-label="Desfazer vínculo {bond.id}"
              onclick={(e) => {
                e.stopPropagation();
                session.unbind(bond.id);
              }}
              onkeydown={(e) => e.key === 'Enter' && session.unbind(bond.id)}
            />
          </g>
        {/if}
      {/each}
    </g>

    {#each network.tensors as tensor (tensor.id)}
      {@const selected = session.selection.includes(tensor.id)}
      <g class="moira-tensor" class:selected>
        {#each tensor.legs as leg (leg.id)}
          {#if !bondOfLeg(network, leg.id)}
            {@const tip = legTip(tensor, leg)}
            <path class="moira-leg" d={freeLegPath(tensor, leg)} />
            <circle
              class="leg-hit"
              class:armed={session.pendingLeg === leg.id}
              cx={tip.x}
              cy={tip.y}
              r="8"
              role="button"
              tabindex="-1"
              aria-label="Perna livre {leg.id}"
              onpointerdown={(e) => e.stopPropagation()}
              onclick={(e) => {
                e.stopPropagation();
                session.tapLeg(leg.id);
              }}
              onkeydown={(e) => e.key === 'Enter' && session.tapLeg(leg.id)}
            />
          {/if}
        {/each}

        <g
          class="moira-body"
          transform="translate({tensor.x} {tensor.y})"
          role="button"
          tabindex="0"
          aria-label={tensorLabel(tensor.id, tensor.name)}
          onpointerdown={(e) => onTensorPointerDown(e, tensor.id)}
          onkeydown={(e) => onTensorKeyDown(e, tensor.id)}
        >
          {#if selected}
            <circle class="halo" r="18" />
          {/if}
          <path class="moira-shape shape-{tensor.shape}" d={shapeOutline(tensor.shape, tipAngle(tensor))} />
          {#if tensor.name}
            <text class="moira-name" x="0" y="-20">{tensor.name}</text>
          {/if}
        </g>
      </g>
    {/each}
  </g>
</svg>
</div>

{#if isEmpty}
  <div class="empty">
    <p class="empty-title">{t('canvas.empty')}</p>
    <p class="empty-hint">{t('canvas.emptyHint')}</p>
  </div>
{/if}

<style>
  .surface {
    position: absolute;
    inset: 0;
    background: var(--c-paper);
    touch-action: none;
    cursor: default;
  }

  .canvas {
    display: block;
    width: 100%;
    height: 100%;
  }

  .moira-bond {
    fill: none;
    stroke: var(--c-ink);
    stroke-width: 1.6;
    stroke-linecap: round;
  }

  .bond-hit {
    fill: none;
    stroke: transparent;
    stroke-width: 14;
    cursor: pointer;
  }

  /* Passar o cursor sobre o vínculo mostra em vermelho o que o clique vai desfazer. */
  .bond-group:hover .moira-bond {
    stroke: var(--c-warning);
  }

  .moira-leg {
    fill: none;
    stroke: var(--c-ink);
    stroke-width: 1.4;
    stroke-linecap: round;
  }

  /* A alça da ponta é invisível até ser procurada: o diagrama tem que continuar
     parecendo uma figura, não um formulário. */
  .leg-hit {
    fill: transparent;
    cursor: crosshair;
  }

  .leg-hit:hover {
    fill: var(--c-selection);
    fill-opacity: 0.18;
  }

  .leg-hit.armed {
    fill: var(--c-selection);
    fill-opacity: 0.35;
  }

  .moira-shape {
    fill: var(--c-generic);
    stroke: var(--c-ink);
    stroke-width: 1.6;
  }

  .shape-dot {
    fill: var(--c-ink);
  }

  .moira-body {
    cursor: grab;
  }

  .halo {
    fill: none;
    stroke: var(--c-selection);
    stroke-width: 1.5;
    stroke-dasharray: 3 3;
  }

  .moira-name {
    font-family: var(--font-mono);
    font-size: 12px;
    text-anchor: middle;
    fill: var(--c-ink);
  }

  .empty {
    position: absolute;
    left: 50%;
    top: 42%;
    transform: translate(-50%, -50%);
    text-align: center;
    pointer-events: none;
    max-width: 34ch;
  }

  .empty-title {
    margin: 0 0 var(--step-2);
    font-size: 17px;
  }

  .empty-hint {
    margin: 0;
    color: var(--c-muted);
  }
</style>
