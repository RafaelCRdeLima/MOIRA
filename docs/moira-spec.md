# MOIRA — especificação de implementação

**Manipulador, Ordenador e Ilustrador de Redes e Álgebra tensorial.**
Editor de diagramas de redes tensoriais em notação de Penrose, no navegador.

Prompt de projeto para o Claude Code. Leia inteiro antes de escrever qualquer
código. Ao final de cada marco, pare e relate antes de seguir.

---

## 1. Contexto e público

Aplicação web para **físicos de redes tensoriais** — o público de MPS/MPO, PEPS,
TTN, MERA, DMRG, TEBD. Não é público de aprendizes: eles já sabem notação de
Penrose. O que eles perdem tempo fazendo à mão é (a) desenhar diagramas bonitos
para artigos e (b) traduzir esses diagramas em código de contração correto e
eficiente. O programa existe para eliminar esses dois atritos.

Referências de escopo: `TensorTrace` (Evenbly, arXiv:1911.02558) e `GuiTeNet`
(Sahlmann & Mendl, arXiv:1808.00532) — ambos resolvem parte do problema e estão
parados. Referência estética: os diagramas do `quimb`, que colorem tensores por
tag e escalam a espessura das arestas pela dimensão de vínculo.

Regra de ouro: **o MOIRA não calcula nada numérico**. Ele desenha, valida,
ordena, gera fórmula e gera código. Quem executa é o `numpy`/`quimb`/`ITensor`
do usuário.

## 2. Objetivos e não-objetivos

Objetivos:

1. Desenhar redes tensoriais arbitrárias com interação direta, rápida e agradável.
2. Exibir, ao vivo, a equação em notação de índices que o diagrama representa.
3. Determinar a ordem de contração e gerar o código correspondente.
4. Exportar figura de qualidade de publicação (SVG e TikZ).
5. Rodar inteiramente no navegador, gratuito, sem instalação e sem cadastro.

Não-objetivos — recusar explicitamente se surgirem no meio do caminho:

- Não-linearidades, bolhas, transformers, camadas de rede neural.
- Execução numérica, simulação, DMRG embutido.
- Backend, contas de usuário, sincronização em nuvem, telemetria.
- Edição colaborativa em tempo real.

## 3. Identidade visual — já definida, não redesenhar

A identidade está pronta e é entrada deste projeto, não decisão a tomar. Os
arquivos ficam em `public/assets/`, servidos em `/assets/`, e o guia completo em
`identidade/moira-identidade.md`:

- `moira-logo.svg` — logotipo horizontal, fundo claro
- `moira-logo-dark.svg` — logotipo, fundo escuro
- `moira-marca.svg` — marca isolada colorida (ícone de aplicativo)
- `moira-favicon.svg` — marca simplificada, legível a 16 px
- `moira-icones.svg` — quinze ícones como `<symbol>` reutilizáveis

**A marca** é um nó tensorial com três pernas de espessuras crescentes: as três
Moiras, e ao mesmo tempo a convenção central do programa (espessura ∝ log D).
O corte perpendicular na perna mais grossa é Átropos e um vínculo truncado.

**Cores.** Paleta *bright* de Paul Tol, segura para daltonismo. Declare como
variáveis CSS na raiz e nunca escreva hex solto em componente:

```css
--ink:#1B2430;  --paper:#FFFFFF;  --ink-dark:#F2F0EC;  --bg-dark:#121821;
--purple:#AA3377; --blue:#4477AA; --green:#228833; --amber:#CCBB44;
--red:#EE6677;    --cyan:#66CCEE; --grey:#BBBBBB;
```

Cada cor tem papel fixo dentro do programa: azul = isometria, verde = unitária,
âmbar = centro de ortogonalidade, vermelho = aviso de validação, cinza =
genérico/estrutural, púrpura e ciano entram na rotação de cores por tag. Rampas
contínuas (dimensão, entropia) usam `viridis`. Nenhuma cor fora dessa lista.

**Tipografia.** Instrument Serif só na palavra MOIRA; IBM Plex Sans na interface;
IBM Plex Mono em índices, dimensões e código; KaTeX (Computer Modern) na
matemática. Todas livres, servidas localmente — sem chamada a CDN de fontes.
Caixa de sentença em toda a interface.

