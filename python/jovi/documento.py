"""Documento inteligente: transforma texto em captura e permite revisá-lo.

Evolução do documento.py da Sprint 3. A "digitalização" e o OCR simulados
saíram: o OCR real roda no app (Tesseract.js). Aqui o estudante importa um
arquivo .txt/.md (ou cola o texto) e ele vira uma captura que aparece na
Galeria do app depois da sincronização; também dá para revisar o texto
extraído pelo OCR com localizar/substituir.
"""

from __future__ import annotations

import re
from pathlib import Path

from rich.console import Group
from rich.markdown import Markdown
from rich.text import Text

from . import entrada, interface
from .interface import console
from .modelo import ALBUM_PADRAO, MAX_TITULO, formatar_data, nova_captura, rotulo_modo, tocar
from .persistencia import registrar_historico
from .resumo import contar_palavras, palavras_chave_no_resumo, resumo_desatualizado

TAMANHO_MAXIMO_ARQUIVO = 1_000_000  # 1 MB de texto já é um livro inteiro
EXTENSOES_TEXTO = (".txt", ".md")


def ler_arquivo_texto(caminho: Path) -> str:
    """Lê um arquivo de texto em UTF-8 (ou Latin-1, comum no Bloco de Notas antigo)."""
    if caminho.stat().st_size > TAMANHO_MAXIMO_ARQUIVO:
        raise ValueError("O arquivo é grande demais (máximo 1 MB).")
    try:
        texto = caminho.read_text(encoding="utf-8-sig")
    except UnicodeDecodeError:
        texto = caminho.read_text(encoding="latin-1")
    texto = texto.replace("\r\n", "\n").strip()
    if not texto:
        raise ValueError("O arquivo está vazio.")
    return texto


def titulo_do_texto(texto: str, maximo: int = 48) -> str:
    """Primeira linha com conteúdo real vira título (mesma regra do titleFromText do app)."""
    for linha in (texto or "").split("\n"):
        linha = linha.strip()
        if contar_palavras(linha) >= 2 or len(re.sub(r"[^A-Za-zÀ-ÿ]", "", linha)) >= 4:
            return linha if len(linha) <= maximo else linha[: maximo - 1].rstrip() + "…"
    return ""


def criar_documento(biblioteca: dict, titulo: str, texto: str, album: str = ALBUM_PADRAO, modo: str = "documento") -> dict:
    captura = nova_captura(titulo, texto, album, modo)
    biblioteca["capturas"].insert(0, captura)
    if album not in biblioteca["albuns"]:
        biblioteca["albuns"].append(album)
    registrar_historico(biblioteca, "Documento criado", titulo)
    return captura


def revisar_texto(biblioteca: dict, captura: dict, novo_texto: str) -> bool:
    """Substitui o texto da captura. Retorna False se nada mudou."""
    novo_texto = novo_texto.strip()
    if novo_texto == (captura.get("text") or ""):
        return False
    captura["text"] = novo_texto
    captura["ocrStatus"] = "done" if novo_texto else "empty"
    if captura.get("titleAuto") and titulo_do_texto(novo_texto):
        captura["title"] = titulo_do_texto(novo_texto)
    tocar(captura)
    registrar_historico(biblioteca, "Texto revisado", captura.get("title", ""))
    return True


def substituir_no_texto(texto: str, procurar: str, trocar_por: str, ignorar_maiusculas: bool = True) -> tuple[str, int]:
    """Localizar/substituir. Retorna (novo texto, quantidade de trocas)."""
    if not procurar:
        return texto, 0
    padrao = re.compile(re.escape(procurar), re.IGNORECASE if ignorar_maiusculas else 0)
    return padrao.subn(lambda _m: trocar_por, texto)


def mostrar_captura(captura: dict) -> None:
    """Painel com tudo o que se sabe da captura: metadados, resumo, texto e anotações."""
    meta = Text()
    meta.append(f"{captura.get('title')}\n", style="bold white")
    meta.append(f"{rotulo_modo(captura.get('mode'))} · Álbum {captura.get('album')} · "
                f"{formatar_data(captura.get('createdAt'), com_ano=True)}", style="suave")
    if captura.get("kind") == "video":
        meta.append(f" · vídeo de {captura.get('duration') or 0:.0f} s", style="suave")
    meta.append(f" · {contar_palavras(captura.get('text'))} palavras", style="suave")
    partes = [meta]

    resumo = captura.get("summary")
    if resumo:
        linhas = "\n".join(f"- {frase}" for frase in resumo.get("sentences", []))
        partes += [Text("\nResumo", style="titulo"), Markdown(linhas)]
        termos = palavras_chave_no_resumo(resumo)
        if termos:
            partes.append(Text("Termos principais: " + ", ".join(termos), style="jovi.claro"))
        if resumo_desatualizado(captura):
            partes.append(Text("⚠ O texto mudou depois deste resumo. Gere novamente.", style="aviso"))
    if captura.get("text"):
        texto = captura["text"]
        partes += [Text("\nTexto extraído", style="titulo"), Text(texto if len(texto) < 1800 else texto[:1800] + " […]")]
    if captura.get("notes"):
        partes += [Text("\nAnotações", style="titulo"), Text(captura["notes"])]
    interface.painel(Group(*partes), "Captura")

