"""Resumo extrativo: porte fiel de src/lib/summarize.js.

O resultado precisa ser idêntico ao do app React para que um resumo gerado aqui
seja aceito lá como atual (o app compara a "impressão digital" do texto).
Por isso as regras de palavra, espaço e arredondamento imitam o JavaScript.
"""

from __future__ import annotations

import math
import re
import unicodedata
from datetime import datetime, timezone

STOPWORDS = set("""
a ao aos aquela aquelas aquele aqueles aquilo as ate com como da das de dela delas dele deles depois
do dos e ela elas ele eles em entre era eram essa essas esse esses esta estas este estes eu foi foram
ha isso isto ja la lhe lhes mais mas me mesmo meu minha muito na nas nem no nos nossa nosso num numa
o os ou para pela pelas pelo pelos por qual quando que quem se sem ser seu seus sua suas sao so tambem
te tem tinha tu tua um uma umas uns voce voces vos sobre ser sendo pode podem assim onde ainda apenas
cada outro outra outros outras todo toda todos todas tal tais the of and to in is
ocorre ocorrem acontece existe existem deve devem faz fazem possui possuem forma partir ate bem
""".split())

TAMANHOS = {
    "curto": {"rotulo": "Curto", "proporcao": 0.2, "minimo": 1, "maximo": 3},
    "medio": {"rotulo": "Médio", "proporcao": 0.4, "minimo": 2, "maximo": 6},
}

MIN_PALAVRAS_FRASE = 4
MIN_PALAVRAS_TEXTO = 25

# Mesmo conjunto do \s do JavaScript (o \s do Python inclui caracteres de controle a mais).
_ESPACO = "[\t\n\v\f\r    -     　﻿]"
_RE_ESPACOS = re.compile(_ESPACO + "+")
_RE_BORDAS = re.compile(f"^{_ESPACO}+|{_ESPACO}+$")
_RE_FIM_DE_FRASE = re.compile(r"(?<=[.!?…;])" + _ESPACO + r"+(?=[A-ZÀ-Ý0-9\"“(•\-–])")
_RE_MARCADOR = re.compile(r"^[•\-–]" + _ESPACO + "*")
_RE_ACENTOS = re.compile("[̀-ͯ]")


def _trim(texto: str) -> str:
    return _RE_BORDAS.sub("", texto)


def _e_letra_ou_digito(caractere: str) -> bool:
    # Equivale a [\p{L}\d] com a flag "u": qualquer letra Unicode ou dígito ASCII.
    return caractere in "0123456789" or unicodedata.category(caractere).startswith("L")


def palavras_brutas(frase: str) -> list[str]:
    """Separa as sequências de letras/dígitos da frase, como o regex do app."""
    palavras, atual = [], []
    for caractere in frase:
        if _e_letra_ou_digito(caractere):
            atual.append(caractere)
        elif atual:
            palavras.append("".join(atual))
            atual = []
    if atual:
        palavras.append("".join(atual))
    return palavras


def normalizar_palavra(palavra: str) -> str:
    """Minúsculas e sem acentos (NFD + remoção das marcas combinantes)."""
    return _RE_ACENTOS.sub("", unicodedata.normalize("NFD", palavra.lower()))


def _palavras(frase: str) -> list[tuple[str, str]]:
    resultado = []
    for palavra in palavras_brutas(frase):
        token = normalizar_palavra(palavra)
        if len(token) > 2 and token not in STOPWORDS:
            resultado.append((palavra.lower(), token))
    return resultado


def tokenizar(frase: str) -> list[str]:
    return [token for _, token in _palavras(frase)]


def dividir_frases(texto: str | None) -> list[str]:
    """Cada linha é tratada separadamente para que títulos não se juntem à frase seguinte."""
    frases = []
    for paragrafo in re.split(r"\n+", texto or ""):
        paragrafo = _trim(_RE_ESPACOS.sub(" ", paragrafo))
        for frase in _RE_FIM_DE_FRASE.split(paragrafo):
            frase = _trim(_RE_MARCADOR.sub("", frase, count=1))
            if frase:
                frases.append(frase)
    return frases


def _frequencias(frases: list[str]) -> tuple[dict[str, int], dict[str, str]]:
    frequencias: dict[str, int] = {}
    exibicao: dict[str, str] = {}
    for frase in frases:
        for original, token in _palavras(frase):
            frequencias[token] = frequencias.get(token, 0) + 1
            exibicao.setdefault(token, original)
    return frequencias, exibicao


