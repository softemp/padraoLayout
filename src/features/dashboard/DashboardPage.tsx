import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/shared/ui/Button'
import { Card, CardBody, CardHeader } from '@/shared/ui/Card'
import { PageHeader } from '@/shared/ui/PageHeader'
import { StatTile } from '@/shared/ui/StatTile'
import { Meter } from '@/shared/ui/Meter'
import { Badge } from '@/shared/ui/Badge'
import { Avatar } from '@/shared/ui/Avatar'
import { CanaisBarras } from '@/shared/charts/CanaisBarras'
import { CategoriasBarras } from '@/shared/charts/CategoriasBarras'
import { ReceitaArea } from '@/shared/charts/ReceitaArea'
import { TopClientesCard } from './TopClientesCard'
import { BotaoExportar } from '@/shared/ui/BotaoExportar'
import { atividades, kpis, metaMes, serieReceita } from '@/shared/api/mock-db'
import { money, timeAgo } from '@/shared/lib/format'
import { cn } from '@/shared/lib/cn'

const PERIODOS = ['7 dias', '30 dias', '12 meses'] as const

const tomPorTipo = { info: 'info', sucesso: 'good', alerta: 'warning', critico: 'critical' } as const

export function DashboardPage() {
  const [periodo, setPeriodo] = useState<(typeof PERIODOS)[number]>('12 meses')

  return (
    <div className="space-y-4 sm:space-y-5 lg:space-y-6">
      <PageHeader
        titulo="Visão geral"
        descricao="Como o negócio fechou o mês e o que exige atenção agora."
        acoes={
          <>
            {/* Filtros do painel: uma linha só, acima dos gráficos. */}
            <div role="group" aria-label="Período" className="flex rounded-lg border border-border bg-surface p-0.5">
              {PERIODOS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriodo(p)}
                  aria-pressed={periodo === p}
                  className={cn(
                    'rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors',
                    periodo === p ? 'bg-surface-3 text-text' : 'text-text-muted hover:text-text',
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
            {/* Aqui a impressão está DESLIGADA: painel de acompanhamento não
                é documento de papel. É só virar a prop. */}
            <BotaoExportar
              formatos={{ csv: true, pdf: true, imprimir: false }}
              nomeArquivo="receita-mensal"
              titulo="Receita mensal"
              subtitulo={`Período: ${periodo}`}
              rodape="Painel SoftEmp · valores em reais"
              colunas={[
                { chave: 'mes', cabecalho: 'Mês', peso: 1, valor: (l) => l.mes },
                { chave: 'receita', cabecalho: 'Receita', peso: 1.4, alinhamento: 'direita', valor: (l) => money(l.receita), valorCsv: (l) => l.receita },
                { chave: 'meta', cabecalho: 'Meta', peso: 1.4, alinhamento: 'direita', valor: (l) => money(l.meta), valorCsv: (l) => l.meta },
                { chave: 'atingimento', cabecalho: 'Atingimento', peso: 1.2, alinhamento: 'direita', valor: (l) => `${Math.round((l.receita / l.meta) * 100)}%`, valorCsv: (l) => Math.round((l.receita / l.meta) * 100) },
              ]}
              buscarLinhas={() => serieReceita}
            />
          </>
        }
      />

      {/* KPIs: número em destaque é stat tile, não gráfico de uma barra. */}
      <section aria-label="Indicadores" className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <StatTile key={kpi.id} kpi={kpi} />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-3 lg:gap-5">
        <ReceitaArea />
        <Card className="flex flex-col">
          <CardHeader titulo="Meta do mês" descricao="Agosto de 2026" />
          <CardBody className="flex flex-1 flex-col gap-5">
            <Meter rotulo="Receita realizada" valor={metaMes.atingido} total={metaMes.meta} formatar={money} />
            <Meter rotulo="Novos clientes" valor={168} total={200} formatar={(n) => `${n}`} />
            <Meter rotulo="Renovações" valor={412} total={520} formatar={(n) => `${n}`} />

            <div className="mt-auto space-y-2.5 rounded-lg bg-surface-2 p-3.5">
              <p className="text-[13px] font-semibold text-text">Precisa de decisão</p>
              <ul className="space-y-2 text-[13px] text-text-secondary">
                <li className="flex items-start gap-2">
                  <Badge tom="critical">12</Badge>
                  <span>clientes inadimplentes há mais de 30 dias</span>
                </li>
                <li className="flex items-start gap-2">
                  <Badge tom="warning">7</Badge>
                  <span>contratos vencem nos próximos 15 dias</span>
                </li>
              </ul>
              <Button variant="secondary" size="sm" block className="mt-1">
                Abrir fila de cobrança
              </Button>
            </div>
          </CardBody>
        </Card>

        <TopClientesCard />
      </section>

      <section className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2 lg:gap-5">
        <CanaisBarras />
        <CategoriasBarras />
      </section>

      <section className="grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-3 lg:gap-5">
        <Card className="xl:col-span-2">
          <CardHeader
            titulo="Atividade recente"
            descricao="O que aconteceu no sistema nas últimas 48 horas"
            acoes={<Link to="/em-construcao?t=Auditoria" className="text-[13px] font-medium text-primary hover:underline">Ver auditoria</Link>}
          />
          <ul className="divide-y divide-border">
            {atividades.map((a) => (
              <li key={a.id} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-2 sm:px-5">
                <Avatar nome={a.autor} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-text-secondary">
                    <span className="font-semibold text-text">{a.autor}</span> {a.acao}{' '}
                    <span className="font-medium text-text">{a.alvo}</span>
                  </p>
                  <p className="mt-0.5 text-[12px] text-text-muted">{timeAgo(a.criadoEm)}</p>
                </div>
                <Badge tom={tomPorTipo[a.tipo]}>
                  {a.tipo === 'sucesso' ? 'concluído' : a.tipo === 'alerta' ? 'atenção' : a.tipo === 'critico' ? 'falha' : 'registro'}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader titulo="Atalhos" descricao="As ações que este painel mais executa" />
          <CardBody className="grid grid-cols-2 gap-2.5">
            {[
              { icone: '➕', rotulo: 'Novo cliente', rota: '/em-construcao?t=Novo cliente' },
              { icone: '🧾', rotulo: 'Emitir fatura', rota: '/em-construcao?t=Emitir fatura' },
              { icone: '📇', rotulo: 'Clientes', rota: '/clientes' },
              { icone: '🧩', rotulo: 'Componentes', rota: '/componentes' },
              { icone: '📈', rotulo: 'Relatórios', rota: '/em-construcao?t=Relatórios' },
              { icone: '🔐', rotulo: 'Acessos', rota: '/em-construcao?t=Acessos' },
            ].map((a) => (
              <Link
                key={a.rotulo}
                to={a.rota}
                className="flex flex-col items-start gap-2 rounded-lg border border-border p-3 text-[13px] font-medium text-text-secondary transition-colors hover:border-border-strong hover:bg-surface-2 hover:text-text"
              >
                <span aria-hidden className="text-lg">{a.icone}</span>
                {a.rotulo}
              </Link>
            ))}
          </CardBody>
        </Card>
      </section>
    </div>
  )
}
