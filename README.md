# Sistema Inteligente de Câmera JOVI

Projeto acadêmico do Challenge JOVI 2026 (FIAP) — entrega conjunta da Sprint 4 de **Front-End Design** e **Web Development**.

A aplicação React reúne a Landing Page institucional e uma **câmera real no navegador** pensada para estudantes full-time: ela reconhece a cena e sugere o modo adequado, digitaliza documentos, **extrai o texto da imagem (OCR)**, gera **resumos**, guarda **anotações** e organiza as capturas por **matéria**, com exportação em PDF/TXT.

## Integrantes

Pixel Squad - 1ESPV

- Pedro Henrique Marques - RM 569307
- Evandro Marcondes - RM 572473
- Raphael de Oliveira - RM 571065
- Renan Queiroz - RM 569077

## Links

- Repositório: https://github.com/Pixel-Squad-FIAP/APPCameraJovi
- Deploy (Vercel): https://app-camera-jovi.vercel.app

## Tecnologias

- **React 19** (componentes funcionais, props, Context API, hooks nativos e customizados)
- **React Router 7** (rotas públicas e privadas, rotas aninhadas, parâmetros e query string)
- **Tailwind CSS 4** (toda a estilização, inclusive a câmera)
- **Vite 7** (build e servidor de desenvolvimento)
- **Tesseract.js** (OCR em português executado no navegador)
- **jsPDF** (geração de PDF no navegador)
- **idb / IndexedDB** (armazenamento local de fotos, vídeos e textos)
- **localStorage** (sessão de demonstração e preferências)
- **Web APIs**: MediaDevices/getUserMedia (câmera), MediaRecorder (vídeo), Canvas (processamento de imagem), Clipboard, Web Share
- **API pública da Wikipédia** (REST, em português) para explicar os termos do resumo
- **Vitest** (testes das funções de processamento)

## Como instalar

Pré-requisito: Node.js 20 ou superior.

```bash
npm install
```

## Como executar

```bash
npm run dev
```

Acesse `http://127.0.0.1:5173`. O projeto não tem back-end próprio: não há outro servidor para iniciar. A única API consumida é a pública da Wikipédia, acessada direto do navegador (precisa de internet).

Outros comandos:

```bash
npm run build     # build de produção em dist/
npm run preview   # serve o build localmente
npm test          # testes unitários (resumo, OCR, análise de cena, recortes)
```

### Câmera e permissões

- O navegador só libera a câmera em **HTTPS** ou em **localhost** — localmente funciona em `127.0.0.1`; no celular, use o link da Vercel.
- Na primeira vez, permita o acesso à câmera. O microfone só é pedido ao gravar vídeo (se negado, o vídeo é salvo sem áudio).
- Sem câmera ou com a permissão negada, use **Importar imagem** (na própria tela ou em Ajustes) para testar OCR, resumo e o restante do fluxo.
- O OCR baixa o motor e o modelo de português (alguns MB) da CDN do Tesseract na **primeira** execução; depois fica em cache no navegador.

## Usuário para teste

A autenticação é **demonstrativa** (somente front-end), usada para proteger as rotas privadas.

Na tela de login, o botão **Acessar a câmera** entra direto, sem preencher nada. Para usar o formulário:

```text
E-mail: demo@jovi.com
Senha:  jovi123
```

Qualquer e-mail com `@` e senha com 6 ou mais caracteres é aceito. Não há cadastro real, banco de dados ou autenticação server-side.

## Rotas

| Rota | Tipo | Conteúdo |
| --- | --- | --- |
| `/` | pública | Landing Page (A Solução, Público-Alvo, Galeria, Nossa Equipe, Contato) |
| `/login` | pública | Login demonstrativo |
| `/camera` | privada | Câmera |
| `/galeria` | privada | Galeria com busca e filtros (`?album=` e `?tipo=`) |
| `/galeria/:id` | privada | Detalhe da captura: texto, resumo, notas, organização e exportação |

## Funcionalidades

### Câmera (`/camera`)

- Câmera real (frontal/traseira) com tela cheia no celular e moldura de smartphone no tablet/desktop.
- **Modos funcionais**:
  - **Documento**: recorta pela moldura A4, deixa o papel branco e extrai o texto. A moldura fica verde quando a folha está enquadrada.
  - **Estudante**: moldura de slide/quadro e álbum de destino (matéria). Permite fotografar vários slides seguidos, com o OCR rodando em segundo plano.
  - **Foto**: modo automático.
  - **Retrato**: centro nítido e fundo desfocado (efeito simulado por software).
  - **Noite**: média de 4 quadros para reduzir ruído e clarear a imagem.
  - **Vídeo**: grava já recortado na proporção escolhida (3:4, 9:16 ou 1:1), com zoom ao vivo e áudio quando o microfone é permitido.
