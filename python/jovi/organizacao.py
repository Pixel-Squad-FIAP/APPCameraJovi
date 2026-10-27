"""Organização acadêmica: álbuns (matérias), busca, filtros e seleção de capturas.

Evolução do organizacao.py da Sprint 3: as "matérias" agora são os mesmos
álbuns do app e os materiais são as capturas reais sincronizadas com ele.
"""

from __future__ import annotations

from rich.text import Text

from . import entrada, interface
from .interface import console
from .modelo import ALBUM_PADRAO, MAX_NOME_ALBUM, MAX_TITULO, MODOS, formatar_data, rotulo_modo, tocar
from .persistencia import registrar_historico
from .resumo import contar_palavras, normalizar_palavra, resumo_desatualizado

# ---------------------------------------------------------------- álbuns


def contar_por_album(biblioteca: dict) -> dict[str, int]:
    """Álbuns criados + álbuns que aparecem nas capturas, com a quantidade de cada um."""
    contagem = {nome: 0 for nome in biblioteca["albuns"]}
    for captura in biblioteca["capturas"]:
        contagem[captura.get("album", ALBUM_PADRAO)] = contagem.get(captura.get("album", ALBUM_PADRAO), 0) + 1
    return contagem


def validar_nome_album(biblioteca: dict, nome: str, ignorar: str | None = None) -> tuple[bool, str]:
    """Mesmas regras do app (useAlbums): não vazio, até 30 caracteres, sem duplicar."""
    nome = " ".join(nome.split())
    if not nome:
        return False, "Digite um nome para o álbum."
    if len(nome) > MAX_NOME_ALBUM:
        return False, f"Use no máximo {MAX_NOME_ALBUM} caracteres."
    for existente in biblioteca["albuns"]:
        if existente.lower() == nome.lower() and existente != ignorar:
            return False, f"Já existe o álbum “{existente}”."
    return True, nome


def criar_album(biblioteca: dict, nome: str) -> tuple[bool, str]:
    valido, resultado = validar_nome_album(biblioteca, nome)
    if valido:
        biblioteca["albuns"].append(resultado)
        registrar_historico(biblioteca, "Álbum criado", resultado)
    return valido, resultado


def renomear_album(biblioteca: dict, antigo: str, novo: str) -> tuple[bool, str]:
    """Renomeia o álbum e move todas as capturas dele. Retorna (ok, mensagem/nome)."""
    if antigo == ALBUM_PADRAO:
        return False, f"O álbum “{ALBUM_PADRAO}” é o padrão e não pode ser renomeado."
    valido, resultado = validar_nome_album(biblioteca, novo, ignorar=antigo)
    if not valido:
        return False, resultado
    biblioteca["albuns"] = [resultado if nome == antigo else nome for nome in biblioteca["albuns"]]
    for captura in biblioteca["capturas"]:
        if captura.get("album") == antigo:
            captura["album"] = resultado
            tocar(captura)
    registrar_historico(biblioteca, "Álbum renomeado", f"{antigo} → {resultado}")
    return True, resultado


def excluir_album(biblioteca: dict, nome: str) -> int:
    """Exclui o álbum e devolve as capturas dele para o álbum padrão. Retorna quantas foram movidas."""
    if nome == ALBUM_PADRAO:
        raise ValueError(f"O álbum “{ALBUM_PADRAO}” não pode ser excluído.")
    movidas = 0
    for captura in biblioteca["capturas"]:
        if captura.get("album") == nome:
            captura["album"] = ALBUM_PADRAO
            tocar(captura)
            movidas += 1
    biblioteca["albuns"] = [album for album in biblioteca["albuns"] if album != nome]
    registrar_historico(biblioteca, "Álbum excluído", f"{nome} ({movidas} captura(s) → {ALBUM_PADRAO})")
    return movidas


def mover_captura(biblioteca: dict, captura: dict, album: str) -> None:
    if album not in biblioteca["albuns"]:
        biblioteca["albuns"].append(album)
    captura["album"] = album
    tocar(captura)
    registrar_historico(biblioteca, "Captura movida", f"{captura['title']} → {album}")


def renomear_captura(biblioteca: dict, captura: dict, titulo: str) -> None:
    captura["title"] = titulo
    captura["titleAuto"] = False
    tocar(captura)
    registrar_historico(biblioteca, "Captura renomeada", titulo)

# ---------------------------------------------------------------- busca e filtros


def normalizar_busca(valor: str | None) -> str:
    return normalizar_palavra(valor or "")


def buscar(capturas: list[dict], consulta: str) -> list[dict]:
    """Busca sem acento em título, álbum, texto e anotações (todas as palavras precisam aparecer)."""
    termos = normalizar_busca(consulta).split()
    if not termos:
        return list(capturas)
    resultado = []
    for captura in capturas:
        conteudo = normalizar_busca(" ".join(str(captura.get(campo) or "") for campo in ("title", "album", "text", "notes")))
        if all(termo in conteudo for termo in termos):
            resultado.append(captura)
    return resultado


