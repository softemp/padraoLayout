import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Contrato } from '@/shared/api/types'
import type { NovoAditivo } from '@/shared/api/contratos'
import { Button } from '@/shared/ui/Button'
import { Input, Select } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'
import { date, money } from '@/shared/lib/format'

const schema = z.object({
  tipo: z.enum(['reajuste', 'prazo', 'valor', 'escopo', 'rescisao']),
  vigenciaEm: z.string().min(10, 'Informe a data de vigência'),
  descricao: z.string().min(10, 'Descreva o que muda — é o que a auditoria vai ler'),
  valorNovo: z.string().optional(),
  fimNovo: z.string().optional(),
})
type Formulario = z.infer<typeof schema>

/**
 * Aditivo é o ÚNICO caminho para mudar contrato assinado. O formulário mostra
 * o "de → para" antes de gravar: aditivo que não deixa claro o que mudou não
 * serve para explicar, seis meses depois, por que o valor é outro.
 */
export function AditivoModal({
  contrato, salvando, erro, onFechar, onConfirmar,
}: {
  contrato: Contrato | null
  salvando: boolean
  erro?: string | null
  onFechar: () => void
  onConfirmar: (dados: NovoAditivo) => void
}) {
  const { register, handleSubmit, formState, reset, watch } = useForm<Formulario>({
    resolver: zodResolver(schema),
    defaultValues: { tipo: 'reajuste', vigenciaEm: new Date().toISOString().slice(0, 10), descricao: '', valorNovo: '', fimNovo: '' },
  })

  useEffect(() => {
    if (contrato) {
      reset({
        tipo: 'reajuste',
        vigenciaEm: new Date().toISOString().slice(0, 10),
        descricao: '',
        valorNovo: String(contrato.valorMensal),
        fimNovo: contrato.fim.slice(0, 10),
      })
    }
  }, [contrato, reset])

  const tipo = watch('tipo')
  const valorNovo = Number(watch('valorNovo') || 0)
  const mudaValor = tipo === 'reajuste' || tipo === 'valor'
  const mudaPrazo = tipo === 'prazo'
  const variacao = contrato && valorNovo ? (valorNovo - contrato.valorMensal) / contrato.valorMensal : 0

  return (
    <Modal
      aberto={!!contrato}
      titulo="Novo aditivo"
      descricao={contrato ? `${contrato.numero} · ${contrato.cliente}` : undefined}
      onFechar={salvando ? () => {} : onFechar}
      largura="max-w-xl"
      rodape={
        <>
          <Button variant="ghost" onClick={onFechar} disabled={salvando}>Cancelar</Button>
          <Button form="form-aditivo" type="submit" variant={tipo === 'rescisao' ? 'danger' : 'primary'} loading={salvando}>
            {tipo === 'rescisao' ? 'Registrar rescisão' : 'Criar aditivo'}
          </Button>
        </>
      }
    >
      <form
        id="form-aditivo"
        noValidate
        className="space-y-4"
        onSubmit={handleSubmit((d) =>
          onConfirmar({
            tipo: d.tipo,
            vigenciaEm: new Date(`${d.vigenciaEm}T12:00:00`).toISOString(),
            descricao: d.descricao,
            valorNovo: mudaValor && d.valorNovo ? Number(d.valorNovo) : undefined,
            fimNovo: mudaPrazo && d.fimNovo ? new Date(`${d.fimNovo}T12:00:00`).toISOString() : undefined,
          }),
        )}
      >
        {erro && (
          <p role="alert" className="flex items-start gap-2 rounded-lg border border-critical/30 bg-critical/10 px-3 py-2.5 text-[13px] text-critical">
            <span aria-hidden>⚠️</span>{erro}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 lg:gap-6">
          <Select label="Tipo de aditivo" data-foco-inicial {...register('tipo')}>
            <option value="reajuste">Reajuste de valor</option>
            <option value="valor">Alteração de valor</option>
            <option value="prazo">Prorrogação de prazo</option>
            <option value="escopo">Mudança de escopo</option>
            <option value="rescisao">Rescisão</option>
          </Select>
          <Input label="Vigora a partir de" type="date" error={formState.errors.vigenciaEm?.message} {...register('vigenciaEm')} />

          {mudaValor && <Input label="Novo valor mensal (R$)" type="number" step="0.01" min={0} {...register('valorNovo')} />}
          {mudaPrazo && <Input label="Nova data de fim" type="date" {...register('fimNovo')} />}

          <Input
            label="O que muda"
            className="sm:col-span-2"
            placeholder="Ex.: reajuste anual pelo IPCA acumulado de 4,5%"
            error={formState.errors.descricao?.message}
            {...register('descricao')}
          />
        </div>

        {/* O "de → para" na tela, antes de gravar. */}
        {contrato && (mudaValor || mudaPrazo) && (
          <dl className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-surface-2 p-2 sm:p-4 text-center">
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-text-muted">Hoje</dt>
              <dd className="mt-0.5 text-[13px] font-semibold tabular-nums text-text">
                {mudaValor ? money(contrato.valorMensal) : date(contrato.fim)}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-text-muted">Variação</dt>
              <dd className="mt-0.5 text-[13px] font-semibold tabular-nums text-text-secondary">
                {mudaValor ? `${variacao >= 0 ? '+' : ''}${(variacao * 100).toFixed(1)}%` : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-text-muted">Passa a ser</dt>
              <dd className="mt-0.5 text-[13px] font-semibold tabular-nums text-text">
                {mudaValor ? money(valorNovo) : watch('fimNovo') ? date(`${watch('fimNovo')}T12:00:00`) : '—'}
              </dd>
            </div>
          </dl>
        )}

        <p className="rounded-md bg-surface-2 px-3 py-2 text-[12px] text-text-secondary">
          O contrato assinado não é reescrito: o aditivo guarda o antes e o depois, e é ele que
          explica por que o valor de hoje é diferente do que foi assinado.
        </p>
      </form>
    </Modal>
  )
}
