"""Modo estudante: resumo, termos (Wikipédia), anotações, quiz e material de estudo.

Evolução do estudante.py da Sprint 3: o resumo deixou de cortar as 20
primeiras palavras e passou a ser o mesmo resumo extrativo do app; a anotação
única virou as anotações reais de cada captura; e entraram a explicação de
termos pela Wikipédia, o quiz de revisão e o caderno de estudos em Markdown.
"""

from __future__ import annotations

import random
import re
from datetime import datetime

from rich.markdown import Markdown
from rich.progress import BarColumn, Progress, SpinnerColumn, TextColumn
from rich.text import Text

from . import entrada, interface
from .documento import mostrar_captura
from .interface import console
from .modelo import agora_iso, formatar_data, rotulo_modo, tocar
from .persistencia import PASTA_EXPORTACOES, registrar_historico
from .resumo import (MIN_PALAVRAS_TEXTO, TAMANHOS, contar_palavras, gerar_resumo_captura, normalizar_palavra,
                     palavras_brutas, palavras_chave_no_resumo, resumo_desatualizado, tokenizar)
from .wikipedia import FalhaDeConexao, TermoNaoEncontrado, buscar_com_cache, chave_cache

LACUNA = "_____"

# ---------------------------------------------------------------- resumo


def pode_resumir(captura: dict) -> tuple[bool, str]:
    if captura.get("kind") == "video":
        return False, "Vídeos não têm texto para resumir."
    palavras = contar_palavras(captura.get("text"))
    if palavras < MIN_PALAVRAS_TEXTO:
        return False, f"O texto tem só {palavras} palavras — o mínimo para resumir é {MIN_PALAVRAS_TEXTO}."
    return True, ""


def aplicar_resumo(biblioteca: dict, captura: dict, tamanho: str = "curto") -> dict:
    """Gera e salva o resumo na captura. Lança ValueError se não for possível."""
    ok, motivo = pode_resumir(captura)
    if not ok:
        raise ValueError(motivo)
    resumo = gerar_resumo_captura(captura["text"], tamanho)
    if resumo is None:
        raise ValueError("Não há frases suficientes para resumir.")
    captura["summary"] = resumo
    tocar(captura)
    registrar_historico(biblioteca, f"Resumo {TAMANHOS[resumo['length']]['rotulo'].lower()} gerado", captura.get("title", ""))
    return resumo


def capturas_pendentes(biblioteca: dict) -> list[dict]:
    """Capturas com texto suficiente e sem resumo (ou com resumo desatualizado)."""
    return [c for c in biblioteca["capturas"]
            if pode_resumir(c)[0] and (not c.get("summary") or resumo_desatualizado(c))]

# ---------------------------------------------------------------- anotações


def adicionar_anotacao(biblioteca: dict, captura: dict, texto: str) -> None:
    carimbo = datetime.now().strftime("%d/%m %H:%M")
    atual = (captura.get("notes") or "").rstrip()
    captura["notes"] = f"{atual}\n\n[{carimbo}] {texto}".strip()
    tocar(captura)
    registrar_historico(biblioteca, "Anotação adicionada", captura.get("title", ""))


def substituir_anotacoes(biblioteca: dict, captura: dict, texto: str) -> None:
    captura["notes"] = texto
    tocar(captura)
    registrar_historico(biblioteca, "Anotações reescritas" if texto else "Anotações apagadas", captura.get("title", ""))


def anexar_explicacao(biblioteca: dict, captura: dict, explicacao: dict) -> None:
    adicionar_anotacao(biblioteca, captura, f"📖 {explicacao['titulo']}: {explicacao['resumo']} (Wikipédia: {explicacao['url']})")

# ---------------------------------------------------------------- quiz


def _remover_palavra(frase: str, palavra: str) -> str | None:
    padrao = re.compile(rf"(?<![^\W_]){re.escape(palavra)}(?![^\W_])", re.IGNORECASE)
    nova, trocas = padrao.subn(LACUNA, frase, count=1)
    return nova if trocas else None