**Ícones.** O princípio que rege o conjunto: *todo ícone é um diagrama*. O ícone
de MPS é uma MPS, o de PEPS é uma grade com pernas físicas, o de MERA é uma
árvore com isometrias. Nada de disquete, engrenagem ou pincel. Ícones novos
seguem a mesma regra; se não der para desenhar em notação, use rótulo em texto.
Uso: `<svg><use href="/assets/moira-icones.svg#ic-mps"/></svg>`, com
`stroke="currentColor"` — o modo escuro sai de graça.

**Voz.** Erros dizem o que houve e o que fazer, sem pedir desculpa: "Dimensões
incompatíveis no vínculo χ₃. Ajuste uma das pontas." Estado vazio é convite:
"Comece por uma MPS", com o gerador ao lado.

## 4. Restrições técnicas

- TypeScript + Vite. Svelte 5 na camada de UI (painéis, controles). O canvas é
  **SVG gerado à mão**, não biblioteca de grafos — precisamos de controle total
  sobre a geometria das pernas.
- Zero backend. Build estático, publicável em Cloudflare Pages.
- Persistência local: `localStorage` para a sessão + import/export de `.json`.
  Nenhum dado sai da máquina do usuário. Sem telemetria, sem cookies.
  A rede fica em `moira:sessao`; deslocamento e zoom da vista, idioma e tema
  ficam em chaves próprias (`moira:vista`, `moira:idioma`, `moira:tema`) porque
  são estado de interface e não podem sujar o arquivo do projeto. Sessão
  retomada sem vista gravada — arquivo importado, por exemplo — é enquadrada na
  abertura, senão a rede reaparece fora da tela.
- `KaTeX` para a matemática. Nenhuma dependência de grafo pesada (`d3-force`,
  `cytoscape`): layouts de rede tensorial são estruturados, não force-directed.
- Alvo: 300 tensores com arrasto a 60 fps.
- Acessibilidade: navegação por teclado no canvas (setas movem a seleção, Tab
  percorre tensores), foco visível, `prefers-reduced-motion` respeitado.

## 5. Modelo de dados

```ts
type Shape = 'circle' | 'square' | 'triangle' | 'dot' | 'diamond';
type ColorMode = 'tag' | 'role' | 'layer' | 'degree' | 'manual';   // §7

interface Leg {
  id: string;
  angle: number;        // radianos, relativo ao centro do tensor
  length: number;
  label?: string;       // rótulo KaTeX
  dim?: number;
  arrow?: 'in' | 'out' | null;   // setas de simetria U(1), SU(2)
}

interface Tensor {
  id: string;
  name: string;         // A, B, W, Λ...
  x: number; y: number;
  shape: Shape;
  legs: Leg[];
  tags: string[];       // base da coloração, estilo quimb
  isometryTip?: string; // id da perna para onde aponta a ponta do triângulo —
                        // id e não índice, porque índice quebra em silêncio
                        // quando as pernas são reordenadas ou apagadas
  conjugate?: boolean;
  frozen?: boolean;
  color?: string;       // cor manual em CSS; sobrepõe o modo de coloração
}

interface Bond {
  id: string;
  a: string; b: string; // ids de pernas
  dim?: number;
  label?: string;
  curvature: number;
  value?: number;       // escalar opcional para colorir (entropia etc.)
}

interface Network {
  tensors: Tensor[];
  bonds: Bond[];
  orthogonalityCenter?: string;
  colorMode: ColorMode;
  showLegend?: boolean;       // legenda automática; ligada quando ausente
  edgeColorByValue?: boolean; // colorir arestas por Bond.value
  meta: { title: string; created: string; version: number };
}
```

Invariantes garantidos pelo modelo a todo momento:

- Uma perna participa de no máximo um vínculo.
- Vínculo entre duas pernas do mesmo tensor é permitido (traço parcial) e
  desenhado como laço.
- Dimensões conflitantes nas pontas de um vínculo geram aviso, não erro bloqueante.
- `Bond.dim` só é preenchido quando as duas pernas declaram a mesma dimensão.
  Divergentes, o vínculo fica sem dimensão e o aviso do §11 aparece — anotar uma
  das duas seria escolher um lado em silêncio. Para desenhar e para calcular
  custo, a dimensão ausente no vínculo cai para a da perna que a declarar.

**Relações entre tensores que o modelo não expressa.** Duas dívidas da mesma
classe, e vale tratá-las juntas.