# ---------------------------------------------------------------- telas


def _escolher_album(biblioteca: dict) -> str:
    from .organizacao import selecionar_album

    return selecionar_album(biblioteca, "Álbum (matéria) do documento", permitir_novo=True) or ALBUM_PADRAO


def _finalizar_criacao(biblioteca: dict, texto: str, titulo_sugerido: str) -> None:
    console.print(f"\n[suave]{contar_palavras(texto)} palavras lidas.[/]")
    titulo = entrada.ler_texto("Título do documento", maximo=MAX_TITULO, padrao=titulo_sugerido or "Documento importado")
    album = _escolher_album(biblioteca)
    captura = criar_documento(biblioteca, titulo, texto, album)
    interface.sucesso(f"Documento “{captura['title']}” criado no álbum “{album}”.")
    interface.info("Sincronize com o app (menu 6) para vê-lo na Galeria com capa, resumo e anotações.")
    if contar_palavras(texto) >= 25 and entrada.confirmar("Gerar o resumo agora?", padrao=True):
        from .estudante import aplicar_resumo

        aplicar_resumo(biblioteca, captura, "curto")
        mostrar_captura(captura)
    interface.pausar()


def _tela_importar_arquivo(biblioteca: dict) -> None:
    interface.cabecalho("Importar arquivo de texto", "📄", "Anotações do Bloco de Notas, resumos em Markdown, transcrições…")
    caminho = entrada.ler_caminho_arquivo("Caminho do arquivo .txt ou .md (pode arrastar o arquivo para cá)", EXTENSOES_TEXTO)
    if caminho is None:
        return
    try:
        texto = ler_arquivo_texto(caminho)
    except (OSError, ValueError) as erro:
        interface.erro(f"Não foi possível ler o arquivo: {erro}")
        interface.pausar()
        return
    _finalizar_criacao(biblioteca, texto, titulo_do_texto(texto) or caminho.stem)


def _tela_colar_texto(biblioteca: dict) -> None:
    interface.cabecalho("Novo documento a partir de texto", "📝")
    texto = entrada.ler_texto_longo("Texto do documento:")
    _finalizar_criacao(biblioteca, texto, titulo_do_texto(texto))


def _tela_ver(biblioteca: dict) -> None:
    from .organizacao import selecionar_captura

    interface.cabecalho("Ver captura", "🔍")
    captura = selecionar_captura(biblioteca["capturas"])
    if captura:
        mostrar_captura(captura)
        interface.pausar()


def _tela_revisar(biblioteca: dict) -> None:
    from .organizacao import selecionar_captura

    interface.cabecalho("Revisar texto", "📝", "Corrija erros do OCR sem precisar redigitar tudo.")
    captura = selecionar_captura(biblioteca["capturas"], filtro=lambda c: c.get("kind") == "photo")
    if captura is None:
        return
    if captura.get("text"):
        console.print(interface.tabela(["Texto atual"], [[captura["text"][:1200]]]))
    interface.menu("Como revisar?", [("1", "Localizar e substituir", "ex.: “fotosintese” → “fotossíntese”"),
                                     ("2", "Reescrever o texto inteiro", "")], rodape="0  Cancelar")
    opcao = entrada.ler_opcao(["0", "1", "2"])
    if opcao == "0":
        return
    if opcao == "1":
        if not captura.get("text"):
            interface.aviso("Esta captura ainda não tem texto. Use “Reescrever o texto inteiro”.")
            interface.pausar()
            return
        procurar = entrada.ler_texto("Procurar por", maximo=100)
        trocar_por = entrada.ler_texto("Substituir por (Enter vazio apaga)", obrigatorio=False, maximo=100)
        novo, trocas = substituir_no_texto(captura["text"], procurar, trocar_por)
        if trocas == 0:
            interface.aviso(f"“{procurar}” não aparece no texto.")
        elif entrada.confirmar(f"{trocas} ocorrência(s) encontrada(s). Substituir?", padrao=True):
            revisar_texto(biblioteca, captura, novo)
            interface.sucesso(f"{trocas} trecho(s) corrigido(s).")
    else:
        novo = entrada.ler_texto_longo("Novo texto:")
        if revisar_texto(biblioteca, captura, novo):
            interface.sucesso("Texto atualizado.")
        else:
            interface.aviso("O texto é igual ao anterior; nada mudou.")
    if resumo_desatualizado(captura):
        interface.aviso("O resumo desta captura ficou desatualizado. Gere de novo no Modo estudante.")
    interface.pausar()


def executar_menu(biblioteca: dict) -> None:
    acoes = {"1": _tela_importar_arquivo, "2": _tela_colar_texto, "3": _tela_ver, "4": _tela_revisar}
    while True:
        interface.cabecalho("Documento inteligente", "📄")
        interface.menu("Documento", [("1", "Importar arquivo .txt / .md", "vira uma captura no app"),
                                     ("2", "Colar ou digitar texto", ""),
                                     ("3", "Ver captura", "resumo, texto e anotações"),
                                     ("4", "Revisar texto", "corrigir o OCR")])
        opcao = entrada.ler_opcao(["0", *acoes])
        if opcao == "0":
            return
        acoes[opcao](biblioteca)
