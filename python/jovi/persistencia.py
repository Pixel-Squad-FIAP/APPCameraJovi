"""Persistência em arquivos JSON (biblioteca local do JOVI Desktop)."""

from __future__ import annotations

import json
import os
import shutil
from pathlib import Path

from .modelo import ALBUNS_PADRAO, agora_iso

PASTA_PYTHON = Path(__file__).resolve().parent.parent
PASTA_DADOS = PASTA_PYTHON / "dados"
PASTA_EXPORTACOES = PASTA_PYTHON / "exportacoes"
ARQUIVO_BIBLIOTECA = PASTA_DADOS / "biblioteca.json"
ARQUIVO_EXEMPLO = PASTA_DADOS / "exemplo_biblioteca.json"

FORMATO_LOCAL = "jovi-desktop"
VERSAO_LOCAL = 1
LIMITE_HISTORICO = 200


class ErroPersistencia(Exception):
    """Falha ao ler ou gravar um arquivo de dados."""


def biblioteca_vazia() -> dict:
    return {
        "formato": FORMATO_LOCAL,
        "versao": VERSAO_LOCAL,
        "albuns": list(ALBUNS_PADRAO),
        "capturas": [],
        "lixeira": [],
        "historico": [],
        "cacheTermos": {},
        "quiz": [],
        "ultimaSincronizacao": None,
    }


def _completar(dados: dict) -> dict:
    """Garante todas as chaves esperadas (arquivos de versões antigas ou editados à mão)."""
    biblioteca = biblioteca_vazia()
    for chave, padrao in biblioteca.items():
        valor = dados.get(chave, padrao)
        biblioteca[chave] = valor if isinstance(valor, type(padrao)) or padrao is None else padrao
    biblioteca["capturas"] = [item for item in biblioteca["capturas"] if isinstance(item, dict) and item.get("id")]
    biblioteca["lixeira"] = [item for item in biblioteca["lixeira"] if isinstance(item, dict) and item.get("id")]
    biblioteca["albuns"] = [nome for nome in biblioteca["albuns"] if isinstance(nome, str) and nome.strip()] or list(ALBUNS_PADRAO)
    return biblioteca


def ler_json(caminho: Path) -> object:
    """Lê um arquivo JSON qualquer. Lança ErroPersistencia com mensagem amigável."""
    try:
        with open(caminho, encoding="utf-8-sig") as arquivo:
            return json.load(arquivo)
    except FileNotFoundError as erro:
        raise ErroPersistencia(f"Arquivo não encontrado: {caminho}") from erro
    except json.JSONDecodeError as erro:
        raise ErroPersistencia(f"O arquivo não é um JSON válido (linha {erro.lineno}, coluna {erro.colno}).") from erro
    except UnicodeDecodeError as erro:
        raise ErroPersistencia("O arquivo não está em UTF-8.") from erro
    except OSError as erro:
        raise ErroPersistencia(f"Não foi possível abrir o arquivo: {erro.strerror}") from erro


def salvar_json(caminho: Path, dados: object) -> Path:
    """Grava de forma atômica: escreve num temporário e só então substitui o original."""
    caminho = Path(caminho)
    temporario = caminho.with_name(caminho.name + ".tmp")
    try:
        caminho.parent.mkdir(parents=True, exist_ok=True)
        with open(temporario, "w", encoding="utf-8") as arquivo:
            json.dump(dados, arquivo, ensure_ascii=False, indent=2)
        os.replace(temporario, caminho)
    except OSError as erro:
        temporario.unlink(missing_ok=True)
        raise ErroPersistencia(f"Não foi possível salvar {caminho.name}: {erro.strerror}") from erro
    return caminho


def carregar_biblioteca(caminho: Path = ARQUIVO_BIBLIOTECA) -> tuple[dict | None, str | None]:
    """Retorna (biblioteca, aviso). Biblioteca None = primeira execução (arquivo ainda não existe)."""
    if not Path(caminho).exists():
        return None, None
    try:
        dados = ler_json(caminho)
    except ErroPersistencia as erro:
        # Arquivo corrompido: guarda uma cópia para análise e recomeça vazio, sem travar o programa.
        copia = Path(caminho).with_suffix(".corrompido.json")
        try:
            shutil.copyfile(caminho, copia)
        except OSError:
            copia = None
        aviso = f"{erro} Uma biblioteca vazia foi criada"
        aviso += f" e o arquivo antigo foi guardado em {copia.name}." if copia else "."
        return biblioteca_vazia(), aviso
    if not isinstance(dados, dict):
        return biblioteca_vazia(), "O arquivo da biblioteca tinha um formato inesperado; foi criada uma biblioteca vazia."
    return _completar(dados), None


def carregar_exemplo() -> dict:
    dados = ler_json(ARQUIVO_EXEMPLO)
    biblioteca = biblioteca_vazia()
    biblioteca["albuns"] = list(dict.fromkeys([*biblioteca["albuns"], *dados.get("albuns", [])]))
    biblioteca["capturas"] = dados.get("capturas", [])
    return biblioteca


def salvar_biblioteca(biblioteca: dict, caminho: Path = ARQUIVO_BIBLIOTECA) -> Path:
    return salvar_json(caminho, biblioteca)


def registrar_historico(biblioteca: dict, acao: str, detalhe: str = "") -> None:
    biblioteca["historico"].append({"quando": agora_iso(), "acao": acao, "detalhe": detalhe})
    del biblioteca["historico"][:-LIMITE_HISTORICO]
