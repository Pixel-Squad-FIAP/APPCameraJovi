# JOVI Desktop: programa Python (Sprint 4)

Programa de terminal do **Sistema Inteligente de Câmera JOVI**, entregue para a Sprint 4 de *Computational Thinking with Python*. Ele faz parte do mesmo projeto do app React e **compartilha a mesma biblioteca de capturas**. As fotos tiradas no app chegam aqui com o texto extraído pelo OCR. Aqui o estudante gera resumos, consulta termos na Wikipédia, faz anotações, organiza os álbuns, joga um quiz de revisão e exporta cadernos de estudo. Tudo volta para o app.

## Requisitos

- Python 3.10 ou superior (testado no 3.12)
- Dependências: `rich` (interface do terminal) e `requests` (API da Wikipédia)

## Instalação

Na raiz do projeto:

```bash
python -m venv python/.venv

# Windows
python\.venv\Scripts\activate
# macOS / Linux
source python/.venv/bin/activate

pip install -r python/requirements.txt
```

## Execução

```bash
python python/main.py              # menu interativo
python python/main.py --servidor   # abre direto o servidor de sincronização com o app
```

Na primeira execução, o programa oferece carregar uma **biblioteca de exemplo** com apostilas, slides e provas de um estudante. Assim dá para testar tudo sem o app.

> Use um terminal com suporte a cores e emojis (Windows Terminal, terminal do VS Code, PowerShell 7, ou o terminal do macOS/Linux).

## Menu

| Opção | O que faz |
| --- | --- |
| 1. Câmera contextual | Recomenda o modo da câmera (Documento, Estudante, Retrato, Noite, Vídeo, Foto) a partir da cena e da luz. Mostra a confiança e dicas de luz, enquadramento e alinhamento, e abre a câmera do app no navegador já no modo recomendado. |
| 2. Documento inteligente | Importa um `.txt`/`.md` (ou texto colado) como captura, mostra uma captura completa e revisa o texto do OCR com localizar/substituir. |
| 3. Modo estudante | Gera resumo curto ou médio (o mesmo algoritmo do app) e resume em lote as capturas pendentes. Explica termos com a **API da Wikipédia**, com cache offline. Também tem anotações, **quiz relâmpago**, glossário e exportação de material de estudo em Markdown. |
| 4. Organização acadêmica | Lista, busca sem acentos e filtra por álbum, modo ou tipo. Cria, renomeia e exclui álbuns, além de mover, renomear e remover capturas. |
| 5. Estatísticas | Painel com números e gráficos de barra (por álbum, modo, mês e dia da semana) e os termos mais frequentes. Mostra o histórico de ações e exporta um relatório em Markdown. |
| 6. Integração com o app | Importa e exporta a biblioteca em JSON e liga o **servidor de sincronização**. |
| 7. Lixeira | Restaura ou apaga de vez as capturas removidas. |
| 0. Sair | Salva e encerra o programa. |

Depois de cada funcionalidade, o programa salva e volta ao menu principal. Em qualquer submenu, `0`, `Enter` ou `voltar` volta ao menu anterior. Entradas inválidas (letras no lugar de números, valores fora do intervalo, campos vazios, arquivos inexistentes) são explicadas e perguntadas de novo. `Ctrl+C` cancela a operação atual e volta ao menu.

## Integração com o app React

Há dois caminhos, e os dois usam o mesmo formato (`"formato": "jovi-biblioteca"`) e a mesma regra de mesclagem (`python/jovi/integracao.py` ⇄ `src/services/libraryTransfer.js`).

**1. Arquivo JSON**

1. No app, abra **Galeria › Sincronizar › Exportar biblioteca**. O navegador salva o arquivo `jovi-biblioteca-AAAA-MM-DD.json`.
2. Aqui, escolha **6 › 1 Importar do app**. O arquivo é encontrado automaticamente na pasta Downloads.
3. Trabalhe no Python e depois use **6 › 2 Exportar para o app**.
4. No app, abra **Galeria › Sincronizar › Importar biblioteca**.

**2. Servidor local (API)**

