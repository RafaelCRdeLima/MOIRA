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

Marco M0 concluído: esqueleto, tokens da identidade, modelo de dados, canvas
SVG, arrasto, criação e remoção de tensores e vínculos, persistência local.
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
```

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
