"""Consumo da API externa: Wikipédia em português (REST, sem chave).

É a mesma API que o app usa para explicar os termos do resumo
(src/services/wikipediaApi.js). As respostas ficam em cache na biblioteca,
então um termo já consultado continua disponível sem internet.
"""

from __future__ import annotations

from urllib.parse import quote

import requests

from .modelo import agora_iso
from .resumo import normalizar_palavra

ENDPOINT = "https://pt.wikipedia.org/api/rest_v1/page/summary/"
TEMPO_LIMITE = 8  # segundos
CABECALHOS = {
    "Accept": "application/json",
    # A Wikimedia pede um User-Agent que identifique o programa.
    "User-Agent": "JOVI-Desktop/4.0 (FIAP Challenge JOVI 2026; https://github.com/Pixel-Squad-FIAP/APPCameraJovi)",
}


class TermoNaoEncontrado(Exception):
    """A Wikipédia não tem um artigo que explique o termo."""


class FalhaDeConexao(Exception):
    """Sem internet, tempo esgotado ou erro do servidor."""


def chave_cache(termo: str) -> str:
    return normalizar_palavra(" ".join(termo.split()))


def buscar_termo(termo: str, sessao: requests.Session | None = None) -> dict:
    """Consulta o resumo do artigo. Lança TermoNaoEncontrado ou FalhaDeConexao."""
    termo = " ".join(termo.split())
    if not termo:
        raise ValueError("Digite um termo para pesquisar.")
    cliente = sessao or requests
    try:
        resposta = cliente.get(ENDPOINT + quote(termo, safe=""), headers=CABECALHOS, timeout=TEMPO_LIMITE)
    except requests.Timeout as erro:
        raise FalhaDeConexao("A Wikipédia demorou demais para responder.") from erro
    except requests.ConnectionError as erro:
        raise FalhaDeConexao("Sem conexão com a internet.") from erro
    except requests.RequestException as erro:
        raise FalhaDeConexao(f"Falha na requisição: {erro}") from erro

    if resposta.status_code == 404:
        raise TermoNaoEncontrado(termo)
    if not resposta.ok:
        raise FalhaDeConexao(f"A Wikipédia respondeu com erro {resposta.status_code}.")
    try:
        dados = resposta.json()
    except ValueError as erro:
        raise FalhaDeConexao("A resposta da Wikipédia veio num formato inesperado.") from erro

    # Páginas de desambiguação só listam significados; não explicam o termo.
    if dados.get("type") == "disambiguation" or not dados.get("extract"):
        raise TermoNaoEncontrado(termo)

    return {
        "titulo": dados.get("title", termo),
        "descricao": dados.get("description", ""),
        "resumo": dados["extract"],
        "url": (dados.get("content_urls") or {}).get("desktop", {}).get("page")
        or f"https://pt.wikipedia.org/wiki/{quote(termo)}",
        "consultadoEm": agora_iso(),
    }


def buscar_com_cache(termo: str, cache: dict) -> tuple[dict, bool]:
    """Usa o cache quando possível. Retorna (explicação, veio_do_cache)."""
    chave = chave_cache(termo)
    if chave in cache:
        return cache[chave], True
    explicacao = buscar_termo(termo)
    cache[chave] = explicacao
    return explicacao, False
