"""Testes das regras de câmera, organização, documento, estudante e estatísticas."""

import random
import sys
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import requests  # noqa: E402

from jovi import camera, documento, estatisticas, estudante, lixeira, organizacao, persistencia, wikipedia  # noqa: E402


def biblioteca_exemplo():
    return persistencia.carregar_exemplo()


class TestCamera(unittest.TestCase):
    def test_recomendacoes(self):
        casos = [("documento", 60, False, "documento"), ("slide", 60, False, "estudante"), ("pessoa", 60, False, "retrato"),
                 ("pessoa", 10, False, "noite"), ("paisagem", 80, False, "foto"), ("paisagem", 5, False, "noite"),
                 ("movimento", 50, True, "video"), ("documento", 5, False, "documento")]
        for cenario, luz, video, esperado in casos:
            with self.subTest(cenario=cenario, luz=luz):
                self.assertEqual(camera.recomendar_modo(cenario, luz, video)["modo"], esperado)

    def test_confianca_noite_usa_formula_do_app(self):
        # 0,55 + (0,2 − 0,1) × 4 = 0,95
        self.assertEqual(camera.recomendar_modo("paisagem", 10)["confianca"], 0.95)

    def test_documento_com_pouca_luz_perde_confianca(self):
        self.assertLess(camera.recomendar_modo("documento", 5)["confianca"], camera.recomendar_modo("documento", 70)["confianca"])

    def test_entradas_invalidas(self):
        with self.assertRaises(ValueError):
            camera.recomendar_modo("nave espacial", 50)
        with self.assertRaises(ValueError):
            camera.recomendar_modo("documento", 101)


class TestOrganizacao(unittest.TestCase):
    def setUp(self):
        self.biblioteca = biblioteca_exemplo()

    def test_validacao_de_album(self):
        self.assertEqual(organizacao.criar_album(self.biblioteca, "  Química   Orgânica "), (True, "Química Orgânica"))
        self.assertFalse(organizacao.criar_album(self.biblioteca, "")[0])
        self.assertFalse(organizacao.criar_album(self.biblioteca, "biologia")[0])  # duplicado, sem diferenciar maiúsculas
        self.assertFalse(organizacao.criar_album(self.biblioteca, "x" * 31)[0])

    def test_renomear_move_capturas(self):
        ok, _ = organizacao.renomear_album(self.biblioteca, "Biologia", "Bio")
        self.assertTrue(ok)
        self.assertEqual(len(organizacao.filtrar(self.biblioteca["capturas"], album="Bio")), 1)
        self.assertFalse(organizacao.renomear_album(self.biblioteca, "Geral", "Outro")[0])

    def test_excluir_devolve_para_geral(self):
        movidas = organizacao.excluir_album(self.biblioteca, "Provas")
        self.assertEqual(movidas, 1)
        self.assertNotIn("Provas", self.biblioteca["albuns"])
        with self.assertRaises(ValueError):
            organizacao.excluir_album(self.biblioteca, "Geral")

    def test_busca_ignora_acentos_e_exige_todos_os_termos(self):
        capturas = self.biblioteca["capturas"]
        self.assertEqual(len(organizacao.buscar(capturas, "FOTOSSINTESE")), 1)
        self.assertEqual(len(organizacao.buscar(capturas, "revolução bastilha")), 1)
        self.assertEqual(organizacao.buscar(capturas, "fotossintese bastilha"), [])

    def test_filtros(self):
        capturas = self.biblioteca["capturas"]
        self.assertEqual(len(organizacao.filtrar(capturas, tipo="video")), 1)
        self.assertTrue(all(c["text"] for c in organizacao.filtrar(capturas, tipo="texto")))


