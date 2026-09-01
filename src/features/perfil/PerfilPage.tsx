import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  alterarSenha, alternarSegundoFator, encerrarOutrasSessoes, encerrarSessao,
  gerarCodigosRecuperacao, listarAcessos, listarNotificacoesPerfil, listarSessoes,
  obterPerfil, salvarNotificacoes, salvarPerfil,
} from '@/shared/api/perfil'
import type { AcessoRegistrado, CanalNotificacao, PreferenciaNotificacao, SessaoAtiva } from '@/shared/api/types'
import { Avatar } from '@/shared/ui/Avatar'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card, CardBody, CardHeader } from '@/shared/ui/Card'
import { ConfirmarAcao } from '@/shared/ui/ConfirmarAcao'
import { Input, Select } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Skeleton } from '@/shared/ui/Skeleton'
import { cn } from '@/shared/lib/cn'
import { datetime, mascaraTelefoneBr, timeAgo } from '@/shared/lib/format'
import { useUi } from '@/store/ui'
import type { ThemeChoice } from '@/shared/lib/ui-prefs'

const ABAS = [
  { id: 'dados', rotulo: 'Dados pessoais', icone: '👤' },
  { id: 'preferencias', rotulo: 'Preferências', icone: '⚙️' },
  { id: 'notificacoes', rotulo: 'Notificações', icone: '🔔' },
  { id: 'seguranca', rotulo: 'Segurança', icone: '🔐' },
  { id: 'atividade', rotulo: 'Sessões e acessos', icone: '🖥️' },
] as const
type AbaId = (typeof ABAS)[number]['id']

const CANAIS: { id: CanalNotificacao; rotulo: string; icone: string }[] = [
  { id: 'email', rotulo: 'E-mail', icone: '✉️' },
  { id: 'whatsapp', rotulo: 'WhatsApp', icone: '💬' },
  { id: 'push', rotulo: 'No sistema', icone: '🔔' },
]

const resultadoAcesso: Record<AcessoRegistrado['resultado'], { tom: 'good' | 'warning' | 'critical'; rotulo: string }> = {
  sucesso: { tom: 'good', rotulo: 'Entrou' },
  senha_incorreta: { tom: 'warning', rotulo: 'Senha incorreta' },
  segundo_fator_falhou: { tom: 'warning', rotulo: 'Falhou no 2º fator' },
  bloqueado: { tom: 'critical', rotulo: 'Bloqueado' },
}

/** Medidor honesto: comprimento pesa mais que "tem símbolo" — é o que a pesquisa mostra. */
function forcaSenha(senha: string) {
  if (!senha) return { nivel: 0, rotulo: '', classe: '' }
  let pontos = 0
  if (senha.length >= 8) pontos++
  if (senha.length >= 12) pontos++
  if (senha.length >= 16) pontos++
  if (/[^A-Za-z0-9]/.test(senha) || (/[A-Z]/.test(senha) && /[0-9]/.test(senha))) pontos++
  const escala = [
    { rotulo: 'Muito fraca', classe: 'bg-critical' },
    { rotulo: 'Fraca', classe: 'bg-critical' },
    { rotulo: 'Razoável', classe: 'bg-warning' },
    { rotulo: 'Boa', classe: 'bg-good' },
    { rotulo: 'Forte', classe: 'bg-good' },
  ]
  return { nivel: pontos, ...escala[pontos] }
}

const schemaDados = z.object({
  nome: z.string().min(3, 'Informe o nome completo'),
  email: z.string().email('E-mail inválido'),
  telefone: z.string().transform((v) => v.replace(/\D/g, '')).refine((v) => v.length >= 10, 'Telefone incompleto'),
  cargo: z.string().optional().default(''),
  bio: z.string().max(200, 'Máximo de 200 caracteres').optional().default(''),
})
type FormDados = z.infer<typeof schemaDados>

const schemaSenha = z
  .object({
    atual: z.string().min(1, 'Informe a senha atual'),
    nova: z.string().min(8, 'Mínimo de 8 caracteres'),
    confirmacao: z.string(),
  })
  .refine((d) => d.nova === d.confirmacao, { path: ['confirmacao'], message: 'As senhas não conferem' })
