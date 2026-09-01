import { useState } from 'react'
import { faturas, recebimentos } from '@/shared/api/operacao'
import { clientes } from '@/shared/api/mock-db'
import { BotaoExportar } from '@/shared/ui/BotaoExportar'
import { Badge } from '@/shared/ui/Badge'
import { Card, CardBody, CardHeader } from '@/shared/ui/Card'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Select } from '@/shared/ui/Field'
import { cn } from '@/shared/lib/cn'
import { date, money, number } from '@/shared/lib/format'
import type { ColunaExport } from '@/shared/export/tipos'

/**
 * Catálogo de relatórios: escolher → conferir a prévia → exportar.
 *
 * A prévia existe porque relatório exportado às cegas é PDF de 40 páginas
 * descoberto errado depois de impresso. Ela mostra as primeiras linhas com as
 * MESMAS colunas do arquivo — se está torto aqui, sai torto lá.
 */
type Relatorio = {
  id: string
  nome: string
  descricao: string
  icone: string
  categoria: 'Financeiro' | 'Comercial' | 'Operacional'
  colunas: ColunaExport<never>[]
  linhas: () => unknown[]
}

const RELATORIOS: Relatorio[] = [
  {
    id: 'faturamento',
    nome: 'Faturamento por período',
    descricao: 'Todas as faturas emitidas, com status e meio de pagamento',
    icone: '🧾',
    categoria: 'Financeiro',
    colunas: [
      { chave: 'numero', cabecalho: 'Fatura', peso: 1.1, valor: (f: any) => f.numero },
      { chave: 'cliente', cabecalho: 'Cliente', peso: 2.2, valor: (f: any) => f.cliente },
      { chave: 'vencimento', cabecalho: 'Vencimento', peso: 1.1, alinhamento: 'direita', valor: (f: any) => date(f.vencimento), valorCsv: (f: any) => f.vencimento.slice(0, 10) },
      { chave: 'status', cabecalho: 'Status', peso: 1, valor: (f: any) => f.status },
      { chave: 'valor', cabecalho: 'Valor', peso: 1.1, alinhamento: 'direita', valor: (f: any) => money(f.valor), valorCsv: (f: any) => f.valor },
    ] as ColunaExport<never>[],
    linhas: () => faturas,
  },
  {
    id: 'recebimentos',
    nome: 'Recebimentos por meio',
    descricao: 'Entradas confirmadas, com conta de destino',
    icone: '💰',
    categoria: 'Financeiro',
    colunas: [
      { chave: 'data', cabecalho: 'Data', peso: 1, valor: (r: any) => date(r.data), valorCsv: (r: any) => r.data.slice(0, 10) },
      { chave: 'cliente', cabecalho: 'Cliente', peso: 2.2, valor: (r: any) => r.cliente },
      { chave: 'meio', cabecalho: 'Meio', peso: 1, valor: (r: any) => r.meio },
      { chave: 'conta', cabecalho: 'Conta', peso: 1.5, valor: (r: any) => r.conta },
      { chave: 'valor', cabecalho: 'Valor', peso: 1.1, alinhamento: 'direita', valor: (r: any) => money(r.valor), valorCsv: (r: any) => r.valor },
    ] as ColunaExport<never>[],
    linhas: () => recebimentos,
  },
  {
    id: 'carteira',
    nome: 'Carteira de clientes',
    descricao: 'Base ativa com plano, status e receita recorrente',
    icone: '📇',
    categoria: 'Comercial',
    colunas: [
      { chave: 'nome', cabecalho: 'Cliente', peso: 2.2, valor: (c: any) => c.nome },
      { chave: 'plano', cabecalho: 'Plano', peso: 1, valor: (c: any) => c.plano },
      { chave: 'status', cabecalho: 'Status', peso: 1, valor: (c: any) => c.status },
      { chave: 'mrr', cabecalho: 'MRR', peso: 1.1, alinhamento: 'direita', valor: (c: any) => money(c.mrr), valorCsv: (c: any) => c.mrr },
      { chave: 'criadoEm', cabecalho: 'Cliente desde', peso: 1.2, alinhamento: 'direita', valor: (c: any) => date(c.criadoEm), valorCsv: (c: any) => c.criadoEm.slice(0, 10) },
    ] as ColunaExport<never>[],
    linhas: () => clientes.filter((c) => c.excluidoEm === null),
  },
  {
    id: 'inadimplencia',
    nome: 'Inadimplência',
    descricao: 'Faturas vencidas e não pagas, da mais antiga para a mais nova',
    icone: '🚩',
    categoria: 'Financeiro',
    colunas: [
      { chave: 'numero', cabecalho: 'Fatura', peso: 1.1, valor: (f: any) => f.numero },
      { chave: 'cliente', cabecalho: 'Cliente', peso: 2.2, valor: (f: any) => f.cliente },
      { chave: 'vencimento', cabecalho: 'Venceu em', peso: 1.2, alinhamento: 'direita', valor: (f: any) => date(f.vencimento), valorCsv: (f: any) => f.vencimento.slice(0, 10) },
      { chave: 'valor', cabecalho: 'Valor', peso: 1.1, alinhamento: 'direita', valor: (f: any) => money(f.valor), valorCsv: (f: any) => f.valor },
    ] as ColunaExport<never>[],
    linhas: () => faturas.filter((f) => f.status === 'vencida').sort((a, b) => +new Date(a.vencimento) - +new Date(b.vencimento)),
  },
  {
    id: 'produtividade',
    nome: 'Produtividade da equipe',
    descricao: 'Atendimentos e baixas por operador no período',
    icone: '⚡',
    categoria: 'Operacional',
    colunas: [
      { chave: 'operador', cabecalho: 'Operador', peso: 2, valor: (l: any) => l.operador },
      { chave: 'atendimentos', cabecalho: 'Atendimentos', peso: 1.2, alinhamento: 'direita', valor: (l: any) => number(l.atendimentos), valorCsv: (l: any) => l.atendimentos },
      { chave: 'baixas', cabecalho: 'Baixas', peso: 1, alinhamento: 'direita', valor: (l: any) => number(l.baixas), valorCsv: (l: any) => l.baixas },
    ] as ColunaExport<never>[],
    linhas: () => [
      { operador: 'Camila Bonfim', atendimentos: 184, baixas: 96 },
      { operador: 'Rafael Quintana', atendimentos: 152, baixas: 88 },
      { operador: 'Ana Beatriz', atendimentos: 143, baixas: 61 },
      { operador: 'Diego Ferrari', atendimentos: 97, baixas: 34 },
    ],
  },
]