class TestDocumentoEEstudante(unittest.TestCase):
    def setUp(self):
        self.biblioteca = biblioteca_exemplo()

    def test_titulo_do_texto(self):
        self.assertEqual(documento.titulo_do_texto("\n  \nA\nResumo de Biologia\nconteúdo"), "Resumo de Biologia")
        self.assertTrue(documento.titulo_do_texto("palavra " * 30).endswith("…"))

    def test_localizar_e_substituir(self):
        self.assertEqual(documento.substituir_no_texto("Fotosintese e FOTOSINTESE", "fotosintese", "fotossíntese"),
                         ("fotossíntese e fotossíntese", 2))
        self.assertEqual(documento.substituir_no_texto("a+b", "+", "-"), ("a-b", 1))  # sem interpretar regex

    def test_revisar_texto_deixa_resumo_desatualizado(self):
        captura = next(c for c in self.biblioteca["capturas"] if c["summary"])
        anterior = captura["updatedAt"]
        self.assertTrue(documento.revisar_texto(self.biblioteca, captura, captura["text"] + "\nNova linha."))
        self.assertTrue(estudante.resumo_desatualizado(captura))
        self.assertNotEqual(captura["updatedAt"], anterior)
        self.assertIn(captura, estudante.capturas_pendentes(self.biblioteca))

    def test_resumo_exige_texto_suficiente(self):
        captura = documento.criar_documento(self.biblioteca, "Curto", "Só umas palavras.")
        with self.assertRaises(ValueError):
            estudante.aplicar_resumo(self.biblioteca, captura)

    def test_quiz_sem_frase_repetida_e_com_resposta_entre_as_opcoes(self):
        for captura in estudante.capturas_pendentes(self.biblioteca):
            estudante.aplicar_resumo(self.biblioteca, captura, "medio")
        perguntas = estudante.gerar_perguntas(self.biblioteca["capturas"], 10, random.Random(42))
        self.assertGreaterEqual(len(perguntas), 5)
        for pergunta in perguntas:
            self.assertIn(estudante.LACUNA, pergunta["frase"])
            self.assertEqual(pergunta["opcoes"][pergunta["correta"]], pergunta["resposta"])
            self.assertEqual(len(set(pergunta["opcoes"])), 4)
        originais = [p["frase"].replace(estudante.LACUNA, p["resposta"].lower()).lower() for p in perguntas]
        self.assertEqual(len(originais), len(set(originais)))

    def test_markdown_do_caderno(self):
        texto = estudante.montar_markdown("Caderno", self.biblioteca["capturas"][:1], {})
        self.assertTrue(texto.startswith("# Caderno"))
        self.assertIn("### Resumo", texto)

    def test_lixeira(self):
        captura = self.biblioteca["capturas"][0]
        lixeira.mover_para_lixeira(self.biblioteca, captura)
        self.assertNotIn(captura, self.biblioteca["capturas"])
        lixeira.restaurar(self.biblioteca, 0)
        self.assertEqual(self.biblioteca["capturas"][-1]["id"], captura["id"])
        self.assertEqual(lixeira.esvaziar(self.biblioteca), 0)

    def test_estatisticas(self):
        e = estatisticas.calcular_estatisticas(self.biblioteca)
        self.assertEqual((e["total"], e["videos"]), (7, 1))
        self.assertEqual(sum(e["por_album"].values()), 7)
        self.assertTrue(all(len(termo) > 3 for termo, _ in e["termos"]))


class TestWikipedia(unittest.TestCase):
    def resposta(self, status, dados):
        falsa = mock.Mock(status_code=status, ok=200 <= status < 300)
        falsa.json.return_value = dados
        return falsa

    def test_sucesso_e_cache(self):
        cache = {}
        dados = {"title": "Fotossíntese", "description": "processo", "extract": "Processo…",
                 "content_urls": {"desktop": {"page": "https://pt.wikipedia.org/wiki/Fotoss%C3%ADntese"}}}
        with mock.patch("requests.get", return_value=self.resposta(200, dados)) as get:
            explicacao, do_cache = wikipedia.buscar_com_cache("Fotossíntese", cache)
            self.assertFalse(do_cache)
            self.assertEqual(explicacao["titulo"], "Fotossíntese")
            _, do_cache = wikipedia.buscar_com_cache("FOTOSSINTESE", cache)
            self.assertTrue(do_cache)
            self.assertEqual(get.call_count, 1)

    def test_desambiguacao_e_404(self):
        with mock.patch("requests.get", return_value=self.resposta(200, {"type": "disambiguation", "extract": "x"})):
            with self.assertRaises(wikipedia.TermoNaoEncontrado):
                wikipedia.buscar_termo("Manga")
        with mock.patch("requests.get", return_value=self.resposta(404, {})):
            with self.assertRaises(wikipedia.TermoNaoEncontrado):
                wikipedia.buscar_termo("asdfgh")

    def test_sem_internet(self):
        with mock.patch("requests.get", side_effect=requests.ConnectionError()):
            with self.assertRaises(wikipedia.FalhaDeConexao):
                wikipedia.buscar_termo("Python")
        with mock.patch("requests.get", side_effect=requests.Timeout()):
            with self.assertRaises(wikipedia.FalhaDeConexao):
                wikipedia.buscar_termo("Python")


if __name__ == "__main__":
    unittest.main()