type FormSenha = z.infer<typeof schemaSenha>

export function PerfilPage() {
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const aba = (params.get('aba') ?? 'dados') as AbaId

  const tema = useUi((s) => s.theme)
  const setTheme = useUi((s) => s.setTheme)

  const [salvo, setSalvo] = useState(false)
  const [erroSenha, setErroSenha] = useState<string | null>(null)
  const [senhaTrocada, setSenhaTrocada] = useState(false)
  const [encerrando, setEncerrando] = useState<SessaoAtiva | null>(null)
  const [encerrarTodas, setEncerrarTodas] = useState(false)
  const [codigos, setCodigos] = useState<string[] | null>(null)
  const [notificacoes, setNotificacoes] = useState<PreferenciaNotificacao[] | null>(null)

  const { data: perfil, isLoading } = useQuery({ queryKey: ['perfil'], queryFn: obterPerfil })
  const { data: prefsServidor } = useQuery({ queryKey: ['perfil-notificacoes'], queryFn: listarNotificacoesPerfil })
  const { data: sessoes } = useQuery({ queryKey: ['perfil-sessoes'], queryFn: listarSessoes })
  const { data: acessos } = useQuery({ queryKey: ['perfil-acessos'], queryFn: listarAcessos })

  useEffect(() => { if (prefsServidor) setNotificacoes(prefsServidor.map((n) => ({ ...n, canais: { ...n.canais } }))) }, [prefsServidor])

  const formDados = useForm<FormDados>({ resolver: zodResolver(schemaDados) })
  const formSenha = useForm<FormSenha>({ resolver: zodResolver(schemaSenha) })

  useEffect(() => {
    if (perfil) {
      formDados.reset({
        nome: perfil.nome,
        email: perfil.email,
        telefone: mascaraTelefoneBr(perfil.telefone),
        cargo: perfil.cargo,
        bio: perfil.bio,
      })
    }
  }, [perfil]) // eslint-disable-line react-hooks/exhaustive-deps

  const salvarDados = useMutation({
    mutationFn: (dados: FormDados) => salvarPerfil(dados),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['perfil'] })
      setSalvo(true)
      setTimeout(() => setSalvo(false), 2600)
    },
  })

  const trocarSenha = useMutation({
    mutationFn: (dados: FormSenha) => alterarSenha(dados.atual, dados.nova),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['perfil'] })
      formSenha.reset()
      setErroSenha(null)
      setSenhaTrocada(true)
      setTimeout(() => setSenhaTrocada(false), 3000)
    },
    onError: (e: Error) => setErroSenha(e.message),
  })

  const salvarPrefs = useMutation({
    mutationFn: (novas: PreferenciaNotificacao[]) => salvarNotificacoes(novas),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['perfil-notificacoes'] }),
  })

  const encerrar = useMutation({
    mutationFn: encerrarSessao,
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['perfil-sessoes'] }); setEncerrando(null) },
  })
  const encerrarOutras = useMutation({
    mutationFn: encerrarOutrasSessoes,
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['perfil-sessoes'] }); setEncerrarTodas(false) },
  })
  const novosCodigos = useMutation({ mutationFn: gerarCodigosRecuperacao, onSuccess: (lista) => setCodigos(lista) })
  const toggle2fa = useMutation({
    mutationFn: alternarSegundoFator,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['perfil'] }),
  })

  const novaSenha = formSenha.watch('nova') ?? ''
  const forca = forcaSenha(novaSenha)

  const prefsMudaram =
    notificacoes && prefsServidor
      ? JSON.stringify(notificacoes.map((n) => n.canais)) !== JSON.stringify(prefsServidor.map((n) => n.canais))
      : false

  const alternarCanal = (evento: string, canal: CanalNotificacao) => {
    setNotificacoes((atual) =>
      atual?.map((n) => (n.evento === evento ? { ...n, canais: { ...n.canais, [canal]: !n.canais[canal] } } : n)) ?? null,
    )
  }

  if (isLoading || !perfil) {
    return <div className="space-y-4"><Skeleton className="h-8 w-56" /><Skeleton className="h-72 w-full rounded-xl" /></div>
  }

  return (
    <div className="space-y-2 sm:space-y-4 lg:space-y-6">
      <PageHeader titulo="Meu perfil" descricao="Seus dados, preferências, notificações e a segurança da sua conta." />

      {/* Cartão de identidade + os sinais que importam de imediato */}
      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar nome={perfil.nome} size="lg" className="h-16 w-16 text-lg" />
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold tracking-tight text-text">{perfil.nome}</h2>
              <p className="truncate text-[13px] text-text-muted">{perfil.cargo} · {perfil.email}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge tom={perfil.emailVerificado ? 'good' : 'warning'}>
                  {perfil.emailVerificado ? 'E-mail verificado' : 'E-mail não verificado'}
                </Badge>
                <Badge tom={perfil.telefoneVerificado ? 'good' : 'warning'}>
                  {perfil.telefoneVerificado ? 'Telefone verificado' : 'Telefone não verificado'}
                </Badge>
                <Badge tom={perfil.segundoFatorAtivo ? 'good' : 'critical'}>
                  {perfil.segundoFatorAtivo ? '2FA ativo' : '2FA desligado'}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Button variant="secondary" size="sm">Trocar foto</Button>
            {!perfil.telefoneVerificado && <Button size="sm">Verificar telefone</Button>}
          </div>
        </CardBody>
      </Card>

      <div role="tablist" aria-label="Seções do perfil" className="flex flex-wrap items-center gap-1 border-b border-border">
        {ABAS.map((item) => {
          const ativa = aba === item.id
          return (
            <button
              key={item.id}
              role="tab"
              aria-selected={ativa}
              onClick={() => setParams({ aba: item.id }, { replace: true })}
              className={cn(
                '-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors',
                ativa ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:border-border-strong hover:text-text',
              )}
            >
              <span aria-hidden>{item.icone}</span>
              {item.rotulo}
            </button>
          )
        })}
      </div>

      {aba === 'dados' && (
        <Card>
          <CardHeader titulo="Dados pessoais" descricao="Como você aparece para o restante da equipe" />
          <CardBody>
            <form onSubmit={formDados.handleSubmit((d) => salvarDados.mutate(d))} noValidate className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 lg:gap-6">
                <Input label="Nome completo" error={formDados.formState.errors.nome?.message} {...formDados.register('nome')} />
                <Input
                  label="E-mail"
                  type="email"
                  hint={perfil.emailVerificado ? undefined : 'Confirme o e-mail para receber alertas de segurança.'}
                  error={formDados.formState.errors.email?.message}
                  {...formDados.register('email')}
                />
                <Input
                  label="Telefone"
                  inputMode="numeric"
                  error={formDados.formState.errors.telefone?.message}
                  {...formDados.register('telefone', {
                    onChange: (e) => formDados.setValue('telefone', mascaraTelefoneBr(e.target.value), { shouldDirty: true }),
                  })}
                />
                <Input label="Cargo" {...formDados.register('cargo')} />
                <Input
                  label="Sobre você"
                  className="sm:col-span-2"
                  hint="Aparece para a equipe em menções e atribuições. Máximo de 200 caracteres."
                  error={formDados.formState.errors.bio?.message}
                  {...formDados.register('bio')}
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
                <Button type="submit" loading={salvarDados.isPending} disabled={!formDados.formState.isDirty}>
                  Salvar alterações
                </Button>
                <Button type="button" variant="ghost" onClick={() => formDados.reset()} disabled={!formDados.formState.isDirty}>
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

      {aba === 'preferencias' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-4 lg:gap-6">
          <Card>
            <CardHeader titulo="Aparência" descricao="Guardado neste navegador (ui-prefs) — o token nunca" />
            <CardBody className="space-y-2">
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
            </CardBody>
          </Card>

          <Card>
            <CardHeader titulo="Região e idioma" descricao="Afeta datas, números e a página que abre no login" />
            <CardBody className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 lg:gap-6">
              <Select label="Fuso horário" defaultValue={perfil.fuso}>
                <option value="America/Sao_Paulo">Brasília (GMT-3)</option>
                <option value="America/Manaus">Manaus (GMT-4)</option>
                <option value="America/Rio_Branco">Rio Branco (GMT-5)</option>
              </Select>
              <Select label="Idioma" defaultValue={perfil.idioma}>
                <option value="pt-BR">Português (Brasil)</option>
                <option value="en-US">English (US)</option>
                <option value="es-ES">Español</option>
              </Select>
              <Select label="Formato de data" defaultValue={perfil.formatoData}>
                <option value="dd/MM/yyyy">31/08/2026</option>
                <option value="yyyy-MM-dd">2026-08-31</option>
                <option value="MM/dd/yyyy">08/31/2026</option>
              </Select>
              <Select label="Página inicial" defaultValue={perfil.paginaInicial}>
                <option value="/">Dashboard</option>
                <option value="/clientes">Clientes</option>
                <option value="/financeiro/contas">Contas a pagar e receber</option>
              </Select>
            </CardBody>
          </Card>
        </div>
      )}

      {aba === 'notificacoes' && (
        <Card>
          <CardHeader
            titulo="Por onde falar com você"
            descricao="Um canal por tipo de evento — os canais disponíveis dependem do que está configurado em Comunicação"
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2/60">
                  <th className="px-4 py-2.5 text-left text-[12px] font-semibold uppercase tracking-wide text-text-muted">Evento</th>
                  {CANAIS.map((canal) => (
                    <th key={canal.id} className="px-3 py-2.5 text-center text-[12px] font-semibold uppercase tracking-wide text-text-muted">
                      <span aria-hidden className="mr-1">{canal.icone}</span>{canal.rotulo}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {notificacoes?.map((pref) => (
                  <tr key={pref.evento} className="border-b border-border/60 transition-colors last:border-0 hover:bg-surface-2">
                    <th scope="row" className="px-4 py-3 text-left font-normal">
                      <span className="flex items-center gap-2 text-[13px] font-medium text-text">
                        {pref.rotulo}
                        {pref.obrigatorio && <Badge tom="info">Sempre por e-mail</Badge>}
                      </span>
                      <span className="mt-0.5 block text-[12px] text-text-muted">{pref.descricao}</span>
                    </th>
                    {CANAIS.map((canal) => {
                      // Alerta de segurança não se desliga do e-mail: é o aviso
                      // de que alguém entrou na conta.
                      const travado = pref.obrigatorio && canal.id === 'email'
                      return (
                        <td key={canal.id} className="px-3 py-3 text-center">
                          <label className="mx-auto flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-surface-3">
                            <span className="sr-only">{`${pref.rotulo} por ${canal.rotulo}`}</span>
                            <input
                              type="checkbox"
                              checked={pref.canais[canal.id]}
                              disabled={travado}
                              onChange={() => alternarCanal(pref.evento, canal.id)}
                              className="h-4 w-4 cursor-pointer rounded border-border-strong accent-[rgb(var(--primary))] disabled:cursor-not-allowed disabled:opacity-50"
                            />
                          </label>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {prefsMudaram && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface-2/40 px-4 py-3">
              <p className="text-[13px] text-text-secondary">Preferências de notificação alteradas.</p>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => setNotificacoes(prefsServidor?.map((n) => ({ ...n, canais: { ...n.canais } })) ?? null)}>
                  Descartar
                </Button>
                <Button loading={salvarPrefs.isPending} onClick={() => notificacoes && salvarPrefs.mutate(notificacoes)}>
                  Salvar preferências
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {aba === 'seguranca' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 sm:gap-4 lg:gap-6">
          <Card className="lg:col-span-2">
            <CardHeader
              titulo="Senha"
              descricao={`Alterada ${timeAgo(perfil.senhaAlteradaEm)}`}
            />
            <CardBody>
              <form onSubmit={formSenha.handleSubmit((d) => trocarSenha.mutate(d))} noValidate className="space-y-4">
                {erroSenha && (
                  <p role="alert" className="flex items-start gap-2 rounded-lg border border-critical/30 bg-critical/10 px-3 py-2.5 text-[13px] text-critical">
                    <span aria-hidden>⚠️</span>{erroSenha}
                  </p>
                )}
                {senhaTrocada && (
                  <p role="status" className="flex items-start gap-2 rounded-lg border border-good/30 bg-good/10 px-3 py-2.5 text-[13px] text-good">
                    <span aria-hidden>✔</span> Senha alterada. As outras sessões continuam ativas — encerre-as na aba ao lado se preferir.
                  </p>
                )}

                {/* Senha atual mesmo com sessão válida: navegador esquecido
                    aberto não pode virar troca de dono da conta. */}
                <Input
                  label="Senha atual"
                  type="password"
                  autoComplete="current-password"
                  error={formSenha.formState.errors.atual?.message}
                  {...formSenha.register('atual')}
                />

                <div className="space-y-2">
                  <Input
                    label="Nova senha"
                    type="password"
                    autoComplete="new-password"
                    hint="Comprimento vale mais que símbolo: uma frase longa é mais forte que 8 caracteres embaralhados."
                    error={formSenha.formState.errors.nova?.message}
                    {...formSenha.register('nova')}
                  />
                  {novaSenha && (
                    <div className="flex items-center gap-2">
                      <span className="flex h-1.5 flex-1 gap-1">
                        {[0, 1, 2, 3].map((i) => (
                          <span key={i} className={cn('h-full flex-1 rounded-full', i < forca.nivel ? forca.classe : 'bg-surface-3')} />
                        ))}
                      </span>
                      <span className="w-24 text-right text-[12px] font-medium text-text-secondary">{forca.rotulo}</span>
                    </div>
                  )}
                </div>

                <Input
                  label="Confirmar nova senha"
                  type="password"
                  autoComplete="new-password"
                  error={formSenha.formState.errors.confirmacao?.message}
                  {...formSenha.register('confirmacao')}
                />

                <div className="border-t border-border pt-4">
                  <Button type="submit" loading={trocarSenha.isPending}>Alterar senha</Button>
                </div>
              </form>
            </CardBody>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader titulo="Verificação em duas etapas" />
              <CardBody className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge tom={perfil.segundoFatorAtivo ? 'good' : 'critical'}>
                    {perfil.segundoFatorAtivo ? 'Ativo' : 'Desligado'}
                  </Badge>
                  {perfil.segundoFatorAtivo && (
                    <span className="text-[12px] text-text-muted">app autenticador</span>
                  )}
                </div>
                <p className="text-[13px] leading-relaxed text-text-secondary">
                  Um código a mais no login. É a única proteção que continua valendo depois de a senha
                  vazar em outro site.
                </p>
                <Button
                  variant={perfil.segundoFatorAtivo ? 'secondary' : 'primary'}
                  block
                  loading={toggle2fa.isPending}
                  onClick={() => toggle2fa.mutate(!perfil.segundoFatorAtivo)}
                >
                  {perfil.segundoFatorAtivo ? 'Desativar 2FA' : 'Ativar 2FA'}
                </Button>
              </CardBody>
            </Card>

            <Card>
              <CardHeader titulo="Códigos de recuperação" />
              <CardBody className="space-y-3">
                <p className="text-[13px] text-text-secondary">
                  Restam <strong className="text-text">{perfil.codigosRecuperacaoRestantes}</strong> códigos.
                  Servem para entrar quando o celular do autenticador some.
                </p>
                <Button variant="secondary" block loading={novosCodigos.isPending} onClick={() => novosCodigos.mutate()}>
                  Gerar novos códigos
                </Button>
                <p className="text-[12px] text-text-muted">Gerar novos invalida os antigos na hora.</p>
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {aba === 'atividade' && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              titulo="Sessões ativas"
              descricao="Onde sua conta está conectada agora"
              acoes={
                (sessoes?.length ?? 0) > 1 ? (
                  <Button size="sm" variant="secondary" onClick={() => setEncerrarTodas(true)}>
                    Encerrar as outras
                  </Button>
                ) : undefined
              }
            />
            <ul className="divide-y divide-border">
              {sessoes?.map((sessao) => (
                <li key={sessao.id} className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 sm:px-5">
                  <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-base">
                    {sessao.sistema.includes('iOS') || sessao.sistema.includes('Android') ? '📱' : '💻'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-[13px] font-medium text-text">
                      {sessao.dispositivo}
                      {sessao.atual && <Badge tom="good">Sessão atual</Badge>}
                    </p>
                    <p className="truncate text-[12px] text-text-muted">
                      {sessao.navegador} · {sessao.sistema} · {sessao.local} · {sessao.ip}
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-[12px] text-text-muted">{timeAgo(sessao.ultimaAtividade)}</span>
                  {/* A sessão atual não se encerra por aqui: derrubar a si
                      mesmo confunde mais do que protege. O caminho é "Sair". */}
                  {!sessao.atual && (
                    <Button size="sm" variant="ghost" onClick={() => setEncerrando(sessao)}>Encerrar</Button>
                  )}
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader titulo="Histórico de acesso" descricao="Tentativas recentes, inclusive as que falharam" />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-2/60 text-[12px] uppercase tracking-wide text-text-muted">
                    <th className="px-4 py-2.5 text-left font-semibold">Quando</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Origem</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Dispositivo</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {acessos?.map((acesso) => {
                    const info = resultadoAcesso[acesso.resultado]
                    return (
                      <tr key={acesso.id} className="border-b border-border/60 transition-colors last:border-0 hover:bg-surface-2">
                        <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-text-secondary">{datetime(acesso.data)}</td>
                        <td className="px-3 py-2.5 text-text-secondary">{acesso.local} · <span className="font-mono text-[12px]">{acesso.ip}</span></td>
                        <td className="px-3 py-2.5 text-text-secondary">{acesso.dispositivo}</td>
                        <td className="px-4 py-2.5 text-right"><Badge tom={info.tom}>{info.rotulo}</Badge></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="border-t border-border px-4 py-3 text-[12px] text-text-muted">
              Tentativa que falhou também entra aqui — é o que permite perceber alguém insistindo na sua
              conta antes de conseguir entrar.
            </p>
          </Card>
        </div>
      )}

      <ConfirmarAcao
        aberto={!!encerrando}
        titulo="Encerrar sessão"
        rotuloConfirmar="Encerrar sessão"
        carregando={encerrar.isPending}
        onCancelar={() => setEncerrando(null)}
        onConfirmar={() => encerrando && encerrar.mutate(encerrando.id)}
        mensagem={
          <>
            <strong className="font-semibold text-text">{encerrando?.dispositivo}</strong> ({encerrando?.local}) será
            desconectado e precisará entrar de novo com senha e segundo fator.
          </>
        }
      />

      <ConfirmarAcao
        aberto={encerrarTodas}
        titulo="Encerrar as outras sessões"
        rotuloConfirmar="Encerrar as outras"
        carregando={encerrarOutras.isPending}
        onCancelar={() => setEncerrarTodas(false)}
        onConfirmar={() => encerrarOutras.mutate()}
        mensagem="Todos os outros dispositivos serão desconectados. Esta sessão continua aberta."
      />

      <Modal
        aberto={!!codigos}
        titulo="Novos códigos de recuperação"
        descricao="Guarde agora: eles não são exibidos de novo."
        onFechar={() => setCodigos(null)}
        rodape={<Button onClick={() => setCodigos(null)} data-foco-inicial>Guardei os códigos</Button>}
      >
        <div className="grid grid-cols-2 gap-2">
          {codigos?.map((codigo) => (
            <span key={codigo} className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-center font-mono text-[13px] text-text">
              {codigo}
            </span>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-text-muted">
          Cada código serve uma vez. Os antigos deixaram de valer no momento em que estes foram gerados.
        </p>
      </Modal>
    </div>
  )
}
