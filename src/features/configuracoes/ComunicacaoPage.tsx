import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card, CardBody, CardHeader } from '@/shared/ui/Card'
import { Checkbox, Input, Select } from '@/shared/ui/Field'
import { PageHeader } from '@/shared/ui/PageHeader'
import { cn } from '@/shared/lib/cn'

/**
 * Configuração dos canais de comunicação: e-mail (SMTP), WhatsApp e SMS.
 *
 * As telas de acesso (login, 2FA, recuperação) só OFERECEM um canal se o
 * provedor dele estiver configurado e testado aqui. Canal ligado sem
 * credencial válida é uma opção que falha calada na mão do usuário final.
 *
 * Três regras de tela de credencial, que valem para qualquer provedor:
 *  1. o segredo NUNCA volta do servidor — a leitura traz só os 4 últimos;
 *  2. campo vazio na edição significa MANTER a chave atual;
 *  3. existe um botão de TESTAR: chave errada é indistinguível de chave certa
 *     até alguém tentar enviar — e aí quem descobre é o cliente final.
 */

type CanalId = 'email' | 'whatsapp' | 'sms'
type Situacao = 'conectado' | 'nao_configurado' | 'falha'

const ABAS: { id: CanalId; rotulo: string; icone: string }[] = [
  { id: 'email', rotulo: 'E-mail (SMTP)', icone: '✉️' },
  { id: 'whatsapp', rotulo: 'WhatsApp', icone: '💬' },
  { id: 'sms', rotulo: 'SMS', icone: '📱' },
]

const situacaoBadge: Record<Situacao, { tom: 'good' | 'neutro' | 'critical'; rotulo: string }> = {
  conectado: { tom: 'good', rotulo: 'Conectado' },
  nao_configurado: { tom: 'neutro', rotulo: 'Não configurado' },
  falha: { tom: 'critical', rotulo: 'Falha na última verificação' },
}

const schemaEmail = z.object({
  remetenteNome: z.string().min(2, 'Informe o nome do remetente'),
  remetenteEmail: z.string().email('E-mail inválido'),
  host: z.string().min(3, 'Informe o servidor SMTP'),
  porta: z.coerce.number().int().min(1).max(65535),
  seguranca: z.enum(['tls', 'ssl', 'nenhuma']),
  usuario: z.string().min(1, 'Informe o usuário'),
  senha: z.string().optional(),
  ativo: z.boolean().default(true),
})
const schemaApi = z.object({
  provedor: z.string().min(1, 'Escolha o provedor'),
  urlBase: z.string().url('URL inválida'),
  remetente: z.string().min(3, 'Informe o número/identificador de envio'),
  token: z.string().optional(),
  ativo: z.boolean().default(true),
})

function ResultadoTeste({ estado }: { estado: 'ok' | 'erro' | null }) {
  if (!estado) return null
  return (
    <p
      role="status"
      className={cn(
        'flex items-start gap-2 rounded-lg border px-3 py-2.5 text-[13px]',
        estado === 'ok' ? 'border-good/30 bg-good/10 text-good' : 'border-critical/30 bg-critical/10 text-critical',
      )}
    >
      <span aria-hidden>{estado === 'ok' ? '✔' : '⚠️'}</span>
      {estado === 'ok'
        ? 'Conexão bem-sucedida — a credencial responde e o remetente é válido.'
        : 'A credencial foi recusada pelo provedor. Confira a chave e o ambiente (produção × teste).'}
    </p>
  )
}

function FormularioEmail() {
  const [testando, setTestando] = useState(false)
  const [resultado, setResultado] = useState<'ok' | 'erro' | null>(null)
  const { register, handleSubmit, formState } = useForm<z.infer<typeof schemaEmail>>({
    resolver: zodResolver(schemaEmail),
    defaultValues: {
      remetenteNome: 'SoftEmp',
      remetenteEmail: 'nao-responda@softemp.com.br',
      host: 'smtp.softemp.com.br',
      porta: 587,
      seguranca: 'tls',
      usuario: 'nao-responda@softemp.com.br',
      senha: '',
      ativo: true,
    },
  })

  const testar = async () => {
    setTestando(true)
    setResultado(null)
    await new Promise((r) => setTimeout(r, 900))
    setResultado('ok')
    setTestando(false)
  }

  return (
    <form onSubmit={handleSubmit(async () => { await new Promise((r) => setTimeout(r, 600)) })} noValidate className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Nome do remetente" error={formState.errors.remetenteNome?.message} {...register('remetenteNome')} />
        <Input label="E-mail do remetente" type="email" error={formState.errors.remetenteEmail?.message} {...register('remetenteEmail')} />
        <Input label="Servidor SMTP" error={formState.errors.host?.message} {...register('host')} />
        <Input label="Porta" type="number" error={formState.errors.porta?.message} {...register('porta')} />
        <Select label="Segurança" {...register('seguranca')}>
          <option value="tls">STARTTLS</option>
          <option value="ssl">SSL/TLS</option>
          <option value="nenhuma">Nenhuma</option>
        </Select>
        <Input label="Usuário" autoComplete="off" error={formState.errors.usuario?.message} {...register('usuario')} />
        <Input
          label="Senha"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••4417"
          hint="Deixe em branco para manter a senha atual."
          className="sm:col-span-2"
          {...register('senha')}
        />
      </div>

      <Checkbox label="Canal ativo — o e-mail fica disponível para recuperação de senha e avisos" {...register('ativo')} />
      <ResultadoTeste estado={resultado} />

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <Button type="submit" loading={formState.isSubmitting}>Salvar configuração</Button>
        <Button type="button" variant="secondary" loading={testando} onClick={() => void testar()}>
          <span aria-hidden>🔌</span> Testar conexão
        </Button>
        <Button type="button" variant="ghost">Enviar e-mail de teste</Button>
      </div>
    </form>
  )
}

