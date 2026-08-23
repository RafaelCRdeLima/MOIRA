# MOIRA

**MOIRA — um editor de redes tensoriais em notação de Penrose**, no navegador.
A notação gráfica é de Roger Penrose (1971).

*Manipulador, Ordenador e Ilustrador de Redes e Álgebra tensorial.*

MOIRA desenha redes tensoriais, valida a estrutura, determina a ordem de
contração, exibe a equação em notação de índices e gera o código correspondente.
Ele não executa nada numérico: quem contrai é o `numpy`, o `quimb` ou o
`ITensor` de quem usa.

Roda inteiramente no navegador. Sem instalação, sem cadastro, sem backend,
sem telemetria — nenhum dado sai da máquina.

## Estado

Marco M3b concluído. O editor desenha e edita redes tensoriais — inspetor,
ângulos e curvatura, seleção múltipla, desfazer e refazer, copiar e colar,
geradores de MPS, MPO, sanduíche, PEPS, árvore, MERA e matriz de transferência —
tem a linguagem visual completa (cinco formas, cinco modos de coloração,
espessura de aresta proporcional a log(D), arestas coloridas por valor, legenda
automática, modo escuro), exibe ao vivo em KaTeX a equação em notação de índices
que o diagrama representa, determina a ordem de contração com o custo e o
escalonamento em χ, e gera o código nas quatro convenções — `ncon` (MATLAB e
Julia), `numpy.einsum`/`opt_einsum`, `quimb` e `ITensor`. Interface em português
e inglês.

O que falta: exportação SVG/TikZ/PNG/JSON e a animação da ordem de contração
(M4), tutorial e publicação (M5).

A validação numérica tem duas camadas (§14.1): a de dentro do `npm test`
contrai cada rede pela ordem escolhida e compara com a força bruta; a de fora,
em [`scripts/`](scripts/), confere a convenção do `ncon` contra o `numpy`.
A especificação de implementação está em [`docs/moira-spec.md`](docs/moira-spec.md)
e a identidade visual, já fechada, em
[`identidade/moira-identidade.md`](identidade/moira-identidade.md).

## Desenvolvimento

```sh
npm install
npm run dev      # servidor de desenvolvimento
npm run build    # build estático em dist/
npm test         # vitest sobre a lógica pura
npm run check    # svelte-check
npm run e2e      # aceites de marco em navegador, contra o servidor de dev
```

Os aceites de marco vivem em [`e2e/`](e2e/) e ficam fora do `npm test` de
propósito: o `vitest` é rápido e roda sempre; o e2e é ritual de fechamento de
marco e precisa do servidor no ar. `npm run e2e -- m1` roda um marco só, e
`MOIRA_URL` aponta para outro endereço.

## Referências

- Roger Penrose, *Applications of negative dimensional tensors* (1971) — a notação.
- Jordan Taylor, *Graphical tensor notation for interpretability*,
  [arXiv:2402.01790](https://arxiv.org/abs/2402.01790) — a origem da ideia.
- Glen Evenbly, *TensorTrace*, [arXiv:1911.02558](https://arxiv.org/abs/1911.02558) — referência de escopo.
- Sahlmann & Mendl, *GuiTeNet*, [arXiv:1808.00532](https://arxiv.org/abs/1808.00532) — referência de escopo.
- Pfeifer, Haegeman & Verstraete, *netcon* — busca de ordem ótima de contração.
- [`quimb`](https://quimb.readthedocs.io) — referência estética da coloração por tag.

## Dependências

Toda dependência nova entra aqui com uma linha dizendo por que a alternativa
manual não serve.

- **Vite + TypeScript** — build estático e tipagem; exigidos pela especificação.
- **Svelte 5** — só a camada de painéis e controles. O canvas é SVG escrito à
  mão: o traçado das pernas e dos vínculos precisa de controle geométrico que
  nenhuma biblioteca de grafos entrega.
- **@fontsource/{instrument-serif, ibm-plex-sans, ibm-plex-mono}** — as três
  faces da identidade servidas do próprio domínio. A alternativa manual seria
  versionar os `.woff2` e escrever os `@font-face` à mão; o pacote faz isso com
  os intervalos de Unicode certos e sem chamar CDN de fontes.
- **vitest + jsdom** — testes da lógica pura (§14).
- **svelte-check** — verificação de tipos dentro dos componentes.
- **katex** — a matemática da faixa da equação. Exigido pela especificação, e
  a alternativa manual seria compor frações e subscritos em SVG à mão. As fontes
  vêm no pacote e são servidas do próprio domínio, sem CDN.
- **playwright** — os aceites de marco rodam em navegador porque os erros que
  mais importam aqui não aparecem em teste de unidade: captura de ponteiro
  redirecionando um duplo clique, alvo de gesto, cor que o CSS de fato computou.
  A alternativa manual é reabrir o navegador e repetir os gestos à mão a cada
  marco, que foi o que se fez até o M2 e não se sustenta com cinco.
