# Camada B da validação numérica

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
