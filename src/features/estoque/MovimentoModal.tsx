import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { depositos, disponivel } from '@/shared/api/estoque'
import type { NovoMovimento } from '@/shared/api/estoque'
import type { ItemEstoque, TipoMovimentoEstoque } from '@/shared/api/types'
import { Button } from '@/shared/ui/Button'
import { Input, Select } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'
import { cn } from '@/shared/lib/cn'
import { money, number } from '@/shared/lib/format'

const schema = z.object({
  tipo: z.enum(['entrada', 'saida', 'ajuste', 'transferencia']),
  quantidade: z.coerce.number().positive('Informe a quantidade'),
  custoUnitario: z.coerce.number().optional(),
  documento: z.string().optional().default(''),
  motivo: z.string().min(3, 'Informe o motivo — é o que explica o movimento depois'),
  depositoId: z.coerce.number(),
})
type Formulario = z.infer<typeof schema>

const rotulos: Record<TipoMovimentoEstoque, string> = {
  entrada: 'Entrada', saida: 'Saída', ajuste: 'Ajuste por contagem', transferencia: 'Transferência',
}

export function MovimentoModal({
  item, tipoInicial, salvando, erro, onFechar, onConfirmar,
}: {
  item: ItemEstoque | null
  tipoInicial: TipoMovimentoEstoque
  salvando: boolean
  erro?: string | null
  onFechar: () => void
  onConfirmar: (dados: NovoMovimento) => void
}) {
  const { register, handleSubmit, formState, reset, watch } = useForm<Formulario>({
    resolver: zodResolver(schema),
    defaultValues: { tipo: tipoInicial, quantidade: 0, custoUnitario: 0, documento: '', motivo: '', depositoId: 1 },
  })

  useEffect(() => {
    if (item) {
      reset({
        tipo: tipoInicial,
        quantidade: tipoInicial === 'ajuste' ? item.saldo : 0,
        custoUnitario: item.custoMedio,
        documento: '',
        motivo: '',
        depositoId: 1,
      })
    }
  }, [item, tipoInicial, reset])

  const tipo = watch('tipo')
  const quantidade = Number(watch('quantidade') || 0)
  const custoUnitario = Number(watch('custoUnitario') || 0)

  const saldo = item?.saldo ?? 0
  const delta = tipo === 'entrada' ? quantidade : tipo === 'saida' ? -quantidade : tipo === 'ajuste' ? quantidade - saldo : 0
  const saldoFinal = saldo + delta

  // Só a entrada mexe no custo médio — a saída consome pelo custo vigente.
  const custoFinal =
    tipo === 'entrada' && saldo + quantidade > 0
      ? (saldo * (item?.custoMedio ?? 0) + quantidade * custoUnitario) / (saldo + quantidade)
      : item?.custoMedio ?? 0

  return (
    <Modal
      aberto={!!item}
      titulo={rotulos[tipo]}
      descricao={item ? `${item.sku} · ${item.nome}` : undefined}
      largura="max-w-xl"
      onFechar={salvando ? () => {} : onFechar}
      rodape={
        <>
          <Button variant="ghost" onClick={onFechar} disabled={salvando}>Cancelar</Button>
          <Button form="form-movimento" type="submit" variant={tipo === 'saida' ? 'danger' : 'primary'} loading={salvando}>
            Registrar {rotulos[tipo].toLowerCase()}
          </Button>
        </>
      }
    >
      <form
        id="form-movimento"
        noValidate
        className="space-y-4"
        onSubmit={handleSubmit((d) =>
          onConfirmar({
            tipo: d.tipo,
            quantidade: d.quantidade,
            custoUnitario: d.tipo === 'entrada' ? d.custoUnitario : undefined,
            documento: d.documento || '—',
            motivo: d.motivo,
            depositoId: d.depositoId,
          }),
        )}
      >
        {erro && (
          <p role="alert" className="flex items-start gap-2 rounded-lg border border-critical/30 bg-critical/10 px-3 py-2.5 text-[13px] text-critical">
            <span aria-hidden>⚠️</span>{erro}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 lg:gap-6">
          <Select label="Tipo de movimento" data-foco-inicial {...register('tipo')}>
            <option value="entrada">Entrada (compra, devolução)</option>
            <option value="saida">Saída (venda, consumo, perda)</option>
            <option value="ajuste">Ajuste por contagem</option>
            <option value="transferencia">Transferência entre depósitos</option>
          </Select>
          <Select label="Depósito" {...register('depositoId')}>
            {depositos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </Select>

          <Input
            label={tipo === 'ajuste' ? `Quantidade CONTADA (${item?.unidade ?? 'un'})` : `Quantidade (${item?.unidade ?? 'un'})`}
            type="number"
            step="1"
            min={0}
            hint={tipo === 'ajuste' ? 'O que existe na prateleira agora — a diferença vira o ajuste.' : undefined}
            error={formState.errors.quantidade?.message}
            {...register('quantidade')}
          />

          {tipo === 'entrada' && (
            <Input
              label="Custo unitário da compra (R$)"
              type="number"
              step="0.01"
              min={0}
              hint="Entra no cálculo do custo médio."
              {...register('custoUnitario')}
            />
          )}

          <Input label="Documento" placeholder="NF, pedido, romaneio…" {...register('documento')} />
          <Input
            label="Motivo"
            className={tipo === 'entrada' ? 'sm:col-span-2' : ''}
            placeholder={tipo === 'ajuste' ? 'Ex.: contagem do inventário de setembro' : 'Ex.: venda do pedido 1042'}
            error={formState.errors.motivo?.message}
            {...register('motivo')}
          />
        </div>

        {/* Prévia do efeito: saldo e custo médio antes de gravar. */}
        {item && (
          <dl className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-surface-2 p-2 sm:p-4 text-center sm:grid-cols-4">
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-text-muted">Saldo hoje</dt>
              <dd className="mt-0.5 text-[13px] font-semibold tabular-nums text-text">{number(saldo)}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-text-muted">Movimento</dt>
              <dd className={cn('mt-0.5 text-[13px] font-semibold tabular-nums', delta >= 0 ? 'text-good' : 'text-critical')}>
                {delta >= 0 ? '+' : ''}{number(delta)}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-text-muted">Fica com</dt>
              <dd className={cn('mt-0.5 text-[13px] font-semibold tabular-nums', saldoFinal < 0 ? 'text-critical' : 'text-text')}>
                {number(saldoFinal)}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-text-muted">Custo médio</dt>
              <dd className="mt-0.5 text-[13px] font-semibold tabular-nums text-text">{money(custoFinal)}</dd>
            </div>
          </dl>
        )}

        {tipo === 'saida' && item && (
          <p className="rounded-md bg-surface-2 px-3 py-2 text-[12px] text-text-secondary">
            Disponível para saída: <strong className="text-text">{number(disponivel(item))} {item.unidade}</strong> —
            o saldo de {number(item.saldo)} menos {number(item.reservado)} já reservado a pedidos.
          </p>
        )}
        {tipo === 'entrada' && (
          <p className="rounded-md bg-surface-2 px-3 py-2 text-[12px] text-text-secondary">
            Só a entrada muda o custo médio. A saída consome pelo custo vigente — mexer no médio na
            saída inventa lucro que não existiu.
          </p>
        )}
      </form>
    </Modal>
  )
}
