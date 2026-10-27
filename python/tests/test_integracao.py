"""Testes da integração com o app (formato de troca, mesclagem e servidor) e da persistência."""

import json
import sys
import tempfile
import unittest
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from jovi import integracao, persistencia  # noqa: E402
from jovi.modelo import nova_captura  # noqa: E402
from jovi.servidor import EstadoServidor, iniciar_servidor  # noqa: E402


def captura_app(id_, atualizada="2026-10-01T10:00:00.000Z", **campos):
    return {"id": id_, "createdAt": "2026-09-01T10:00:00.000Z", "updatedAt": atualizada, "kind": "photo",
            "mode": "documento", "album": "Aulas", "title": f"Captura {id_}", "titleAuto": True, "text": "Texto",
            "ocrStatus": "done", "ocrConfidence": 90, "summary": None, "notes": "", **campos}


def arquivo_app(*capturas, albuns=("Geral", "Aulas")):
    return {"formato": "jovi-biblioteca", "versao": 1, "origem": "app", "albuns": list(albuns), "capturas": list(capturas)}


class TestFormatoDeTroca(unittest.TestCase):
    def test_rejeita_arquivo_de_outro_formato(self):
        for dados in ([], {"formato": "outro", "versao": 1}, {"formato": "jovi-biblioteca", "versao": 2, "capturas": []},
                      {"formato": "jovi-biblioteca", "versao": 1, "capturas": "x"}):
            with self.subTest(dados=dados), self.assertRaises(integracao.ErroFormato):
                integracao.ler_arquivo_troca(dados)

    def test_pula_capturas_invalidas_e_normaliza(self):
        dados = arquivo_app(captura_app("a", ocrStatus="processing", mode="inexistente"),
                            {"id": "sem-datas", "kind": "photo"},
                            captura_app("b", kind="audio"),
                            captura_app("c", summary={"sem": "frases"}))
        albuns, capturas, invalidas = integracao.ler_arquivo_troca(dados)
        self.assertEqual(albuns, ["Geral", "Aulas"])
        self.assertEqual([c["id"] for c in capturas], ["a"])
        self.assertEqual(invalidas, 3)
        self.assertEqual(capturas[0]["ocrStatus"], "done")  # "processing" não sobrevive fora do navegador
        self.assertEqual(capturas[0]["mode"], "foto")


class TestMesclagem(unittest.TestCase):
    def setUp(self):
        self.biblioteca = persistencia.biblioteca_vazia()
        self.biblioteca["capturas"] = [captura_app("x", notes="nota local")]

    def test_captura_nova_e_album_novo(self):
        relatorio = integracao.mesclar(self.biblioteca, ["Biologia"], [captura_app("y", album="Química")])
        self.assertEqual(relatorio["novas"], ["Captura y"])
        self.assertIn("Biologia", self.biblioteca["albuns"])
        self.assertIn("Química", self.biblioteca["albuns"])  # álbum usado por uma captura também entra

    def test_versao_mais_recente_vence(self):
        recebida = captura_app("x", atualizada="2026-10-02T10:00:00.000Z", notes="nota do app", album="Provas")
        relatorio = integracao.mesclar(self.biblioteca, [], [recebida])
        local = self.biblioteca["capturas"][0]
        self.assertEqual(relatorio["atualizadas"], ["Captura x"])
        self.assertEqual((local["notes"], local["album"]), ("nota do app", "Provas"))
        self.assertEqual(local["updatedAt"], "2026-10-02T10:00:00.000Z")

    def test_versao_mais_antiga_nao_sobrescreve(self):
        antiga = captura_app("x", atualizada="2026-09-30T10:00:00.000Z", notes="nota velha")
        relatorio = integracao.mesclar(self.biblioteca, [], [antiga])
        self.assertEqual(relatorio["iguais"], 1)
        self.assertEqual(self.biblioteca["capturas"][0]["notes"], "nota local")

    def test_item_na_lixeira_nao_volta(self):
        self.biblioteca["lixeira"] = [captura_app("z")]
        relatorio = integracao.mesclar(self.biblioteca, [], [captura_app("z")])
        self.assertEqual(relatorio["ignoradas"], 1)
        self.assertNotIn("z", [c["id"] for c in self.biblioteca["capturas"]])

    def test_excluida_no_app_vai_para_a_lixeira(self):
        dados = arquivo_app(captura_app("y"))
        dados["excluidas"] = ["x", "y", 42]
        _, capturas, _ = integracao.ler_arquivo_troca(dados)
        relatorio = integracao.mesclar(self.biblioteca, [], capturas, integracao.ids_excluidos(dados))
        self.assertEqual(relatorio["removidas"], ["Captura x"])
        self.assertEqual(self.biblioteca["capturas"], [])  # "y" também foi excluída: não é recriada
        self.assertEqual([c["id"] for c in self.biblioteca["lixeira"]], ["x"])
        self.assertEqual(integracao.montar_arquivo_troca(self.biblioteca)["excluidas"], ["x"])

    def test_ida_e_volta_nao_muda_nada(self):
        self.biblioteca["capturas"].append(nova_captura("Doc", "Algum texto aqui", "Aulas"))
        arquivo = json.loads(json.dumps(integracao.montar_arquivo_troca(self.biblioteca)))
        _, capturas, _ = integracao.ler_arquivo_troca(arquivo)
        relatorio = integracao.mesclar(self.biblioteca, arquivo["albuns"], capturas)
        self.assertEqual((relatorio["novas"], relatorio["atualizadas"], relatorio["iguais"]), ([], [], 2))


