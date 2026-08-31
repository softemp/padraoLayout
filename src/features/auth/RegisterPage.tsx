import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/shared/ui/Button'
import { Checkbox, Input } from '@/shared/ui/Field'
import { AuthCard } from './AuthLayout'

const schema = z
  .object({
    nome: z.string().min(3, 'Informe o nome completo'),
    email: z.string().min(1, 'Informe o e-mail').email('E-mail inválido'),
    senha: z.string().min(8, 'Mínimo de 8 caracteres'),
    confirmacao: z.string(),
    aceite: z.literal(true, { errorMap: () => ({ message: 'É preciso aceitar os termos' }) }),
  })
  .refine((d) => d.senha === d.confirmacao, { path: ['confirmacao'], message: 'As senhas não conferem' })

type Formulario = z.infer<typeof schema>

export function RegisterPage() {
  const navigate = useNavigate()
  const { register, handleSubmit, formState } = useForm<Formulario>({ resolver: zodResolver(schema) })

  const enviar = handleSubmit(async () => {
    await new Promise((r) => setTimeout(r, 700))
    navigate('/')
  })

  return (
    <AuthCard
      titulo="Criar conta"
      descricao="Leva menos de um minuto."
      // Par simétrico: todo cadastro aponta de volta para o login. Sem isso,
      // quem já tem conta sai pelo botão do navegador — ou abandona.
      rodape={
        <>
          Já tem conta?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">Entrar</Link>
        </>
      }
    >
      <form onSubmit={enviar} noValidate className="space-y-4">
        <Input label="Nome completo" autoComplete="name" error={formState.errors.nome?.message} {...register('nome')} />
        <Input label="E-mail" type="email" autoComplete="email" error={formState.errors.email?.message} {...register('email')} />
        <Input
          label="Senha"
          type="password"
          autoComplete="new-password"
          hint="Mínimo de 8 caracteres."
          error={formState.errors.senha?.message}
          {...register('senha')}
        />
        <Input
          label="Confirmar senha"
          type="password"
          autoComplete="new-password"
          error={formState.errors.confirmacao?.message}
          {...register('confirmacao')}
        />
        <Checkbox
          label={<span>Li e aceito os <a href="#termos" className="text-primary hover:underline">termos de uso</a></span>}
          {...register('aceite')}
        />
        {formState.errors.aceite && (
          <p role="alert" className="text-[13px] text-critical">{formState.errors.aceite.message}</p>
        )}
        <Button type="submit" size="lg" block loading={formState.isSubmitting}>Criar conta</Button>
      </form>
    </AuthCard>
  )
}
