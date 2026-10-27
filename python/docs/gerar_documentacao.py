"""Gera a documentação da Sprint 4 em PDF (ferramenta da equipe, não faz parte do menu).

1. Roda telas reais do JOVI Desktop com respostas pré-definidas e salva cada uma em SVG (docs/telas/).
2. Imprime docs/documentacao.html em PDF com o Edge/Chrome em modo headless.
3. Descobre em que página cada seção caiu e imprime de novo com os números no sumário.

Uso (na raiz do projeto, com o ambiente virtual ativado):
    pip install pypdf
    python python/docs/gerar_documentacao.py
"""

from __future__ import annotations

import os
import random
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

os.environ["JOVI_SEM_LIMPAR"] = "1"
PASTA_DOCS = Path(__file__).resolve().parent
sys.path.insert(0, str(PASTA_DOCS.parent))

from jovi import camera, documento, estatisticas, estudante, interface, persistencia  # noqa: E402
from jovi.interface import console  # noqa: E402
from jovi.servidor import EstadoServidor, _tela_ao_vivo  # noqa: E402

PASTA_TELAS = PASTA_DOCS / "telas"
FONTE_HTML = PASTA_DOCS / "documentacao.html"
DESTINO_PDF = PASTA_DOCS / "Documentacao_JOVI_Python_Sprint4.pdf"
LARGURA_TERMINAL = 118


def _responder(respostas: list[str]):
    """Substitui o console.input por respostas fixas, mostrando cada uma como se fosse digitada."""
    fila = list(respostas)

    def entrada_falsa(prompt: str = "", **_kwargs) -> str:
        resposta = fila.pop(0) if fila else ""
        console.print(prompt + resposta, end="\n")
        return resposta

    return entrada_falsa


def capturar(nome: str, titulo: str, desenhar, respostas: list[str] | None = None) -> None:
    console.width = LARGURA_TERMINAL
    console.record = True
    console.export_text(clear=True)
    original = console.input
    console.input = _responder(respostas or [])
    try:
        desenhar()
    finally:
        console.input = original
    PASTA_TELAS.mkdir(exist_ok=True)
    console.save_svg(str(PASTA_TELAS / f"{nome}.svg"), title=titulo, clear=True)
    console.record = False
    print(f"tela {nome}.svg", file=sys.__stdout__)


def gerar_telas() -> None:
    biblioteca = persistencia.carregar_exemplo()
    for captura in estudante.capturas_pendentes(biblioteca):
        estudante.aplicar_resumo(biblioteca, captura, "curto")
    biblioteca["quiz"].append({"quando": "2026-10-20T12:00:00.000Z", "acertos": 4, "total": 5, "percentual": 80.0})
    biblioteca["cacheTermos"]["fotossintese"] = {"titulo": "Fotossíntese", "descricao": "processo biológico", "resumo": "", "url": ""}

    import main  # noqa: E402  (painel inicial)

    capturar("01-menu", "JOVI Desktop — menu principal", lambda: main.painel_inicial(biblioteca))
    capturar("02-camera", "Câmera contextual — recomendação",
             lambda: camera._tela_recomendar(biblioteca), ["1", "12", "n", "n", ""])
    fotossintese = next(c for c in biblioteca["capturas"] if c["id"] == "demo-fotossintese")
    capturar("03-captura", "Documento inteligente — captura com resumo", lambda: documento.mostrar_captura(fotossintese))

    # Quiz com semente fixa: a imagem mostra uma resposta certa e uma errada.
    gerar_original = estudante.gerar_perguntas
    estudante.gerar_perguntas = lambda capturas, quantidade, rng=None: gerar_original(capturas, quantidade, random.Random(7))
    corretas = [p["correta"] + 1 for p in estudante.gerar_perguntas([c for c in biblioteca["capturas"] if c.get("summary")], 2)]
    respostas = [str(corretas[0]), str(corretas[1] % 4 + 1)]
    try:
        capturar("04-quiz", "Modo estudante — quiz relâmpago", lambda: estudante._tela_quiz(biblioteca), ["2", *respostas, ""])
    finally:
        estudante.gerar_perguntas = gerar_original
    capturar("05-estatisticas", "Estatísticas", lambda: estatisticas._tela_painel(biblioteca), [""])

    estado = EstadoServidor(biblioteca, lambda: None)
    estado.registrar("OPTIONS", "/api/biblioteca", 204, "pré-verificação CORS")
    estado.registrar("POST", "/api/biblioteca", 200, "↓ 6 nova(s) · 0 atualizada(s)")
    estado.registrar("GET", "/api/status", 200, "status")
    estado.sincronizacoes = 1
    capturar("06-servidor", "Servidor de sincronização ao vivo",
             lambda: console.print(_tela_ao_vivo(estado, 5050, time.monotonic() - 95)))


def _navegador() -> str:
    candidatos = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        shutil.which("msedge") or "", shutil.which("google-chrome") or "", shutil.which("chromium") or "",
    ]
    for caminho in candidatos:
        if caminho and Path(caminho).exists():
            return caminho
    raise SystemExit("Edge ou Chrome não encontrado para imprimir o PDF.")


def imprimir(html: str, destino: Path) -> None:
    temporario = PASTA_DOCS / "_impressao.html"
    temporario.write_text(html, encoding="utf-8")
    perfil = tempfile.mkdtemp()
    try:
        subprocess.run([_navegador(), "--headless", "--disable-gpu", "--no-pdf-header-footer",
                        f"--user-data-dir={perfil}", "--virtual-time-budget=8000",
                        f"--print-to-pdf={destino}", temporario.as_uri()],
                       check=True, capture_output=True, timeout=120)
    finally:
        temporario.unlink(missing_ok=True)
        shutil.rmtree(perfil, ignore_errors=True)


def gerar_pdf() -> None:
    from pypdf import PdfReader

    fonte = FONTE_HTML.read_text(encoding="utf-8")
    secoes = re.findall(r"\{\{pg:([a-z0-9-]+)\}\}", fonte)
    titulos = dict(re.findall(r'<h2 id="([a-z0-9-]+)"[^>]*>(?:<span[^>]*>[^<]*</span>)?\s*([^<]+)</h2>', fonte))

    # 1ª passagem com "00" (mesma largura) só para descobrir as páginas.
    imprimir(re.sub(r"\{\{pg:[a-z0-9-]+\}\}", "00", fonte), DESTINO_PDF)
    paginas = [" ".join(pagina.extract_text().split()) for pagina in PdfReader(DESTINO_PDF).pages]
    numeros = {}
    for secao in secoes:
        titulo = " ".join(titulos[secao].split())
        numeros[secao] = next((n for n, texto in enumerate(paginas, 1) if n > 2 and titulo in texto), 0)
    html = re.sub(r"\{\{pg:([a-z0-9-]+)\}\}", lambda m: f"{numeros[m.group(1)]:02d}", fonte)
    imprimir(html, DESTINO_PDF)
    print(f"PDF: {DESTINO_PDF} ({len(paginas)} páginas) · seções: {numeros}", file=sys.__stdout__)


if __name__ == "__main__":
    interface.console.quiet = False
    gerar_telas()
    gerar_pdf()