- **Sugestão contextual**: a análise de luminância e de "papel com texto" sugere Noite ou Documento. O usuário aceita ou ignora, e a câmera nunca troca de modo sozinha.
- Timer (3 s/10 s, cancelável), flash (lanterna quando o aparelho suporta, senão flash de tela), grade, proporção 3:4/9:16/1:1, foco por toque com ajuste de exposição.
- **Zoom contínuo de 1x a 5x**, com animação suave: atalhos 1x/2x/5x, arrastar o visor para cima (aproxima) ou para baixo (afasta), pinça com dois dedos e roda do mouse. Uma régua mostra o valor durante o ajuste. Em celulares Android compatíveis usa o zoom do próprio sensor (mais nítido); nos demais, zoom digital.
- Gestos e atalhos: deslizar para os lados no visor troca de modo; no computador, `Espaço` captura, `←`/`→` trocam o modo e `+`/`-` ajustam o zoom.
- Tutorial no primeiro uso, ajuda com a explicação de cada modo e da privacidade, ajustes (sugestões, grade, espelhamento, armazenamento usado).

### Galeria e detalhe (`/galeria`)

- Busca no título, no texto extraído e nas anotações; filtros por tipo e por álbum (matéria).
- **Texto (OCR)**: progresso por etapa, cancelar, tentar de novo, edição com salvamento automático, aviso de baixa confiança, digitação manual.
- **Resumo** extrativo (curto/médio), que avisa quando o texto mudou depois do resumo. Os **termos principais** que aparecem no resumo podem ser tocados para ver a explicação da Wikipédia.
- **Notas** por captura e **Organizar** (título, álbum, criação de álbum, metadados).
- **Exportar**: PDF (imagem + resumo + texto + notas), TXT, arquivo original, copiar, abrir no Google Docs (copia e abre um documento novo) e compartilhamento nativo do aparelho.
- Excluir com confirmação e opção **Desfazer**.

## API

O app consome a **API pública da Wikipédia em português** (sem chave de acesso):

```text
GET https://pt.wikipedia.org/api/rest_v1/page/summary/{termo}
```

Na aba **Resumo** de uma captura, cada termo principal (sempre uma palavra que aparece nas frases do resumo) abre a explicação do artigo correspondente, com descrição, imagem e link para o artigo completo. O app trata carregamento, termo sem artigo (404 ou página de desambiguação) e falha de conexão com opção de tentar novamente. As respostas ficam em cache durante a sessão. Código: `src/services/wikipediaApi.js` e `src/hooks/useTermDefinition.js`.

## Persistência

- **IndexedDB** (`jovi-camera`): fotos, vídeos, miniaturas, texto extraído, resumo e anotações.
- **localStorage**: `jovi.auth.session` (sessão demonstrativa) e `jovi.preferences` (último modo, câmera, proporção, timer, grade, sugestões, álbuns, tutorial visto).

Tudo fica apenas no navegador do usuário. Nenhuma imagem ou texto é enviado para servidores; à Wikipédia só vai o termo consultado.

## Estrutura

```text
src/
  pages/             Landing, Login, Câmera, Galeria, Detalhe
  components/
    camera/          TopBar, Viewfinder, ModeSelector, ShutterBar, sheets da câmera
    capture/         Painéis do detalhe (Texto, Resumo, Notas, Organizar, Exportar)
    library/         Cards e seletor de álbum
    landing/         Seções da Landing Page
    ui/              Botões, Sheet, Toast, Chip, feedback
  hooks/             Hooks customizados (câmera, cena, OCR, gravação, exportação, autosave…)
  lib/               Lógica pura: processamento de imagem, OCR, resumo, análise de cena
  services/          IndexedDB, preferências (localStorage), cliente da API da Wikipédia
  library/ feedback/ auth/   Contextos (capturas, toasts, sessão)
  data/modes.js      Configuração de cada modo da câmera
```

## Limitações conhecidas

- É uma aplicação web: não controla o hardware nativo de um smartphone JOVI (HDR, lentes, ISO etc.).
- O efeito Retrato é simulado (desfoque radial), sem detecção de pessoas.
- A sugestão de modo usa heurísticas de imagem, não um modelo de IA treinado.
- O resumo é extrativo: seleciona frases do próprio texto, sem gerar texto novo.
- A precisão do OCR depende da luz, do foco e do enquadramento.

## Uso de IA

Usamos ferramentas de Inteligência Artificial (assistente de código) como apoio durante o desenvolvimento: na análise do código existente e dos requisitos das Sprints 3 e 4, no planejamento da reestruturação da câmera, na escrita e revisão de componentes, hooks e funções de processamento (OCR, resumo, análise de cena), em testes automatizados e de navegador e na redação desta documentação. A equipe revisou, testou e validou todas as alterações antes de integrá-las à entrega.