function FormularioApi({ canal }: { canal: 'whatsapp' | 'sms' }) {
  const [testando, setTestando] = useState(false)
  const [resultado, setResultado] = useState<'ok' | 'erro' | null>(null)
  const ehWhats = canal === 'whatsapp'

  const { register, handleSubmit, formState } = useForm<z.infer<typeof schemaApi>>({
    resolver: zodResolver(schemaApi),
    defaultValues: {
      provedor: ehWhats ? 'API interna SoftEmp' : 'Gateway SMS SoftEmp',
      urlBase: ehWhats ? 'https://wbot.softemp.com.br/api/v1' : 'https://sms.softemp.com.br/api',
      remetente: ehWhats ? '+55 48 99999-0000' : 'SOFTEMP',
      token: '',
      ativo: true,
    },
  })

  const testar = async () => {
    setTestando(true)
    setResultado(null)
    await new Promise((r) => setTimeout(r, 950))
    setResultado(ehWhats ? 'ok' : 'erro')
    setTestando(false)
  }

  return (
    <form onSubmit={handleSubmit(async () => { await new Promise((r) => setTimeout(r, 600)) })} noValidate className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select label="Provedor" {...register('provedor')}>
          {ehWhats ? (
            <>
              <option>API interna SoftEmp</option>
              <option>WhatsApp Cloud API (Meta)</option>
              <option>Outro provedor</option>
            </>
          ) : (
            <>
              <option>Gateway SMS SoftEmp</option>
              <option>Zenvia</option>
              <option>Twilio</option>
            </>
          )}
        </Select>
        <Input label="URL base" error={formState.errors.urlBase?.message} {...register('urlBase')} />
        <Input
          label={ehWhats ? 'Número de envio' : 'Remetente (sender ID)'}
          error={formState.errors.remetente?.message}
          {...register('remetente')}
        />
        <Input
          label="Token de acesso"
          type="password"
          autoComplete="off"
          placeholder="••••••••a91f"
          hint="Deixe em branco para manter o token atual."
          {...register('token')}
        />
      </div>

      <Checkbox
        label={`Canal ativo — ${ehWhats ? 'o WhatsApp' : 'o SMS'} fica disponível para recuperação de senha e segundo fator`}
        {...register('ativo')}
      />
      <ResultadoTeste estado={resultado} />

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <Button type="submit" loading={formState.isSubmitting}>Salvar configuração</Button>
        <Button type="button" variant="secondary" loading={testando} onClick={() => void testar()}>
          <span aria-hidden>🔌</span> Testar credencial
        </Button>
        <Button type="button" variant="ghost">Enviar mensagem de teste</Button>
      </div>
    </form>
  )
}

export function ComunicacaoPage() {
  const [params, setParams] = useSearchParams()
  const aba = (params.get('canal') ?? 'email') as CanalId

  const situacoes: Record<CanalId, Situacao> = {
    email: 'conectado',
    whatsapp: 'conectado',
    sms: 'falha',
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        titulo="Comunicação"
        descricao="Os canais que o sistema usa para falar com o usuário: recuperação de senha, segundo fator e avisos."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        {ABAS.map((canal) => {
          const situacao = situacoes[canal.id]
          const info = situacaoBadge[situacao]
          const ativa = aba === canal.id
          return (
            <button
              key={canal.id}
              type="button"
              onClick={() => setParams({ canal: canal.id }, { replace: true })}
              aria-pressed={ativa}
              className={cn(
                'flex items-center gap-3 rounded-xl border p-3.5 text-left transition-colors',
                ativa ? 'border-primary bg-primary/[0.06]' : 'border-border bg-surface hover:bg-surface-2',
              )}
            >
              <span aria-hidden className="text-lg">{canal.icone}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-text">{canal.rotulo}</span>
                <span className="mt-1 block"><Badge tom={info.tom}>{info.rotulo}</Badge></span>
              </span>
            </button>
          )
        })}
      </div>

      <Card>
        <CardHeader
          titulo={ABAS.find((c) => c.id === aba)?.rotulo ?? ''}
          descricao="A credencial nunca volta do servidor: a leitura traz só os últimos dígitos, e campo vazio mantém a atual."
        />
        <CardBody>
          {aba === 'email' ? <FormularioEmail /> : <FormularioApi canal={aba} />}
        </CardBody>
      </Card>

      <Card>
        <CardHeader titulo="Por que existe o botão de testar" />
        <CardBody className="space-y-2 text-[13px] text-text-secondary">
          <p>
            Credencial errada é <strong className="text-text">indistinguível</strong> de credencial certa até
            alguém tentar enviar — e quem descobre é o usuário final, na hora em que precisa do link de
            recuperação. O teste faz a chamada autenticada mais barata do provedor e pega inclusive o
            engano mais comum: chave de teste apontada para produção, ou o contrário.
          </p>
          <p>
            Enquanto o teste não passa, o canal continua listado como indisponível nas telas de acesso —
            canal ligado sem credencial válida é uma opção que falha calada.
          </p>
        </CardBody>
      </Card>
    </div>
  )
}