def gerar_perguntas(capturas: list[dict], quantidade: int, rng: random.Random | None = None) -> list[dict]:
    """Perguntas de lacuna a partir das frases dos resumos.

    A palavra escondida é sempre um termo principal do resumo; as alternativas
    erradas são outros termos relevantes da biblioteca.
    """
    rng = rng or random.Random()
    candidatas, geral = [], {}
    for captura in capturas:
        resumo = captura.get("summary")
        if not resumo:
            continue
        termos = palavras_chave_no_resumo(resumo)
        # Alternativas erradas da mesma matéria são mais difíceis (e mais úteis) que palavras aleatórias.
        proprias = {normalizar_palavra(p): p for p in termos}
        for palavra in palavras_brutas(captura.get("text", "")):
            if len(palavra) >= 6 and tokenizar(palavra):
                proprias.setdefault(normalizar_palavra(palavra), palavra.lower())
        geral.update(proprias)
        for frase in resumo.get("sentences", []):
            tokens = set(tokenizar(frase))
            for palavra in termos:
                if normalizar_palavra(palavra) in tokens:
                    lacuna = _remover_palavra(frase, palavra)
                    if lacuna:
                        candidatas.append({"original": frase, "frase": lacuna, "resposta": palavra,
                                           "fonte": captura.get("title", ""), "proprias": proprias})

    rng.shuffle(candidatas)
    perguntas, frases_usadas = [], set()
    for candidata in candidatas:
        if len(perguntas) == quantidade:
            break
        if candidata["original"] in frases_usadas:
            continue
        certa = normalizar_palavra(candidata["resposta"])
        erradas = [p for chave, p in candidata["proprias"].items() if chave != certa]
        if len(erradas) >= 3:
            escolhidas = rng.sample(erradas, 3)
        else:
            extras = [p for chave, p in geral.items() if chave != certa and chave not in candidata["proprias"]]
            if len(erradas) + len(extras) < 3:
                continue
            escolhidas = erradas + rng.sample(extras, 3 - len(erradas))
        opcoes = escolhidas + [candidata["resposta"]]
        rng.shuffle(opcoes)
        frases_usadas.add(candidata["original"])
        perguntas.append({"frase": candidata["frase"], "resposta": candidata["resposta"], "fonte": candidata["fonte"],
                          "opcoes": opcoes, "correta": opcoes.index(candidata["resposta"])})
    return perguntas


def registrar_partida(biblioteca: dict, acertos: int, total: int) -> float:
    percentual = round(acertos / total * 100, 1) if total else 0.0
    biblioteca["quiz"].append({"quando": agora_iso(), "acertos": acertos, "total": total, "percentual": percentual})
    registrar_historico(biblioteca, "Quiz concluído", f"{acertos}/{total} ({percentual:.0f}%)")
    return percentual

# ---------------------------------------------------------------- exportação


