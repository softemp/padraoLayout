/** Navegação em NÍVEIS: cada item é FOLHA (rota) ou PAI (com filhos). */
export type NavFolha = { rotulo: string; icone: string; rota: string; badge?: string }
export type NavPai = { rotulo: string; icone: string; filhos: NavFolha[] }
export type NavItem = NavFolha | NavPai

export const ehPai = (item: NavItem): item is NavPai => 'filhos' in item

export type NavSecao = { titulo: string; itens: NavItem[] }

export const navegacao: NavSecao[] = [
  {
    titulo: 'Operação',
    itens: [
      { rotulo: 'Dashboard', icone: '📊', rota: '/' },
      {
        rotulo: 'Clientes',
        icone: '👥',
        filhos: [
          { rotulo: 'Todos os clientes', icone: '📇', rota: '/clientes' },
          { rotulo: 'Inadimplentes', icone: '🚩', rota: '/clientes?status=inadimplente', badge: '12' },
          { rotulo: 'Novos no mês', icone: '✨', rota: '/clientes?sortBy=criadoEm&sortDir=desc' },
        ],
      },
      {
        rotulo: 'Financeiro',
        icone: '💳',
        filhos: [
          { rotulo: 'Contas a pagar e receber', icone: '📒', rota: '/financeiro/contas' },
          { rotulo: 'Faturas', icone: '🧾', rota: '/financeiro/faturas' },
          { rotulo: 'Recebimentos', icone: '💰', rota: '/financeiro/recebimentos' },
          { rotulo: 'Conciliação', icone: '⚖️', rota: '/financeiro/conciliacao' },
        ],
      },
      { rotulo: 'Relatórios', icone: '📈', rota: '/relatorios' },
      { rotulo: 'Auditoria', icone: '🕘', rota: '/auditoria' },
    ],
  },
  {
    titulo: 'Sistema',
    itens: [
      { rotulo: 'Componentes', icone: '🧩', rota: '/componentes' },
      {
        rotulo: 'Configurações',
        icone: '⚙️',
        // Perfil NÃO entra aqui: o lugar dele é o dropdown do usuário, na navbar.
        // Duas portas para a mesma tela é como o menu incha.
        filhos: [
          { rotulo: 'Comunicação', icone: '📡', rota: '/configuracoes/comunicacao' },
          { rotulo: 'Usuários e acessos', icone: '🔐', rota: '/configuracoes/acessos' },
          { rotulo: 'Integrações', icone: '🔌', rota: '/configuracoes/integracoes' },
        ],
      },
    ],
  },
]
