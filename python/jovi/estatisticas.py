"""Estatísticas de uso da biblioteca: números, gráficos e histórico de ações."""

from __future__ import annotations

from collections import Counter
from datetime import datetime

from rich.columns import Columns

from . import entrada, interface
from .interface import console
from .modelo import ALBUM_PADRAO, formatar_data, ler_data, rotulo_modo
from .persistencia import PASTA_EXPORTACOES, registrar_historico
from .resumo import contar_palavras, palavras_brutas, resumo_desatualizado, tokenizar

MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
DIAS_SEMANA = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]
STATUS_OCR = {"done": "Texto extraído", "empty": "Sem texto", "idle": "Não processado", "error": "Erro", "processing": "Processando"}


def termos_frequentes(capturas: list[dict], limite: int = 10) -> list[tuple[str, int]]:
    """Termos relevantes (sem stopwords) mais repetidos em todos os textos."""
    contagem, exibicao = Counter(), {}
    for captura in capturas:
        for palavra in palavras_brutas(captura.get("text", "")):
            for token in tokenizar(palavra):
                if len(token) <= 3:
                    continue
                contagem[token] += 1
                exibicao.setdefault(token, palavra.lower())
    return [(exibicao[token], quantidade) for token, quantidade in contagem.most_common(limite)]


def calcular_estatisticas(biblioteca: dict) -> dict:
    capturas = biblioteca["capturas"]
    com_texto = [c for c in capturas if c.get("text")]
    palavras = [contar_palavras(c.get("text")) for c in com_texto]
    por_mes, por_dia = Counter(), Counter()
    for captura in capturas:
        data = ler_data(captura.get("createdAt"))
        if data:
            local = data.astimezone()
            por_mes[(local.year, local.month)] += 1
            por_dia[DIAS_SEMANA[local.weekday()]] += 1
    partidas = biblioteca["quiz"]
    acertos = sum(p["acertos"] for p in partidas)
    perguntas = sum(p["total"] for p in partidas)
    return {
        "total": len(capturas),
        "fotos": sum(1 for c in capturas if c.get("kind") == "photo"),
        "videos": sum(1 for c in capturas if c.get("kind") == "video"),
        "com_texto": len(com_texto),
        "com_resumo": sum(1 for c in capturas if c.get("summary")),
        "resumos_desatualizados": sum(1 for c in capturas if resumo_desatualizado(c)),
        "com_anotacoes": sum(1 for c in capturas if c.get("notes")),
        "palavras_total": sum(palavras),
        "media_palavras": round(sum(palavras) / len(palavras), 1) if palavras else 0,
        # Leitura média de ~200 palavras por minuto: quanto tempo o resumo economiza.
        "minutos_leitura": round(sum(palavras) / 200, 1),
        "por_album": Counter(c.get("album", ALBUM_PADRAO) for c in capturas),
        "por_modo": Counter(rotulo_modo(c.get("mode")) for c in capturas),
        "por_mes": {f"{MESES[mes - 1]}/{str(ano)[2:]}": n for (ano, mes), n in sorted(por_mes.items())},
        "por_dia": {dia: por_dia[dia] for dia in DIAS_SEMANA if por_dia[dia]},
        "por_status": Counter(STATUS_OCR.get(c.get("ocrStatus"), "—") for c in capturas if c.get("kind") == "photo"),
        "termos": termos_frequentes(capturas),
        "quiz_partidas": len(partidas),
        "quiz_percentual": round(acertos / perguntas * 100, 1) if perguntas else None,
        "termos_consultados": len(biblioteca["cacheTermos"]),
        "lixeira": len(biblioteca["lixeira"]),
    }


def relatorio_markdown(estatisticas: dict) -> str:
    e = estatisticas
    linhas = ["# Relatório de estudos — JOVI Desktop", "", f"_Gerado em {datetime.now().strftime('%d/%m/%Y %H:%M')}_", "",
              "## Visão geral", "",
              f"- Capturas: **{e['total']}** ({e['fotos']} fotos, {e['videos']} vídeos)",
              f"- Com texto extraído: **{e['com_texto']}** · com resumo: **{e['com_resumo']}** · com anotações: **{e['com_anotacoes']}**",
              f"- Palavras digitalizadas: **{e['palavras_total']}** (média de {e['media_palavras']} por captura, ~{e['minutos_leitura']} min de leitura)",
              f"- Termos consultados na Wikipédia: **{e['termos_consultados']}**"]
    if e["quiz_percentual"] is not None:
        linhas.append(f"- Quiz: **{e['quiz_partidas']}** partida(s), **{e['quiz_percentual']}%** de acertos")
    for titulo, dados in (("Por álbum", e["por_album"]), ("Por modo da câmera", e["por_modo"]), ("Por mês", e["por_mes"])):
        linhas += ["", f"## {titulo}", "", "| Item | Capturas |", "| --- | ---: |"]
        linhas += [f"| {nome} | {qtd} |" for nome, qtd in dados.items()]
    if e["termos"]:
        linhas += ["", "## Termos mais frequentes", "", ", ".join(f"{t} ({n})" for t, n in e["termos"])]
    return "\n".join(linhas) + "\n"