def slugify(valor: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", normalizar_palavra(valor)).strip("-") or "material"


def _glossario(capturas: list[dict], cache: dict) -> list[dict]:
    vistos, itens = set(), []
    for captura in capturas:
        for termo in palavras_chave_no_resumo(captura.get("summary")):
            chave = chave_cache(termo)
            if chave in cache and chave not in vistos:
                vistos.add(chave)
                itens.append(cache[chave])
    return itens


def montar_markdown(titulo: str, capturas: list[dict], cache: dict) -> str:
    linhas = [f"# {titulo}", "", f"_Gerado pelo JOVI Desktop em {datetime.now().strftime('%d/%m/%Y %H:%M')}_", ""]
    for captura in capturas:
        linhas += [f"## {captura.get('title')}", "",
                   f"{rotulo_modo(captura.get('mode'))} · Álbum {captura.get('album')} · {formatar_data(captura.get('createdAt'), True)}", ""]
        resumo = captura.get("summary")
        if resumo:
            linhas += ["### Resumo", "", *[f"- {frase}" for frase in resumo.get("sentences", [])], ""]
            termos = palavras_chave_no_resumo(resumo)
            if termos:
                linhas += [f"**Termos principais:** {', '.join(termos)}", ""]
        if captura.get("notes"):
            linhas += ["### Anotações", "", captura["notes"], ""]
        if captura.get("text"):
            linhas += ["### Texto completo", "", captura["text"], ""]
    glossario = _glossario(capturas, cache)
    if glossario:
        linhas += ["## Glossário", ""]
        linhas += [f"- **{item['titulo']}** — {item['resumo']} ([Wikipédia]({item['url']}))" for item in glossario]
        linhas.append("")
    return "\n".join(linhas)


def exportar_markdown(titulo: str, capturas: list[dict], cache: dict) -> str:
    PASTA_EXPORTACOES.mkdir(parents=True, exist_ok=True)
    destino = PASTA_EXPORTACOES / f"{slugify(titulo)}.md"
    destino.write_text(montar_markdown(titulo, capturas, cache), encoding="utf-8")
    return str(destino)

# ---------------------------------------------------------------- telas


def _so_com_texto(captura: dict) -> bool:
    return captura.get("kind") == "photo" and bool(captura.get("text"))


def _escolher_tamanho() -> str:
    chaves = list(TAMANHOS)
    console.print(interface.tabela([("#", {"style": "opcao"}), "Tamanho", "Frases"],
                                   [[n, TAMANHOS[c]["rotulo"], f"{TAMANHOS[c]['minimo']} a {TAMANHOS[c]['maximo']}"]
                                    for n, c in enumerate(chaves, 1)]))
    return chaves[entrada.ler_inteiro("Tamanho do resumo", 1, len(chaves), padrao=1) - 1]


def _tela_resumo(biblioteca: dict) -> None:
    from .organizacao import selecionar_captura

    interface.cabecalho("Gerar resumo", "✨", "Resumo extrativo: as frases mais importantes do próprio texto — idêntico ao do app.")
    captura = selecionar_captura(biblioteca["capturas"], filtro=_so_com_texto)
    if captura is None:
        return
    try:
        aplicar_resumo(biblioteca, captura, _escolher_tamanho())
        interface.sucesso("Resumo gerado. Ele aparece na aba Resumo do app depois da sincronização.")
        mostrar_captura(captura)
    except ValueError as erro:
        interface.erro(str(erro))
    interface.pausar()


def _tela_resumir_pendentes(biblioteca: dict) -> None:
    interface.cabecalho("Resumir pendentes", "⚡")
    pendentes = capturas_pendentes(biblioteca)
    if not pendentes:
        interface.sucesso("Todas as capturas com texto já têm um resumo atualizado.")
        interface.pausar()
        return
    console.print(f"[destaque]{len(pendentes)}[/] captura(s) sem resumo ou com resumo desatualizado.")
    if not entrada.confirmar("Gerar todos agora (tamanho curto)?", padrao=True):
        return
    with Progress(SpinnerColumn(style="jovi"), TextColumn("{task.description}"), BarColumn(complete_style="jovi"),
                  TextColumn("{task.completed}/{task.total}"), console=console, transient=False) as progresso:
        tarefa = progresso.add_task("Resumindo", total=len(pendentes))
        for captura in pendentes:
            progresso.update(tarefa, description=f"Resumindo “{captura['title'][:30]}”")
            aplicar_resumo(biblioteca, captura, "curto")
            progresso.advance(tarefa)
        progresso.update(tarefa, description="Pronto!")
    interface.sucesso(f"{len(pendentes)} resumo(s) gerado(s).")
    interface.pausar()


def _mostrar_explicacao(explicacao: dict, do_cache: bool) -> None:
    corpo = Text()
    if explicacao.get("descricao"):
        corpo.append(f"{explicacao['descricao']}\n\n", style="jovi.claro")
    corpo.append(f"{explicacao['resumo']}\n\n")
    corpo.append(explicacao["url"], style="suave underline")
    origem = "cache local (funciona offline)" if do_cache else "pt.wikipedia.org"
    interface.painel(corpo, f"📖 {explicacao['titulo']}  [suave]· {origem}[/]")


def _tela_termo(biblioteca: dict) -> None:
    from .organizacao import selecionar_captura

    interface.cabecalho("Explicar termo", "📖", "Consulta a API pública da Wikipédia (a mesma usada pelo app).")
    interface.menu("De onde vem o termo?", [("1", "Termos principais de um resumo", ""),
                                            ("2", "Digitar um termo", "")], rodape="0  Cancelar")
    opcao = entrada.ler_opcao(["0", "1", "2"])
    if opcao == "0":
        return
    captura = None
    if opcao == "1":
        captura = selecionar_captura(biblioteca["capturas"], filtro=lambda c: bool(palavras_chave_no_resumo(c.get("summary"))))
        if captura is None:
            interface.pausar()
            return
        termos = palavras_chave_no_resumo(captura["summary"])
        console.print(interface.tabela([("#", {"style": "opcao"}), "Termo"], [[n, t] for n, t in enumerate(termos, 1)]))
        indice = entrada.escolher_indice(len(termos), "Número do termo")
        if indice is None:
            return
        termo = termos[indice]
    else:
        termo = entrada.ler_texto("Termo a pesquisar", maximo=80)

    try:
        with console.status(f"[jovi]Consultando a Wikipédia sobre “{termo}”…", spinner="dots"):
            explicacao, do_cache = buscar_com_cache(termo, biblioteca["cacheTermos"])
    except TermoNaoEncontrado:
        interface.aviso(f"A Wikipédia não tem um artigo que explique “{termo}”. Tente outra grafia ou um termo mais específico.")
        interface.pausar()
        return
    except FalhaDeConexao as erro:
        interface.erro(f"{erro} Os termos já consultados continuam disponíveis no Glossário.")
        interface.pausar()
        return

    _mostrar_explicacao(explicacao, do_cache)
    if not do_cache:
        registrar_historico(biblioteca, "Termo consultado", explicacao["titulo"])
    if captura is None and entrada.confirmar("Anexar esta explicação às anotações de uma captura?"):
        captura = selecionar_captura(biblioteca["capturas"], filtro=lambda c: c.get("kind") == "photo")
        if captura:
            anexar_explicacao(biblioteca, captura, explicacao)
            interface.sucesso("Explicação anexada às anotações.")
    elif captura is not None and entrada.confirmar("Anexar às anotações desta captura?", padrao=True):
        anexar_explicacao(biblioteca, captura, explicacao)
        interface.sucesso("Explicação anexada — ela aparece na aba Notas do app.")
    interface.pausar()


def _tela_anotacoes(biblioteca: dict) -> None:
    from .organizacao import selecionar_captura

    interface.cabecalho("Anotações", "📝", "As mesmas anotações da aba Notas do app.")
    captura = selecionar_captura(biblioteca["capturas"])
    if captura is None:
        return
    interface.painel(Text(captura.get("notes") or "Nenhuma anotação ainda.", style="" if captura.get("notes") else "suave"),
                     f"Anotações de “{captura['title']}”")
    interface.menu("Anotações", [("1", "Adicionar anotação", "com data e hora"),
                                 ("2", "Reescrever todas", ""), ("3", "Apagar todas", "")], rodape="0  Voltar")
    opcao = entrada.ler_opcao(["0", "1", "2", "3"])
    if opcao == "1":
        adicionar_anotacao(biblioteca, captura, entrada.ler_texto("Nova anotação", maximo=2000))
        interface.sucesso("Anotação salva.")
    elif opcao == "2":
        substituir_anotacoes(biblioteca, captura, entrada.ler_texto_longo("Novas anotações:"))
        interface.sucesso("Anotações reescritas.")
    elif opcao == "3" and captura.get("notes") and entrada.confirmar("Apagar todas as anotações desta captura?"):
        substituir_anotacoes(biblioteca, captura, "")
        interface.sucesso("Anotações apagadas.")
    if opcao != "0":
        interface.pausar()


def _tela_quiz(biblioteca: dict) -> None:
    interface.cabecalho("Quiz relâmpago", "🧠", "Complete as lacunas com os termos dos seus próprios resumos.")
    com_resumo = [c for c in biblioteca["capturas"] if c.get("summary")]
    if not com_resumo:
        interface.aviso("Gere pelo menos um resumo antes de jogar (opção 1 ou 2 deste menu).")
        interface.pausar()
        return
    quantidade = entrada.ler_inteiro("Quantas perguntas?", 1, 10, padrao=5)
    perguntas = gerar_perguntas(com_resumo, quantidade)
    if not perguntas:
        interface.aviso("Os resumos ainda não têm termos suficientes para montar perguntas. Resuma mais capturas.")
        interface.pausar()
        return
    if len(perguntas) < quantidade:
        interface.info(f"Consegui montar {len(perguntas)} pergunta(s) com os resumos atuais.")

    acertos = 0
    for numero, pergunta in enumerate(perguntas, start=1):
        enunciado = Text(f"{pergunta['frase']}\n\n", style="white")
        for letra, opcao in enumerate(pergunta["opcoes"], start=1):
            enunciado.append(f"  {letra}) ", style="opcao")
            enunciado.append(f"{opcao}\n")
        enunciado.append(f"\nFonte: {pergunta['fonte']}", style="suave")
        interface.painel(enunciado, f"Pergunta {numero} de {len(perguntas)}")
        resposta = entrada.ler_inteiro("Sua resposta", 1, len(pergunta["opcoes"])) - 1
        if resposta == pergunta["correta"]:
            acertos += 1
            interface.sucesso("Acertou!")
        else:
            interface.erro(f"Era “{pergunta['resposta']}”.")
        console.print()

    percentual = registrar_partida(biblioteca, acertos, len(perguntas))
    placar = Text(f"{acertos} de {len(perguntas)} acertos  ", style="bold white")
    placar.append_text(interface.medidor(percentual))
    placar.append(f"  {percentual:.0f}%\n\n")
    placar.append("Mandou bem! 🎉" if percentual >= 70 else "Bora revisar os resumos e tentar de novo. 💪", style="jovi.claro")
    interface.painel(placar, "Resultado")
    interface.pausar()


def _tela_glossario(biblioteca: dict) -> None:
    interface.cabecalho("Glossário", "📚", "Termos já consultados na Wikipédia — disponíveis mesmo sem internet.")
    itens = sorted(biblioteca["cacheTermos"].values(), key=lambda item: item["titulo"].lower())
    if not itens:
        interface.info("Nenhum termo consultado ainda. Use “Explicar termo”.")
    else:
        linhas = [[item["titulo"], item.get("descricao") or "—", item["resumo"][:160] + ("…" if len(item["resumo"]) > 160 else "")]
                  for item in itens]
        console.print(interface.tabela([("Termo", {"style": "destaque"}), "Descrição", ("Resumo", {"ratio": 1})], linhas,
                                       titulo=f"Glossário ({len(itens)})"))
    interface.pausar()


def _tela_exportar(biblioteca: dict) -> None:
    from .organizacao import ordenar_recentes, selecionar_album, selecionar_captura

    interface.cabecalho("Exportar material de estudo", "📤", "Gera um arquivo Markdown (.md) — abre no VS Code, Obsidian, Notion e GitHub.")
    interface.menu("O que exportar?", [("1", "Uma captura", "resumo, anotações e texto"),
                                       ("2", "Caderno do álbum", "todas as capturas da matéria + glossário")], rodape="0  Cancelar")
    opcao = entrada.ler_opcao(["0", "1", "2"])
    if opcao == "0":
        return
    if opcao == "1":
        captura = selecionar_captura(biblioteca["capturas"], filtro=lambda c: c.get("kind") == "photo")
        if captura is None:
            return
        titulo, capturas = captura["title"], [captura]
    else:
        album = selecionar_album(biblioteca, "Álbum do caderno")
        if album is None:
            return
        capturas = [c for c in ordenar_recentes(biblioteca["capturas"]) if c.get("album") == album and c.get("kind") == "photo"]
        if not capturas:
            interface.aviso(f"O álbum “{album}” não tem capturas com conteúdo.")
            interface.pausar()
            return
        titulo = f"Caderno de estudos — {album}"
    try:
        destino = exportar_markdown(titulo, capturas, biblioteca["cacheTermos"])
    except OSError as erro:
        interface.erro(f"Não foi possível gravar o arquivo: {erro}")
    else:
        registrar_historico(biblioteca, "Material exportado", titulo)
        interface.sucesso(f"Arquivo gerado: {destino}")
        if entrada.confirmar("Mostrar uma prévia aqui?"):
            console.print(Markdown(montar_markdown(titulo, capturas[:2], biblioteca["cacheTermos"])[:3000]))
    interface.pausar()


def executar_menu(biblioteca: dict) -> None:
    acoes = {"1": _tela_resumo, "2": _tela_resumir_pendentes, "3": _tela_termo, "4": _tela_anotacoes,
             "5": _tela_quiz, "6": _tela_glossario, "7": _tela_exportar}
    while True:
        pendentes = len(capturas_pendentes(biblioteca))
        interface.cabecalho("Modo estudante", "🎓", "Transforme o que você fotografou em material de estudo.")
        interface.menu("Modo estudante", [
            ("1", "Gerar resumo", "curto ou médio"),
            ("2", "Resumir pendentes", f"{pendentes} captura(s) aguardando" if pendentes else "tudo em dia"),
            ("3", "Explicar termo", "API da Wikipédia"),
            ("4", "Anotações", "adicionar, reescrever, apagar"),
            ("5", "Quiz relâmpago", "revise com os seus resumos"),
            ("6", "Glossário", f"{len(biblioteca['cacheTermos'])} termo(s) salvos"),
            ("7", "Exportar material", "Markdown por captura ou por álbum"),
        ])
        opcao = entrada.ler_opcao(["0", *acoes])
        if opcao == "0":
            return
        acoes[opcao](biblioteca)
