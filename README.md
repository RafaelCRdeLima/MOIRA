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

Em construção, no marco M0. A especificação de implementação está em
[`docs/moira-spec.md`](docs/moira-spec.md) e a identidade visual, já fechada,
em [`identidade/moira-identidade.md`](identidade/moira-identidade.md).

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