def filtrar(capturas: list[dict], album: str | None = None, modo: str | None = None, tipo: str | None = None) -> list[dict]:
    """tipo: 'texto' (com texto extraído), 'photo', 'video' ou None (tudo)."""
    resultado = []
    for captura in capturas:
        if album and captura.get("album") != album:
            continue
        if modo and captura.get("mode") != modo:
            continue
        if tipo == "texto" and not captura.get("text"):
            continue
        if tipo in ("photo", "video") and captura.get("kind") != tipo:
            continue
        resultado.append(captura)
    return resultado


def ordenar_recentes(capturas: list[dict]) -> list[dict]:
    return sorted(capturas, key=lambda captura: captura.get("createdAt", ""), reverse=True)

# ---------------------------------------------------------------- listagem e seleção


def status_resumo(captura: dict) -> Text:
    if captura.get("kind") == "video":
        return Text("vídeo", style="suave")
    if not captura.get("summary"):
        return Text("—", style="suave")
    if resumo_desatualizado(captura):
        return Text("desatualizado", style="aviso")
    return Text("✔", style="ok")


def tabela_capturas(capturas: list[dict], titulo: str = "Capturas"):
    linhas = []
    for numero, captura in enumerate(capturas, start=1):
        modo = MODOS.get(captura.get("mode"), {})
        linhas.append([
            numero,
            Text(captura.get("title", "Sem título"), style="destaque", overflow="ellipsis", no_wrap=True),
            captura.get("album", ALBUM_PADRAO),
            f"{modo.get('icone', '')} {rotulo_modo(captura.get('mode'))}",
            formatar_data(captura.get("createdAt")),
            contar_palavras(captura.get("text")) or "—",
            status_resumo(captura),
        ])
    return interface.tabela(
        [("#", {"justify": "right", "style": "opcao"}), ("Título", {"max_width": 42}), "Álbum", "Modo", "Data",
         ("Palavras", {"justify": "right"}), ("Resumo", {"justify": "center"})],
        linhas, titulo=f"{titulo} ({len(capturas)})")


def selecionar_captura(capturas: list[dict], titulo: str = "Escolha uma captura", filtro=None) -> dict | None:
    """Mostra a lista numerada e devolve a captura escolhida (ou None se cancelar/vazia)."""
    candidatas = ordenar_recentes([captura for captura in capturas if filtro is None or filtro(captura)])
    if not candidatas:
        interface.aviso("Nenhuma captura disponível para esta ação.")
        return None
    console.print(tabela_capturas(candidatas, titulo))
    indice = entrada.escolher_indice(len(candidatas), "Número da captura")
    return None if indice is None else candidatas[indice]


def selecionar_album(biblioteca: dict, mensagem: str = "Escolha o álbum", permitir_novo: bool = False) -> str | None:
    contagem = contar_por_album(biblioteca)
    nomes = list(contagem)
    linhas = [[numero, nome, contagem[nome]] for numero, nome in enumerate(nomes, start=1)]
    if permitir_novo:
        linhas.append([len(nomes) + 1, Text("+ Criar novo álbum", style="opcao"), ""])
    console.print(interface.tabela([("#", {"justify": "right", "style": "opcao"}), "Álbum", ("Capturas", {"justify": "right"})], linhas))
    total = len(nomes) + (1 if permitir_novo else 0)
    indice = entrada.escolher_indice(total, mensagem)
    if indice is None:
        return None
    if indice == len(nomes):
        while True:
            ok, resultado = criar_album(biblioteca, entrada.ler_texto("Nome do novo álbum", maximo=MAX_NOME_ALBUM))
            if ok:
                interface.sucesso(f"Álbum “{resultado}” criado.")
                return resultado
            interface.erro(resultado)
    return nomes[indice]

# ---------------------------------------------------------------- telas


def _tela_listar(biblioteca: dict) -> None:
    interface.cabecalho("Todas as capturas", "📚")
    console.print(tabela_capturas(ordenar_recentes(biblioteca["capturas"])))
    interface.pausar()


def _tela_buscar(biblioteca: dict) -> None:
    interface.cabecalho("Buscar", "🔎", "Procura no título, álbum, texto extraído e anotações — sem diferenciar acentos.")
    consulta = entrada.ler_texto("O que você procura?", maximo=80)
    encontrados = ordenar_recentes(buscar(biblioteca["capturas"], consulta))
    if encontrados:
        console.print(tabela_capturas(encontrados, f"Resultados para “{consulta}”"))
    else:
        interface.aviso(f"Nada encontrado para “{consulta}”.")
    interface.pausar()


