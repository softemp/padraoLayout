import type { ColumnDef } from '@tanstack/react-table'
import { Avatar } from '@/shared/ui/Avatar'
import { Badge } from '@/shared/ui/Badge'
import { date, money } from '@/shared/lib/format'
import type { Cliente, ClienteStatus, EscopoRegistro } from '@/shared/api/types'

/** Máscara é APRESENTAÇÃO: o "banco" guarda só dígitos. */
export const mascaraCpf = (digitos: string) =>
  digitos.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')

const statusTom: Record<ClienteStatus, { tom: 'good' | 'warning' | 'critical' | 'neutro'; rotulo: string }> = {
  ativo: { tom: 'good', rotulo: 'Ativo' },
  pendente: { tom: 'warning', rotulo: 'Pendente' },
  inadimplente: { tom: 'critical', rotulo: 'Inadimplente' },
  inativo: { tom: 'neutro', rotulo: 'Inativo' },
}

export type AcoesCliente = {
  onGerenciar: (cliente: Cliente) => void
  onEditar: (cliente: Cliente) => void
  onLixeira: (cliente: Cliente) => void
  onRestaurar: (cliente: Cliente) => void
  onExcluir: (cliente: Cliente) => void
  /** id em operação — desabilita os botões daquela linha. */
  ocupadoId?: number | null
}

function BotaoAcao({
  icone, titulo, tom = 'neutro', onClick, desabilitado,
}: { icone: string; titulo: string; tom?: 'neutro' | 'critico'; onClick: () => void; desabilitado?: boolean }) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      disabled={desabilitado}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className={
        'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-[13px] ' +
        'transition-colors disabled:cursor-not-allowed disabled:opacity-40 ' +
        (tom === 'critico'
          ? 'text-text-muted hover:border-critical/30 hover:bg-critical/10 hover:text-critical'
          : 'text-text-muted hover:border-border hover:bg-surface-3 hover:text-text')
      }
    >
      <span aria-hidden>{icone}</span>
    </button>
  )
}

/**
 * Colunas por ESCOPO: na lixeira, "cliente desde" dá lugar a "excluído em" e
 * as ações mudam de editar/descartar para restaurar/excluir em definitivo.
 */
export function colunasClientes(escopo: EscopoRegistro, acoes: AcoesCliente): ColumnDef<Cliente, unknown>[] {
  const naLixeira = escopo === 'lixeira'

  return [
    {
      id: 'nome',
      header: 'Cliente',
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar nome={row.original.nome} />
          <div className="min-w-0">
            <p className="truncate font-medium text-text">{row.original.nome}</p>
            <p className="truncate text-[12px] text-text-muted">{row.original.email}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'documento',
      header: 'Documento',
      enableSorting: false,
      cell: ({ row }) => <span className="tabular-nums">{mascaraCpf(row.original.documento)}</span>,
    },
    {
      id: 'plano',
      header: 'Plano',
      cell: ({ row }) => <span className="font-medium text-text-secondary">{row.original.plano}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const { tom, rotulo } = statusTom[row.original.status]
        return <Badge tom={tom}>{rotulo}</Badge>
      },
    },
    {
      id: 'mrr',
      header: 'MRR',
      meta: { alinhamento: 'direita' },
      cell: ({ row }) => <span className="font-medium tabular-nums text-text">{money(row.original.mrr)}</span>,
    },
    naLixeira
      ? {
          id: 'excluidoEm',
          header: 'Excluído em',
          meta: { alinhamento: 'direita' },
          cell: ({ row }) => (
            <span className="tabular-nums">{row.original.excluidoEm ? date(row.original.excluidoEm) : '—'}</span>
          ),
        }
      : {
          id: 'criadoEm',
          header: 'Cliente desde',
          meta: { alinhamento: 'direita' },
          cell: ({ row }) => <span className="tabular-nums">{date(row.original.criadoEm)}</span>,
        },
    {
      id: 'acoes',
      header: 'Ações',
      enableSorting: false,
      meta: { alinhamento: 'direita' },
      cell: ({ row }) => {
        const cliente = row.original
        const ocupado = acoes.ocupadoId === cliente.id
        return (
          <div className="flex items-center justify-end gap-1">
            {naLixeira ? (
              <>
                <BotaoAcao icone="↩️" titulo={`Restaurar ${cliente.nome}`} onClick={() => acoes.onRestaurar(cliente)} desabilitado={ocupado} />
                <BotaoAcao icone="🔥" titulo={`Excluir ${cliente.nome} em definitivo`} tom="critico" onClick={() => acoes.onExcluir(cliente)} desabilitado={ocupado} />
              </>
            ) : (
              <>
                <BotaoAcao icone="⚙️" titulo={`Gerenciar a conta de ${cliente.nome}`} onClick={() => acoes.onGerenciar(cliente)} desabilitado={ocupado} />
                <BotaoAcao icone="✏️" titulo={`Editar ${cliente.nome}`} onClick={() => acoes.onEditar(cliente)} desabilitado={ocupado} />
                <BotaoAcao icone="🗑️" titulo={`Mover ${cliente.nome} para a lixeira`} tom="critico" onClick={() => acoes.onLixeira(cliente)} desabilitado={ocupado} />
              </>
            )}
          </div>
        )
      },
    },
  ]
}
