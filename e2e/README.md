# Aceites de marco

Um roteiro por marco, rodando em navegador contra o servidor de desenvolvimento.
Cada roteiro verifica o critério de aceite que o §13 da especificação escreve
para o seu marco, e mais o que ficou provado que quebra em silêncio.

```sh
npm run dev        # noutro terminal
npm run e2e        # todos
npm run e2e -- m1  # um só
```

`MOIRA_URL` aponta para outro endereço, se o servidor não estiver em
`http://localhost:5173`.

| roteiro | marco | critério |
|---|---|---|
| `m0-persistencia.mjs` | M0 | cadeia de 5 montada à mão sobrevive ao recarregamento |
| `m1-mera-e-gestos.mjs` | M1 | MERA de 16 folhas num clique; ramo reposicionado sem quebrar vínculo |
| `m2-cor.mjs` | M2 | cinco modos de cor sem recarregar; espessura, legenda, modo escuro |

`comum.mjs` guarda o que se repete: abrir uma página limpa, ler os contadores do
painel, tirar a assinatura dos vínculos, arrastar, e o relatório que decide o
código de saída.

Uma armadilha que já custou tempo: escrever no `localStorage` de uma página já
aberta não adianta, porque a descarga do `pagehide` sobrescreve na saída. Para
injetar uma sessão, use `abrirPaginaCom`, que a escreve antes do carregamento.
