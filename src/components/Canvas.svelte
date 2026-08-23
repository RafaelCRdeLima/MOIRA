<script lang="ts">
  import { t } from '../lib/i18n/index.svelte';
  import { bondMidpoint, bondPath, freeLegPath, legTip, shapeOutline, tipAngle } from '../lib/model/geometry';
  import { bondOfLeg } from '../lib/model/network';
  import { buildLegend } from '../lib/render/legend';
  import {
    bondStroke,
    bondWidth,
    computeStyle,
    legWidth,
    tensorFill,
    tensorRing,
  } from '../lib/render/style';
  import { session } from '../state/session.svelte';
  import Legend from './Legend.svelte';

  const NUDGE = 4;
  const NUDGE_FINE = 1;
  const ZOOM_MIN = 0.2;
  const ZOOM_MAX = 4;

  /** As ações do fundo — deslocar, aproximar, teclado — ficam no <div> que
   *  envolve o SVG: um <svg> não é elemento interativo e não deve carregar
   *  esses ouvintes. Os alvos de dentro têm papel próprio e tratam os seus. */
  let surface: HTMLDivElement;

  type Gesture =
    | { kind: 'pan'; pointerId: number; lastX: number; lastY: number }
    | { kind: 'rect'; pointerId: number; x0: number; y0: number; x1: number; y1: number; additive: boolean }
    | { kind: 'tensor'; pointerId: number; startX: number; startY: number }
    | { kind: 'leg'; pointerId: number; legId: string; moved: boolean }
    | { kind: 'bond'; pointerId: number; bondId: string };

  let gesture: Gesture | null = $state(null);
  let captured: Element | null = null;
  let moved = false;

  const network = $derived(session.network);
  const isEmpty = $derived(network.tensors.length === 0);
  /** A rede é medida uma vez por quadro; cada tensor consulta o resultado em
   *  vez de varrer a rede inteira para descobrir o intervalo das rampas. */
  const style = $derived(computeStyle(network));
  const legend = $derived(buildLegend(network, style));
  /** Função à parte porque o estreitamento de união não sobrevive dentro de
   *  um $derived sobre uma variável mutável. */
  function asRect(g: Gesture | null): Extract<Gesture, { kind: 'rect' }> | null {
    return g && g.kind === 'rect' ? g : null;
  }
  const rect = $derived(asRect(gesture));

  function toCanvas(event: { clientX: number; clientY: number }): { x: number; y: number } {
    const box = surface.getBoundingClientRect();
    return {
      x: (event.clientX - box.left - session.view.x) / session.view.scale,
      y: (event.clientY - box.top - session.view.y) / session.view.scale,
    };
  }

  /** A captura de ponteiro vai no elemento que começou o gesto, não na
   *  superfície: capturar na superfície redireciona para ela também os eventos
   *  de mouse derivados, e o duplo clique num tensor acabava criando outro
   *  tensor no fundo em vez de abrir o inspetor. Os movimentos continuam
   *  chegando aos ouvintes da superfície por borbulhamento. */
  function capture(event: PointerEvent, el: Element) {
    el.setPointerCapture(event.pointerId);
    captured = el;
    moved = false;
  }

  function release(event: PointerEvent) {
    if (captured?.hasPointerCapture(event.pointerId)) captured.releasePointerCapture(event.pointerId);
    captured = null;
  }

  function onBackgroundPointerDown(event: PointerEvent) {
    if (event.button !== 0) return;
    if (event.shiftKey) {
      const p = toCanvas(event);
      gesture = { kind: 'rect', pointerId: event.pointerId, x0: p.x, y0: p.y, x1: p.x, y1: p.y, additive: event.ctrlKey || event.metaKey };
    } else {
      gesture = { kind: 'pan', pointerId: event.pointerId, lastX: event.clientX, lastY: event.clientY };
    }
    capture(event, surface);
  }

  function onTensorPointerDown(event: PointerEvent, tensorId: string) {
    if (event.button !== 0) return;
    event.stopPropagation();
    if (event.shiftKey) session.select(tensorId, true);
    else if (!session.selection.includes(tensorId)) session.select(tensorId);
    session.beginDrag();
    gesture = { kind: 'tensor', pointerId: event.pointerId, startX: event.clientX, startY: event.clientY };
    capture(event, event.currentTarget as Element);
  }

  function onLegPointerDown(event: PointerEvent, legId: string) {
    if (event.button !== 0) return;
    event.stopPropagation();
    session.beginGesture();
    gesture = { kind: 'leg', pointerId: event.pointerId, legId, moved: false };
    capture(event, event.currentTarget as Element);
  }

  function onBondHandlePointerDown(event: PointerEvent, bondId: string) {
    if (event.button !== 0) return;
    event.stopPropagation();
    session.beginGesture();
    gesture = { kind: 'bond', pointerId: event.pointerId, bondId };
    capture(event, event.currentTarget as Element);
  }

  function onPointerMove(event: PointerEvent) {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    moved = true;

    switch (gesture.kind) {
      case 'pan': {
        const dx = event.clientX - gesture.lastX;
        const dy = event.clientY - gesture.lastY;
        gesture.lastX = event.clientX;
        gesture.lastY = event.clientY;
        session.view = { ...session.view, x: session.view.x + dx, y: session.view.y + dy };
        session.touchView();
        break;
      }
      case 'rect': {
        const p = toCanvas(event);
        gesture.x1 = p.x;
        gesture.y1 = p.y;
        break;
      }
      case 'tensor': {
        session.dragBy(
          (event.clientX - gesture.startX) / session.view.scale,
          (event.clientY - gesture.startY) / session.view.scale,
        );
        break;
      }
      case 'leg': {
        gesture.moved = true;
        session.dragLegTo(gesture.legId, toCanvas(event));
        break;
      }
      case 'bond': {
        session.dragBondTo(gesture.bondId, toCanvas(event));
        break;
      }
    }
  }

  function onPointerUp(event: PointerEvent) {
    if (!gesture || event.pointerId !== gesture.pointerId) return;

    switch (gesture.kind) {
      case 'pan':
        // Clique limpo no fundo: larga a seleção e o vínculo pendente.
        if (!moved) {
          session.clearSelection();
          session.cancelPending();
        }
        break;
      case 'rect':
        session.selectMany(
          session.tensorsInRect(gesture.x0, gesture.y0, gesture.x1, gesture.y1),
          gesture.additive,
        );
        break;
      case 'tensor':
        session.endDrag();
        break;
      case 'leg':
        // Sem arrasto, o gesto era um toque: arma ou fecha o vínculo.
        if (!gesture.moved) session.tapLeg(gesture.legId);
        session.endGesture();
        break;
      case 'bond':
        session.endGesture();
        break;
    }

    release(event);
    gesture = null;
  }

  function onDoubleClick(event: MouseEvent) {
    const p = toCanvas(event);
    session.addTensor(p.x, p.y);
  }

  function onTensorDoubleClick(event: MouseEvent, tensorId: string) {
    event.stopPropagation();
    session.select(tensorId);
    session.inspecting = tensorId;
  }

  /** Zoom ancorado no cursor: o ponto sob o ponteiro não se mexe. */
  function onWheel(event: WheelEvent) {
    event.preventDefault();
    const box = surface.getBoundingClientRect();
    const px = event.clientX - box.left;
    const py = event.clientY - box.top;
    const scale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, session.view.scale * Math.exp(-event.deltaY * 0.0015)));
    const k = scale / session.view.scale;
    session.view = { scale, x: px - (px - session.view.x) * k, y: py - (py - session.view.y) * k };
    session.touchView();
  }

  function onKeyDown(event: KeyboardEvent) {
    const mod = event.ctrlKey || event.metaKey;

    if (mod && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) session.redo();
      else session.undo();
      return;
    }
    if (mod && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      session.redo();
      return;
    }
    if (mod && event.key.toLowerCase() === 'c') {
      session.copy();
      return;
    }
    if (mod && event.key.toLowerCase() === 'v') {
      event.preventDefault();
      session.paste();
      return;
    }
    if (mod && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      session.selectMany(network.tensors.map((t) => t.id));
      return;
    }
    if (event.key === 'Escape') {
      session.cancelPending();
      session.clearSelection();
      session.inspecting = null;
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (session.selection.length === 0) return;
      event.preventDefault();
      session.deleteSelection();
      return;
    }

    const step = event.shiftKey ? NUDGE_FINE : NUDGE;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const delta = moves[event.key];
    if (delta && session.selection.length > 0) {
      event.preventDefault();
      session.nudgeSelection(delta[0], delta[1]);
    }
  }

  function onTensorKeyDown(event: KeyboardEvent, tensorId: string) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      session.select(tensorId, event.shiftKey);
      session.inspecting = tensorId;
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
    {#if session.grid.on}
      <defs>
        <pattern
          id="moira-grade"
          width={session.grid.size * session.view.scale}
          height={session.grid.size * session.view.scale}
          patternUnits="userSpaceOnUse"
          x={session.view.x}
          y={session.view.y}
        >
          <circle cx="0" cy="0" r="1" class="grid-dot" />
        </pattern>
      </defs>
      <rect class="grid" width="100%" height="100%" fill="url(#moira-grade)" />
    {/if}

    <g transform="translate({session.view.x} {session.view.y}) scale({session.view.scale})">
      <g class="moira-bonds">
        {#each network.bonds as bond (bond.id)}
          {@const d = bondPath(network, bond)}
          {#if d}
            {@const mid = bondMidpoint(network, bond)}
            <g class="bond-group">
              <path
                class="moira-bond"
                {d}
                stroke={bondStroke(network, style, bond)}
                stroke-width={bondWidth(network, bond)}
              />
              <path
                class="bond-hit"
                {d}
                role="button"
                tabindex="-1"
                aria-label="{t('hint.curve')} — {bond.id}"
                onclick={(e) => {
                  e.stopPropagation();
                  session.unbind(bond.id);
                }}
                onkeydown={(e) => e.key === 'Enter' && session.unbind(bond.id)}
              />
              {#if mid}
                <circle
                  class="bond-handle"
                  class:visible={bond.curvature !== 0}
                  cx={mid.x}
                  cy={mid.y}
                  r="5"
                  role="button"
                  tabindex="-1"
                  aria-label="Curvatura de {bond.id}"
                  onpointerdown={(e) => onBondHandlePointerDown(e, bond.id)}
                  ondblclick={(e) => {
                    e.stopPropagation();
                    session.inspecting = null;
                    session.inspectingBond = bond.id;
                  }}
                  onkeydown={(e) => e.key === 'Enter' && (session.inspectingBond = bond.id)}
                />
              {/if}
            </g>
          {/if}
        {/each}
      </g>

      {#each network.tensors as tensor (tensor.id)}
        {@const selected = session.selection.includes(tensor.id)}
        {@const isCenter = network.orthogonalityCenter === tensor.id}
        {@const ring = tensorRing(network, style, tensor)}
        <g class="moira-tensor" class:selected>
          {#each tensor.legs as leg (leg.id)}
            {@const tip = legTip(tensor, leg)}
            {#if bondOfLeg(network, leg.id)}
              <!-- A ponta de uma perna vinculada é o ponto de controle da curva
                   do vínculo. Só aparece com o tensor selecionado, para não
                   encher o diagrama de alças. -->
              {#if selected}
                <circle
                  class="leg-handle"
                  cx={tip.x}
                  cy={tip.y}
                  r="4.5"
                  role="button"
                  tabindex="-1"
                  aria-label="{t('insp.bound')} {leg.id}"
                  onpointerdown={(e) => onLegPointerDown(e, leg.id)}
                  onkeydown={(e) => e.preventDefault()}
                />
              {/if}
            {:else}
              <path class="moira-leg" d={freeLegPath(tensor, leg)} stroke-width={legWidth(leg)} />
              <circle
                class="leg-hit"
                class:armed={session.pendingLeg === leg.id}
                cx={tip.x}
                cy={tip.y}
                r="8"
                role="button"
                tabindex="-1"
                aria-label="{t('insp.free')} {leg.id}"
                onpointerdown={(e) => onLegPointerDown(e, leg.id)}
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
            ondblclick={(e) => onTensorDoubleClick(e, tensor.id)}
            onkeydown={(e) => onTensorKeyDown(e, tensor.id)}
          >
            {#if isCenter}
              <circle class="orthocenter" r="17" />
            {/if}
            {#if selected}
              <circle class="halo" r="19" />
            {/if}
            {#if ring}
              <!-- Segunda tag: anel fino em volta da forma. -->
              <path class="moira-ring" d={shapeOutline(tensor.shape, tipAngle(tensor))} stroke={ring} />
            {/if}
            <path
              class="moira-shape shape-{tensor.shape}"
              d={shapeOutline(tensor.shape, tipAngle(tensor))}
              fill={tensorFill(network, style, tensor)}
            />
            {#if tensor.name}
              <text class="moira-name" x="0" y="-20">{tensor.name}{tensor.conjugate ? '†' : ''}</text>
            {/if}
          </g>
        </g>
      {/each}

      {#if rect}
        <rect
          class="rubber"
          x={Math.min(rect.x0, rect.x1)}
          y={Math.min(rect.y0, rect.y1)}
          width={Math.abs(rect.x1 - rect.x0)}
          height={Math.abs(rect.y1 - rect.y0)}
        />
      {/if}
    </g>

    {#if legend}
      <Legend {legend} />
    {/if}
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

  .grid-dot {
    fill: var(--c-rule);
  }

  .moira-bond {
    fill: none;
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

  .bond-handle {
    fill: var(--c-paper);
    stroke: var(--c-selection);
    stroke-width: 1.4;
    opacity: 0;
    cursor: grab;
  }

  .bond-group:hover .bond-handle,
  .bond-handle.visible {
    opacity: 1;
  }

  .moira-leg {
    fill: none;
    stroke: var(--c-ink);
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

  .leg-handle {
    fill: var(--c-paper);
    stroke: var(--c-selection);
    stroke-width: 1.3;
    cursor: grab;
  }

  .moira-shape {
    stroke: var(--c-ink);
    stroke-width: 1.6;
  }

  /* O anel da segunda tag fica por fora da forma, sem preenchimento. Fino de
     propósito: é informação secundária e não pode competir com o corpo. */
  .moira-ring {
    fill: none;
    stroke-width: 3;
    transform: scale(1.17);
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

  .orthocenter {
    fill: var(--c-orthocenter);
    fill-opacity: 0.45;
    stroke: none;
  }

  .moira-name {
    font-family: var(--font-mono);
    font-size: 12px;
    text-anchor: middle;
    fill: var(--c-ink);
  }

  .rubber {
    fill: var(--c-selection);
    fill-opacity: 0.08;
    stroke: var(--c-selection);
    stroke-width: 1;
    stroke-dasharray: 4 3;
  }

  .empty {
    position: absolute;
    left: 50%;
    top: 42%;
    transform: translate(-50%, -50%);
    text-align: center;
    pointer-events: none;
    max-width: 36ch;
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