def _tela_filtrar(biblioteca: dict) -> None:
    interface.cabecalho("Filtrar", "🧭")
    interface.menu("Filtrar por", [("1", "Álbum", ""), ("2", "Modo da câmera", ""),
                                   ("3", "Tipo", "com texto, fotos ou vídeos")], rodape="0  Cancelar")
    opcao = entrada.ler_opcao(["0", "1", "2", "3"])
    if opcao == "0":
        return
    if opcao == "1":
        album = selecionar_album(biblioteca)
        if album is None:
            return
        resultado, descricao = filtrar(biblioteca["capturas"], album=album), f"Álbum {album}"
    elif opcao == "2":
        modos = list(MODOS)
        console.print(interface.tabela([("#", {"style": "opcao"}), "Modo"],
                                       [[numero, f"{MODOS[m]['icone']} {MODOS[m]['rotulo']}"] for numero, m in enumerate(modos, 1)]))
        indice = entrada.escolher_indice(len(modos), "Número do modo")
        if indice is None:
            return
        resultado, descricao = filtrar(biblioteca["capturas"], modo=modos[indice]), f"Modo {MODOS[modos[indice]]['rotulo']}"
    else:
        tipos = [("texto", "Com texto"), ("photo", "Fotos"), ("video", "Vídeos")]
        console.print(interface.tabela([("#", {"style": "opcao"}), "Tipo"], [[n, rotulo] for n, (_, rotulo) in enumerate(tipos, 1)]))
        indice = entrada.escolher_indice(len(tipos), "Número do tipo")
        if indice is None:
            return
        resultado, descricao = filtrar(biblioteca["capturas"], tipo=tipos[indice][0]), tipos[indice][1]
    console.print(tabela_capturas(ordenar_recentes(resultado), descricao))
    interface.pausar()


def _tela_albuns(biblioteca: dict) -> None:
    while True:
        interface.cabecalho("Álbuns (matérias)", "📁", "Os mesmos álbuns da Galeria do app.")
        contagem = contar_por_album(biblioteca)
        console.print(interface.grafico_barras("Capturas por álbum", contagem))
        console.print()
        interface.menu("Álbuns", [("1", "Criar álbum", ""), ("2", "Renomear álbum", "move as capturas junto"),
                                  ("3", "Excluir álbum", f"capturas voltam para “{ALBUM_PADRAO}”")])
        opcao = entrada.ler_opcao(["0", "1", "2", "3"])
        if opcao == "0":
            return
        if opcao == "1":
            ok, resultado = criar_album(biblioteca, entrada.ler_texto("Nome do novo álbum", maximo=MAX_NOME_ALBUM))
            (interface.sucesso if ok else interface.erro)(f"Álbum “{resultado}” criado." if ok else resultado)
        elif opcao == "2":
            antigo = selecionar_album(biblioteca, "Álbum a renomear")
            if antigo:
                ok, resultado = renomear_album(biblioteca, antigo, entrada.ler_texto("Novo nome", maximo=MAX_NOME_ALBUM))
                (interface.sucesso if ok else interface.erro)(f"“{antigo}” agora se chama “{resultado}”." if ok else resultado)
        else:
            nome = selecionar_album(biblioteca, "Álbum a excluir")
            if nome:
                try:
                    if entrada.confirmar(f"Excluir “{nome}”? As capturas dele irão para “{ALBUM_PADRAO}”."):
                        movidas = excluir_album(biblioteca, nome)
                        interface.sucesso(f"Álbum excluído. {movidas} captura(s) movida(s) para “{ALBUM_PADRAO}”.")
                except ValueError as erro:
                    interface.erro(str(erro))
        interface.pausar()


def _tela_mover(biblioteca: dict) -> None:
    interface.cabecalho("Mover captura de álbum", "📂")
    captura = selecionar_captura(biblioteca["capturas"])
    if captura is None:
        return
    album = selecionar_album(biblioteca, "Álbum de destino", permitir_novo=True)
    if album is None:
        return
    if album == captura.get("album"):
        interface.aviso(f"A captura já está em “{album}”.")
    else:
        mover_captura(biblioteca, captura, album)
        interface.sucesso(f"“{captura['title']}” movida para “{album}”.")
    interface.pausar()


def _tela_renomear(biblioteca: dict) -> None:
    interface.cabecalho("Renomear captura", "📝")
    captura = selecionar_captura(biblioteca["capturas"])
    if captura is None:
        return
    titulo = entrada.ler_texto("Novo título", maximo=MAX_TITULO, padrao=captura["title"])
    renomear_captura(biblioteca, captura, titulo)
    interface.sucesso(f"Título atualizado: “{titulo}”.")
    interface.pausar()


def executar_menu(biblioteca: dict) -> None:
    from .lixeira import tela_remover

    acoes = {"1": _tela_listar, "2": _tela_buscar, "3": _tela_filtrar, "4": _tela_albuns,
             "5": _tela_mover, "6": _tela_renomear, "7": tela_remover}
    while True:
        interface.cabecalho("Organização acadêmica", "📚", "Suas capturas organizadas por matéria, como na Galeria do app.")
        interface.menu("Organização", [
            ("1", "Listar capturas", "mais recentes primeiro"),
            ("2", "Buscar", "título, texto e anotações"),
            ("3", "Filtrar", "por álbum, modo ou tipo"),
            ("4", "Álbuns", "criar, renomear e excluir"),
            ("5", "Mover captura", "trocar de álbum"),
            ("6", "Renomear captura", ""),
            ("7", "Remover captura", "vai para a lixeira"),
        ])
        opcao = entrada.ler_opcao(["0", *acoes])
        if opcao == "0":
            return
        acoes[opcao](biblioteca)
