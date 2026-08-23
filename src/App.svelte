<script lang="ts">
  import Canvas from './components/Canvas.svelte';
  import Header from './components/Header.svelte';
  import Panel from './components/Panel.svelte';
  import Toolbar from './components/Toolbar.svelte';
  import { i18n } from './lib/i18n/index.svelte';
  import { session } from './state/session.svelte';
  import { theme } from './state/theme.svelte';

  session.restore();
  theme.apply();

  /** Sessão retomada sem vista gravada — arquivo importado, ou primeira visita
   *  depois de uma versão antiga: enquadra, para a rede não nascer fora da tela. */
  $effect(() => {
    if (session.viewRestored || session.network.tensors.length === 0) return;
    const stage = document.querySelector<HTMLElement>('.stage');
    if (stage) {
      session.fitTo({ w: stage.clientWidth, h: stage.clientHeight });
      session.viewRestored = true;
    }
  });

  /** Enquanto o tema for o do sistema, seguir a troca feita nele. */
  $effect(() => theme.watchSystem());

  /** O idioma escolhido também governa o atributo lang do documento. */
  $effect(() => {
    document.documentElement.lang = i18n.locale === 'pt' ? 'pt-BR' : 'en';
  });

  /** Recarregar logo depois de um arrasto não pode perder o último movimento. */
  $effect(() => {
    const flush = () => session.flush();
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      session.flush();
    };
  });
</script>

<Header />
<Toolbar />
<main>
  <div class="stage"><Canvas /></div>
  <Panel />
</main>

<style>
  :global(#app) {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  main {
    display: flex;
    flex: 1;
    min-height: 0;
  }

  .stage {
    position: relative;
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }
</style>
