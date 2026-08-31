import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Field'
import { AuthCard } from './AuthLayout'

const schema = z.object({ email: z.string().min(1, 'Informe o e-mail').email('E-mail inválido') })
type Formulario = z.infer<typeof schema>

export function ForgotPasswordPage() {
  const [enviado, setEnviado] = useState(false)
  const { register, handleSubmit, formState, getValues } = useForm<Formulario>({ resolver: zodResolver(schema) })

  const enviar = handleSubmit(async () => {
    await new Promise((r) => setTimeout(r, 700))
    setEnviado(true)
  })

  return (
    <AuthCard
      titulo={enviado ? 'Verifique seu e-mail' : 'Recuperar senha'}
      descricao={
        enviado
          ? 'Se existir uma conta com esse endereço, o link de redefinição chega em instantes.'
          : 'Enviamos um link de redefinição para o seu e-mail.'
      }
      rodape={<Link to="/login" className="font-medium text-primary hover:underline">← Voltar para o login</Link>}
    >
      {enviado ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-surface-2 px-4 py-3.5 text-[13px] text-text-secondary">
            <p>
              Link enviado para <span className="font-semibold text-text">{getValues('email')}</span>.
              Ele vale por 30 minutos e deixa de funcionar assim que for usado.
            </p>
          </div>
          {/* Resposta IDÊNTICA para e-mail existente e inexistente: a tela de
              recuperação não pode virar um verificador de cadastro. */}
          <p className="text-[12px] text-text-muted">
            Não recebeu? Confira a caixa de spam ou tente novamente em alguns minutos.
          </p>
          <Button variant="secondary" block onClick={() => setEnviado(false)}>Usar outro e-mail</Button>
        </div>
      ) : (
        <form onSubmit={enviar} noValidate className="space-y-4">
          <Input
            label="E-mail cadastrado"
            type="email"
            autoComplete="email"
            placeholder="voce@empresa.com.br"
            error={formState.errors.email?.message}
            {...register('email')}
          />
          <Button type="submit" size="lg" block loading={formState.isSubmitting}>Enviar link de redefinição</Button>
        </form>
      )}
    </AuthCard>
  )
}