def _arredondar_js(valor: float) -> int:
    # Math.round do JavaScript arredonda .5 para cima; o round() do Python arredonda para o par.
    return math.floor(valor + 0.5)


def resumir(texto: str | None, tamanho: str = "curto") -> dict:
    """Escolhe as frases mais representativas do texto pela frequência normalizada dos termos."""
    config = TAMANHOS.get(tamanho, TAMANHOS["curto"])
    todas = dividir_frases(texto)
    # Títulos e linhas soltas entram na contagem de termos, mas não viram frases do resumo.
    completas = [frase for frase in todas if len(palavras_brutas(frase)) >= MIN_PALAVRAS_FRASE]
    frases = completas or todas

    if not frases:
        return {"sentences": [], "keywords": [], "sourceSentences": 0}

    frequencias, exibicao = _frequencias(todas)
    maior_frequencia = max([1, *frequencias.values()])

    pontuadas = []
    for indice, frase in enumerate(frases):
        tokens = tokenizar(frase)
        peso = 0.0
        for token in tokens:
            peso += frequencias[token] / maior_frequencia
        # Raiz do tamanho evita favorecer frases longas; a primeira frase costuma introduzir o tema.
        bonus = 0.15 if indice == 0 else 0
        pontos = peso / math.sqrt(len(tokens)) + bonus if tokens else 0
        pontuadas.append({"frase": frase, "indice": indice, "pontos": pontos})

    quantidade = min(
        len(frases),
        max(config["minimo"], min(config["maximo"], _arredondar_js(len(frases) * config["proporcao"]))),
    )

    melhores = sorted(pontuadas, key=lambda item: -item["pontos"])[:quantidade]
    selecionadas = [item["frase"] for item in sorted(melhores, key=lambda item: item["indice"])]

    tokens_resumo = {token for frase in selecionadas for token in tokenizar(frase)}
    candidatas = [(token, freq) for token, freq in frequencias.items() if freq > 1 and token in tokens_resumo]
    candidatas.sort(key=lambda par: -par[1])
    palavras_chave = [exibicao[token] for token, _ in candidatas[:6]]

    return {"sentences": selecionadas, "keywords": palavras_chave, "sourceSentences": len(frases)}


def palavras_chave_no_resumo(resumo: dict | None) -> list[str]:
    """Só mantém termos que aparecem nas frases do resumo (vale também para resumos antigos)."""
    if not resumo:
        return []
    tokens = {token for frase in resumo.get("sentences", []) for token in tokenizar(frase)}
    return [palavra for palavra in resumo.get("keywords", []) if normalizar_palavra(palavra) in tokens]


def impressao_texto(texto: str | None) -> str:
    """Hash igual ao textFingerprint do app: percorre unidades UTF-16 com overflow de int32."""
    dados = (texto or "").encode("utf-16-le")
    valor = 0
    for posicao in range(0, len(dados), 2):
        unidade = dados[posicao] | (dados[posicao + 1] << 8)
        valor = (valor * 31 + unidade) & 0xFFFFFFFF
    if valor >= 2**31:
        valor -= 2**32
    return f"{len(dados) // 2}:{valor}"


def gerar_resumo_captura(texto: str, tamanho: str = "curto") -> dict | None:
    """Monta o objeto de resumo no mesmo formato que o app salva (SummaryPanel.jsx)."""
    resultado = resumir(texto, tamanho)
    if not resultado["sentences"]:
        return None
    return {
        **resultado,
        "length": tamanho if tamanho in TAMANHOS else "curto",
        "fingerprint": impressao_texto(texto),
        "createdAt": datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
    }


def resumo_desatualizado(captura: dict) -> bool:
    resumo = captura.get("summary")
    return bool(resumo) and resumo.get("fingerprint") != impressao_texto(captura.get("text", ""))


_RE_PALAVRA_SIMPLES = re.compile(r"[A-Za-zÀ-ÿ0-9]+")


def contar_palavras(texto: str | None) -> int:
    """Mesma contagem do countWords do app (usada no mínimo de 25 palavras para resumir)."""
    return len(_RE_PALAVRA_SIMPLES.findall(texto or ""))
