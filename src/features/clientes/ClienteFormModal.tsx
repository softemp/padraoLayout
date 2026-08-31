import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/shared/ui/Button'
import { Input, Select } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'
import type { Cliente } from '@/shared/api/types'

const schema = z.object({
  nome: z.string().min(3, 'Informe o nome completo'),
  email: z.string().min(1, 'Informe o e-mail').email('E-mail inválido'),
  plano: z.enum(['Starter', 'Pro', 'Enterprise']),
  status: z.enum(['ativo', 'pendente', 'inadimplente', 'inativo']),
  mrr: z.coerce.number().min(0, 'Não pode ser negativo'),
})
export type ClienteFormulario = z.infer<typeof schema>

export function ClienteFormModal({
  cliente, salvando, onSalvar, onFechar,
}: {
  cliente: Cliente | null
  salvando: boolean
  onSalvar: (dados: ClienteFormulario) => void
  onFechar: () => void
}) {
  const { register, handleSubmit, formState, reset } = useForm<ClienteFormulario>({ resolver: zodResolver(schema) })

  // Trocar de cliente com o diálogo aberto não pode manter o formulário do anterior.
  useEffect(() => {
    if (cliente) {
      reset({
        nome: cliente.nome,
        email: cliente.email,
        plano: cliente.plano,
        status: cliente.status,
        mrr: cliente.mrr,
      })
    }
  }, [cliente, reset])

  return (
    <Modal
      aberto={!!cliente}
      titulo="Editar cliente"
      descricao={cliente ? `#${cliente.id} · cadastrado em ${new Date(cliente.criadoEm).toLocaleDateString('pt-BR')}` : undefined}
      onFechar={salvando ? () => {} : onFechar}
      rodape={
        <>
          <Button variant="ghost" onClick={onFechar} disabled={salvando}>Cancelar</Button>
          <Button form="form-cliente" type="submit" loading={salvando}>Salvar alterações</Button>
        </>
      }
    >
      <form id="form-cliente" onSubmit={handleSubmit(onSalvar)} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Nome" className="sm:col-span-2" data-foco-inicial error={formState.errors.nome?.message} {...register('nome')} />
        <Input label="E-mail" type="email" className="sm:col-span-2" error={formState.errors.email?.message} {...register('email')} />
        <Select label="Plano" error={formState.errors.plano?.message} {...register('plano')}>
          <option value="Starter">Starter</option>
          <option value="Pro">Pro</option>
          <option value="Enterprise">Enterprise</option>
        </Select>
        <Select label="Status" error={formState.errors.status?.message} {...register('status')}>
          <option value="ativo">Ativo</option>
          <option value="pendente">Pendente</option>
          <option value="inadimplente">Inadimplente</option>
          <option value="inativo">Inativo</option>
        </Select>
        <Input label="MRR (R$)" type="number" step="0.01" min={0} error={formState.errors.mrr?.message} {...register('mrr')} />
      </form>
    </Modal>
  )
}
