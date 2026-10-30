"""JOVI Desktop — programa Python do Sistema Inteligente de Câmera JOVI (Sprint 4).

Execução (na raiz do projeto):
    python python/main.py               menu interativo
    python python/main.py --servidor    abre direto o servidor de sincronização
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

try:
    from jovi import __version__, camera, documento, entrada, estatisticas, estudante, integracao, interface, lixeira, organizacao
    from jovi.interface import console
    from jovi.persistencia import (ARQUIVO_BIBLIOTECA, ErroPersistencia, biblioteca_vazia, carregar_biblioteca,
                                   carregar_exemplo, registrar_historico, salvar_biblioteca)
except ModuleNotFoundError as erro:  # rich/requests ausentes
    print(f"Dependência não instalada: {erro.name}.\nRode:  pip install -r python/requirements.txt")
    sys.exit(1)


def iniciar_biblioteca() -> dict:
    """Carrega a biblioteca salva; na primeira execução oferece a biblioteca de exemplo."""
    biblioteca, aviso = carregar_biblioteca()
    if aviso:
        interface.aviso(aviso)
        interface.pausar()
    if biblioteca is not None:
        return biblioteca

    interface.limpar_tela()
    interface.banner()
    interface.painel(
        "Primeira vez por aqui! O JOVI Desktop guarda a sua biblioteca em [destaque]python/dados/biblioteca.json[/].\n\n"
        "Você pode começar com uma [destaque]biblioteca de exemplo[/] (apostilas, slides e provas de um estudante) "
        "ou começar vazio e importar as capturas do app no menu [opcao]6[/].",
        "Bem-vindo")
    if entrada.confirmar("Carregar a biblioteca de exemplo?", padrao=True):
        try:
            biblioteca = carregar_exemplo()
            registrar_historico(biblioteca, "Biblioteca de exemplo carregada", f"{len(biblioteca['capturas'])} capturas")
        except ErroPersistencia as erro:
            interface.erro(f"{erro} Começando com uma biblioteca vazia.")
            biblioteca = biblioteca_vazia()
    else:
        biblioteca = biblioteca_vazia()
    salvar(biblioteca)
    return biblioteca


def salvar(biblioteca: dict) -> bool:
    try:
        salvar_biblioteca(biblioteca)
        return True
    except ErroPersistencia as erro:
        interface.erro(f"{erro} Suas alterações continuam na memória; tente de novo antes de sair.")
        return False


def painel_inicial(biblioteca: dict) -> None:
    interface.limpar_tela()
    interface.banner()
    console.print(estatisticas.resumo_rapido(biblioteca))
    console.print()
    interface.menu("Menu principal", [
        ("1", "📷  Câmera contextual", "qual modo usar em cada cena"),
        ("2", "📄  Documento inteligente", "texto vira captura · revisar OCR"),
        ("3", "🎓  Modo estudante", "resumo · Wikipédia · quiz · caderno"),
        ("4", "📚  Organização acadêmica", "álbuns · busca · filtros"),
        ("5", "📊  Estatísticas", "gráficos e histórico"),
        ("6", "🔄  Integração com o app", "arquivo JSON e servidor local"),
        ("7", "🚮  Lixeira", f"{len(biblioteca['lixeira'])} item(ns)"),
    ], rodape="0  Sair")


def executar(biblioteca: dict) -> None:
    acoes = {
        "1": camera.executar_menu,
        "2": documento.executar_menu,
        "3": estudante.executar_menu,
        "4": organizacao.executar_menu,
        "5": estatisticas.executar_menu,
        "6": lambda b: integracao.executar_menu(b, lambda: salvar_biblioteca(b)),
        "7": lixeira.executar_menu,
    }
    while True:
        painel_inicial(biblioteca)
        try:
            opcao = entrada.ler_opcao(["0", *acoes], vazio_volta=False)
        except KeyboardInterrupt:
            opcao = "0"
        if opcao == "0":
            return
        try:
            acoes[opcao](biblioteca)
        except KeyboardInterrupt:
            interface.aviso("Operação cancelada. Voltando ao menu principal.")
        finally:
            # Salva depois de cada funcionalidade: nada se perde se o terminal for fechado.
            salvar(biblioteca)


def main() -> int:
    parser = argparse.ArgumentParser(description="JOVI Desktop — integração Python do Sistema Inteligente de Câmera JOVI")
    parser.add_argument("--servidor", action="store_true", help="abre direto o servidor de sincronização")
    parser.add_argument("--versao", action="version", version=f"JOVI Desktop {__version__}")
    argumentos = parser.parse_args()

    biblioteca = None
    try:
        biblioteca = iniciar_biblioteca()
        if argumentos.servidor:
            from jovi.servidor import tela_servidor

            tela_servidor(biblioteca, lambda: salvar_biblioteca(biblioteca))
        else:
            executar(biblioteca)
    except (KeyboardInterrupt, EOFError):
        console.print()
    finally:
        if biblioteca is not None and salvar(biblioteca):
            interface.sucesso(f"Biblioteca salva em {ARQUIVO_BIBLIOTECA}")
    console.print("[jovi]Até logo! Bons estudos. 📚[/]")
    return 0


if __name__ == "__main__":
    sys.exit(main())
