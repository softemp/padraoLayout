import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { listarContas, saldoAberto } from '@/shared/api/financeiro'
import type { BaixaLancamento, Lancamento } from '@/shared/api/types'
import { Button } from '@/shared/ui/Button'
import { Input, Select } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'
import { cn } from '@/shared/lib/cn'
import { date, money } from '@/shared/lib/format'

const schema = z.object({
  pagamentoEm: z.string().min(10, 'Informe a data'),
  contaId: z.string().optional(),
  valorPago: z.coerce.number().positive('Informe um valor maior que zero'),
  juros: z.coerce.number().min(0).default(0),
  desconto: z.coerce.number().min(0).default(0),
})
type Formulario = z.infer<typeof schema>

export function BaixaModal({
  lancamento, salvando, erro, onFechar, onConfirmar,
}: {
  lancamento: Lancamento | null
  salvando: boolean
  erro?: string | null
  onFechar: () => void
  onConfirmar: (baixa: BaixaLancamento) => void
}) {
  const { data: contas } = useQuery({ queryKey: ['fin-contas'], queryFn: listarContas })
  const aberto = lancamento ? saldoAberto(lancamento) : 0

  const { register, handleSubmit, formState, reset, watch } = useForm<Formulario>({
    resolver: zodResolver(schema),
    defaultValues: { pagamentoEm: new Date().toISOString().slice(0, 10), contaId: '', valorPago: 0, juros: 0, desconto: 0 },
  })

  useEffect(() => {
    if (lancamento) {
      reset({
        pagamentoEm: new Date().toISOString().slice(0, 10),
        contaId: lancamento.contaId ? String(lancamento.contaId) : '',
        valorPago: aberto,
        juros: 0,
        desconto: 0,
      })
    }
  }, [lancamento, aberto, reset])

  const valorPago = Number(watch('valorPago') || 0)
  const juros = Number(watch('juros') || 0)
  const desconto = Number(watch('desconto') || 0)
  const restante = Math.max(aberto + juros - desconto - valorPago, 0)
  const receber = lancamento?.tipo === 'receber'

  return (
    <Modal
      aberto={!!lancamento}
      titulo={receber ? 'Registrar recebimento' : 'Registrar pagamento'}
      descricao={lancamento ? `${lancamento.descricao} · vence em ${date(lancamento.vencimento)}` : undefined}
      onFechar={salvando ? () => {} : onFechar}
      rodape={
        <>
          <Button variant="ghost" onClick={onFechar} disabled={salvando}>Cancelar</Button>
          <Button form="form-baixa" type="submit" loading={salvando}>
            {restante > 0 ? 'Registrar baixa parcial' : 'Registrar baixa'}
          </Button>
        </>
      }
    >
      <form
        id="form-baixa"
        noValidate
        className="space-y-4"
        onSubmit={handleSubmit((dados) =>
          onConfirmar({
            pagamentoEm: new Date(`${dados.pagamentoEm}T12:00:00`).toISOString(),
            contaId: dados.contaId ? Number(dados.contaId) : null,
            valorPago: dados.valorPago,
            juros: dados.juros,
            desconto: dados.desconto,
          }),
        )}
      >
        {erro && (
          <p role="alert" className="flex items-start gap-2 rounded-lg border border-critical/30 bg-critical/10 px-3 py-2.5 text-[13px] text-critical">
            <span aria-hidden>⚠️</span>{erro}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 lg:gap-6">
          <Input label="Data do pagamento" type="date" data-foco-inicial error={formState.errors.pagamentoEm?.message} {...register('pagamentoEm')} />
          <Select label="Conta bancária" hint="Sem conta vinculada, o saldo não se move." {...register('contaId')}>
            <option value="">Não movimentar conta</option>
            {contas?.map((c) => (
              <option key={c.id} value={c.id}>{c.nome} · {money(c.saldo)}</option>
            ))}
          </Select>
          <Input label="Valor pago (R$)" type="number" step="0.01" min={0} error={formState.errors.valorPago?.message} {...register('valorPago')} />
          <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:gap-6">
            <Input label="Juros/multa" type="number" step="0.01" min={0} {...register('juros')} />
            <Input label="Desconto" type="number" step="0.01" min={0} {...register('desconto')} />
          </div>
        </div>

        <dl className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-surface-2 p-2 sm:p-4 text-center">
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-text-muted">Em aberto</dt>
            <dd className="mt-0.5 text-[13px] font-semibold tabular-nums text-text">{money(aberto)}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-text-muted">Baixa agora</dt>
            <dd className={cn('mt-0.5 text-[13px] font-semibold tabular-nums', receber ? 'text-good' : 'text-critical')}>
              {money(valorPago)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-text-muted">Fica em aberto</dt>
            <dd className="mt-0.5 text-[13px] font-semibold tabular-nums text-text">{money(restante)}</dd>
          </div>
        </dl>

        {/* Baixa parcial é um caminho normal, não um erro: o registro fica em
            'parcial' com o saldo restante, e recebe outra baixa depois. */}
        {restante > 0 && valorPago > 0 && (
          <p className="rounded-md bg-warning/10 px-3 py-2 text-[12px] text-text-secondary">
            Baixa parcial: o lançamento continua em aberto com {money(restante)} e pode receber outra baixa.
          </p>
        )}
      </form>
    </Modal>
  )
}
