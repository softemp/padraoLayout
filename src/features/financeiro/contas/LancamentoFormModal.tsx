import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { listarCategorias, listarContas } from '@/shared/api/financeiro'
import type { Lancamento, NovoLancamento, TipoLancamento } from '@/shared/api/types'
import { Button } from '@/shared/ui/Button'
import { Checkbox, Input, Select } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'
import { cn } from '@/shared/lib/cn'
import { date, money } from '@/shared/lib/format'

const schema = z.object({
  tipo: z.enum(['receber', 'pagar']),
  descricao: z.string().min(3, 'Descreva o lançamento'),
  contraparte: z.string().min(2, 'Informe o cliente ou fornecedor'),
  categoriaId: z.coerce.number().min(1, 'Escolha a categoria'),
  valor: z.coerce.number().positive('Informe um valor maior que zero'),
  competencia: z.string().min(7, 'Informe a competência'),
  vencimento: z.string().min(10, 'Informe o vencimento'),
  contaId: z.string().optional(),
  observacao: z.string().optional(),
  recorrente: z.boolean().default(false),
  periodicidade: z.enum(['mensal', 'semanal', 'anual']).default('mensal'),
  parcelas: z.coerce.number().min(2).max(60).default(12),
})
type Formulario = z.infer<typeof schema>

const hojeIso = () => new Date().toISOString().slice(0, 10)
const competenciaHoje = () => new Date().toISOString().slice(0, 7)

