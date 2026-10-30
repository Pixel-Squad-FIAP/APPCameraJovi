"""Câmera contextual: recomenda o modo do app para a cena e dá dicas de captura.

Evolução do camera.py da Sprint 3. Antes eram 4 contextos fixos e uma captura
"simulada"; agora a recomendação usa a luminosidade e o tipo de cena, calcula
a confiança com a mesma fórmula da sugestão do app (src/lib/sceneAnalysis.js)
e devolve um dos modos reais da câmera, que pode ser aberta direto no navegador.
"""

from __future__ import annotations

import webbrowser

from rich.text import Text

from . import entrada, interface
from .interface import console
from .modelo import MODOS, URL_APP
from .persistencia import registrar_historico

LIMIAR_POUCA_LUZ = 20  # % — mesmo limiar (0.2) usado pelo app

CENARIOS = {
    "documento": "Folha, apostila ou documento",
    "slide": "Slide, lousa ou quadro da aula",
    "pessoa": "Pessoa ou selfie",
    "paisagem": "Paisagem, lugar ou objeto",
    "movimento": "Algo em movimento (experimento, esporte)",
}

DICAS = {
    "documento": {
        "luz": "Luz uniforme por cima; evite a sombra do próprio celular sobre a folha.",
        "enquadramento": "Encaixe a folha inteira na moldura A4 — ela fica verde quando está certa.",
        "alinhamento": "Segure o celular paralelo à mesa para as linhas não ficarem tortas.",
    },
    "estudante": {
        "luz": "Evite o reflexo do projetor: fotografe levemente de lado.",
        "enquadramento": "Enquadre o slide inteiro na moldura 16:9; o texto é extraído em segundo plano.",
        "alinhamento": "Fotografe vários slides seguidos — todos vão para o álbum da matéria.",
    },
    "retrato": {
        "luz": "Evite luz forte atrás da pessoa; prefira luz de janela no rosto.",
        "enquadramento": "Centralize a pessoa: o centro fica nítido e as bordas desfocadas.",
        "alinhamento": "Câmera na altura dos olhos e nivelada.",
    },
    "noite": {
        "luz": "Pouca luz: o modo Noite combina vários quadros para reduzir o ruído.",
        "enquadramento": "Mantenha o enquadramento estável durante a captura.",
        "alinhamento": "Apoie o celular ou use o timer de 3 s para não tremer.",
    },
    "video": {
        "luz": "Grave com a luz a favor; o microfone só é pedido na hora de gravar.",
        "enquadramento": "Escolha a proporção antes (9:16 para Reels/TikTok).",
        "alinhamento": "Arraste o visor para cima ou para baixo para dar zoom sem tremer.",
    },
    "foto": {
        "luz": "Verifique de onde vem a luz antes de fotografar.",
        "enquadramento": "Ative a grade nos Ajustes para usar a regra dos terços.",
        "alinhamento": "Toque no visor para focar e ajustar a exposição.",
    },
}


def _limitar(valor: float, minimo: float = 0.0, maximo: float = 1.0) -> float:
    return min(maximo, max(minimo, valor))


def recomendar_modo(cenario: str, luminosidade: int, quer_video: bool = False) -> dict:
    """Retorna {'modo', 'confianca', 'motivos'} para o cenário e a luminosidade (0 a 100)."""
    if cenario not in CENARIOS:
        raise ValueError(f"Cenário desconhecido: {cenario}")
    if not 0 <= luminosidade <= 100:
        raise ValueError("A luminosidade deve estar entre 0 e 100.")

    motivos = []
    pouca_luz = luminosidade < LIMIAR_POUCA_LUZ
    # Mesma fórmula da sugestão "pouca luz" do app: 0,55 + (limiar − luminância) × 4.
    confianca_noite = _limitar(0.55 + (LIMIAR_POUCA_LUZ - luminosidade) / 100 * 4)

    if quer_video:
        modo, confianca = "video", 0.95
        motivos.append("Você quer registrar em vídeo.")
    elif cenario == "documento":
        modo, confianca = "documento", 0.92
        motivos.append("Folhas são recortadas pela moldura e o texto é extraído (OCR).")
        if pouca_luz:
            confianca -= 0.2
            motivos.append("A luz está baixa: o OCR pode errar — aproxime de uma janela ou ligue o flash.")
    elif cenario == "slide":
        modo, confianca = "estudante", 0.9
        motivos.append("Slides e quadros vão direto para o álbum da matéria, com o texto extraído.")
    elif pouca_luz:
        modo, confianca = "noite", confianca_noite
        motivos.append(f"Luminosidade de {luminosidade}% está abaixo de {LIMIAR_POUCA_LUZ}%.")
    elif cenario == "pessoa":
        modo, confianca = "retrato", 0.85
        motivos.append("Retrato destaca a pessoa e desfoca o fundo.")
    elif cenario == "movimento":
        modo, confianca = "foto", 0.6
        motivos.append("Para movimento, a foto automática com o timer desligado é a mais rápida.")
    else:
        modo, confianca = "foto", 0.75
        motivos.append("Cena comum: o modo automático resolve bem.")

    return {"modo": modo, "confianca": round(_limitar(confianca), 2), "motivos": motivos}