class TestPersistencia(unittest.TestCase):
    def setUp(self):
        self.pasta = Path(tempfile.mkdtemp())
        self.arquivo = self.pasta / "biblioteca.json"

    def test_salvar_e_carregar(self):
        biblioteca = persistencia.biblioteca_vazia()
        biblioteca["capturas"].append(nova_captura("Título", "texto"))
        persistencia.salvar_biblioteca(biblioteca, self.arquivo)
        carregada, aviso = persistencia.carregar_biblioteca(self.arquivo)
        self.assertIsNone(aviso)
        self.assertEqual(carregada["capturas"][0]["title"], "Título")

    def test_primeira_execucao(self):
        self.assertEqual(persistencia.carregar_biblioteca(self.arquivo), (None, None))

    def test_json_corrompido_vira_backup(self):
        self.arquivo.write_text("{ isto não é json", encoding="utf-8")
        biblioteca, aviso = persistencia.carregar_biblioteca(self.arquivo)
        self.assertEqual(biblioteca["capturas"], [])
        self.assertIn("corrompido", aviso)
        self.assertTrue((self.pasta / "biblioteca.corrompido.json").exists())

    def test_completa_chaves_ausentes(self):
        self.arquivo.write_text(json.dumps({"capturas": [{"id": "a"}, "lixo"], "albuns": "x"}), encoding="utf-8")
        biblioteca, _ = persistencia.carregar_biblioteca(self.arquivo)
        self.assertEqual(len(biblioteca["capturas"]), 1)
        self.assertEqual(biblioteca["lixeira"], [])
        self.assertIn("Geral", biblioteca["albuns"])

    def test_exemplo_e_um_arquivo_de_troca_valido(self):
        _, capturas, invalidas = integracao.ler_arquivo_troca(persistencia.ler_json(persistencia.ARQUIVO_EXEMPLO))
        self.assertEqual(invalidas, 0)
        self.assertGreaterEqual(len(capturas), 5)


class TestServidor(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.biblioteca = persistencia.biblioteca_vazia()
        cls.biblioteca["capturas"] = [captura_app("local")]
        cls.salvamentos = []
        cls.estado = EstadoServidor(cls.biblioteca, lambda: cls.salvamentos.append(1))
        cls.servidor, cls.thread = iniciar_servidor(cls.estado, 0)  # porta 0 = qualquer porta livre
        cls.url = f"http://127.0.0.1:{cls.servidor.server_address[1]}"

    @classmethod
    def tearDownClass(cls):
        cls.servidor.shutdown()
        cls.servidor.server_close()

    def requisitar(self, caminho, dados=None, origem=None, metodo=None):
        corpo = json.dumps(dados).encode() if dados is not None else None
        pedido = urllib.request.Request(self.url + caminho, data=corpo, method=metodo)
        pedido.add_header("Content-Type", "application/json")
        if origem:
            pedido.add_header("Origin", origem)
        with urllib.request.urlopen(pedido, timeout=5) as resposta:
            return resposta.status, dict(resposta.headers), json.loads(resposta.read() or b"null")

    def test_status(self):
        status, _, dados = self.requisitar("/api/status")
        self.assertEqual(status, 200)
        self.assertTrue(dados["ok"])

    def test_sincronizacao_devolve_biblioteca_mesclada(self):
        status, cabecalhos, dados = self.requisitar("/api/biblioteca", arquivo_app(captura_app("do-app")),
                                                    origem="https://app-camera-jovi.vercel.app")
        self.assertEqual(status, 200)
        self.assertEqual(cabecalhos["Access-Control-Allow-Origin"], "https://app-camera-jovi.vercel.app")
        self.assertEqual({c["id"] for c in dados["capturas"]}, {"local", "do-app"})
        self.assertEqual(dados["relatorio"]["novas"], 1)
        self.assertTrue(self.salvamentos)

    def test_origem_desconhecida_e_recusada(self):
        with self.assertRaises(urllib.error.HTTPError) as erro:
            self.requisitar("/api/biblioteca", origem="https://site-qualquer.com")
        self.assertEqual(erro.exception.code, 403)

    def test_formato_invalido(self):
        with self.assertRaises(urllib.error.HTTPError) as erro:
            self.requisitar("/api/biblioteca", {"formato": "x"})
        self.assertEqual(erro.exception.code, 422)

    def test_preflight_libera_rede_privada(self):
        status, cabecalhos, _ = self.requisitar("/api/biblioteca", origem="http://127.0.0.1:5173", metodo="OPTIONS")
        self.assertEqual(status, 204)
        self.assertEqual(cabecalhos["Access-Control-Allow-Private-Network"], "true")


if __name__ == "__main__":
    unittest.main()