export function LancamentoFormModal({
  aberto, tipoInicial, salvando, duplicata, onFechar, onSalvar,
}: {
  aberto: boolean
  tipoInicial: TipoLancamento
  salvando: boolean
  /** Preenchido quando a trava de duplicidade barrou a criação. */
  duplicata: Lancamento | null
  onFechar: () => void
  onSalvar: (dados: NovoLancamento, confirmarDuplicidade: boolean) => void
}) {
  const { data: categorias } = useQuery({ queryKey: ['fin-categorias'], queryFn: listarCategorias })
  const { data: contas } = useQuery({ queryKey: ['fin-contas'], queryFn: listarContas })
  const [confirmarDuplicidade, setConfirmar] = useState(false)

  const { register, handleSubmit, formState, reset, watch, setValue } = useForm<Formulario>({
    resolver: zodResolver(schema),
    defaultValues: {
      tipo: tipoInicial, descricao: '', contraparte: '', categoriaId: 0, valor: 0,
      competencia: competenciaHoje(), vencimento: hojeIso(), contaId: '', observacao: '',
      recorrente: false, periodicidade: 'mensal', parcelas: 12,
    },
  })

  useEffect(() => {
    if (aberto) {
      setConfirmar(false)
      reset({
        tipo: tipoInicial, descricao: '', contraparte: '', categoriaId: 0, valor: 0,
        competencia: competenciaHoje(), vencimento: hojeIso(), contaId: '', observacao: '',
        recorrente: false, periodicidade: 'mensal', parcelas: 12,
      })
    }
  }, [aberto, tipoInicial, reset])

  const tipo = watch('tipo')
  const recorrente = watch('recorrente')
  const parcelas = Number(watch('parcelas') || 0)
  const valor = Number(watch('valor') || 0)
  const vencimento = watch('vencimento')

  // A categoria pertence ao tipo: trocar de "a pagar" para "a receber" com a
  // categoria antiga presa geraria despesa dentro da receita.
  const categoriasDoTipo = (categorias ?? []).filter((c) => c.tipo === tipo)

  return (
    <Modal
      aberto={aberto}
      titulo={tipo === 'receber' ? 'Nova conta a receber' : 'Nova conta a pagar'}
      descricao="Competência é o mês do fato; vencimento é a data do dinheiro."
      onFechar={salvando ? () => {} : onFechar}
      largura="max-w-2xl"
      rodape={
        <>
          <Button variant="ghost" onClick={onFechar} disabled={salvando}>Cancelar</Button>
          <Button form="form-lancamento" type="submit" loading={salvando}>
            {duplicata && confirmarDuplicidade ? 'Criar mesmo assim' : recorrente ? `Criar ${parcelas} parcelas` : 'Criar lançamento'}
          </Button>
        </>
      }
    >
      <form
        id="form-lancamento"
        noValidate
        className="space-y-4"
        onSubmit={handleSubmit((dados) =>
          onSalvar(
            {
              tipo: dados.tipo,
              descricao: dados.descricao,
              contraparte: dados.contraparte,
              categoriaId: dados.categoriaId,
              competencia: dados.competencia,
              vencimento: new Date(`${dados.vencimento}T12:00:00`).toISOString(),
              valor: dados.valor,
              contaId: dados.contaId ? Number(dados.contaId) : null,
              observacao: dados.observacao,
              recorrencia: { ativa: dados.recorrente, periodicidade: dados.periodicidade, parcelas: dados.parcelas },
            },
            confirmarDuplicidade,
          ),
        )}
      >
        {/* Aviso de duplicidade: barra, mostra o que já existe e deixa seguir
            conscientemente. Bloquear de vez faria o operador cadastrar torto
            para escapar da trava. */}
        {duplicata && (
          <div className="space-y-2 rounded-lg border border-warning/40 bg-warning/10 px-3.5 py-3 text-[13px]">
            <p className="font-semibold text-text">Já existe um lançamento parecido</p>
            <p className="text-text-secondary">
              {duplicata.descricao} · {duplicata.contraparte} · {money(duplicata.valor)} · vence em {date(duplicata.vencimento)}
            </p>
            <Checkbox
              label="Confirmo que este é um lançamento diferente"
              checked={confirmarDuplicidade}
              onChange={(e) => setConfirmar(e.target.checked)}
            />
          </div>
        )}

        <div className="flex rounded-lg border border-border p-0.5">
          {(['receber', 'pagar'] as const).map((op) => (
            <button
              key={op}
              type="button"
              onClick={() => { setValue('tipo', op); setValue('categoriaId', 0) }}
              aria-pressed={tipo === op}
              className={cn(
                'flex-1 rounded-md px-3 py-2 text-[13px] font-medium transition-colors',
                tipo === op
                  ? op === 'receber' ? 'bg-good/12 text-good' : 'bg-critical/12 text-critical'
                  : 'text-text-muted hover:text-text',
              )}
            >
              {op === 'receber' ? '↓ A receber' : '↑ A pagar'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 lg:gap-6">
          <Input label="Descrição" className="sm:col-span-2" error={formState.errors.descricao?.message} {...register('descricao')} />
          <Input
            label={tipo === 'receber' ? 'Cliente' : 'Fornecedor'}
            error={formState.errors.contraparte?.message}
            {...register('contraparte')}
          />
          <Select label="Categoria" error={formState.errors.categoriaId?.message} {...register('categoriaId')}>
            <option value={0}>Selecione…</option>
            {categoriasDoTipo.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </Select>

          <Input label="Valor (R$)" type="number" step="0.01" min={0} error={formState.errors.valor?.message} {...register('valor')} />
          <Input
            label="Competência"
            type="month"
            hint="O mês a que o fato pertence."
            error={formState.errors.competencia?.message}
            {...register('competencia')}
          />
          <Input
            label="Vencimento"
            type="date"
            hint="A data em que o dinheiro entra ou sai."
            error={formState.errors.vencimento?.message}
            {...register('vencimento')}
          />
          <Select label="Conta bancária (opcional)" hint="Sem conta, a baixa não move saldo." {...register('contaId')}>
            <option value="">Não vincular</option>
            {contas?.map((c) => (
              <option key={c.id} value={c.id}>{c.nome} · {c.banco}</option>
            ))}
          </Select>
          <Input label="Observação" className="sm:col-span-2" {...register('observacao')} />
        </div>

        <div className="space-y-3 rounded-lg border border-border p-3.5">
          <Checkbox label="Repetir este lançamento" {...register('recorrente')} />

          {recorrente && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 lg:gap-6">
                <Select label="Periodicidade" {...register('periodicidade')}>
                  <option value="mensal">Mensal</option>
                  <option value="semanal">Semanal</option>
                  <option value="anual">Anual</option>
                </Select>
                <Input label="Quantas parcelas" type="number" min={2} max={60} {...register('parcelas')} />
              </div>

              {/* As parcelas são criadas AGORA, uma a uma. Guardar só a regra
                  empurra para o futuro a pergunta "quanto tenho a pagar em
                  março?" — que é justamente a pergunta. */}
              <p className="rounded-md bg-surface-2 px-3 py-2 text-[12px] text-text-secondary">
                Serão criados <strong className="text-text">{parcelas} lançamentos</strong> de{' '}
                <strong className="text-text">{money(valor)}</strong> cada, a partir de{' '}
                {vencimento ? date(`${vencimento}T12:00:00`) : '—'}. Cada parcela é um registro próprio,
                com o seu vencimento e a sua baixa.
              </p>
            </>
          )}
        </div>
      </form>
    </Modal>
  )
}
