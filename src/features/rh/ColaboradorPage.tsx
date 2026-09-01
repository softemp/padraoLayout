import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  agendarFerias, alternarItemDesligamento, checklistDesligamento, diasEmAberto, diasParaDobra,
  emDobra, feriasVencendo, listarAcessosSensiveis, listarAusencias, obterColaborador,
  obterPeriodosFerias,
} from '@/shared/api/rh'
import type { Ausencia, SituacaoColaborador } from '@/shared/api/types'
import { Avatar } from '@/shared/ui/Avatar'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card, CardBody, CardHeader } from '@/shared/ui/Card'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Input } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'
import { Skeleton } from '@/shared/ui/Skeleton'
import { cn } from '@/shared/lib/cn'
import { date, datetime, money, number } from '@/shared/lib/format'

const ABAS = [
  { id: 'resumo', rotulo: 'Resumo', icone: '📋' },
  { id: 'ferias', rotulo: 'Férias', icone: '🏖️' },
  { id: 'ausencias', rotulo: 'Ausências', icone: '📆' },
  { id: 'desligamento', rotulo: 'Desligamento', icone: '🚪' },
] as const
type AbaId = (typeof ABAS)[number]['id']

const situacaoInfo: Record<SituacaoColaborador, { tom: 'good' | 'info' | 'warning' | 'neutro'; rotulo: string }> = {
  ativo: { tom: 'good', rotulo: 'Ativo' },
  ferias: { tom: 'info', rotulo: 'Em férias' },
  afastado: { tom: 'warning', rotulo: 'Afastado' },
  aviso_previo: { tom: 'warning', rotulo: 'Aviso prévio' },
  desligado: { tom: 'neutro', rotulo: 'Desligado' },
}

const tipoAusencia: Record<Ausencia['tipo'], string> = {
  falta: 'Falta', atestado: 'Atestado', licenca: 'Licença', home_office: 'Home office', folga: 'Folga',
}

/** CPF aparece parcial mesmo para quem pode ver: ninguém precisa do número inteiro na lista. */
const cpfParcial = (d: string) => `•••.${d.slice(3, 6)}.${d.slice(6, 9)}-••`

