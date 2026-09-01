import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/shared/ui/Button'
import { Input, Select } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'
import { money } from '@/shared/lib/format'
import type { AjusteConta } from '@/shared/api/types'

const CATEGORIAS = {
  credito: ['Pagamento de fatura', 'Estorno de cobrança', 'Bônus comercial', 'Crédito manual'],
  debito: ['Mensalidade', 'Serviço avulso', 'Multa por atraso', 'Débito manual'],
} as const

const schema = z.object({
  // O valor é sempre POSITIVO no formulário; o sinal vem do tipo, no serviço.
  valor: z.coerce.number().positive('Informe um valor maior que zero'),
  categoria: z.string().min(1, 'Escolha a categoria'),
  descricao: z.string().min(5, 'Descreva o motivo — é o que a auditoria vai ler'),
})
type Formulario = z.infer<typeof schema>

export function AjusteContaModal({
  tipo, saldoAtual, salvando, onFechar, onConfirmar,
}: {
  tipo: 'credito' | 'debito' | null
  saldoAtual: number
  salvando: boolean
  onFechar: () => void
  onConfirmar: (ajuste: AjusteConta) => void
}) {
  const { register, handleSubmit, formState, reset, watch } = useForm<Formulario>({
    resolver: zodResolver(schema),
    defaultValues: { valor: 0, categoria: '', descricao: '' },
  })

  useEffect(() => { if (tipo) reset({ valor: 0, categoria: '', descricao: '' }) }, [tipo, reset])

  const valor = Number(watch('valor') || 0)
  const credito = tipo === 'credito'
  const saldoResultante = saldoAtual + (credito ? valor : -valor)

  return (
    <Modal
      aberto={!!tipo}
      titulo={credito ? 'Lançar crédito' : 'Lançar débito'}
      descricao="O lançamento entra no extrato com autor, data e saldo resultante."
      onFechar={salvando ? () => {} : onFechar}
      rodape={
        <>
          <Button variant="ghost" onClick={onFechar} disabled={salvando}>Cancelar</Button>
          <Button form="form-ajuste" type="submit" variant={credito ? 'primary' : 'danger'} loading={salvando}>
            {credito ? 'Lançar crédito' : 'Lançar débito'}
          </Button>
        </>
      }
    >
      <form
        id="form-ajuste"
        noValidate
        className="space-y-4"
        onSubmit={handleSubmit((dados) => tipo && onConfirmar({ ...dados, tipo }))}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 lg:gap-6">
          <Input
            label="Valor (R$)"
            type="number"
            step="0.01"
            min={0}
            data-foco-inicial
            error={formState.errors.valor?.message}
            {...register('valor')}
          />
          <Select label="Categoria" error={formState.errors.categoria?.message} {...register('categoria')}>
            <option value="">Selecione…</option>
            {CATEGORIAS[credito ? 'credito' : 'debito'].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </div>

        <Input
          label="Motivo"
          placeholder="Ex.: acordo comercial fechado com o time de vendas"
          hint="Aparece no extrato e no histórico da conta."
          error={formState.errors.descricao?.message}
          {...register('descricao')}
        />

        {/* Prévia do efeito: ninguém deveria descobrir o saldo novo só depois. */}
        <dl className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-surface-2 p-2 sm:p-4 text-center">
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-text-muted">Saldo atual</dt>
            <dd className="mt-0.5 text-[13px] font-semibold tabular-nums text-text">{money(saldoAtual)}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-text-muted">Lançamento</dt>
            <dd className={`mt-0.5 text-[13px] font-semibold tabular-nums ${credito ? 'text-good' : 'text-critical'}`}>
              {credito ? '+' : '−'} {money(valor)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-text-muted">Fica em</dt>
            <dd className="mt-0.5 text-[13px] font-semibold tabular-nums text-text">{money(saldoResultante)}</dd>
          </div>
        </dl>
      </form>
    </Modal>
  )
}
