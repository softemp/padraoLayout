# padraoLayout — modelo de layout SoftEmp

Projeto **só frontend**, com dados mocados. Existe para uma coisa: ser o layout
de referência que todo projeto novo copia como ponto de partida.

## Cofre de Neurônios (consulta obrigatória)
O conhecimento desta stack vive em `~/Documentos/projetos/IA/brainSoftEmp`.

- Antes de criar ou refatorar tela: leia `10_Neurons/Base_UI_Kit_Padrao_Projeto.md`
  e aplique o checklist de aceite (é gate, não sugestão).
- Antes de tocar um arquivo: procure-o em `30_Atlas/Indice_Simbolos.md`.
- Ao aprender algo novo: registre o neurônio e indexe num MOC — o que não vira
  neurônio se perde.

## O que este projeto fixa
- **Pacotes aprovados**: React + Vite + TS, TanStack Query, TanStack Table v8,
  React Hook Form + Zod, Zustand (só UI), Tailwind com tokens em CSS vars,
  Recharts, ícones em emoji.
- **Piso de UI**: login com esqueci-senha / manter-conectado / link de cadastro;
  cadastro com volta para o login; AppShell com sidebar em níveis, navbar com
  tema, sino de notificação e dropdown do usuário; `<main>` largura total na
  régua `px-2 sm:px-4 lg:px-6`; toda listagem paginada e ordenada no servidor.
- **Cor só por token** (`src/index.css`). Nenhum hex em componente ou tela.
- **`localStorage` só via `src/shared/lib/ui-prefs.ts`** — token nunca.

## Regras de trabalho aqui
- PT-BR nos nomes de domínio e nos textos; código e libs em inglês.
- Componente do kit mora em `src/shared/ui`; gráfico em `src/shared/charts`;
  tela em `src/features/<feature>`.
- Não escreva tabela nova: use `DataTable` com `useTableState`.
- Gráfico novo passa pelas regras de dataviz: uma cor por entidade (ordem fixa),
  um eixo só, legenda quando há 2+ séries, `isAnimationActive={false}`,
  e sempre com a alternância gráfico↔tabela do `ChartCard`.
- `npm run typecheck && npm run build` verdes antes de considerar pronto.
