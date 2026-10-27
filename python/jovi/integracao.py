"""Integração com o app React por arquivo JSON (formato "jovi-biblioteca").

O app exporta a Galeria em Galeria › Sincronizar › Exportar; o Python importa,
enriquece (resumos, anotações, álbuns, documentos novos) e exporta de volta.
A mesma regra de mesclagem existe no app (src/services/libraryTransfer.js):

- as capturas são casadas pelo id;
- vence a versão com updatedAt mais recente, e só os campos editáveis mudam;
- ids desconhecidos viram capturas novas;
- os álbuns são unidos;
- o arquivo leva os ids excluídos ("excluidas"): o que o app excluiu vai para a
  lixeira daqui (pode ser restaurado), e nenhum lado recria o que o outro excluiu.
  Excluir aqui não apaga do app, porque a foto original só existe no navegador.
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from . import entrada, interface
from .interface import console
from .modelo import ALBUM_PADRAO, MODO_PADRAO, MODOS, STATUS_OCR, TIPOS, agora_iso, formatar_data, ler_data
from .persistencia import PASTA_EXPORTACOES, ErroPersistencia, ler_json, registrar_historico, salvar_json

FORMATO_TROCA = "jovi-biblioteca"
VERSAO_TROCA = 1
CAMPOS_SINCRONIZADOS = ("title", "titleAuto", "album", "text", "summary", "notes", "ocrStatus", "ocrConfidence")
LIMITE_CAPTURAS = 5000
DATA_ZERO = datetime(1970, 1, 1, tzinfo=timezone.utc)


class ErroFormato(Exception):
    """O arquivo não é uma exportação válida da biblioteca JOVI."""


def validar_captura(item: object) -> bool:
    """Confere os campos mínimos e os tipos de uma captura recebida."""
    if not isinstance(item, dict):
        return False
    if not isinstance(item.get("id"), str) or not 0 < len(item["id"]) <= 100:
        return False
    if ler_data(item.get("createdAt")) is None or ler_data(item.get("updatedAt")) is None:
        return False
    if item.get("kind") not in TIPOS:
        return False
    for campo in ("title", "album", "text", "notes"):
        if item.get(campo) is not None and not isinstance(item[campo], str):
            return False
    resumo = item.get("summary")
    if resumo is not None and not (isinstance(resumo, dict) and isinstance(resumo.get("sentences"), list)):
        return False
    return True


def normalizar_captura(item: dict) -> dict:
    """Preenche valores padrão e corrige estados que não fazem sentido fora do app."""
    captura = dict(item)
    captura["mode"] = item.get("mode") if item.get("mode") in MODOS else MODO_PADRAO
    captura["album"] = (item.get("album") or ALBUM_PADRAO).strip() or ALBUM_PADRAO
    captura["title"] = (item.get("title") or "Captura sem título").strip()
    captura["titleAuto"] = bool(item.get("titleAuto", False))
    captura["text"] = item.get("text") or ""
    captura["notes"] = item.get("notes") or ""
    captura.setdefault("summary", None)
    status = item.get("ocrStatus")
    # "processing" só existe enquanto o OCR roda no navegador.
    captura["ocrStatus"] = status if status in STATUS_OCR and status != "processing" else ("done" if captura["text"] else "idle")
    return captura


def ids_excluidos(dados: dict) -> set[str]:
    """Ids que o outro lado excluiu (campo opcional "excluidas")."""
    excluidas = dados.get("excluidas") if isinstance(dados, dict) else None
    return {item for item in excluidas if isinstance(item, str)} if isinstance(excluidas, list) else set()


def ler_arquivo_troca(dados: object) -> tuple[list[str], list[dict], int]:
    """Valida o conteúdo do arquivo. Retorna (álbuns, capturas válidas, quantidade inválida)."""
    if not isinstance(dados, dict) or dados.get("formato") != FORMATO_TROCA:
        raise ErroFormato("Este arquivo não é uma exportação da biblioteca JOVI (formato “jovi-biblioteca”).")
    if dados.get("versao") != VERSAO_TROCA:
        raise ErroFormato(f"Versão {dados.get('versao')} do arquivo não é suportada (esperada: {VERSAO_TROCA}).")
    capturas = dados.get("capturas")
    if not isinstance(capturas, list):
        raise ErroFormato("O arquivo não tem a lista de capturas.")
    if len(capturas) > LIMITE_CAPTURAS:
        raise ErroFormato(f"O arquivo tem mais de {LIMITE_CAPTURAS} capturas.")
    validas = [normalizar_captura(item) for item in capturas if validar_captura(item)]
    albuns = [nome.strip() for nome in dados.get("albuns", []) if isinstance(nome, str) and nome.strip()]
    return albuns, validas, len(capturas) - len(validas)


def mesclar(biblioteca: dict, albuns: list[str], recebidas: list[dict], excluidas: set[str] | frozenset = frozenset()) -> dict:
    """Aplica as capturas recebidas na biblioteca local. Retorna um relatório do que mudou."""
    relatorio = {"novas": [], "atualizadas": [], "iguais": 0, "ignoradas": 0, "removidas": []}
    # O que foi excluído do outro lado vai para a lixeira daqui (e pode ser restaurado).
    for captura in [c for c in biblioteca["capturas"] if c["id"] in excluidas]:
        biblioteca["capturas"].remove(captura)
        biblioteca["lixeira"].append({**captura, "removidaEm": agora_iso()})
        relatorio["removidas"].append(captura["title"])

    locais = {captura["id"]: captura for captura in biblioteca["capturas"]}
    na_lixeira = {captura["id"] for captura in biblioteca["lixeira"]}
    for recebida in recebidas:
        if recebida["id"] in na_lixeira or recebida["id"] in excluidas:
            relatorio["ignoradas"] += 1
            continue
        local = locais.get(recebida["id"])
        if local is None:
            biblioteca["capturas"].append(recebida)
            locais[recebida["id"]] = recebida
            relatorio["novas"].append(recebida["title"])
            continue
        if ler_data(recebida["updatedAt"]) <= (ler_data(local.get("updatedAt")) or DATA_ZERO):
            relatorio["iguais"] += 1
            continue
        mudou = any(local.get(campo) != recebida.get(campo) for campo in CAMPOS_SINCRONIZADOS)
        for campo in CAMPOS_SINCRONIZADOS:
            local[campo] = recebida.get(campo, local.get(campo))
        local["updatedAt"] = recebida["updatedAt"]
        if recebida.get("thumbDataUrl") and not local.get("thumbDataUrl"):
            local["thumbDataUrl"] = recebida["thumbDataUrl"]
        if mudou:
            relatorio["atualizadas"].append(local["title"])
        else:
            relatorio["iguais"] += 1

    usados = [captura["album"] for captura in biblioteca["capturas"]]
    biblioteca["albuns"] = list(dict.fromkeys([*biblioteca["albuns"], *albuns, *usados]))
    return relatorio


def montar_arquivo_troca(biblioteca: dict, origem: str = "python") -> dict:
    return {
        "formato": FORMATO_TROCA,
        "versao": VERSAO_TROCA,
        "exportadoEm": agora_iso(),
        "origem": origem,
        "albuns": list(biblioteca["albuns"]),
        "capturas": biblioteca["capturas"],
        "excluidas": [captura["id"] for captura in biblioteca["lixeira"]],
    }


def importar_arquivo(biblioteca: dict, caminho: Path) -> dict:
    """Lê, valida e mescla um arquivo exportado pelo app. Lança ErroFormato/ErroPersistencia."""
    dados = ler_json(caminho)
    albuns, capturas, invalidas = ler_arquivo_troca(dados)
    relatorio = mesclar(biblioteca, albuns, capturas, ids_excluidos(dados))
    relatorio["invalidas"] = invalidas
    biblioteca["ultimaSincronizacao"] = agora_iso()
    registrar_historico(biblioteca, "Biblioteca importada do app",
                        f"{len(relatorio['novas'])} nova(s), {len(relatorio['atualizadas'])} atualizada(s)")
    return relatorio


def exportar_arquivo(biblioteca: dict, destino: Path | None = None) -> Path:
    destino = destino or PASTA_EXPORTACOES / f"jovi-biblioteca-desktop-{datetime.now():%Y-%m-%d-%H%M}.json"
    salvar_json(destino, montar_arquivo_troca(biblioteca))
    biblioteca["ultimaSincronizacao"] = agora_iso()
    registrar_historico(biblioteca, "Biblioteca exportada para o app", destino.name)
    return destino


def encontrar_exportacoes(pastas: list[Path] | None = None, limite: int = 6) -> list[Path]:
    """Procura as exportações do app (jovi-biblioteca-AAAA-MM-DD.json) onde o navegador salva downloads."""
    pastas = pastas or [Path.home() / "Downloads", Path.home() / "Transferências", Path.home() / "Desktop"]
    encontrados = []
    for pasta in pastas:
        try:
            # As exportações do próprio JOVI Desktop ("-desktop-") não fazem sentido aqui.
            encontrados += [arquivo for arquivo in pasta.glob("jovi-biblioteca*.json")
                            if arquivo.is_file() and "-desktop-" not in arquivo.name]
        except OSError:
            continue
    return sorted(encontrados, key=lambda arquivo: arquivo.stat().st_mtime, reverse=True)[:limite]


def mostrar_relatorio(relatorio: dict) -> None:
    linhas = [["Novas", len(relatorio["novas"]), ", ".join(relatorio["novas"][:4]) + ("…" if len(relatorio["novas"]) > 4 else "")],
              ["Atualizadas", len(relatorio["atualizadas"]),
               ", ".join(relatorio["atualizadas"][:4]) + ("…" if len(relatorio["atualizadas"]) > 4 else "")],
              ["Sem mudança", relatorio["iguais"], ""],
              ["Excluídas no app → lixeira", len(relatorio["removidas"]), ", ".join(relatorio["removidas"][:4])],
              ["Na lixeira (ignoradas)", relatorio["ignoradas"], ""]]
    if relatorio.get("invalidas"):
        linhas.append(["Inválidas (puladas)", relatorio["invalidas"], "faltam campos obrigatórios"])
    console.print(interface.tabela([("Resultado", {"style": "destaque"}), ("Qtd.", {"justify": "right"}), ("Capturas", {"ratio": 1})],
                                   linhas, titulo="Sincronização"))

# ---------------------------------------------------------------- telas


def _tela_importar(biblioteca: dict) -> None:
    interface.cabecalho("Importar do app", "📥", "No app: Galeria › Sincronizar › Exportar biblioteca (.json).")
    arquivos = encontrar_exportacoes()
    caminho = None
    if arquivos:
        linhas = [[n, arquivo.name, str(arquivo.parent), formatar_data(datetime.fromtimestamp(arquivo.stat().st_mtime).astimezone().isoformat())]
                  for n, arquivo in enumerate(arquivos, 1)]
        linhas.append([len(arquivos) + 1, "Outro arquivo…", "", ""])
        console.print(interface.tabela([("#", {"style": "opcao", "justify": "right"}), "Arquivo encontrado", "Pasta", "Modificado"],
                                       linhas))
        indice = entrada.escolher_indice(len(arquivos) + 1, "Qual arquivo importar?")
        if indice is None:
            return
        caminho = arquivos[indice] if indice < len(arquivos) else None
    if caminho is None:
        caminho = entrada.ler_caminho_arquivo("Caminho do arquivo .json exportado pelo app", (".json",))
        if caminho is None:
            return
    try:
        with console.status("[jovi]Lendo e mesclando…"):
            relatorio = importar_arquivo(biblioteca, caminho)
    except (ErroFormato, ErroPersistencia) as erro:
        interface.erro(str(erro))
    else:
        mostrar_relatorio(relatorio)
        interface.sucesso("Biblioteca atualizada com os dados do app.")
    interface.pausar()


def _tela_exportar(biblioteca: dict) -> None:
    interface.cabecalho("Exportar para o app", "📤")
    try:
        destino = exportar_arquivo(biblioteca)
    except ErroPersistencia as erro:
        interface.erro(str(erro))
    else:
        interface.sucesso(f"Arquivo gerado: {destino}")
        interface.info("No app: Galeria › Sincronizar › Importar biblioteca e escolha este arquivo.")
    interface.pausar()


def _tela_como_funciona(biblioteca: dict) -> None:
    interface.cabecalho("Como funciona a integração", "🔗")
    from rich.markdown import Markdown

    console.print(Markdown("""