`conjugate?: boolean` diz que um tensor **é** conjugado, não **de quem**. Numa
rede de verdade isso importa: em `⟨ψ|O|ψ⟩`, cada `A†` é o conjugado do `A`
correspondente — é o mesmo tensor, não outro. O código gerado hoje declara os
dois como arrays independentes, o que roda e dá um número, mas não é o número
que a rede representa. Quem cola o trecho e preenche com dados de verdade tem de
saber disso, e por isso o cabeçalho o diz; mas a limitação é do §5, não do
gerador. A correção é um campo `conjugateOf?: string` — id do tensor de que este
é o conjugado —, e com ele o gerador emite `np.conj(A1)` em vez de pedir um
`A1c` à parte.

`Leg` não representa agrupamento de pernas (`rearrange(T, 'i j k l -> (i l) (k
j)')`), que a notação usa. A correção é um `LegGroup` no tensor: lista ordenada
de ids de perna.

Os dois campos são aditivos e opcionais, e entram juntos no M4 — a versão de
esquema não sobe. Até lá, o parser de `einsum` **recusa parênteses** com
mensagem explícita ("agrupamento de índices ainda não suportado") em vez de
interpretá-los errado, e o código gerado documenta que os slots marcados como
conjugados esperam os dados já conjugados.

**Versão de esquema.** Campo novo que seja opcional e aditivo não sobe a versão:
um arquivo antigo continua abrindo e um arquivo novo continua sendo lido por
código que ignora o campo. Os três campos acrescentados no M2 (`Tensor.color`,
`Network.showLegend`, `Network.edgeColorByValue`) são desse tipo, e a versão
segue em **1**. A versão sobe quando um campo existente muda de significado, de
tipo ou de nome — e aí a migração correspondente entra em `storage/migrate.ts`.

## 6. Canvas e interação

- Arrastar tensores; grade opcional com encaixe; zoom e pan.
- Seleção múltipla por retângulo e Shift+clique; mover, apagar e taguear em bloco.
- Criar vínculo: clicar numa ponta livre e depois noutra. Clicar num vínculo o
  desfaz. Arrastar a ponta de uma perna muda ângulo e comprimento.
- Curvar um vínculo arrastando seu ponto médio.
- Desfazer/refazer com no mínimo 50 passos (`Ctrl+Z` / `Ctrl+Shift+Z`).
- Copiar/colar de sub-redes selecionadas.
- Duplo clique abre o inspetor: nome, forma, tags, conjugado, pernas (dimensão,
  rótulo, seta).

**Geradores de rede** — menu que instancia estruturas canônicas com parâmetros.
É o que torna o programa utilizável de verdade: ninguém monta uma MERA de 32
sítios clicando.

- MPS: N sítios, contorno aberto ou periódico.
- MPO: N sítios, duas pernas físicas por sítio.
- Sanduíche `⟨ψ|O|ψ⟩`: MPS + MPO + MPS conjugada, já conectados.
- PEPS: grade L×L.
- Árvore binária (TTN): N folhas.
- MERA binária ou ternária: N folhas, com desemaranhadores e isometrias já
  distinguidos por forma e cor.
- Matriz de transferência / rede infinita com célula unitária marcada.

## 7. Cor como informação

Diagramas de rede tensorial em preto e branco ficam ilegíveis acima de ~20
tensores. A cor aqui não decora: ela codifica.

**Modos de coloração**, num seletor do painel lateral:

1. **Por tag** (padrão, estilo `quimb`). Cada tag recebe uma cor por hash estável
   do nome, de modo que a mesma tag tem sempre a mesma cor entre sessões.
   Múltiplas tags: cor da primeira, anel fino com a segunda. Acima de sete tags,
   as excedentes caem em cinza e a legenda mostra "outras".
2. **Por papel estrutural**: genérico cinza, isometria azul, unitária verde,
   delta como ponto preto pequeno, centro de ortogonalidade com halo âmbar. É o
   modo que mostra num olhar se o gauge está fixado.
3. **Por camada**: rampa `viridis` pela coordenada y ou profundidade na árvore.
   É o que faz uma MERA parecer uma MERA.
4. **Por grau**: número de pernas, rampa sequencial. Para depurar redes grandes.
5. **Manual**: cor por tensor em `Tensor.color`, sobrepondo os demais modos —
   inclusive quando o seletor está noutro modo, porque uma cor escolhida à mão é
   uma decisão do autor da figura e não uma consequência do modo ativo.

