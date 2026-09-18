# Sistema Inteligente de Câmera JOVI

Projeto acadêmico da Sprint 4 que reúne a entrega de Front-End Design e Web Development da JOVI em uma aplicação React única. A solução apresenta uma Landing Page institucional responsiva, uma interface de câmera contextual, autenticação demonstrativa, rota privada, persistência local e uma API HTTP própria com dados mockados de capturas acadêmicas.

## Integrantes

Pixel Squad - 1ESPV

- Pedro Henrique Marques - RM 569307
- Evandro Marcondes - RM 572473
- Enzo Alves - RM 569665
- Raphael de Oliveira - RM 571065
- Renan Queiroz - RM 569077

## Tecnologias

- React
- Vite
- Tailwind CSS
- React Router
- JavaScript
- CSS
- Vercel Functions
- localStorage
- Git/GitHub
- Vercel

## Funcionalidades principais

- Landing Page institucional pública e responsiva.
- Interface de câmera contextual preservada do protótipo da JOVI.
- Modos de câmera: Panorâmica, Noite, Documento, Vídeo, Foto, Retrato, Estudante e Pro.
- Modo Estudante com fluxos simulados de resumo, anotação e exportação.
- Galeria local com slideshow.
- Área complementar de capturas acadêmicas consumidas via API.
- Autenticação demonstrativa no front-end.
- Rota privada para a aplicação da câmera.
- Persistência local da sessão demonstrativa e das anotações.
- Notificações visuais da câmera com timeout.

## Rotas

- `/` - pública, exibe a Landing Page institucional.
- `/login` - pública, exibe o login demonstrativo.
- `/camera` - privada, exibe a aplicação da câmera após autenticação demonstrativa.
- `/api/captures` - endpoint HTTP da Vercel Function com capturas acadêmicas mockadas.

## Autenticação demonstrativa

A autenticação deste projeto é acadêmica e acontece somente no front-end. Ela serve para demonstrar o uso de rota privada, estado global com React Context e persistência com `localStorage`.

Regra de validação:

- email contendo `@`;
- senha com no mínimo 6 caracteres.

Exemplo para teste:

```text
demo@jovi.com
jovi123
```

Qualquer entrada que respeite a regra acima é aceita. O projeto não possui autenticação segura server-side, cadastro real, banco de dados, JWT ou controle de permissões em produção.

## Instalação

```bash
npm install
```

## Execução local

```bash
npm run dev
```

O comando acima executa o front-end Vite localmente. Como o projeto usa uma Vercel Function em `api/captures.js`, o endpoint `/api/captures` pertence ao ambiente Vercel. No servidor Vite puro, essa Function não é servida automaticamente.

Para testar a experiência completa com a API HTTP, use a versão publicada na Vercel após o deploy.

## Build

```bash
npm run build
```

## API

Endpoint:

```text
GET /api/captures
```

Finalidade: fornecer dados demonstrativos de capturas acadêmicas para a área "Capturas de estudo" dentro da galeria da câmera.

Formato da resposta:

```json
{
  "items": [
    {
      "id": "capture-board-thermo",
      "title": "Quadro de Termodinâmica",
      "type": "quadro de aula",
      "summary": "Registro demonstrativo de um quadro com conceitos de conservação de energia e ciclos térmicos.",
      "capturedAt": "2026-04-16T14:20:00.000Z",
      "tags": ["aula", "quadro", "resumo"]
    }
  ]
}
```

Os dados são mockados, acadêmicos e não representam usuários reais. A API é somente leitura nesta entrega. Métodos diferentes de `GET` retornam `405 Method Not Allowed`.

## Persistência

O projeto usa `localStorage` para persistências demonstrativas:

- `jovi.auth.session` - sessão acadêmica do login demonstrativo.
- `jovi.student.annotation` - anotação salva no Modo Estudante.

## Responsividade

A Landing Page foi construída com Tailwind CSS e possui adaptação para mobile, tablet e desktop. A interface da câmera preserva o mockup de smartphone em `390 x 800`, por decisão de protótipo visual.

## Uso de IA

Ferramentas de Inteligência Artificial foram utilizadas como apoio durante análise, organização e evolução do projeto, incluindo revisão técnica, planejamento de slices, auxílio na migração de interface e suporte à documentação. As alterações foram revisadas e validadas antes de integrarem a entrega.

## Deploy

GitHub:

```text
https://github.com/Pixel-Squad-FIAP/APPCameraJovi
```

Vercel:

```text
https://app-camera-jovi.vercel.app
```
