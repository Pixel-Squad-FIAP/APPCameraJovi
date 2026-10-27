"""Lixeira: capturas removidas podem ser restauradas até a lixeira ser esvaziada."""

from __future__ import annotations

from . import entrada, interface
from .interface import console
from .modelo import agora_iso, formatar_data
from .persistencia import registrar_historico


def mover_para_lixeira(biblioteca: dict, captura: dict) -> None:
    biblioteca["capturas"] = [item for item in biblioteca["capturas"] if item["id"] != captura["id"]]
    biblioteca["lixeira"].append({**captura, "removidaEm": agora_iso()})
    registrar_historico(biblioteca, "Captura removida", captura.get("title", ""))


def restaurar(biblioteca: dict, indice: int) -> dict:
    """Devolve à biblioteca o item da lixeira na posição indice. Lança IndexError se não existir."""
    item = biblioteca["lixeira"].pop(indice)
    item.pop("removidaEm", None)
    biblioteca["capturas"].append(item)
    registrar_historico(biblioteca, "Captura restaurada", item.get("title", ""))
    return item


def esvaziar(biblioteca: dict) -> int:
    quantidade = len(biblioteca["lixeira"])
    biblioteca["lixeira"] = []
    if quantidade:
        registrar_historico(biblioteca, "Lixeira esvaziada", f"{quantidade} item(ns)")
    return quantidade


def tela_remover(biblioteca: dict) -> None:
    from .organizacao import selecionar_captura

    interface.cabecalho("Remover captura", "🚮", "A captura vai para a lixeira e pode ser restaurada depois.")
    captura = selecionar_captura(biblioteca["capturas"])
    if captura and entrada.confirmar(f"Mover “{captura['title']}” para a lixeira?"):
        mover_para_lixeira(biblioteca, captura)
        interface.sucesso("Captura movida para a lixeira.")
        interface.info("A captura continua no app: excluir aqui não apaga a foto original, que só existe no navegador.")
        interface.pausar()


def executar_menu(biblioteca: dict) -> None:
    while True:
        interface.cabecalho("Lixeira", "🚮")
        itens = biblioteca["lixeira"]
        if itens:
            linhas = [[n, item.get("title", ""), item.get("album", ""), formatar_data(item.get("removidaEm"))]
                      for n, item in enumerate(itens, start=1)]
            console.print(interface.tabela([("#", {"justify": "right", "style": "opcao"}), "Título", "Álbum", "Removida em"],
                                           linhas, titulo=f"Itens na lixeira ({len(itens)})"))
        else:
            interface.info("A lixeira está vazia.")
        console.print()
        interface.menu("Lixeira", [("1", "Restaurar item", ""), ("2", "Remover uma captura", ""),
                                   ("3", "Esvaziar lixeira", "apaga de vez")])
        opcao = entrada.ler_opcao(["0", "1", "2", "3"])
        if opcao == "0":
            return
        if opcao == "1":
            indice = entrada.escolher_indice(len(itens), "Número do item a restaurar")
            if indice is not None:
                item = restaurar(biblioteca, indice)
                interface.sucesso(f"“{item['title']}” restaurada.")
            elif not itens:
                interface.aviso("Não há nada para restaurar.")
            interface.pausar()
        elif opcao == "2":
            tela_remover(biblioteca)
        elif itens and entrada.confirmar(f"Apagar definitivamente {len(itens)} item(ns)?"):
            interface.sucesso(f"{esvaziar(biblioteca)} item(ns) apagado(s).")
            interface.pausar()
