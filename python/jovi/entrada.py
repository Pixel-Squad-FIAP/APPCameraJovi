"""Leitura de dados do usuário com validação.

Todas as funções repetem a pergunta até receber um valor válido e explicam
o que estava errado; nenhuma entrada inválida derruba o programa.
"""

from __future__ import annotations

from pathlib import Path

from .interface import console, erro

ENTRADA_PROMPT = "[opcao]›[/] "


def _perguntar(mensagem: str) -> str:
    return console.input(f"[destaque]{mensagem}[/]\n{ENTRADA_PROMPT}").strip()


def ler_texto(mensagem: str, obrigatorio: bool = True, maximo: int | None = None, padrao: str | None = None) -> str:
    """Lê um texto de uma linha. Enter vazio usa o padrão (quando houver)."""
    if padrao:
        mensagem += f" [suave](Enter = {padrao})[/]"
    while True:
        valor = " ".join(_perguntar(mensagem).split())
        if not valor and padrao is not None:
            return padrao
        if not valor and obrigatorio:
            erro("Este campo não pode ficar vazio.")
            continue
        if maximo and len(valor) > maximo:
            erro(f"Use no máximo {maximo} caracteres (você digitou {len(valor)}).")
            continue
        return valor


def ler_inteiro(mensagem: str, minimo: int, maximo: int, padrao: int | None = None) -> int:
    """Lê um número inteiro dentro do intervalo [minimo, maximo]."""
    if padrao is not None:
        mensagem += f" [suave](Enter = {padrao})[/]"
    while True:
        bruto = _perguntar(mensagem)
        if not bruto and padrao is not None:
            return padrao
        try:
            numero = int(bruto)
        except ValueError:
            erro(f"“{bruto}” não é um número inteiro. Digite um valor de {minimo} a {maximo}.")
            continue
        if not minimo <= numero <= maximo:
            erro(f"Digite um valor de {minimo} a {maximo}.")
            continue
        return numero


PALAVRAS_DE_SAIDA = ("v", "voltar", "sair", "cancelar", "menu")


def ler_opcao(validas: list[str], mensagem: str = "Escolha uma opção", vazio_volta: bool = True) -> str:
    """Lê a opção de um menu; aceita só as teclas listadas.

    Nos submenus, Enter vazio ou "voltar" equivalem ao 0, para nunca deixar o usuário preso.
    No menu principal (vazio_volta=False) o Enter vazio só repete a pergunta, para não sair sem querer.
    """
    while True:
        valor = _perguntar(mensagem).lower()
        if valor in validas:
            return valor
        if "0" in validas and (not valor or valor in PALAVRAS_DE_SAIDA):
            # No menu principal o 0 encerra o programa: só "sair" vale como atalho.
            if vazio_volta or valor == "sair":
                return "0"
        erro(f"Opção inválida. Digite uma destas: {', '.join(validas)}.")


def confirmar(mensagem: str, padrao: bool = False) -> bool:
    dica = "S/n" if padrao else "s/N"
    while True:
        valor = _perguntar(f"{mensagem} [suave]({dica})[/]").lower()
        if not valor:
            return padrao
        if valor in ("s", "sim", "y", "yes"):
            return True
        if valor in ("n", "nao", "não", "no"):
            return False
        erro("Responda com s (sim) ou n (não).")


def ler_texto_longo(mensagem: str, minimo_palavras: int = 0) -> str:
    """Lê várias linhas; termina com uma linha contendo só FIM."""
    console.print(f"[destaque]{mensagem}[/]\n[suave]Cole ou digite o texto. Para terminar, digite FIM sozinho numa linha.[/]")
    while True:
        linhas = []
        while True:
            linha = console.input(ENTRADA_PROMPT)
            if linha.strip().upper() == "FIM":
                break
            linhas.append(linha.rstrip())
        texto = "\n".join(linhas).strip()
        if len(texto.split()) >= max(1, minimo_palavras):
            return texto
        erro(f"O texto precisa ter pelo menos {max(1, minimo_palavras)} palavra(s). Tente novamente.")


def ler_caminho_arquivo(mensagem: str, extensoes: tuple[str, ...]) -> Path | None:
    """Lê o caminho de um arquivo existente com uma das extensões aceitas. Enter vazio cancela."""
    while True:
        bruto = _perguntar(f"{mensagem} [suave](Enter vazio cancela)[/]").strip('"').strip("'")
        if not bruto:
            return None
        caminho = Path(bruto).expanduser()
        if not caminho.is_file():
            erro(f"Arquivo não encontrado: {caminho}")
            continue
        if caminho.suffix.lower() not in extensoes:
            erro(f"Formato não suportado. Use: {', '.join(extensoes)}.")
            continue
        return caminho


def escolher_indice(quantidade: int, mensagem: str = "Número do item") -> int | None:
    """Escolhe um item numerado de 1 a quantidade; 0 cancela. Retorna o índice (base 0) ou None."""
    if quantidade == 0:
        return None
    numero = ler_inteiro(f"{mensagem} [suave](0 cancela)[/]", 0, quantidade)
    return None if numero == 0 else numero - 1