const PERIODOS = ['Últimos 30 dias', 'Mês corrente', 'Mês anterior', 'Ano corrente'] as const

export function RelatoriosPage() {
  const [escolhido, setEscolhido] = useState<Relatorio>(RELATORIOS[0])
  const [periodo, setPeriodo] = useState<(typeof PERIODOS)[number]>('Últimos 30 dias')

  const linhas = escolhido.linhas()
  const previa = linhas.slice(0, 8)

  return (
    <div className="space-y-2 sm:space-y-4 lg:space-y-6">
      <PageHeader titulo="Relatórios" descricao="Escolha o relatório, confira a prévia e exporte no formato que precisa." />

      <div className="grid grid-cols-1 lg:grid-cols-[19rem_1fr] gap-2 sm:gap-4 lg:gap-6">
        <div className="space-y-2">
          {RELATORIOS.map((relatorio) => {
            const ativo = escolhido.id === relatorio.id
            return (
              <button
                key={relatorio.id}
                type="button"
                onClick={() => setEscolhido(relatorio)}
                aria-pressed={ativo}
                className={cn(
                  'flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-colors',
                  ativo ? 'border-primary bg-primary/[0.06]' : 'border-border bg-surface hover:bg-surface-2',
                )}
              >
                <span aria-hidden className="text-lg leading-none">{relatorio.icone}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-text">{relatorio.nome}</span>
                  <span className="mt-0.5 block text-[12px] text-text-muted">{relatorio.descricao}</span>
                  <span className="mt-1.5 block"><Badge tom="neutro">{relatorio.categoria}</Badge></span>
                </span>
              </button>
            )
          })}
        </div>

        <Card className="flex flex-col">
          <CardHeader
            titulo={escolhido.nome}
            descricao={`${number(linhas.length)} registros · ${periodo}`}
            acoes={
              <>
                <Select aria-label="Período" value={periodo} onChange={(e) => setPeriodo(e.target.value as typeof periodo)} className="w-44">
                  {PERIODOS.map((p) => <option key={p} value={p}>{p}</option>)}
                </Select>
                <BotaoExportar
                  nomeArquivo={escolhido.id}
                  titulo={escolhido.nome}
                  subtitulo={periodo}
                  orientacao="paisagem"
                  rodape="Relatório gerado pelo painel SoftEmp"
                  colunas={escolhido.colunas as never}
                  buscarLinhas={() => linhas as never[]}
                />
              </>
            }
          />

          <CardBody className="flex-1">
            <p className="mb-2 text-[12px] text-text-muted">
              Prévia das primeiras {previa.length} linhas — mesmas colunas do arquivo exportado.
            </p>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[38rem] text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-2/60 text-[12px] uppercase tracking-wide text-text-muted">
                    {escolhido.colunas.map((coluna) => (
                      <th key={coluna.chave} className={cn('px-3 py-2.5 font-semibold', coluna.alinhamento === 'direita' ? 'text-right' : 'text-left')}>
                        {coluna.cabecalho}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previa.map((linha, i) => (
                    <tr key={i} className="border-b border-border/60 last:border-0">
                      {escolhido.colunas.map((coluna) => (
                        <td
                          key={coluna.chave}
                          className={cn(
                            'px-3 py-2 text-text-secondary',
                            coluna.alinhamento === 'direita' ? 'text-right tabular-nums' : 'text-left',
                          )}
                        >
                          {coluna.valor(linha as never)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
