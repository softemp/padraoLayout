import type { ColumnDef } from '@tanstack/react-table'
import { Avatar } from '@/shared/ui/Avatar'
import { Badge } from '@/shared/ui/Badge'
import { date, money } from '@/shared/lib/format'
import type { Cliente, ClienteStatus } from '@/shared/api/types'

/** Máscara é APRESENTAÇÃO: o "banco" guarda só dígitos. */
export const mascaraCpf = (digitos: string) =>
  digitos.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')

const statusTom: Record<ClienteStatus, { tom: 'good' | 'warning' | 'critical' | 'neutro'; rotulo: string }> = {
  ativo: { tom: 'good', rotulo: 'Ativo' },
  pendente: { tom: 'warning', rotulo: 'Pendente' },
  inadimplente: { tom: 'critical', rotulo: 'Inadimplente' },
  inativo: { tom: 'neutro', rotulo: 'Inativo' },
}

export const colunasClientes: ColumnDef<Cliente, unknown>[] = [
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
  {
    id: 'criadoEm',
    header: 'Cliente desde',
    meta: { alinhamento: 'direita' },
    cell: ({ row }) => <span className="tabular-nums">{date(row.original.criadoEm)}</span>,
  },
  {
    id: 'acoes',
    header: '',
    enableSorting: false,
    meta: { alinhamento: 'direita' },
    cell: () => (
      <button
        type="button"
        aria-label="Ações do cliente"
        onClick={(e) => e.stopPropagation()}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-3 hover:text-text"
      >
        <span aria-hidden>⋯</span>
      </button>
    ),
  },
]
