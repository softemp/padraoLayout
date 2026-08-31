import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { destinosRecuperacao, enviarRecuperacao } from '@/shared/api/api'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Field'
import { cn } from '@/shared/lib/cn'
import { canais, configAcesso, type CanalRecuperacao } from '@/app/auth-config'
import { formatarIdentificador } from '@/shared/lib/identificador'
import { AuthCard } from './AuthLayout'

const schema = z.object({ identificador: z.string().min(1, 'Informe seu acesso') })
type Formulario = z.infer<typeof schema>

type Etapa = 'identificar' | 'escolher' | 'enviado'

/**
 * Recuperação em três passos: quem é você → por onde prefere receber → pronto.
 *
 * A escolha de canal existe porque nem todo mundo tem acesso ao e-mail que
 * cadastrou. Os destinos vêm MASCARADOS do servidor: a tela confirma o canal
 * sem revelar e-mail e telefone de terceiros a quem só digitou um CPF.
 */
export function ForgotPasswordPage() {
  const [etapa, setEtapa] = useState<Etapa>('identificar')
  const [destinos, setDestinos] = useState<Record<CanalRecuperacao, string> | null>(null)
  const [canalEscolhido, setCanal] = useState<CanalRecuperacao>(configAcesso.canaisRecuperacao[0])
  const [enviando, setEnviando] = useState(false)
  const [identificador, setIdentificador] = useState('')

  const { handleSubmit, formState, setValue } = useForm<Formulario>({ resolver: zodResolver(schema) })

  const identificar = handleSubmit(async ({ identificador: id }) => {
    setDestinos(await destinosRecuperacao(id))
    setEtapa('escolher')
  })

  const enviar = async () => {
    setEnviando(true)
    try {
      await enviarRecuperacao(identificador, canalEscolhido)
      setEtapa('enviado')
    } finally {
      setEnviando(false)
    }
  }

  const disponiveis = configAcesso.canaisRecuperacao

  return (
    <AuthCard
      titulo={etapa === 'enviado' ? 'Link enviado' : 'Recuperar senha'}
      descricao={
        etapa === 'identificar'
          ? 'Informe o e-mail, telefone ou CPF da sua conta.'
          : etapa === 'escolher'
            ? 'Escolha por onde prefere receber o link de redefinição.'
            : 'Se existir uma conta com esses dados, o link chega em instantes.'
      }
      rodape={<Link to="/login" className="font-medium text-primary hover:underline">← Voltar para o login</Link>}
    >
      {etapa === 'identificar' && (
        <form onSubmit={identificar} noValidate className="space-y-4">
          <Input
            label="E-mail, telefone ou CPF"
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
          <Button type="submit" size="lg" block loading={formState.isSubmitting}>Continuar</Button>
        </form>
      )}

      {etapa === 'escolher' && (
        <div className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="sr-only">Canal de recuperação</legend>
            {disponiveis.map((canal) => {
              const info = canais[canal]
              const escolhido = canalEscolhido === canal
              return (
                <label
                  key={canal}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors',
                    escolhido ? 'border-primary bg-primary/[0.06]' : 'border-border hover:bg-surface-2',
                  )}
                >
                  <input
                    type="radio"
                    name="canal"
                    value={canal}
                    checked={escolhido}
                    onChange={() => setCanal(canal)}
                    className="mt-0.5 h-4 w-4 accent-[rgb(var(--primary))]"
                  />
                  <span aria-hidden className="text-lg leading-none">{info.icone}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-text">{info.rotulo}</span>
                    <span className="block text-[13px] text-text-muted">{info.descricao}</span>
                    {destinos && (
                      <span className="mt-1 block font-mono text-[12px] text-text-secondary">{destinos[canal]}</span>
                    )}
                  </span>
                </label>
              )
            })}
          </fieldset>

          <Button size="lg" block loading={enviando} onClick={() => void enviar()}>
            Enviar link por {canais[canalEscolhido].rotulo}
          </Button>
          <Button variant="ghost" block onClick={() => setEtapa('identificar')} disabled={enviando}>
            Usar outros dados
          </Button>
        </div>
      )}

      {etapa === 'enviado' && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-surface-2 px-4 py-3.5 text-[13px] text-text-secondary">
            <p>
              Enviamos por <span className="font-semibold text-text">{canais[canalEscolhido].rotulo}</span>
              {destinos && <> para <span className="font-mono text-text">{destinos[canalEscolhido]}</span></>}.
              O link vale por 30 minutos e para de funcionar assim que for usado.
            </p>
          </div>
          {/* Resposta idêntica para conta existente ou não: a recuperação não
              pode virar um verificador de cadastro. */}
          <p className="text-[12px] text-text-muted">
            Não recebeu? Confira o spam (no caso do e-mail) ou tente por outro canal em alguns minutos.
          </p>
          <Button variant="secondary" block onClick={() => setEtapa('escolher')}>Tentar por outro canal</Button>
        </div>
      )}
    </AuthCard>
  )
}
