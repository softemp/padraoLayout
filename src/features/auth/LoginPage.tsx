import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { login } from '@/shared/api/api'
import { Button } from '@/shared/ui/Button'
import { Checkbox, Input } from '@/shared/ui/Field'
import { AuthCard } from './AuthLayout'

/** Validação no front é UX; o backend revalida sempre. */
const schema = z.object({
  email: z.string().min(1, 'Informe o e-mail').email('E-mail inválido'),
  senha: z.string().min(1, 'Informe a senha'),
  manterConectado: z.boolean().default(true),
})
type Formulario = z.infer<typeof schema>

export function LoginPage() {
  const navigate = useNavigate()
  const [erroGeral, setErroGeral] = useState<string | null>(null)

  const { register, handleSubmit, formState } = useForm<Formulario>({
    resolver: zodResolver(schema),
    defaultValues: { email: 'paulo@softemp.com.br', senha: '', manterConectado: true },
  })

  const enviar = handleSubmit(async ({ email, senha }) => {
    setErroGeral(null)
    try {
      await login(email, senha)
      navigate('/')
    } catch {
      // Mensagem que NÃO distingue e-mail de senha (quem enumera conta agradece
      // a distinção). Qual dos dois falhou vai para o log do servidor.
      setErroGeral('E-mail ou senha inválidos.')
    }
  })

  return (
    <AuthCard
      titulo="Entrar"
      descricao="Acesse o painel com suas credenciais."
      rodape={
        <>
          Ainda não tem conta?{' '}
          <Link to="/cadastro" className="font-medium text-primary hover:underline">Criar conta</Link>
        </>
      }
    >
      <form onSubmit={enviar} noValidate className="space-y-4">
        {erroGeral && (
          <p role="alert" className="flex items-start gap-2 rounded-lg border border-critical/30 bg-critical/10 px-3 py-2.5 text-[13px] text-critical">
            <span aria-hidden>⚠️</span>
            {erroGeral}
          </p>
        )}

        <Input
          label="E-mail"
          type="email"
          autoComplete="email"
          placeholder="voce@empresa.com.br"
          error={formState.errors.email?.message}
          {...register('email')}
        />

        <Input
          label="Senha"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          error={formState.errors.senha?.message}
          acao={
            // Piso inegociável nº 1: recuperação de senha nasce com a tela.
            <Link to="/recuperar-senha" className="text-[13px] font-medium text-primary hover:underline">
              Esqueci minha senha
            </Link>
          }
          {...register('senha')}
        />

        {/* Piso inegociável nº 2: "manter conectado" muda o prazo do refresh,
            decidido no servidor — nunca o prazo do access token. */}
        <Checkbox label="Manter conectado neste dispositivo" {...register('manterConectado')} />

        <Button type="submit" size="lg" block loading={formState.isSubmitting}>
          Entrar
        </Button>

        <p className="text-center text-[12px] text-text-muted">
          Demonstração: qualquer senha com 6+ caracteres entra.
        </p>
      </form>
    </AuthCard>
  )
}
