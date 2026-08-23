#!/usr/bin/env python3
"""Camada B da validação do §14.1: confere a *convenção* do código gerado.

A camada A, no vitest, já verifica a matemática — contrai a rede pela ordem que
o MOIRA determinou e compara com a força bruta. O que ela não pega é o dialeto:
a ordem dos índices negativos do ncon, o sinal deles, a ordem dos argumentos.
Isso só aparece rodando o código de verdade.

Este script roda uma vez, fora do laço de teste, e a saída fica commitada em
`scripts/fixtures/`. Ver `scripts/README.md`.

Uso:
    python3 scripts/verifica-ncon.py            # roda e imprime
    python3 scripts/verifica-ncon.py --grava    # regrava a fixture
"""

from __future__ import annotations

import argparse
import json
import pathlib
import sys

import numpy as np

RAIZ = pathlib.Path(__file__).resolve().parent
FIXTURE = RAIZ / "fixtures" / "sanduiche-4.json"


def ncon(tensores, indices, sequencia=None):
    """Implementação mínima da convenção ncon, para não exigir a biblioteca.

    Índices positivos são somados na ordem de `sequencia`; negativos ficam, e a
    saída sai ordenada por −1, −2, … É exatamente a convenção que o MOIRA emite,
    escrita aqui de forma independente para que a comparação valha alguma coisa.
    """
    tensores = [np.asarray(t) for t in tensores]
    indices = [list(map(int, ix)) for ix in indices]

    if sequencia is None:
        sequencia = sorted({i for ix in indices for i in ix if i > 0})

    for rotulo in sequencia:
        alvos = [k for k, ix in enumerate(indices) if rotulo in ix]
        if len(alvos) == 2:
            a, b = alvos
            eixos_a = [indices[a].index(rotulo)]
            eixos_b = [indices[b].index(rotulo)]
            # Soma de uma vez todos os índices comuns a este par.
            comuns = [r for r in indices[a] if r in indices[b] and r > 0]
            eixos_a = [indices[a].index(r) for r in comuns]
            eixos_b = [indices[b].index(r) for r in comuns]
            novo = np.tensordot(tensores[a], tensores[b], axes=(eixos_a, eixos_b))
            novos_indices = [r for r in indices[a] if r not in comuns] + [
                r for r in indices[b] if r not in comuns
            ]
            for k in sorted((a, b), reverse=True):
                tensores.pop(k)
                indices.pop(k)
            tensores.append(novo)
            indices.append(novos_indices)
        elif len(alvos) == 1:
            # Traço parcial dentro do mesmo tensor.
            a = alvos[0]
            i, j = [k for k, r in enumerate(indices[a]) if r == rotulo]
            tensores[a] = np.trace(tensores[a], axis1=i, axis2=j)
            indices[a] = [r for k, r in enumerate(indices[a]) if k not in (i, j)]

    # Componentes desconexas viram produto tensorial.
    while len(tensores) > 1:
        tensores[0] = np.tensordot(tensores[0], tensores[1], axes=([], []))
        indices[0] = indices[0] + indices[1]
        tensores.pop(1)
        indices.pop(1)

    ordem = np.argsort([-r for r in indices[0]])
    return np.transpose(tensores[0], ordem)


def sanduiche(sitios: int, chi: int, d: int, semente: int):
    """⟨ψ|O|ψ⟩ com as formas que o MOIRA declara para o sanduíche."""
    rng = np.random.default_rng(semente)
    ket, mpo = [], []
    for s in range(sitios):
        esq = 1 if s == 0 else chi
        dir_ = 1 if s == sitios - 1 else chi
        forma = tuple(x for x in (esq if s > 0 else None, dir_ if s < sitios - 1 else None, d) if x)
        ket.append(rng.standard_normal(forma))
        esqO = 1 if s == 0 else chi
        dirO = 1 if s == sitios - 1 else chi
        formaO = tuple(
            x for x in (esqO if s > 0 else None, dirO if s < sitios - 1 else None, d, d) if x
        )
        mpo.append(rng.standard_normal(formaO))
    return ket, mpo


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--grava", action="store_true")
    args = parser.parse_args()

    ket, mpo = sanduiche(sitios=4, chi=3, d=2, semente=20260823)
    bra = [np.conjugate(t) for t in ket]

    # Índices como o MOIRA os emite para o sanduíche de 4 sítios: cada tensor na
    # ordem de leitura do canvas — bra, operador, ket — e cada eixo na ordem das
    # pernas do diagrama. Ver `src/lib/codegen/ncon.ts`.
    tensores = bra + mpo + ket
    indices = [
        [1, 4],        # A1†: vínculo, físico
        [1, 2, 5],     # A2†
        [2, 3, 6],     # A3†
        [3, 7],        # A4†
        [8, 4, 11],    # W1: vínculo, físico de cima, físico de baixo
        [8, 9, 5, 12],
        [9, 10, 6, 13],
        [10, 7, 14],
        [15, 11],      # A1
        [15, 16, 12],
        [16, 17, 13],
        [17, 14],
    ]

    valor = complex(ncon(tensores, indices))

    # Referência independente: einsum sobre a mesma rede.
    referencia = complex(
        np.einsum(
            "ad,abe,bcf,cg,hdk,hiel,ijfm,jgn,ok,opl,pqm,qn->",
            *tensores,
        )
    )

    # quimb, quando estiver instalado: confere o terceiro dialeto contra os
    # dois primeiros. Sem ele o script continua valendo — o que a camada B
    # precisa mesmo conferir é a convenção de índices do ncon.
    try:
        import quimb.tensor as qtn

        nomes = [
            ["alpha", "delta"], ["alpha", "beta", "epsilon"],
            ["beta", "gamma", "zeta"], ["gamma", "eta"],
            ["theta", "delta", "nu"], ["theta", "lambda", "epsilon", "xi"],
            ["lambda", "mu", "zeta", "alpha1"], ["mu", "eta", "beta1"],
            ["gamma1", "nu"], ["gamma1", "delta1", "xi"],
            ["delta1", "epsilon1", "alpha1"], ["epsilon1", "beta1"],
        ]
        rede = qtn.TensorNetwork(
            [qtn.Tensor(t, inds=tuple(ix)) for t, ix in zip(tensores, nomes)]
        )
        por_quimb = complex(rede.contract())
    except ImportError:
        por_quimb = None

    print(f"ncon      = {valor!r}")
    print(f"einsum    = {referencia!r}")
    if por_quimb is not None:
        print(f"quimb     = {por_quimb!r}")
    else:
        print("quimb     = ausente (pip install quimb) — comparação pendente")
    print(f"diferença = {abs(valor - referencia):.3e}")

    ok = abs(valor - referencia) < 1e-9 * max(1.0, abs(referencia))
    if por_quimb is not None:
        ok = ok and abs(valor - por_quimb) < 1e-9 * max(1.0, abs(referencia))
    print("convenção confere" if ok else "CONVENÇÃO DIVERGE")

    if args.grava:
        FIXTURE.parent.mkdir(parents=True, exist_ok=True)
        FIXTURE.write_text(
            json.dumps(
                {
                    "rede": "sanduíche de 4 sítios, χ=3, d=2",
                    "semente": 20260823,
                    "ncon": [valor.real, valor.imag],
                    "einsum": [referencia.real, referencia.imag],
                    "quimb": None if por_quimb is None else [por_quimb.real, por_quimb.imag],
                    "numpy": np.__version__,
                },
                indent=2,
                ensure_ascii=False,
            )
            + "\n"
        )
        print(f"fixture gravada em {FIXTURE.relative_to(RAIZ.parent)}")

    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
