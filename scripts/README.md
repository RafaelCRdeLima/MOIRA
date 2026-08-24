# Verificação fora do laço de teste

Dois scripts, pelo mesmo motivo: há coisas que só se conferem executando de
verdade, com ferramentas que o projeto não tem como dependência.

## O código gerado roda ao colar

```sh
npm run verifica-codigo
MOIRA_PYTHON=/caminho/para/python npm run verifica-codigo   # com quimb instalado
```

Gera os cinco dialetos para o sanduíche de 4 sítios, grava em
`fixtures/gerado/` e executa os que o ambiente sabe executar. Cada um tem de
imprimir o escalar sem edição nenhuma. Biblioteca ausente entra como pendência
e aparece na saída — não conta como sucesso nem como falha.

O que motivou isto: na verificação manual do M3b, o primeiro erro de quem colava
o trecho era `NameError`, e o segundo era não ver resultado nenhum. Nenhum dos
dois é defeito de matemática, e os dois transformam a ferramenta em demonstração.

E rodar de verdade pegou dois defeitos que nenhum teste de unidade pegaria:

- o `np.einsum` sem `optimize` contrai na ordem ingênua, e o sanduíche de 4
  sítios não terminava. O caminho que o MOIRA calcula agora vai dentro da
  chamada, no formato que o próprio numpy aceita;
- o `ncon` do `TensorOperations.jl` **não é o do MATLAB**: o terceiro argumento
  posicional ali é a lista de conjugação, e a sequência vai em `order=`. Passada
  na posição, o erro era "number of tensors and of index lists should be the
  same", que não diz nada sobre a causa.

| dialeto | estado neste ambiente |
|---|---|
| `numpy.einsum` | roda, imprime o escalar |
| `quimb` | roda, imprime o escalar (`MOIRA_PYTHON` apontando para um ambiente com quimb) |
| `ncon` (Julia) | roda, imprime o escalar |
| `ITensor` | roda, imprime o escalar |
| `ncon` (MATLAB) | **pendente** — nem MATLAB nem Octave disponíveis, e instalar exige privilégio que não há aqui |

## Camada B da validação numérica

O §14.1 da especificação divide a verificação em duas camadas. A camada A roda
no `vitest` a cada commit: contrai a rede pela ordem que o MOIRA determinou e
compara com a força bruta, somando explicitamente sobre todos os índices. Ela
verifica a **matemática** — contabilidade de índices, ordem de contração,
transposição implícita — e não depende de nada instalado.

O que ela não pega é o **dialeto**: a ordem dos índices negativos do `ncon`, o
sinal deles, a ordem dos argumentos. Isso só aparece rodando o código de
verdade, e é o que este diretório faz.

```sh
python3 scripts/verifica-ncon.py           # roda e imprime
python3 scripts/verifica-ncon.py --grava   # regrava a fixture
```

A saída fica em `fixtures/sanduiche-4.json`, commitada. Refaça-a quando mudar
a convenção de índices do gerador de `ncon` — e, se o número mudar sem que a
convenção tenha mudado de propósito, é regressão.

Não roda no CI: precisa de Python e de bibliotecas que o projeto não tem como
dependência. Precisa ter rodado antes do M5.

## O que está conferido

| dialeto | estado |
|---|---|
| `ncon` | confere contra `numpy.einsum` sobre a mesma rede |
| `numpy.einsum` | é a referência |
| `quimb` | conferido quando o pacote está instalado; sem ele o script avisa e segue |
| `ITensor` | não conferido — exigiria Julia; a contração ali é por nome de índice, não por posição, que é a parte que a convenção do `ncon` arrisca errar |

O `ncon` embutido no script é uma implementação mínima da convenção, escrita à
parte de propósito: comparar o gerador com uma cópia da própria lógica dele não
verificaria nada.
