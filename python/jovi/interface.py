"""Camada visual do terminal (Rich) com a identidade do app JOVI."""

from __future__ import annotations

import math
import os
import sys

from rich import box
from rich.align import Align
from rich.console import Console, Group
from rich.panel import Panel
from rich.rule import Rule
from rich.table import Table
from rich.text import Text
from rich.theme import Theme

# Mesmas cores do tema Tailwind do app (src/tailwind.css).
AZUL = "#3f66f6"
AZUL_CLARO = "#9db4ff"
AZUL_MEDIO = "#6f8fff"

TEMA = Theme({
    "jovi": f"bold {AZUL}",
    "jovi.claro": AZUL_CLARO,
    "titulo": f"bold {AZUL_CLARO}",
    "ok": "bold green",
    "aviso": "bold yellow",
    "erro": "bold red",
    "suave": "grey58",
    "destaque": "bold white",
    "opcao": f"bold {AZUL_MEDIO}",
})

# No Windows a entrada/saída pode vir em cp1252 (console antigo ou redirecionada), que não tem
# os caracteres do logo nem emojis e corrompe acentos; força UTF-8 nos três fluxos.
for _fluxo in (sys.stdin, sys.stdout, sys.stderr):
    if hasattr(_fluxo, "reconfigure") and (_fluxo.encoding or "").lower().replace("-", "") != "utf8":
        _fluxo.reconfigure(encoding="utf-8", errors="replace")

console = Console(theme=TEMA, highlight=False)

LOGO = r"""
     ██╗ ██████╗ ██╗   ██╗██╗
     ██║██╔═══██╗██║   ██║██║
     ██║██║   ██║██║   ██║██║
██   ██║██║   ██║╚██╗ ██╔╝██║
╚█████╔╝╚██████╔╝ ╚████╔╝ ██║
 ╚════╝  ╚═════╝   ╚═══╝  ╚═╝"""


def limpar_tela() -> None:
    if os.environ.get("JOVI_SEM_LIMPAR"):
        return
    console.clear()


def banner(subtitulo: str = "Sistema Inteligente de Câmera · Desktop") -> None:
    linhas = LOGO.strip("\n").split("\n")
    largura = max(len(linha) for linha in linhas)
    # Todas as linhas com a mesma largura, senão o Align centraliza cada uma separadamente.
    logo = Text("\n".join(linha.ljust(largura) for linha in linhas), style="jovi")
    logo.append("  DESKTOP", style="bold white")
    console.print(Align.center(logo))
    console.print(Align.center(Text(subtitulo, style="jovi.claro")))
    console.print(Align.center(Text("Pixel Squad · FIAP 1ESPV · Challenge JOVI 2026", style="suave")))
    console.print()


def cabecalho(titulo: str, icone: str = "", descricao: str = "") -> None:
    limpar_tela()
    console.print(Rule(Text(f" {icone}  {titulo} ".strip(), style="titulo"), style=AZUL))
    if descricao:
        console.print(Align.center(Text(descricao, style="suave")))
    console.print()


def menu(titulo: str, opcoes: list[tuple[str, str, str]], rodape: str = "0  Voltar") -> None:
    """Desenha um menu. opcoes = [(tecla, rótulo, descrição)]."""
    tabela = Table(box=None, show_header=False, padding=(0, 2), expand=False)
    tabela.add_column(justify="right", style="opcao", no_wrap=True)
    tabela.add_column(style="destaque", no_wrap=True)
    tabela.add_column(style="suave")
    for tecla, rotulo, descricao in opcoes:
        tabela.add_row(tecla, rotulo, descricao)
    console.print(Panel(tabela, title=f"[titulo]{titulo}[/]", border_style=AZUL, box=box.ROUNDED, padding=(1, 2),
                        subtitle=f"[suave]{rodape}[/]", expand=False))


def sucesso(mensagem: str) -> None:
    console.print(f"[ok]✔[/] {mensagem}")


def aviso(mensagem: str) -> None:
    console.print(f"[aviso]![/] {mensagem}")


