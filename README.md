# JOVI Camera

## Projeto

JOVI Camera é um protótipo web de interface de câmera de smartphone, com modos de captura, galeria, scanner de documento e um Modo Estudante com fluxos simulados de resumo, anotação e exportação.

## Objetivo

Esta entrega da Sprint 3 migra o protótipo original em HTML, CSS e JavaScript Vanilla para React, preservando a identidade visual, os assets, os fluxos e os comportamentos já existentes.

## Tecnologias

- React
- Vite
- JavaScript
- CSS
- localStorage

## Estrutura

- `src/App.jsx`: componente pai da aplicação, concentra o estado compartilhado de modo, timer, ratio, notificações, galeria, overlays e settings.
- `src/components/TopBar.jsx`: flash, timer, modo ativo, ratio e botão de modos/configurações.
- `src/components/Viewfinder.jsx`: viewfinder, foco, brilho, zoom, shutter, vídeo, documento, panorâmica e ações do Modo Estudante.
- `src/components/ModeCarousel.jsx`: carrossel infinito de modos com clique, arraste, snap e cálculos de posição.
- `src/components/Gallery.jsx`: galeria e slideshow declarativos.
- `src/components/StudentMode.jsx`: resumo simulado, anotação persistida, exportação simulada e fluxo de documento acoplado ao protótipo.
- `src/components/SettingsOverlay.jsx`: área do usuário com login simulado e recuperação por prompt.
- `assets/`: imagens usadas pela galeria e prévia de documento.
- `css/`: CSS reaproveitado do protótipo Vanilla.
- `vanilla.html`: versão Vanilla preservada para referência.

## Instalação

```bash
npm install
```

## Execução

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Funcionalidades

- Modos de câmera: Panorâmica, Noite, Documento, Vídeo, Foto, Retrato, Estudante e Pro.
- Carrossel infinito de modos com clique, arraste e snap.
- TopBar com flash, timer, ratio e menu de modos.
- Shutter para foto, timer de captura e gravação de vídeo simulada.
- Zoom, brilho e foco no viewfinder.
- Galeria com slideshow, setas e dots.
- Modo Estudante com resumo simulado, anotação, exportação simulada e envio simulado ao Google Docs.
- Scanner/documento com enquadramento e exportação simulada.
- Configurações/login simulado com validação local, `alert` e `prompt`.
- Toasts/notificações visuais.

## localStorage

A anotação do Modo Estudante é persistida em `localStorage` com a chave `jovi.student.annotation`.

O formato salvo é JSON:

```json
{"text":"texto da anotação"}
```

O valor é carregado quando o componente `StudentMode` inicializa. Ele é salvo somente quando o usuário edita a anotação e clica em `Salvar alterações`. Para demonstrar a persistência: abra o Modo Estudante, entre em `Anotar`, escreva uma anotação, clique em `Salvar alterações`, recarregue a página, retorne a `Anotar` e confirme que o texto continua no campo.

## Math

- `src/components/ModeCarousel.jsx`: `Math.abs` calcula distância do item ao centro do carrossel, limiar de drag e parada do snap.
- `src/components/Viewfinder.jsx`: `Math.floor` converte segundos em minutos no timer de gravação.
- `src/components/Viewfinder.jsx`: `Math.max` e `Math.min` limitam o percentual de brilho entre `0` e `1`.

Esses usos preservam os cálculos reais existentes na versão Vanilla.

## Uso de Inteligência Artificial

Durante a Sprint 3, ferramentas de Inteligência Artificial foram utilizadas como apoio em etapas específicas do desenvolvimento, principalmente na revisão de trechos de código, identificação de inconsistências durante a migração do protótipo para React, análise da organização dos componentes e suporte na revisão da documentação. As sugestões geradas foram utilizadas como referência técnica e passaram por análise e validação antes de serem aplicadas ao projeto.

## Deploy

- GitHub: `https://github.com/Pixel-Squad-FIAP/APPCameraJovi`
- Vercel: `https://app-camera-jovi.vercel.app`

## Equipe

Consulte `INTEGRANTES.TXT`.