**Arestas.** Espessura ∝ `log(D)`, limitada a [1.2 px, 6 px]; 1.6 px sem
dimensão definida. Pernas livres um pouco mais finas que vínculos internos.
Modo opcional "colorir arestas por valor": mapeia `Bond.value` — entropia de
emaranhamento, peso descartado no truncamento, o que o usuário importar — numa
rampa sequencial com barra de cor legendada. Isso não existe em nenhum
concorrente e é o que faz o diagrama virar figura de resultado, não só de método.

**Formas**, pela convenção da literatura: círculo genérico, triângulo para
isometria com a ponta apontando para a dimensão menor, quadrado para unitária,
ponto preto para delta, losango para centro de ortogonalidade. Conjugação
desenha o daga no nome, não muda a cor.

**Legenda automática** a partir do modo ativo, incluída na exportação, desligável.

**Modo escuro** com segundo par de paletas ajustado — não inverta as cores do
modo claro, elas lavam.

**Elemento de assinatura**: a *animação da ordem de contração*. Dado o caminho
escolhido, o canvas reproduz passo a passo a fusão dos tensores, com custo
acumulado e dimensão do intermediário exibidos a cada passo. Nenhum concorrente
tem isso, e é didaticamente honesto — mostra por que uma ordem é exponencial e a
outra linear. Toda a ousadia visual do projeto mora aqui; o resto da interface é
sóbrio.

## 8. Fórmula e código

### 8.1 Expressão matemática ao vivo

Faixa fixa acima do painel de código mostrando **a equação que o diagrama
representa**, em KaTeX, sempre sincronizada com o canvas. É o par simétrico da
geração de código: a notação gráfica só vale porque é equivalente à notação de
índices, e as duas ficam visíveis ao mesmo tempo, não escondidas num menu.

- Índices livres viram os índices do lado esquerdo, na ordem em que aparecem no
  canvas (esquerda→direita, cima→baixo): `M_{ij} = ...`. Sem índices livres, o
  lado esquerdo é escalar.
- Índices contraídos aparecem repetidos sob um `\sum` explícito com todos os
  mudos listados, ou implícitos na convenção de Einstein. O botão que alterna
  entre as duas formas fica visível.
- Conjugados saem com daga ou asterisco, conforme preferência.
- Deltas aparecem como `\delta_{ij}` quando a forma for `dot`; identidades
  desenhadas como linha nua não geram termo.
- Rótulos definidos pelo usuário são respeitados; os demais recebem letras
  automáticas — latinas para índices físicos, gregas para vínculos internos.
- Ordem alfabética estável: mover um tensor não pode reembaralhar as letras de
  quem ficou parado.

Botão de copiar LaTeX puro, e opção de incluir a fórmula como legenda na
exportação SVG/TikZ.

A ordem dos fatores segue a ordem de leitura do canvas — faixas horizontais de
cima para baixo, cada faixa da esquerda para a direita. Num sanduíche isso põe a
bra antes do operador e do ket, e o produto sai `∑ A† W A`. Consequência aceita:
reorganizar o canvas por motivo estético reordena os fatores e, portanto, os
argumentos no código gerado. Não muda valor nenhum — a soma é a mesma — mas quem
versionar o código gerado verá diff sem mudança matemática. É comportamento
esperado, não defeito: o diagrama manda.

Caminho inverso, se couber no M4: colar uma string `einsum` ou expressão de
índices e receber o diagrama montado. Barato perto do resto, e resolve o caso de
quem já tem o código e quer a figura.

### 8.2 Código

Painel com abas, sempre sincronizado:

- `ncon` (MATLAB e Julia) — convenção nativa da comunidade.
- `numpy.einsum` / `opt_einsum`.
- `quimb` (`TensorNetwork`, preservando as tags).
- `ITensor` (Julia), usando nomes de índice em vez de posições.

O código carrega nomes de tensores e rótulos do diagrama e vem com comentário de
cabeçalho com o custo estimado. Botão de copiar. Se a rede estiver inválida, o
painel mostra o motivo em vez de gerar algo quebrado.

## 9. Ordem de contração e custo

- Busca exaustiva do caminho ótimo para redes pequenas (≤ 10 tensores), no
  espírito do `netcon` de Pfeifer, Haegeman & Verstraete; heurística gulosa por
  custo mínimo par-a-par acima disso.
- Exibir para o caminho escolhido: FLOPs totais, escalonamento assintótico em
  função da dimensão de vínculo (ex.: `O(χ^7)`) e maior intermediário em memória.
- Permitir fixar a ordem manualmente e comparar com a automática.

## 10. Exportação

