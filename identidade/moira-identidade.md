# MOIRA — identidade visual

**Manipulador, Ordenador e Ilustrador de Redes e Álgebra tensorial.**
Editor de diagramas de redes tensoriais em notação de Penrose.

## A marca

Um nó tensorial com três pernas de espessuras crescentes. Três leituras
sobrepostas, todas verdadeiras:

- as três Moiras — Cloto fia, Láquesis mede, Átropos corta;
- a convenção central do programa: espessura da aresta ∝ log(D);
- um vértice de Penrose genuíno, não um símbolo abstrato de software.

O corte perpendicular na perna mais grossa é Átropos e é, ao mesmo tempo, um
vínculo truncado. É o único detalhe decorativo da marca; nada mais deve ser
acrescentado a ela.

Arquivos: `moira-logo.svg` (horizontal, fundo claro), `moira-logo-dark.svg`
(fundo escuro), `moira-marca.svg` (marca isolada colorida, ícone de aplicativo),
`moira-favicon.svg` (simplificada, legível a 16 px).

**Uso.** Área de respiro mínima ao redor do logotipo: a altura do nó.
Tamanho mínimo do logotipo horizontal: 120 px de largura; abaixo disso, use só a
marca. Não gire, não incline, não aplique sombra ou contorno, não recoloriza o
nó, não separe a marca do corte de Átropos.

## Cores

| Papel | Hex | Uso |
|---|---|---|
| Tinta | `#1B2430` | nó, texto, traço do diagrama |
| Papel | `#FFFFFF` | fundo claro |
| Tinta invertida | `#F2F0EC` | texto e traço no modo escuro |
| Fundo escuro | `#121821` | fundo do modo escuro |
| Púrpura | `#AA3377` | acento da marca, primeira cor de tag |
| Azul | `#4477AA` | isometrias |
| Verde | `#228833` | unitárias |
| Amarelo | `#CCBB44` | centro de ortogonalidade |
| Vermelho | `#EE6677` | avisos de validação |
| Ciano | `#66CCEE` | quinta cor de tag |
| Cinza | `#BBBBBB` | tensores genéricos, elementos estruturais |

As sete cores cromáticas são a paleta *bright* de Paul Tol, segura para as
formas mais comuns de daltonismo. Marca e interface compartilham a mesma paleta
de propósito: nenhuma cor existe no logotipo que não signifique algo dentro do
programa. Rampas contínuas (dimensão de vínculo, entropia) usam `viridis`.

## Tipografia

| Papel | Face | Onde |
|---|---|---|
| Logotipo | Instrument Serif, espacejamento 7 | apenas na palavra MOIRA |
| Interface | IBM Plex Sans | painéis, botões, rótulos |
| Dados e código | IBM Plex Mono | índices, dimensões, painel de código |
| Matemática | KaTeX (Computer Modern) | faixa da fórmula, rótulos gregos |

Todas livres. A Plex Mono e a Computer Modern têm cor de página parecida, então
a fórmula e o código não brigam quando ficam empilhados. Frases em caixa de
sentença em toda a interface — nunca Caixa Alta Inicial, nunca versalete fora do
logotipo.

## Ícones

`moira-icones.svg` traz quinze ícones como `<symbol>` reutilizáveis:
tensor, isometria, unitária, delta, vínculo, laço, MPS, MPO, PEPS, MERA,
contrair, ordem, cores, fórmula, exportar.

Grade de 24 px, traço 1.5, pontas arredondadas, `stroke="currentColor"` — a cor
vem do CSS do contexto e o modo escuro sai de graça.

O princípio que rege o conjunto: **todo ícone é um diagrama**. O ícone de MPS é
uma MPS; o de PEPS é uma grade com pernas físicas; o de MERA é uma árvore com
isometrias marcadas. Nada de disquetes, engrenagens ou pincéis. Um usuário desse
programa lê notação de rede tensorial mais rápido do que lê metáfora de
interface, e a barra de ferramentas deve aproveitar isso. Ícones novos seguem a
mesma regra: se não der para desenhar em notação, o rótulo em texto é preferível.

Uso em HTML:

```html
<svg class="ic" width="20" height="20"><use href="/moira-icones.svg#ic-mps"/></svg>
```

## Voz

Nome completo na primeira menção de qualquer documento: **MOIRA — um editor de
redes tensoriais em notação de Penrose**. O crédito à notação fica no subtítulo e
na primeira linha do README, nunca no nome do produto.

Mensagens de erro dizem o que aconteceu e o que fazer, sem pedir desculpa:
"Dimensões incompatíveis no vínculo χ₃. Ajuste uma das pontas." Estado vazio é
convite, não lamento: "Comece por uma MPS" com o gerador ao lado.