1. Aqui, escolha **6 › 3** (ou rode `python python/main.py --servidor`). O servidor sobe em `http://127.0.0.1:5050`.
2. No app, abra **Galeria › Sincronizar › Sincronizar com o JOVI Desktop**. Uma requisição envia as alterações do navegador e devolve as do Python.

Funciona com o app local (`npm run dev`) e com o publicado na Vercel. Se o Chrome pedir permissão de acesso à rede local, permita.

| Endpoint | Descrição |
| --- | --- |
| `GET /api/status` | Estado do servidor e totais |
| `GET /api/biblioteca` | Biblioteca completa no formato de troca |
| `POST /api/biblioteca` | Recebe a biblioteca do app, mescla, salva e devolve o resultado |
| `GET /api/estatisticas` | Os mesmos números do menu Estatísticas |

**Regras da mesclagem**

- As capturas são casadas pelo `id`. Vence a edição mais recente (`updatedAt`), e só os campos editáveis mudam: título, álbum, texto, resumo, anotações e status do OCR.
- Documentos criados no Python aparecem no app com uma capa gerada a partir do título.
- Os álbuns dos dois lados são unidos.
- O que é excluído no app vai para a lixeira do Python e pode ser restaurado. Nenhum dos lados recria o que o outro excluiu.
- O servidor só aceita requisições do próprio app (localhost ou `app-camera-jovi.vercel.app`) e escuta apenas em `127.0.0.1`.

O resumo em Python é um porte fiel de `src/lib/summarize.js`. Um resumo gerado aqui é aceito pelo app como atual, sem o aviso de "texto mudou", porque a impressão digital do texto é calculada da mesma forma.

## Persistência

| Arquivo | Conteúdo |
| --- | --- |
| `python/dados/biblioteca.json` | Capturas, álbuns, lixeira, histórico de ações, cache de termos da Wikipédia e partidas do quiz. É gerado na primeira execução e fica fora do Git. |
| `python/dados/exemplo_biblioteca.json` | Biblioteca de exemplo, no mesmo formato que o app exporta |
| `python/exportacoes/` | Cadernos de estudo, relatórios e JSON para o app |

A gravação é atômica: o programa escreve num arquivo temporário e só então substitui o original. Se o JSON estiver corrompido, o programa guarda uma cópia (`*.corrompido.json`) e recomeça com uma biblioteca vazia, sem travar.

## API externa

API pública da Wikipédia em português (REST, sem chave), a mesma usada pelo app:

```text
GET https://pt.wikipedia.org/api/rest_v1/page/summary/{termo}
```

O código está em `python/jovi/wikipedia.py`. Ele trata termo inexistente (404), página de desambiguação, falta de internet e tempo esgotado. Os termos consultados ficam em cache e continuam disponíveis offline, no Glossário.

## Estrutura

```text
python/
  main.py             Ponto de entrada: painel inicial e menu principal
  requirements.txt
  jovi/
    interface.py      Visual do terminal (Rich) com as cores do app
    entrada.py        Leitura de dados com validação
    persistencia.py   Leitura e gravação dos arquivos JSON
    modelo.py         Modos, álbuns e formato de captura (iguais ao app)
    camera.py         Recomendação de modo e dicas de captura
    documento.py      Texto → captura, visualização e revisão do OCR
    resumo.py         Resumo extrativo (porte de src/lib/summarize.js)
    estudante.py      Resumos, anotações, Wikipédia, quiz e exportação
    wikipedia.py      Cliente da API da Wikipédia
    organizacao.py    Álbuns, busca, filtros e seleção de capturas
    estatisticas.py   Números, gráficos e relatório
    lixeira.py        Remover, restaurar e esvaziar
    integracao.py     Formato de troca e mesclagem com o app
    servidor.py       Servidor HTTP de sincronização
  dados/              Biblioteca local e biblioteca de exemplo
  tests/              Testes automatizados (unittest)
  docs/               Documentação da Sprint 4 (PDF)
```

## Testes

```bash
python -m unittest discover -s python/tests -v
```

São 45 testes: paridade do resumo com o JavaScript (as saídas esperadas são geradas pelo próprio `summarize.js`, com `node python/tests/gerar_fixtures_resumo.mjs`), mesclagem, servidor HTTP, persistência, câmera, álbuns, quiz e a API da Wikipédia simulada.
