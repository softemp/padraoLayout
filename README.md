# padraoLayout

Layout de referência da SoftEmp — **frontend puro, dados mocados**. É o modelo
que os projetos novos copiam: as telas do piso, a moldura do painel, o kit de
componentes e o padrão de gráficos, já montados e navegáveis.

## Rodar

```bash
npm install
npm run dev       # http://localhost:5273
```

Outros comandos: `npm run build`, `npm run preview`, `npm run typecheck`.

Login de demonstração: qualquer e-mail válido e **qualquer senha com 6+ caracteres**.

## Rotas

| Rota | O que demonstra |
|---|---|
| `/login` | Piso da tela de acesso: esqueci-senha, manter conectado, link de cadastro |
| `/cadastro` | Formulário RHF + Zod com volta para o login |
| `/recuperar-senha` | Fluxo de recuperação com resposta idêntica para e-mail inexistente |
| `/` | Dashboard: KPIs, gráficos, meta do mês, atividade recente |
| `/clientes` | Listagem server-side (247 registros): busca, filtros, ordenação, paginação |
| `/perfil` | Formulário com abas, preferências de tema, segurança |
| `/componentes` | Inventário do kit: botões, campos, selos, tokens, régua de espaçamento |

## Stack (pacotes aprovados)

| Papel | Pacote |
|---|---|
| Build | `vite` + `@vitejs/plugin-react` + TypeScript |
| Rotas | `react-router-dom` |
| Estado de servidor | `@tanstack/react-query` |
| Estado global de UI | `zustand` |
| Tabela | `@tanstack/react-table` (headless, server-side) |
| Formulário | `react-hook-form` + `zod` + `@hookform/resolvers` |
| Estilo | `tailwindcss` + design tokens em CSS vars |
| Gráficos | `recharts` |
| Ícones | emoji (sem lib de SVG) |

## Estrutura

```
src/
  app/           providers (Query) e navegação
  features/      uma pasta por tela/feature (auth, dashboard, clientes, perfil…)
  shared/
    ui/          o kit: AppShell, Sidebar, Navbar, DataTable, Button, Field…
    charts/      ChartCard + gráficos, tokens de cor de série
    api/         API FALSA (mock) com o contrato canônico de listagem
    hooks/       useTableState (estado na URL), useDebouncedValue…
    lib/         cn, format (pt-BR), ui-prefs (único acesso ao localStorage)
  store/         estado global de UI (tema, sidebar)
  index.css      DESIGN TOKENS — a única fonte de cor do projeto
```

## Decisões que valem a leitura

- **Largura total.** O `<main>` não tem `max-w`. Em tela de operação, margem
  vazia é linha de tabela que não coube.
- **Régua única de espaçamento:** `px-2 sm:px-4 lg:px-6`, e a mesma escala
  2→4→6 em `gap` e `space-y`. `max-w-prose` só para texto corrido.
- **Listagem server-side de verdade.** A API mocada pagina, ordena e busca
  "no banco", com latência simulada — os estados de carregando, vazio e erro
  aparecem como aparecem em produção. Ordem padrão com desempate por id.
- **Estado da listagem na URL** (`?page=&sortBy=&search=`): link compartilhável
  e "voltar" que devolve a mesma página.
- **Cor de gráfico validada.** A ordem das séries é fixa e passou no validador
  de daltonismo nos dois temas; todo gráfico tem alternância **Gráfico ↔ Tabela**,
  que é o caminho de quem lê por leitor de tela e a compensação exigida para as
  matizes de baixo contraste no tema claro.
- **Tema claro/escuro** carimbado antes da primeira pintura (sem flash branco),
  com a preferência guardada em `ui-prefs` — nunca o token.

## Conferido em

360 · 768 · 1440 · 2560 px, nos dois temas. Nada rola de lado: tabela larga rola
dentro da própria caixa.
