"""Paridade do resumo em Python com o resumo do app (src/lib/summarize.js).

As saídas esperadas são geradas pelo próprio código JavaScript:
    node python/tests/gerar_fixtures_resumo.mjs
"""

import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from jovi.resumo import (  # noqa: E402
    contar_palavras,
    dividir_frases,
    gerar_resumo_captura,
    impressao_texto,
    palavras_chave_no_resumo,
    resumir,
    resumo_desatualizado,
)

CASOS = json.loads((Path(__file__).parent / "fixtures" / "resumos.json").read_text(encoding="utf-8"))


class TestParidadeComApp(unittest.TestCase):
    def test_divisao_de_frases(self):
        for caso in CASOS:
            with self.subTest(texto=caso["texto"][:40]):
                self.assertEqual(dividir_frases(caso["texto"]), caso["frases"])

    def test_resumo(self):
        for caso in CASOS:
            with self.subTest(texto=caso["texto"][:40], tamanho=caso["tamanho"]):
                self.assertEqual(resumir(caso["texto"], caso["tamanho"]), caso["resumo"])

    def test_palavras_chave_no_resumo(self):
        for caso in CASOS:
            with self.subTest(texto=caso["texto"][:40]):
                self.assertEqual(palavras_chave_no_resumo(caso["resumo"]), caso["palavrasNoResumo"])

    def test_impressao_digital(self):
        for caso in CASOS:
            with self.subTest(texto=caso["texto"][:40]):
                self.assertEqual(impressao_texto(caso["texto"]), caso["impressao"])


class TestResumoDaCaptura(unittest.TestCase):
    def test_formato_igual_ao_salvo_pelo_app(self):
        texto = CASOS[0]["texto"]
        resumo = gerar_resumo_captura(texto, "medio")
        self.assertEqual(set(resumo), {"sentences", "keywords", "sourceSentences", "length", "fingerprint", "createdAt"})
        self.assertEqual(resumo["length"], "medio")
        self.assertTrue(resumo["createdAt"].endswith("Z"))
        self.assertFalse(resumo_desatualizado({"text": texto, "summary": resumo}))
        self.assertTrue(resumo_desatualizado({"text": texto + " Nova frase.", "summary": resumo}))

    def test_texto_vazio_nao_gera_resumo(self):
        self.assertIsNone(gerar_resumo_captura("   "))

    def test_contagem_de_palavras(self):
        self.assertEqual(contar_palavras("Câmera JOVI, versão 4.0!"), 5)
        self.assertEqual(contar_palavras(None), 0)


if __name__ == "__main__":
    unittest.main()
