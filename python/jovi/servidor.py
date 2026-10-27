"""Servidor local de sincronização (integração por API).

Sobe um servidor HTTP só da biblioteca padrão em 127.0.0.1. O app React
(Galeria › Sincronizar › Sincronizar com o JOVI Desktop) envia a biblioteca do
navegador num POST; o Python mescla, salva e devolve a biblioteca mesclada, que
o app aplica do lado dele. Uma requisição deixa os dois lados iguais.

Endpoints:
    GET  /api/status        estado do servidor e totais
    GET  /api/biblioteca    biblioteca no formato "jovi-biblioteca"
    POST /api/biblioteca    recebe a biblioteca do app, mescla e devolve o resultado
    GET  /api/estatisticas  os mesmos números do menu Estatísticas
"""

from __future__ import annotations

import json
import re
import threading
import time
import webbrowser
from collections import deque
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from rich.console import Group
from rich.live import Live
from rich.panel import Panel
from rich.text import Text

from . import __version__, entrada, interface
from .estatisticas import calcular_estatisticas
from .integracao import ErroFormato, ids_excluidos, ler_arquivo_troca, mesclar, montar_arquivo_troca
from .interface import AZUL, console
from .modelo import URL_APP, agora_iso
from .persistencia import ErroPersistencia, registrar_historico

HOST = "127.0.0.1"
PORTA_PADRAO = 5050
LIMITE_CORPO = 40 * 1024 * 1024  # miniaturas em base64 deixam o JSON grande

# Só o app (local ou publicado) pode ler a biblioteca pelo navegador; outros sites são recusados.
ORIGENS_PERMITIDAS = re.compile(
    r"^(https?://(127\.0\.0\.1|localhost)(:\d+)?|https://app-camera-jovi(-[a-z0-9-]+)?\.vercel\.app)$"
)


class EstadoServidor:
    """Dados compartilhados entre a thread do servidor e a tela ao vivo."""

    def __init__(self, biblioteca: dict, salvar):
        self.biblioteca = biblioteca
        self.salvar = salvar
        self.trava = threading.Lock()
        self.eventos: deque = deque(maxlen=10)
        self.requisicoes = 0
        self.sincronizacoes = 0

    def registrar(self, metodo: str, caminho: str, status: int, detalhe: str = "") -> None:
        self.requisicoes += 1
        self.eventos.appendleft((datetime.now().strftime("%H:%M:%S"), metodo, caminho, status, detalhe))


def sincronizar(estado: EstadoServidor, dados: object) -> dict:
    """Mescla a biblioteca recebida do app e devolve a biblioteca resultante + o relatório."""
    albuns, capturas, invalidas = ler_arquivo_troca(dados)
    with estado.trava:
        relatorio = mesclar(estado.biblioteca, albuns, capturas, ids_excluidos(dados))
        estado.biblioteca["ultimaSincronizacao"] = agora_iso()
        registrar_historico(estado.biblioteca, "Sincronizado com o app (servidor)",
                            f"{len(relatorio['novas'])} nova(s), {len(relatorio['atualizadas'])} atualizada(s)")
        estado.salvar()
        estado.sincronizacoes += 1
        resposta = montar_arquivo_troca(estado.biblioteca)
    resposta["relatorio"] = {"novas": len(relatorio["novas"]), "atualizadas": len(relatorio["atualizadas"]),
                             "iguais": relatorio["iguais"], "ignoradas": relatorio["ignoradas"],
                             "removidas": len(relatorio["removidas"]), "invalidas": invalidas}
    return resposta


def criar_manipulador(estado: EstadoServidor) -> type[BaseHTTPRequestHandler]:
    class Manipulador(BaseHTTPRequestHandler):
        server_version = f"JOVI-Desktop/{__version__}"

        def log_message(self, formato, *args):  # o log aparece na tela ao vivo, não no terminal cru
            pass

        def _origem_permitida(self) -> bool:
            origem = self.headers.get("Origin")
            return origem is None or bool(ORIGENS_PERMITIDAS.match(origem))

        def _cabecalhos_cors(self) -> None:
            origem = self.headers.get("Origin")
            if origem and ORIGENS_PERMITIDAS.match(origem):
                self.send_header("Access-Control-Allow-Origin", origem)
                self.send_header("Vary", "Origin")
                self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
                self.send_header("Access-Control-Allow-Headers", "Content-Type")
                # Necessário para o app publicado (https) acessar o localhost no Chrome.
                self.send_header("Access-Control-Allow-Private-Network", "true")
                self.send_header("Access-Control-Max-Age", "600")

        def _responder(self, status: int, dados: dict, detalhe: str = "") -> None:
            corpo = json.dumps(dados, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self._cabecalhos_cors()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(corpo)))
            self.end_headers()
            self.wfile.write(corpo)
            estado.registrar(self.command, self.path, status, detalhe)

        def do_OPTIONS(self):
            self.send_response(204 if self._origem_permitida() else 403)
            self._cabecalhos_cors()
            self.send_header("Content-Length", "0")
            self.end_headers()
            estado.registrar("OPTIONS", self.path, 204 if self._origem_permitida() else 403, "pré-verificação CORS")

        def do_GET(self):
            if not self._origem_permitida():
                return self._responder(403, {"erro": "Origem não permitida."}, self.headers.get("Origin", ""))
            caminho = self.path.split("?")[0].rstrip("/") or "/"
            with estado.trava:
                biblioteca = estado.biblioteca
                if caminho in ("/", "/api/status"):
                    return self._responder(200, {
                        "ok": True, "app": "JOVI Desktop", "versao": __version__,
                        "capturas": len(biblioteca["capturas"]), "albuns": len(biblioteca["albuns"]),
                        "ultimaSincronizacao": biblioteca.get("ultimaSincronizacao"),
                        "endpoints": ["GET /api/status", "GET /api/biblioteca", "POST /api/biblioteca", "GET /api/estatisticas"],
                    }, "status")
                if caminho == "/api/biblioteca":
                    return self._responder(200, montar_arquivo_troca(biblioteca), f"{len(biblioteca['capturas'])} capturas")
                if caminho == "/api/estatisticas":
                    return self._responder(200, calcular_estatisticas(biblioteca), "estatísticas")
            self._responder(404, {"erro": "Rota não encontrada."})

        def do_POST(self):
            if not self._origem_permitida():
                return self._responder(403, {"erro": "Origem não permitida."}, self.headers.get("Origin", ""))
            if self.path.split("?")[0].rstrip("/") != "/api/biblioteca":
                return self._responder(404, {"erro": "Rota não encontrada."})
            try:
                tamanho = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                tamanho = -1
            if not 0 < tamanho <= LIMITE_CORPO:
                return self._responder(413 if tamanho > LIMITE_CORPO else 400, {"erro": "Corpo da requisição ausente ou grande demais."})
            try:
                dados = json.loads(self.rfile.read(tamanho).decode("utf-8"))
                resposta = sincronizar(estado, dados)
            except (UnicodeDecodeError, json.JSONDecodeError):
                return self._responder(400, {"erro": "O corpo não é um JSON válido."}, "JSON inválido")
            except ErroFormato as erro:
                return self._responder(422, {"erro": str(erro)}, "formato inválido")
            except ErroPersistencia as erro:
                return self._responder(500, {"erro": str(erro)}, "falha ao salvar")
            r = resposta["relatorio"]
            self._responder(200, resposta, f"↓ {r['novas']} nova(s) · {r['atualizadas']} atualizada(s)")

    return Manipulador