def gerar_assistencia(modo: str) -> dict:
    """Orientações de luz, enquadramento e alinhamento para o modo (herdado da Sprint 3)."""
    return DICAS.get(modo, DICAS["foto"])


def url_camera(modo: str | None = None) -> str:
    """Endereço da câmera do app; com ?modo= ela já abre no modo indicado."""
    return f"{URL_APP}/camera" + (f"?modo={modo}" if modo in MODOS else "")


def abrir_camera_no_app(modo: str | None = None) -> bool:
    try:
        return webbrowser.open(url_camera(modo))
    except webbrowser.Error:
        return False

# ---------------------------------------------------------------- telas


def _tela_recomendar(biblioteca: dict) -> None:
    interface.cabecalho("Recomendar modo", "📷", "Responda 3 perguntas e descubra o melhor modo da câmera JOVI.")
    chaves = list(CENARIOS)
    console.print(interface.tabela([("#", {"style": "opcao", "justify": "right"}), "O que você vai capturar?"],
                                   [[n, CENARIOS[c]] for n, c in enumerate(chaves, 1)]))
    cenario = chaves[entrada.ler_inteiro("Número do cenário", 1, len(chaves)) - 1]
    luminosidade = entrada.ler_inteiro("Quanta luz tem no ambiente? (0 = escuro, 100 = sol forte)", 0, 100, padrao=60)
    quer_video = entrada.confirmar("Quer gravar em vídeo?")

    resultado = recomendar_modo(cenario, luminosidade, quer_video)
    modo = MODOS[resultado["modo"]]
    dicas = gerar_assistencia(resultado["modo"])

    texto = Text()
    texto.append(f"{modo['icone']}  Modo {modo['rotulo']}\n", style="bold white")
    texto.append(f"{modo['descricao']}\n\n", style="suave")
    texto.append("Confiança  ")
    texto.append_text(interface.medidor(resultado["confianca"] * 100))
    texto.append(f"  {resultado['confianca'] * 100:.0f}%\n\n")
    for motivo in resultado["motivos"]:
        texto.append(f"• {motivo}\n")
    texto.append("\n💡 Luz: ", style="jovi.claro")
    texto.append(f"{dicas['luz']}\n")
    texto.append("🎯 Enquadramento: ", style="jovi.claro")
    texto.append(f"{dicas['enquadramento']}\n")
    texto.append("📐 Alinhamento: ", style="jovi.claro")
    texto.append(dicas["alinhamento"])
    interface.painel(texto, "Recomendação da câmera")
    registrar_historico(biblioteca, "Modo recomendado", f"{CENARIOS[cenario]} · luz {luminosidade}% → {modo['rotulo']}")

    if entrada.confirmar("Abrir a câmera do app no navegador agora?"):
        if abrir_camera_no_app(resultado["modo"]):
            interface.sucesso(f"Abrindo a câmera do app já no modo {modo['rotulo']}.")
        else:
            interface.aviso(f"Não consegui abrir o navegador. Acesse {url_camera(resultado['modo'])}")
    interface.pausar()


def _tela_modos(biblioteca: dict) -> None:
    interface.cabecalho("Modos da câmera JOVI", "📋", "Os mesmos modos do app, com o que cada um faz.")
    linhas = [[f"{m['icone']} {m['rotulo']}", m["descricao"], "✔" if m["extrai_texto"] else "—"] for m in MODOS.values()]
    console.print(interface.tabela(["Modo", ("O que faz", {"ratio": 1}), ("Extrai texto", {"justify": "center"})], linhas))
    interface.pausar()


def _tela_abrir(biblioteca: dict) -> None:
    if abrir_camera_no_app():
        interface.sucesso(f"Abrindo {URL_APP}/camera no navegador…")
    else:
        interface.aviso(f"Não consegui abrir o navegador. Acesse {URL_APP}/camera.")
    interface.pausar()


def executar_menu(biblioteca: dict) -> None:
    acoes = {"1": _tela_recomendar, "2": _tela_modos, "3": _tela_abrir}
    while True:
        interface.cabecalho("Câmera contextual", "📷")
        interface.menu("Câmera", [("1", "Recomendar modo", "pela cena e pela luz"),
                                  ("2", "Conhecer os modos", ""),
                                  ("3", "Abrir a câmera no navegador", URL_APP)])
        opcao = entrada.ler_opcao(["0", *acoes])
        if opcao == "0":
            return
        acoes[opcao](biblioteca)