def erro(mensagem: str) -> None:
    console.print(f"[erro]✖[/] {mensagem}")


def info(mensagem: str) -> None:
    console.print(f"[jovi]›[/] {mensagem}")


def painel(conteudo, titulo: str = "", estilo: str = AZUL) -> None:
    console.print(Panel(conteudo, title=f"[titulo]{titulo}[/]" if titulo else None, border_style=estilo,
                        box=box.ROUNDED, padding=(1, 2)))


def pausar() -> None:
    try:
        console.input("\n[suave]Pressione Enter para voltar…[/]")
    except EOFError:
        pass


def tabela(colunas: list[str | tuple[str, dict]], linhas: list[list], titulo: str = "") -> Table:
    resultado = Table(title=f"[titulo]{titulo}[/]" if titulo else None, box=box.SIMPLE_HEAVY,
                      header_style=f"bold {AZUL_CLARO}", border_style=AZUL, row_styles=["", "on grey11"])
    for coluna in colunas:
        nome, opcoes = (coluna, {}) if isinstance(coluna, str) else coluna
        resultado.add_column(nome, **opcoes)
    for linha in linhas:
        resultado.add_row(*[str(celula) if not isinstance(celula, Text) else celula for celula in linha])
    return resultado


def barra(valor: float, maximo: float, largura: int = 28) -> Text:
    """Barra horizontal proporcional, com oitavos de bloco para mais precisão."""
    if maximo <= 0:
        return Text("")
    oitavos = round(valor / maximo * largura * 8)
    cheios, resto = divmod(oitavos, 8)
    parcial = " ▏▎▍▌▋▊▉"[resto].strip()
    return Text("█" * cheios + parcial, style=AZUL)


def grafico_barras(titulo: str, dados: dict[str, float], unidade: str = "", ordenar: bool = True) -> Table:
    """Gráfico de barras no terminal; mostra valor absoluto e percentual.

    ordenar=False mantém a ordem recebida (ex.: meses e dias da semana).
    """
    total = sum(dados.values())
    maior = max(dados.values(), default=0)
    grafico = Table(title=f"[titulo]{titulo}[/]", box=None, show_header=False, padding=(0, 1))
    grafico.add_column(justify="right", style="destaque", no_wrap=True)
    grafico.add_column(no_wrap=True)
    grafico.add_column(justify="right", style="suave", no_wrap=True)
    itens = sorted(dados.items(), key=lambda item: -item[1]) if ordenar else list(dados.items())
    for rotulo, valor in itens:
        percentual = f"{valor / total * 100:.0f}%" if total else "—"
        grafico.add_row(rotulo, barra(valor, maior), f"{formatar_numero(valor)}{unidade} · {percentual}")
    if not dados:
        grafico.add_row("—", Text("sem dados", style="suave"), "")
    return grafico


def formatar_numero(valor: float) -> str:
    if isinstance(valor, float) and not valor.is_integer():
        return f"{valor:.1f}".replace(".", ",")
    return f"{int(valor):,}".replace(",", ".")


def cartao(rotulo: str, valor: str, icone: str) -> Panel:
    conteudo = Group(Align.center(Text(valor, style="bold white")), Align.center(Text(rotulo, style="suave")))
    return Panel(conteudo, title=icone, border_style=AZUL, box=box.ROUNDED, padding=(0, 1))


def linha_de_cartoes(cartoes: list[Panel]) -> Table:
    """Cartões lado a lado numa única linha, dividindo a largura do terminal igualmente."""
    grade = Table.grid(expand=True, padding=(0, 1))
    for _ in cartoes:
        grade.add_column(ratio=1)
    grade.add_row(*cartoes)
    return grade


def medidor(percentual: float, largura: int = 20) -> Text:
    preenchido = math.floor(max(0, min(100, percentual)) / 100 * largura)
    cor = "green" if percentual >= 70 else "yellow" if percentual >= 40 else "red"
    return Text("━" * preenchido, style=cor) + Text("━" * (largura - preenchido), style="grey30")