def iniciar_servidor(estado: EstadoServidor, porta: int = PORTA_PADRAO) -> tuple[ThreadingHTTPServer, threading.Thread]:
    """Cria o servidor e o coloca para rodar numa thread. Lança OSError se a porta estiver ocupada."""
    servidor = ThreadingHTTPServer((HOST, porta), criar_manipulador(estado))
    servidor.daemon_threads = True
    thread = threading.Thread(target=servidor.serve_forever, name="jovi-servidor", daemon=True)
    thread.start()
    return servidor, thread


def _tela_ao_vivo(estado: EstadoServidor, porta: int, inicio: float) -> Group:
    segundos = int(time.monotonic() - inicio)
    cabecalho = Text()
    cabecalho.append("● ", style="bold green")
    cabecalho.append(f"Servidor ativo em http://{HOST}:{porta}", style="bold white")
    cabecalho.append(f"   {segundos // 60:02d}:{segundos % 60:02d} no ar · {estado.requisicoes} requisição(ões) · "
                     f"{estado.sincronizacoes} sincronização(ões) · {len(estado.biblioteca['capturas'])} capturas\n", style="suave")
    cabecalho.append("No app: Galeria › Sincronizar › Sincronizar com o JOVI Desktop", style="jovi.claro")
    linhas = [[hora, metodo, caminho, Text(str(status), style="ok" if status < 400 else "erro"), detalhe]
              for hora, metodo, caminho, status, detalhe in estado.eventos]
    tabela = interface.tabela(["Hora", "Método", "Rota", "Status", ("Detalhe", {"ratio": 1})],
                              linhas or [["—", "", "aguardando o app…", "", ""]])
    return Group(Panel(cabecalho, border_style=AZUL, title="[titulo]🔄 Sincronização ao vivo[/]"), tabela,
                 Text("Ctrl+C para parar o servidor e voltar ao menu", style="suave"))


def tela_servidor(biblioteca: dict, salvar) -> None:
    interface.cabecalho("Servidor de sincronização", "🔄", "Integração por API: o app conversa com o Python pelo localhost.")
    estado = EstadoServidor(biblioteca, salvar)
    porta = PORTA_PADRAO
    while True:
        try:
            servidor, thread = iniciar_servidor(estado, porta)
            break
        except OSError:
            interface.erro(f"A porta {porta} já está em uso (talvez o servidor já esteja aberto em outra janela).")
            porta = entrada.ler_inteiro("Tente outra porta (0 cancela)", 0, 65535)
            if porta == 0:
                return
            if porta < 1024:
                interface.erro("Use uma porta acima de 1023.")
                porta = PORTA_PADRAO
    if porta != PORTA_PADRAO:
        interface.aviso(f"O app procura o servidor na porta {PORTA_PADRAO}; use “?porta={porta}” no endereço da Galeria.")
    if entrada.confirmar("Abrir a Galeria do app no navegador?", padrao=True):
        sufixo = f"&porta={porta}" if porta != PORTA_PADRAO else ""
        webbrowser.open(f"{URL_APP}/galeria?sincronizar=1{sufixo}")

    inicio = time.monotonic()
    try:
        with Live(_tela_ao_vivo(estado, porta, inicio), console=console, refresh_per_second=4, screen=False) as ao_vivo:
            while True:
                time.sleep(0.25)
                ao_vivo.update(_tela_ao_vivo(estado, porta, inicio))
    except KeyboardInterrupt:
        pass
    finally:
        servidor.shutdown()
        servidor.server_close()
        thread.join(timeout=2)
    interface.sucesso(f"Servidor encerrado. {estado.sincronizacoes} sincronização(ões) nesta sessão.")
    interface.pausar()