- **SVG** limpo: sem `<g>` vazios nem transformações aninhadas inúteis, fontes
  como texto e não como caminhos, classes CSS nomeadas por papel para o usuário
  editar no Inkscape.
- **TikZ/PGF**: posições em variáveis nomeadas, nunca números fixos — o diagrama
  precisa ser ajustável dentro do LaTeX depois. Cores como `\definecolor` no
  preâmbulo.
- **PNG** em 2× e 4× para apresentações.
- **JSON** do projeto, com versão de esquema e migração para trás.

## 11. Validação

Painel de avisos sempre visível, nunca modal:

- Dimensões incompatíveis nas pontas de um vínculo.
- Tensor isolado, sem vínculos.
- Triângulo de isometria sem ponta definida.
- Rede desconexa (avisa que a contração dará produto tensorial).
- Laço na rede com centro de ortogonalidade marcado — o gauge por SVD só vale em
  redes sem laços.

## 12. Internacionalização e ajuda

Português e inglês desde o M1, com a estrutura de strings pronta para francês e
italiano. Tutorial de página única, no mesmo domínio, construindo uma MPS e
contraindo `⟨ψ|ψ⟩` do zero.

## 13. Marcos

**M0 — esqueleto.** Vite + TS + Svelte, tokens de cor e fontes da identidade,
favicon e logotipo no cabeçalho, modelo de dados, canvas SVG, arrastar,
criar/apagar tensor, criar/desfazer vínculo, `localStorage`.
*Aceite:* montar à mão uma cadeia de 5 tensores, recarregar a página e reencontrá-la.

**M1 — edição completa.** Inspetor, ângulos e curvatura, seleção múltipla,
desfazer/refazer, copiar/colar, geradores de rede, barra de ferramentas com a
folha de ícones, i18n pt/en.
*Aceite:* gerar uma MERA binária de 16 folhas num clique e reposicionar um ramo
inteiro sem quebrar vínculos.

**M2 — linguagem visual.** Formas, os cinco modos de cor, espessura por dimensão,
legenda automática, modo escuro.
*Aceite:* alternar modos de cor sem recarregar, e um screenshot que aguente
comparação lado a lado com uma figura do `quimb`.

**M3a — fórmula em índices.** Atribuição de índices (latinos para físicos,
gregos para vínculos internos, ordem alfabética estável), faixa da equação ao
vivo em KaTeX, alternância entre somatório explícito e convenção de Einstein,
botão de copiar LaTeX.
*Aceite:* o sanduíche `⟨ψ|O|ψ⟩` de 4 sítios exibe a fórmula em índices conferida
contra a expressão escrita à mão; mover um tensor no canvas não reembaralha as
letras de quem ficou parado; a MERA de 16 folhas produz fórmula sem índice
repetido três vezes nem índice livre duplicado.

**M3b — contração e código.** Busca exaustiva do caminho ótimo (≤ 10 tensores,
no espírito do `netcon`), heurística gulosa acima disso, custo em FLOPs e
escalonamento em χ, maior intermediário em memória, geração de código nas quatro
convenções, painel de validação do §11.
*Aceite:* ver §14.1 — validação numérica contra contração por força bruta.

O M3 era um marco só, com os dois entregáveis acoplados num aceite conjunto.
Foram separados porque são independentes: um erro de nomeação de índice
descoberto depois de já estar embutido em quatro geradores de código custa quatro
vezes mais caro para corrigir.

**M4 — publicação.** Exportação SVG/TikZ/PNG/JSON e a animação da ordem de contração.
*Aceite:* o TikZ exportado compila em `pdflatex` sem edição manual.

Decisão a tomar no M4: a **forma compacta da fórmula**. O sanduíche de 4 sítios
cabe numa linha; a MERA de 16 folhas tem 26 fatores e não cabe em página nenhuma
escrita em produto explícito. A exportação vai precisar de notação de produto
sobre sítios, de quebra em múltiplas linhas, ou das duas. Fica registrado aqui
para não ser descoberto durante o marco.

**M5 — lançamento.** Tutorial, deploy no Cloudflare Pages, README creditando
Penrose pela notação e as referências de escopo.

Os cinco dialetos são executados por `scripts/verifica-codigo.ts` e imprimem o
escalar sem edição — inclusive o `ncon` de MATLAB, no Octave, com o `ncon.m`
canônico dos autores da convenção.

## 14. Testes