# ---------------------------------------------------------------- telas


def _tela_painel(biblioteca: dict) -> None:
    e = calcular_estatisticas(biblioteca)
    interface.cabecalho("Estatísticas", "📊", "Como você está usando a câmera para estudar.")
    console.print(interface.linha_de_cartoes([
        interface.cartao("capturas", str(e["total"]), "📸"),
        interface.cartao("com texto", str(e["com_texto"]), "📄"),
        interface.cartao("resumos", str(e["com_resumo"]), "✨"),
        interface.cartao("palavras", interface.formatar_numero(e["palavras_total"]), "🔤"),
        interface.cartao("min de leitura", interface.formatar_numero(e["minutos_leitura"]), "⌛"),
        interface.cartao("acertos no quiz", f"{e['quiz_percentual']:.0f}%" if e["quiz_percentual"] is not None else "—", "🧠"),
    ]))
    console.print()
    console.print(Columns([interface.grafico_barras("Por álbum", e["por_album"]),
                           interface.grafico_barras("Por modo da câmera", e["por_modo"])], padding=(0, 6)))
    console.print()
    console.print(Columns([interface.grafico_barras("Por mês", e["por_mes"], ordenar=False),
                           interface.grafico_barras("Dia da semana", e["por_dia"], ordenar=False)], padding=(0, 6)))
    console.print()
    if e["termos"]:
        console.print(interface.grafico_barras("Termos mais frequentes nos seus textos", dict(e["termos"]), " ×"))
    if e["resumos_desatualizados"]:
        interface.aviso(f"{e['resumos_desatualizados']} resumo(s) desatualizado(s) — gere de novo no Modo estudante.")
    interface.pausar()


def _tela_historico(biblioteca: dict) -> None:
    interface.cabecalho("Histórico de ações", "🕑")
    eventos = list(reversed(biblioteca["historico"]))[:25]
    if not eventos:
        interface.info("Nenhuma ação registrada ainda.")
    else:
        console.print(interface.tabela(["Quando", ("Ação", {"style": "destaque"}), ("Detalhe", {"ratio": 1})],
                                       [[formatar_data(e["quando"]), e["acao"], e["detalhe"]] for e in eventos],
                                       titulo=f"Últimas {len(eventos)} de {len(biblioteca['historico'])} ações"))
    interface.pausar()


def _tela_exportar(biblioteca: dict) -> None:
    interface.cabecalho("Exportar relatório", "📤")
    destino = PASTA_EXPORTACOES / f"relatorio-estudos-{datetime.now():%Y-%m-%d}.md"
    try:
        PASTA_EXPORTACOES.mkdir(parents=True, exist_ok=True)
        destino.write_text(relatorio_markdown(calcular_estatisticas(biblioteca)), encoding="utf-8")
    except OSError as erro:
        interface.erro(f"Não foi possível gravar o relatório: {erro}")
    else:
        registrar_historico(biblioteca, "Relatório exportado", destino.name)
        interface.sucesso(f"Relatório salvo em {destino}")
    interface.pausar()


def resumo_rapido(biblioteca: dict):
    """Linha de números usada no painel inicial."""
    e = calcular_estatisticas(biblioteca)
    sincronizado = formatar_data(biblioteca.get("ultimaSincronizacao")) if biblioteca.get("ultimaSincronizacao") else "nunca"
    return interface.linha_de_cartoes([
        interface.cartao("capturas", str(e["total"]), "📸"),
        interface.cartao("álbuns", str(len(biblioteca["albuns"])), "📁"),
        interface.cartao("resumos", str(e["com_resumo"]), "✨"),
        interface.cartao("termos", str(e["termos_consultados"]), "📖"),
        interface.cartao("sincronizado", sincronizado, "🔄"),
    ])


def executar_menu(biblioteca: dict) -> None:
    acoes = {"1": _tela_painel, "2": _tela_historico, "3": _tela_exportar}
    while True:
        interface.cabecalho("Estatísticas", "📊")
        interface.menu("Estatísticas", [("1", "Painel completo", "números e gráficos"),
                                        ("2", "Histórico de ações", ""),
                                        ("3", "Exportar relatório", "Markdown")])
        opcao = entrada.ler_opcao(["0", *acoes])
        if opcao == "0":
            return
        acoes[opcao](biblioteca)
