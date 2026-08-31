import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Avatar } from '@/shared/ui/Avatar'
import { Button } from '@/shared/ui/Button'
import { Card, CardBody, CardHeader } from '@/shared/ui/Card'
import { Checkbox, Input, Select } from '@/shared/ui/Field'
import { PageHeader } from '@/shared/ui/PageHeader'
import { cn } from '@/shared/lib/cn'
import { useUi } from '@/store/ui'
import type { ThemeChoice } from '@/shared/lib/ui-prefs'

const schema = z.object({
  nome: z.string().min(3, 'Informe o nome completo'),
  email: z.string().email('E-mail inválido'),
  telefone: z.string().optional(),
  cargo: z.string().optional(),
  fuso: z.string(),
})
type Formulario = z.infer<typeof schema>

const ABAS = [
  { id: 'dados', rotulo: 'Dados pessoais' },
  { id: 'preferencias', rotulo: 'Preferências' },
  { id: 'seguranca', rotulo: 'Segurança' },
] as const

export function PerfilPage() {
  const [params, setParams] = useSearchParams()
  const abaAtual = (params.get('aba') ?? 'dados') as (typeof ABAS)[number]['id']
  const [salvo, setSalvo] = useState(false)

  const tema = useUi((s) => s.theme)
  const setTheme = useUi((s) => s.setTheme)

  const { register, handleSubmit, formState, reset } = useForm<Formulario>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: 'Paulo Roberto da Silva',
      email: 'paulo@softemp.com.br',
      telefone: '(48) 99999-0000',
      cargo: 'Administrador',
      fuso: 'America/Sao_Paulo',
    },
  })

  const salvar = handleSubmit(async (valores) => {
    await new Promise((r) => setTimeout(r, 800))
    reset(valores)
    setSalvo(true)
    setTimeout(() => setSalvo(false), 2600)
  })

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader titulo="Perfil" descricao="Seus dados, preferências de interface e acesso." />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[16rem_1fr] lg:gap-5">
        <Card className="h-fit">
          <CardBody className="flex flex-col items-center gap-3 text-center">
            <Avatar nome="Paulo Roberto" size="lg" className="h-16 w-16 text-lg" />
            <div>
              <p className="font-semibold text-text">Paulo Roberto</p>
              <p className="text-[13px] text-text-muted">Administrador</p>
            </div>
            <Button variant="secondary" size="sm" block>Trocar foto</Button>
          </CardBody>
          <nav aria-label="Seções do perfil" className="border-t border-border p-2">
            {ABAS.map((aba) => (
              <button
                key={aba.id}
                type="button"
                onClick={() => setParams({ aba: aba.id }, { replace: true })}
                className={cn(
                  'w-full rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors',
                  abaAtual === aba.id ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:bg-surface-2 hover:text-text',
                )}
              >
                {aba.rotulo}
              </button>
            ))}
          </nav>
        </Card>

        <div className="space-y-4">
          {abaAtual === 'dados' && (
            <Card>
              <CardHeader titulo="Dados pessoais" descricao="Como você aparece para o restante da equipe." />
              <CardBody>
                <form onSubmit={salvar} noValidate className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Input label="Nome completo" error={formState.errors.nome?.message} {...register('nome')} />
                    <Input label="E-mail" type="email" error={formState.errors.email?.message} {...register('email')} />
                    <Input label="Telefone" {...register('telefone')} />
                    <Input label="Cargo" {...register('cargo')} />
                    <Select label="Fuso horário" {...register('fuso')}>
                      <option value="America/Sao_Paulo">Brasília (GMT-3)</option>
                      <option value="America/Manaus">Manaus (GMT-4)</option>
                      <option value="America/Rio_Branco">Rio Branco (GMT-5)</option>
                    </Select>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
                    <Button type="submit" loading={formState.isSubmitting} disabled={!formState.isDirty}>
                      Salvar alterações
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => reset()} disabled={!formState.isDirty}>
                      Descartar
                    </Button>
                    {salvo && (
                      <span role="status" className="flex items-center gap-1.5 text-[13px] font-medium text-good">
                        <span aria-hidden>✔</span> Alterações salvas
                      </span>
                    )}
                  </div>
                </form>
              </CardBody>
            </Card>
          )}

          {abaAtual === 'preferencias' && (
            <Card>
              <CardHeader titulo="Preferências de interface" descricao="Ficam guardadas neste navegador (ui-prefs) — token nunca." />
              <CardBody className="space-y-5">
                <div className="space-y-2">
                  <p className="text-[13px] font-medium text-text-secondary">Tema</p>
                  <div className="flex flex-wrap gap-2">
                    {([
                      { id: 'light', rotulo: '☀️ Claro' },
                      { id: 'dark', rotulo: '🌙 Escuro' },
                      { id: 'system', rotulo: '🖥️ Do sistema' },
                    ] as { id: ThemeChoice; rotulo: string }[]).map((op) => (
                      <button
                        key={op.id}
                        type="button"
                        onClick={() => setTheme(op.id)}
                        aria-pressed={tema === op.id}
                        className={cn(
                          'rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors',
                          tema === op.id
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-text-secondary hover:bg-surface-2 hover:text-text',
                        )}
                      >
                        {op.rotulo}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2.5 border-t border-border pt-4">
                  <p className="text-[13px] font-medium text-text-secondary">Notificações</p>
                  <Checkbox label="Avisar por e-mail sobre inadimplência" defaultChecked />
                  <Checkbox label="Resumo semanal de desempenho" defaultChecked />
                  <Checkbox label="Alertas de falha em integração" />
                </div>
              </CardBody>
            </Card>
          )}

          {abaAtual === 'seguranca' && (
            <Card>
              <CardHeader titulo="Segurança" descricao="Senha, sessões e segundo fator." />
              <CardBody className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input label="Senha atual" type="password" autoComplete="current-password" />
                  <div className="hidden sm:block" />
                  <Input label="Nova senha" type="password" autoComplete="new-password" hint="Mínimo de 8 caracteres." />
                  <Input label="Confirmar nova senha" type="password" autoComplete="new-password" />
                </div>
                <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3.5">
                  <div>
                    <p className="text-[13px] font-semibold text-text">Autenticação em duas etapas</p>
                    <p className="text-[13px] text-text-muted">Um código extra no login, pelo aplicativo autenticador.</p>
                  </div>
                  <Button variant="secondary" size="sm">Ativar</Button>
                </div>
                <div className="border-t border-border pt-4">
                  <Button>Atualizar senha</Button>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