export function ColaboradorPage() {
  const { id } = useParams()
  const colaboradorId = Number(id)
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const aba = (params.get('aba') ?? 'resumo') as AbaId

  const [agendando, setAgendando] = useState<number | null>(null)
  const [inicio, setInicio] = useState('')
  const [dias, setDias] = useState(15)
  const [erro, setErro] = useState<string | null>(null)

  const colaborador = useQuery({ queryKey: ['rh-colaborador', colaboradorId], queryFn: () => obterColaborador(colaboradorId) })
  const periodos = useQuery({ queryKey: ['rh-periodos', colaboradorId], queryFn: () => obterPeriodosFerias(colaboradorId) })
  const ausencias = useQuery({ queryKey: ['rh-ausencias', colaboradorId], queryFn: () => listarAusencias(colaboradorId) })
  const checklist = useQuery({ queryKey: ['rh-checklist', colaboradorId], queryFn: () => checklistDesligamento(colaboradorId), enabled: aba === 'desligamento' })
  const acessos = useQuery({ queryKey: ['rh-acessos'], queryFn: listarAcessosSensiveis, enabled: aba === 'resumo' })

  const agendar = useMutation({
    mutationFn: ({ periodoId }: { periodoId: number }) =>
      agendarFerias(periodoId, new Date(`${inicio}T12:00:00`).toISOString(), dias),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['rh-periodos', colaboradorId] })
      void qc.invalidateQueries({ queryKey: ['rh-ferias'] })
      setAgendando(null)
      setErro(null)
    },
    onError: (e: Error) => setErro(e.message),
  })

  const marcar = useMutation({
    mutationFn: (itemId: number) => alternarItemDesligamento(colaboradorId, itemId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rh-checklist', colaboradorId] }),
  })

  if (colaborador.isError) {
    return <Card><EmptyState icone="🔍" titulo="Pessoa não encontrada" acao={<Button variant="secondary" size="sm"><Link to="/rh">Voltar</Link></Button>} /></Card>
  }

  const c = colaborador.data
  const pendentesCriticos = checklist.data?.filter((i) => i.critico && !i.feito).length ?? 0

  return (
    <div className="space-y-2 sm:space-y-4 lg:space-y-6">
      <nav aria-label="Trilha" className="flex items-center gap-1.5 text-[13px] text-text-muted">
        <Link to="/rh" className="font-medium text-primary hover:underline">Pessoas</Link>
        <span aria-hidden>/</span>
        <span className="truncate text-text-secondary">{c?.nome ?? '…'}</span>
      </nav>

      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            {c ? <Avatar nome={c.nome} size="lg" className="h-16 w-16 text-lg" /> : <Skeleton className="h-16 w-16 rounded-full" />}
            <div className="min-w-0">
              {c ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="truncate text-lg font-semibold tracking-tight text-text sm:text-xl">{c.nome}</h1>
                    <Badge tom={situacaoInfo[c.situacao].tom}>{situacaoInfo[c.situacao].rotulo}</Badge>
                    <Badge tom="neutro">{c.contrato}</Badge>
                  </div>
                  <p className="mt-1 truncate text-[13px] text-text-muted">
                    {c.cargo} · {c.departamento} · gestor {c.gestor}
                  </p>
                </>
              ) : <Skeleton className="h-10 w-64" />}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm">Editar cadastro</Button>
            {c?.situacao !== 'desligado' && <Button variant="secondary" size="sm" onClick={() => setParams({ aba: 'desligamento' }, { replace: true })}>Iniciar desligamento</Button>}
          </div>
        </CardBody>
      </Card>

      <div role="tablist" aria-label="Seções da ficha" className="flex flex-wrap items-center gap-1 border-b border-border">
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
              <span aria-hidden>{item.icone}</span>{item.rotulo}
            </button>
          )
        })}
      </div>

      {aba === 'resumo' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 sm:gap-4 lg:gap-6">
          <Card className="lg:col-span-2">
            <CardHeader titulo="Dados" descricao="Cadastro funcional" />
            <CardBody>
              {c ? (
                <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                  {[
                    ['E-mail', c.email],
                    ['Telefone', c.telefone.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3')],
                    ['CPF', cpfParcial(c.cpf)],
                    ['Admissão', `${date(c.admissao)}`],
                    ['Local', c.localizacao],
                    ['Gestor', c.gestor],
                    // O salário só existe aqui se o servidor tiver mandado.
                    ['Remuneração', c.salario === null ? '🔒 restrito ao RH e à liderança' : money(c.salario)],
                    ['Desligamento', c.desligamento ? date(c.desligamento) : '—'],
                  ].map(([rotulo, valor]) => (
                    <div key={rotulo}>
                      <dt className="text-[12px] uppercase tracking-wide text-text-muted">{rotulo}</dt>
                      <dd className={cn('mt-0.5 text-sm font-medium', valor.startsWith('🔒') ? 'text-text-muted' : 'text-text')}>{valor}</dd>
                    </div>
                  ))}
                </dl>
              ) : <Skeleton className="h-40 w-full" />}
            </CardBody>
          </Card>

          <Card>
            <CardHeader titulo="Quem viu o quê" descricao="Acesso a dado sensível fica registrado" />
            {acessos.data?.length ? (
              <ul className="divide-y divide-border">
                {acessos.data.slice(0, 6).map((a) => (
                  <li key={a.id} className="px-4 py-2.5">
                    <p className="text-[13px] text-text-secondary">
                      <span className="font-semibold text-text">{a.autor}</span> consultou {a.campo} de {a.alvo}
                    </p>
                    <p className="text-[11px] tabular-nums text-text-muted">{datetime(a.criadoEm)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <CardBody>
                <p className="text-[13px] text-text-muted">
                  Nenhum acesso registrado nesta sessão. Consultar remuneração gera registro — inclusive só olhar.
                </p>
              </CardBody>
            )}
            <p className="border-t border-border px-4 py-3 text-[12px] text-text-muted">
              Dado de pessoa não é como dado de pedido: quem consultou também é informação, e a trilha é o que
              transforma "acesso permitido" em "acesso responsável".
            </p>
          </Card>
        </div>
      )}

      {aba === 'ferias' && (
        <Card>
          <CardHeader titulo="Períodos de férias" descricao="Aquisitivo × concessivo — e o relógio da dobra" />
          {periodos.data?.length ? (
            <ul className="divide-y divide-border">
              {periodos.data.map((p) => {
                const restam = diasEmAberto(p)
                const paraDobra = diasParaDobra(p)
                return (
                  <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-text">
                        Aquisitivo {date(p.aquisitivoInicio)} → {date(p.aquisitivoFim)}
                      </p>
                      <p className="text-[12px] text-text-muted">
                        Concessivo até {date(p.concessivoFim)} ·{' '}
                        {paraDobra >= 0 ? `${number(paraDobra)} dias para a dobra` : `dobra há ${number(Math.abs(paraDobra))} dias`}
                        {p.agendadoPara && ` · agendado para ${date(p.agendadoPara)}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[13px] font-semibold tabular-nums text-text">{number(restam)} dias</p>
                      <p className="text-[11px] text-text-muted">de {p.diasDireito}</p>
                    </div>
                    {emDobra(p) ? <Badge tom="critical">Em dobra</Badge>
                      : feriasVencendo(p) ? <Badge tom="warning">Programar já</Badge>
                      : restam === 0 ? <Badge tom="good">Quitado</Badge>
                      : <Badge tom="neutro">No prazo</Badge>}
                    {restam > 0 && (
                      <Button size="sm" variant="secondary" onClick={() => { setErro(null); setInicio(''); setDias(Math.min(restam, 15)); setAgendando(p.id) }}>
                        Agendar
                      </Button>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : <div className="p-4"><Skeleton className="h-24 w-full" /></div>}
          <p className="border-t border-border px-4 py-3 text-[12px] text-text-muted">
            O período <strong className="text-text-secondary">aquisitivo</strong> é o ano trabalhado; o{' '}
            <strong className="text-text-secondary">concessivo</strong> é o ano seguinte, para conceder. Passou do
            concessivo com dias em aberto, a empresa paga em dobro — e o relógio corre por período, não por pessoa.
          </p>
        </Card>
      )}

      {aba === 'ausencias' && (
        <Card>
          <CardHeader titulo="Ausências" descricao="Faltas, atestados, licenças e trabalho remoto" />
          {ausencias.data?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-2/60 text-[12px] uppercase tracking-wide text-text-muted">
                    <th className="px-4 py-2.5 text-left font-semibold">Período</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Tipo</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Observação</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Dias</th>
                  </tr>
                </thead>
                <tbody>
                  {ausencias.data.map((a) => (
                    <tr key={a.id} className="border-b border-border/60 transition-colors last:border-0 hover:bg-surface-2">
                      <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-text-secondary">{date(a.inicio)}</td>
                      <td className="px-3 py-2.5">
                        <span className="flex items-center gap-2">
                          <span className="text-text">{tipoAusencia[a.tipo]}</span>
                          {!a.justificada && <Badge tom="warning">não justificada</Badge>}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-text-muted">{a.observacao}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-text">{number(a.dias)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState icone="📆" titulo="Nenhuma ausência registrada" />}
          <p className="border-t border-border px-4 py-3 text-[12px] text-text-muted">
            Atestado é dado de saúde: registre <strong className="text-text-secondary">que houve</strong> e o período —
            diagnóstico e CID não pertencem ao sistema de RH da empresa.
          </p>
        </Card>
      )}

      {aba === 'desligamento' && (
        <Card>
          <CardHeader
            titulo="Checklist de desligamento"
            descricao="O evento espalha efeitos por vários módulos — os críticos vêm marcados"
            acoes={pendentesCriticos > 0 ? <Badge tom="critical">{pendentesCriticos} críticos pendentes</Badge> : <Badge tom="good">Sem pendência crítica</Badge>}
          />
          <ul className="divide-y divide-border">
            {checklist.data?.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <input
                  type="checkbox"
                  checked={item.feito}
                  onChange={() => marcar.mutate(item.id)}
                  aria-label={item.rotulo}
                  className="h-4 w-4 cursor-pointer rounded border-border-strong accent-[rgb(var(--primary))]"
                />
                <div className="min-w-0 flex-1">
                  <p className={cn('text-[13px]', item.feito ? 'text-text-muted line-through' : 'font-medium text-text')}>{item.rotulo}</p>
                  <p className="text-[11px] text-text-muted">{item.responsavel}</p>
                </div>
                {item.critico && !item.feito && <Badge tom="critical">Crítico</Badge>}
              </li>
            ))}
          </ul>
          <p className="border-t border-border px-4 py-3 text-[12px] text-text-muted">
            O item mais esquecido é o primeiro: <strong className="text-text-secondary">conta ativa de quem já saiu</strong> é
            a porta que ninguém fecha. Revogar acesso e encerrar sessões no dia do desligamento — não na semana seguinte.
          </p>
        </Card>
      )}

      <Modal
        aberto={agendando !== null}
        titulo="Agendar férias"
        descricao="Comunicação com 30 dias de antecedência é obrigação, não preferência."
        onFechar={agendar.isPending ? () => {} : () => setAgendando(null)}
        rodape={
          <>
            <Button variant="ghost" onClick={() => setAgendando(null)} disabled={agendar.isPending}>Cancelar</Button>
            <Button loading={agendar.isPending} onClick={() => agendando && agendar.mutate({ periodoId: agendando })}>Agendar</Button>
          </>
        }
      >
        <div className="space-y-4">
          {erro && <p role="alert" className="rounded-lg border border-critical/30 bg-critical/10 px-3 py-2.5 text-[13px] text-critical">⚠️ {erro}</p>}
          <Input label="Início das férias" type="date" data-foco-inicial value={inicio} onChange={(e) => setInicio(e.target.value)} />
          <Input label="Dias" type="number" min={5} max={30} value={dias} onChange={(e) => setDias(Number(e.target.value))} />
        </div>
      </Modal>
    </div>
  )
}
