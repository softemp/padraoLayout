import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { login } from '@/shared/api/api'
import { Button } from '@/shared/ui/Button'
import { Checkbox, Input } from '@/shared/ui/Field'
import { configAcesso, rotuloIdentificador } from '@/app/auth-config'
import { detectarTipo, formatarIdentificador } from '@/shared/lib/identificador'
import { AuthCard } from './AuthLayout'

const schema = z.object({
  identificador: z.string().min(1, 'Informe seu acesso'),
  senha: z.string().min(1, 'Informe a senha'),
  manterConectado: z.boolean().default(true),
})
type Formulario = z.infer<typeof schema>

export function LoginPage() {
  const navigate = useNavigate()
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [identificador, setIdentificador] = useState('')

  const { register, handleSubmit, formState, setValue } = useForm<Formulario>({
    resolver: zodResolver(schema),
    defaultValues: { identificador: '', senha: '', manterConectado: true },
  })

  const tipo = detectarTipo(identificador)
  const aceitos = configAcesso.identificadores.map((i) => rotuloIdentificador[i])

  const enviar = handleSubmit(async ({ identificador: id, senha }) => {
    setErroGeral(null)
    try {
      const { exigeSegundoFator } = await login(id, senha)
      // Quem decide se há segundo fator é o servidor. A tela só obedece.
      navigate(exigeSegundoFator && configAcesso.segundoFator ? '/verificacao' : '/')
    } catch {
      // Mensagem única: não distingue identificador de senha, nem diz se a
      // conta existe — senão o login vira um verificador de cadastro.
      setErroGeral('Não foi possível entrar. Confira seus dados e tente de novo.')
    }
  })

  return (
    <AuthCard
      titulo="Entrar"
      descricao={`Acesse com ${aceitos.slice(0, -1).join(', ')} ou ${aceitos.at(-1)}.`}
      rodape={
        configAcesso.autoCadastro ? (
          <>
            Ainda não tem conta?{' '}
            <Link to="/cadastro" className="font-medium text-primary hover:underline">Criar conta</Link>
          </>
        ) : (
          <span className="text-text-muted">Acesso restrito a usuários cadastrados pelo administrador.</span>
        )
      }
    >
      <form onSubmit={enviar} noValidate className="space-y-4">
        {erroGeral && (
          <p role="alert" className="flex items-start gap-2 rounded-lg border border-critical/30 bg-critical/10 px-3 py-2.5 text-[13px] text-critical">
            <span aria-hidden>⚠️</span>
            {erroGeral}
          </p>
        )}

        {/* UM campo para as três formas: o tipo é detectado pelo formato.
            Três campos (ou um seletor "entrar com…") fazem a pessoa declarar
            o que ela acabou de digitar. */}
        <div className="relative">
          <Input
            label="E-mail, telefone ou CPF"
            inputMode={tipo === 'email' || tipo === null ? 'text' : 'numeric'}
            autoComplete="username"
            placeholder="voce@empresa.com.br"
            error={formState.errors.identificador?.message}
            value={identificador}
            onChange={(e) => {
              const formatado = formatarIdentificador(e.target.value)
              setIdentificador(formatado)
              setValue('identificador', formatado, { shouldValidate: false })
            }}
          />
          {tipo && (
            <span className="pointer-events-none absolute right-3 top-[2.15rem] rounded-md bg-surface-3 px-1.5 py-0.5 text-[11px] font-medium text-text-muted">
              {rotuloIdentificador[tipo]}
            </span>
          )}
        </div>

        <Input
          label="Senha"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          error={formState.errors.senha?.message}
          acao={
            <Link to="/recuperar-senha" className="text-[13px] font-medium text-primary hover:underline">
              Esqueci minha senha
            </Link>
          }
          {...register('senha')}
        />

        {/* "Manter conectado" muda o prazo do refresh, decidido no servidor —
            nunca o prazo do access token. */}
        <Checkbox label="Manter conectado neste dispositivo" {...register('manterConectado')} />

        <Button type="submit" size="lg" block loading={formState.isSubmitting}>Entrar</Button>

        <p className="text-center text-[12px] text-text-muted">
          Demonstração: qualquer senha com 6+ caracteres entra.
        </p>
      </form>
    </AuthCard>
  )
}
