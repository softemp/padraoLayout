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
          { rotulo: 'Faturas', icone: '🧾', rota: '/em-construcao?t=Faturas' },
          { rotulo: 'Recebimentos', icone: '💰', rota: '/em-construcao?t=Recebimentos' },
          { rotulo: 'Conciliação', icone: '⚖️', rota: '/em-construcao?t=Conciliação' },
        ],
      },
      { rotulo: 'Relatórios', icone: '📈', rota: '/em-construcao?t=Relatórios' },
    ],
  },
  {
    titulo: 'Sistema',
    itens: [
      { rotulo: 'Componentes', icone: '🧩', rota: '/componentes' },
      {
        rotulo: 'Configurações',
        icone: '⚙️',
        filhos: [
          { rotulo: 'Perfil', icone: '👤', rota: '/perfil' },
          { rotulo: 'Comunicação', icone: '📡', rota: '/configuracoes/comunicacao' },
          { rotulo: 'Usuários e acessos', icone: '🔐', rota: '/em-construcao?t=Usuários e acessos' },
          { rotulo: 'Integrações', icone: '🔌', rota: '/em-construcao?t=Integrações' },
        ],
      },
    ],
  },
]