`vitest` na lógica pura, que é onde os erros doem: geração da string de índices e
da fórmula LaTeX, busca de ordem de contração contra casos conhecidos, cálculo de
custo, migração de JSON, serialização SVG. Snapshots determinísticos do SVG com
posições arredondadas a duas casas, para não quebrarem por ruído de ponto
flutuante. A camada de interação pode ficar sem teste automatizado no começo.

Os aceites de marco são verificados em navegador, por roteiros em `e2e/`, fora
do `npm test`. Os erros que mais importam nesta aplicação — captura de ponteiro,
alvo de gesto, cor computada — não aparecem em teste de unidade.

**O verificador tem de ser independente do produtor.** Três defeitos seguidos
saíram da mesma raiz: o ambiente que produzia a saída também a aceitava, e por
isso a escondia.

- O `np.einsum` sem `optimize` estava sintaticamente perfeito e não terminava.
  Ler o código não mostrava nada; executá-lo, sim.
- O `ncon` do `TensorOperations.jl` aceitou em silêncio um argumento posicional
  com o significado errado, e a mensagem de erro apontava para outro lugar. Só
  a biblioteca canônica — não uma reimplementação nossa da convenção — podia
  pegar isso.
- O SVG saía com `color-mix(...)` no traço. O Chrome resolvia e desenhava certo;
  o `librsvg`, que é o motor do Inkscape, não entende `color-mix` e deixaria a
  legenda sem contorno.

Um quarto caso, de outra natureza e mais instrutivo: o exportador de TikZ ia
posicionar o rótulo com o `above` do próprio TikZ, em vez do deslocamento que o
canvas e o SVG usam. O rótulo caía sobre a forma. **Nem toda duplicação se
parece com código copiado** — usar o recurso nativo da ferramenta de destino
para refazer uma decisão que já existe no modelo é recalcular por conta própria,
disfarçado. A pergunta que pega o disfarce não é "estou copiando código?", é
"esta decisão já foi tomada em algum lugar?". Aqui já estava, e virou
`NAME_OFFSET`.

Daí a regra: toda saída que deixa o programa é conferida por uma ferramenta que
não participou de produzi-la — o intérprete real de cada dialeto, a biblioteca
canônica da convenção, um renderizador que não seja o navegador em que a figura
foi feita. Escrever a nossa própria versão do verificador é comparar o programa
com a nossa leitura da especificação dele, que é exatamente o erro que se quer
pegar. Onde a ferramenta independente não existir no ambiente, a pendência fica
registrada em vez de substituída por uma aproximação.

### 14.1 Validação numérica

O critério original do M3 dizia que o `ncon` gerado "roda e bate com o `quimb`,
com teste automatizado". Isso põe Python no laço de teste, e o projeto é
TypeScript sem backend por decisão de escopo (§4). A verificação passa a ter duas
camadas.

**Camada A — no `vitest`, a cada commit.** Um contrator ingênuo de referência,
escrito no próprio teste: soma explícita sobre todos os índices mudos, laços
aninhados, tensores aleatórios com χ = 2 ou 3 e d = 2. Contrai-se a rede pela
ordem que o MOIRA determinou e compara-se com a força bruta, com `toBeCloseTo`.
Valida exatamente o que pode dar errado — contabilidade de índices, ordem de
contração, transposições implícitas — e é um teste mais forte que o original,
porque não depende de o `quimb` estar instalado nem de a convenção do `ncon`
estar certa: verifica a matemática. Casos obrigatórios: MPS aberta de 6 sítios
contra a MPS conjugada; sanduíche de 4 sítios; rede com laço (traço parcial); e
rede desconexa, que deve dar o produto dos escalares.

O contrator de referência vive no diretório de testes e nunca é importado pela
aplicação. Se ele começar a ser útil em produção, alguma coisa saiu do escopo do
§2 — o MOIRA não calcula nada numérico.

**Camada B — uma vez, fora do laço.** `scripts/verifica-ncon.py` roda o `ncon`
gerado e o `quimb` sobre a mesma rede e imprime os dois resultados. A saída fica
commitada como fixture, com `scripts/README.md` explicando como refazer. Confere
a *convenção* de saída — ordem dos índices negativos do `ncon`, sinais, ordem dos
argumentos — que a camada A não pega, porque a camada A verifica a matemática e
não o dialeto. Não roda no CI; precisa ter rodado antes do M5.

## 15. Estilo

Comentários só onde a matemática não é óbvia (busca de ordem, geometria das
pernas). Commits pequenos e atômicos. Nenhuma dependência nova sem uma linha no
README justificando por que a alternativa manual não serve.