**O app (React) e o JOVI Desktop (Python) compartilham a mesma biblioteca.**

| Caminho | Como usar |
| --- | --- |
| **Arquivo JSON** | App: *Galeria › Sincronizar › Exportar* → aqui: *Importar do app*. Depois *Exportar para o app* → no app: *Importar*. |
| **Servidor local** | Aqui: *Iniciar servidor*. No app: *Galeria › Sincronizar › Sincronizar com o JOVI Desktop*. Os dois lados se atualizam numa só requisição. |

**Regras da mesclagem** (iguais nos dois lados):

- as capturas são reconhecidas pelo `id`;
- vence a edição mais recente (`updatedAt`): título, álbum, texto, resumo e anotações;
- documentos criados aqui aparecem no app com uma capa gerada automaticamente;
- os álbuns dos dois lados são unidos;
- o que você exclui no app vem para a **Lixeira** daqui (dá para restaurar);
- excluir aqui não apaga do app (a foto original só existe no navegador), mas o app não recria o que está na lixeira.

Formato do arquivo: `{"formato": "jovi-biblioteca", "versao": 1, "albuns": [...], "capturas": [...]}`
"""))
    interface.pausar()


def executar_menu(biblioteca: dict, salvar) -> None:
    from .servidor import tela_servidor

    acoes = {"1": _tela_importar, "2": _tela_exportar, "3": lambda b: tela_servidor(b, salvar), "4": _tela_como_funciona}
    while True:
        interface.cabecalho("Integração com o app", "🔄")
        ultima = biblioteca.get("ultimaSincronizacao")
        interface.menu("Integração", [
            ("1", "Importar do app", "arquivo .json da Galeria"),
            ("2", "Exportar para o app", "gera o .json para importar no app"),
            ("3", "Iniciar servidor de sincronização", "http://127.0.0.1:5050"),
            ("4", "Como funciona", ""),
        ], rodape=f"0  Voltar · última sincronização: {formatar_data(ultima) if ultima else 'nunca'}")
        opcao = entrada.ler_opcao(["0", *acoes])
        if opcao == "0":
            return
        acoes[opcao](biblioteca)
