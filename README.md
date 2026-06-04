# JusConsulta TJSP

Consulta processual ampliada para o Tribunal de Justiça de São Paulo.

## Funcionalidades

- Busca por **nome da parte**, **CPF/CNPJ** ou **número do processo**
- Consulta em **1º Grau**, **2º Grau** e **Colégio Recursal** simultaneamente
- Modo **busca rápida** (2 sistemas) e **busca completa** (3 sistemas + paginação)
- Exibição detalhada de partes, movimentações, petições e incidentes
- Fallback para links oficiais do e-SAJ quando proxy estiver indisponível
- Cache em memória para evitar requisições duplicadas

## Tech Stack

- React 19 + TypeScript
- Vite 7
- Tailwind CSS v4
- CORS proxies públicos para contornar restrições de navegador

## Instalação

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Observações

Esta é uma consulta **não-oficial** baseada nas páginas públicas do e-SAJ TJSP.
Os resultados dependem da disponibilidade dos proxies CORS e da estrutura HTML pública do tribunal.

## Fonte dos dados

- [e-SAJ TJSP — 1º Grau](https://esaj.tjsp.jus.br/cpopg/open.do)
- [e-SAJ TJSP — 2º Grau](https://esaj.tjsp.jus.br/cposg/open.do)
- [e-SAJ TJSP — Colégio Recursal](https://esaj.tjsp.jus.br/cposgcr/open.do)
