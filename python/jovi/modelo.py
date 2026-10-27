"""Modelo de dados compartilhado com o app React.

Os modos, os álbuns padrão e os campos de uma captura seguem src/data/modes.js
e o registro salvo por src/library/LibraryContext.jsx, para que o mesmo JSON
circule entre o app e o programa Python sem conversão.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

MODOS = {
    "documento": {
        "rotulo": "Documento",
        "icone": "📄",
        "descricao": "Digitaliza folhas e apostilas: recorta pela moldura, deixa o papel branco e extrai o texto.",
        "extrai_texto": True,
    },
    "estudante": {
        "rotulo": "Estudante",
        "icone": "🎓",
        "descricao": "Para slides e quadros: fotografe vários seguidos, já no álbum da matéria, com o texto extraído em segundo plano.",
        "extrai_texto": True,
    },
    "foto": {
        "rotulo": "Foto",
        "icone": "📷",
        "descricao": "Modo automático padrão. A câmera sugere outro modo quando reconhece a cena.",
        "extrai_texto": False,
    },
    "retrato": {
        "rotulo": "Retrato",
        "icone": "🙂",
        "descricao": "Mantém o centro nítido e desfoca as bordas.",
        "extrai_texto": False,
    },
    "noite": {
        "rotulo": "Noite",
        "icone": "🌙",
        "descricao": "Combina vários quadros para reduzir o ruído e clareia a imagem em pouca luz.",
        "extrai_texto": False,
    },
    "video": {
        "rotulo": "Vídeo",
        "icone": "🎬",
        "descricao": "Grava vídeo com áudio na proporção escolhida.",
        "extrai_texto": False,
    },
}

MODO_PADRAO = "foto"
ALBUM_PADRAO = "Geral"
ALBUNS_PADRAO = [ALBUM_PADRAO, "Aulas", "Trabalhos", "Provas"]
TIPOS = ("photo", "video")
STATUS_OCR = ("idle", "processing", "done", "empty", "error")
MAX_NOME_ALBUM = 30
MAX_TITULO = 80

URL_APP = "https://app-camera-jovi.vercel.app"


def agora_iso() -> str:
    """Data/hora atual no mesmo formato do toISOString() do JavaScript."""
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def ler_data(valor: str | None) -> datetime | None:
    if not isinstance(valor, str) or not valor:
        return None
    try:
        data = datetime.fromisoformat(valor.replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
    # Sem fuso informado, assume UTC (é o que o toISOString() do app grava).
    return data if data.tzinfo else data.replace(tzinfo=timezone.utc)


def formatar_data(valor: str | None, com_ano: bool = False) -> str:
    data = ler_data(valor)
    if data is None:
        return "—"
    data = data.astimezone()
    return data.strftime("%d/%m/%Y %H:%M" if com_ano else "%d/%m %H:%M")


def rotulo_modo(modo_id: str) -> str:
    return MODOS.get(modo_id, MODOS[MODO_PADRAO])["rotulo"]


def nova_captura(titulo: str, texto: str, album: str = ALBUM_PADRAO, modo: str = "documento") -> dict:
    """Cria uma captura de texto (sem imagem) no formato do app.

    Ao ser importada no app, ela ganha uma capa gerada a partir do título.
    """
    criada_em = agora_iso()
    return {
        "id": str(uuid.uuid4()),
        "createdAt": criada_em,
        "updatedAt": criada_em,
        "kind": "photo",
        "mode": modo if modo in MODOS else "documento",
        "album": album or ALBUM_PADRAO,
        "title": titulo,
        "titleAuto": False,
        "mimeType": "image/jpeg",
        "size": 0,
        "width": None,
        "height": None,
        "duration": None,
        "text": texto,
        "ocrStatus": "done" if texto.strip() else "idle",
        "ocrConfidence": None,
        "ocrError": None,
        "summary": None,
        "notes": "",
        "origin": "desktop",
    }


def tocar(captura: dict) -> dict:
    """Marca a captura como alterada agora (é o que decide quem vence na sincronização)."""
    captura["updatedAt"] = agora_iso()
    return captura
