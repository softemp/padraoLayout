import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  criarAditivo, diasParaVencer, estaVencendo, listarAditivos, listarAssinaturas, listarHistorico,
  obterContrato, prazoDeAvisoPerdido, reajusteDevido, registrarAssinatura, type NovoAditivo,
} from '@/shared/api/contratos'
import type { StatusContrato } from '@/shared/api/types'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card, CardBody, CardHeader } from '@/shared/ui/Card'
import { EmptyState } from '@/shared/ui/EmptyState'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Skeleton } from '@/shared/ui/Skeleton'
import { cn } from '@/shared/lib/cn'
import { date, datetime, money, number } from '@/shared/lib/format'
import { AditivoModal } from './AditivoModal'

const ABAS = [
  { id: 'resumo', rotulo: 'Resumo', icone: '📋' },
  { id: 'aditivos', rotulo: 'Aditivos', icone: '📝' },
  { id: 'assinaturas', rotulo: 'Assinaturas', icone: '✍️' },
  { id: 'historico', rotulo: 'Histórico', icone: '🕘' },
] as const
type AbaId = (typeof ABAS)[number]['id']

const statusInfo: Record<StatusContrato, { tom: 'good' | 'info' | 'warning' | 'neutro' | 'critical'; rotulo: string }> = {
  rascunho: { tom: 'neutro', rotulo: 'Rascunho' },
  em_assinatura: { tom: 'warning', rotulo: 'Em assinatura' },
  vigente: { tom: 'good', rotulo: 'Vigente' },
  encerrado: { tom: 'neutro', rotulo: 'Encerrado' },
  rescindido: { tom: 'critical', rotulo: 'Rescindido' },
}

const tipoAditivo = {
  reajuste: 'Reajuste', valor: 'Valor', prazo: 'Prazo', escopo: 'Escopo', rescisao: 'Rescisão',
} as const

export function ContratoPage() {
  const { id } = useParams()
  const contratoId = Number(id)
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const aba = (params.get('aba') ?? 'resumo') as AbaId

  const [aditivoAberto, setAditivoAberto] = useState(false)
  const [erroAditivo, setErroAditivo] = useState<string | null>(null)

  const contrato = useQuery({ queryKey: ['contrato', contratoId], queryFn: () => obterContrato(contratoId) })
  const aditivos = useQuery({ queryKey: ['contrato-aditivos', contratoId], queryFn: () => listarAditivos(contratoId) })
  const assinaturas = useQuery({ queryKey: ['contrato-assinaturas', contratoId], queryFn: () => listarAssinaturas(contratoId) })
  const historico = useQuery({ queryKey: ['contrato-historico', contratoId], queryFn: () => listarHistorico(contratoId) })

  const invalidar = () => {
    void qc.invalidateQueries({ queryKey: ['contrato', contratoId] })
    void qc.invalidateQueries({ queryKey: ['contrato-aditivos', contratoId] })
    void qc.invalidateQueries({ queryKey: ['contrato-historico', contratoId] })
    void qc.invalidateQueries({ queryKey: ['contratos'] })
    void qc.invalidateQueries({ queryKey: ['contratos-totais'] })
  }

  const novoAditivo = useMutation({
    mutationFn: (dados: NovoAditivo) => criarAditivo(contratoId, dados),
    onSuccess: () => { invalidar(); setAditivoAberto(false); setErroAditivo(null) },
    onError: (e: Error) => setErroAditivo(e.message),
  })

  const assinar = useMutation({
    mutationFn: (assinaturaId: number) => registrarAssinatura(contratoId, assinaturaId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['contrato-assinaturas', contratoId] })
      invalidar()
    },
  })

  if (contrato.isError) {
    return (
      <Card>
        <EmptyState
          icone="🔍"
          titulo="Contrato não encontrado"
          acao={<Button variant="secondary" size="sm"><Link to="/contratos">Voltar para a listagem</Link></Button>}
        />
      </Card>
    )
  }

  const c = contrato.data
  const dias = c ? diasParaVencer(c) : 0
  const pendentes = assinaturas.data?.filter((a) => !a.assinadoEm) ?? []

  return (
    <div className="space-y-4 sm:space-y-5">
      <nav aria-label="Trilha" className="flex items-center gap-1.5 text-[13px] text-text-muted">
        <Link to="/contratos" className="font-medium text-primary hover:underline">Contratos</Link>
        <span aria-hidden>/</span>
        <span className="truncate text-text-secondary">{c?.numero ?? '…'}</span>
      </nav>

      <PageHeader
        titulo={c?.numero ?? '…'}
        descricao={c ? `${c.cliente} · ${c.objeto}` : undefined}
        acoes={
          <>
            <Button variant="secondary"><span aria-hidden>⬇️</span> Baixar contrato</Button>
            {/* Contrato assinado não tem "editar": tem aditivo. */}
            <Button onClick={() => { setErroAditivo(null); setAditivoAberto(true) }} disabled={!c}>
              <span aria-hidden>＋</span> Novo aditivo
            </Button>
          </>
        }
      />

      {/* Avisos derivados, na ordem em que exigem decisão */}
      {c && prazoDeAvisoPerdido(c) && (
        <p className="flex items-start gap-2 rounded-lg border border-critical/40 bg-critical/10 px-4 py-3 text-[13px] text-text-secondary">
          <span aria-hidden>⛔</span>
          <span>
            <strong className="text-critical">O prazo de aviso prévio já passou.</strong> Este contrato tem
            renovação automática e exige aviso com {number(c.avisoPrevioDias)} dias — faltam {number(dias)}.
            Na prática, ele já renovou.
          </span>
        </p>
      )}
      {c && estaVencendo(c) && !prazoDeAvisoPerdido(c) && (
        <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-[13px] text-text-secondary">
          <span aria-hidden>⏳</span>
          <span>
            Vence em <strong className="text-text">{number(dias)} dias</strong>. O aviso de não renovação
            precisa sair com {number(c.avisoPrevioDias)} dias de antecedência.
          </span>
        </p>
      )}
      {c && reajusteDevido(c) && (
        <p className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/[0.07] px-4 py-3 text-[13px] text-text-secondary">
          <span aria-hidden>📈</span>
          <span>
            Reajuste devido pelo <strong className="text-text">{c.indice}</strong> — passou o aniversário da
            data-base. Aplicar gera um aditivo.
          </span>
        </p>
      )}

      <Card>
        <div className="grid grid-cols-2 gap-px bg-border lg:grid-cols-5">
          {[
            { rotulo: 'Situação', valor: c ? statusInfo[c.status].rotulo : null },
            { rotulo: 'Valor mensal', valor: c ? money(c.valorMensal) : null },
            { rotulo: 'Vigência', valor: c ? `${date(c.inicio)} → ${date(c.fim)}` : null },
            { rotulo: 'Renovação', valor: c ? (c.renovacaoAutomatica ? `Automática · aviso ${c.avisoPrevioDias}d` : 'Manual') : null },
            { rotulo: 'Reajuste', valor: c ? (c.indice === 'sem_reajuste' ? 'Sem reajuste' : c.indice) : null },
          ].map((item) => (
            <div key={item.rotulo} className="bg-surface px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-text-muted">{item.rotulo}</p>
              {item.valor === null ? <Skeleton className="mt-1.5 h-5 w-24" /> : (
                <p className="mt-0.5 text-[13px] font-semibold text-text">{item.valor}</p>
              )}
            </div>
          ))}
        </div>
      </Card>

      <div role="tablist" aria-label="Seções do contrato" className="flex flex-wrap items-center gap-1 border-b border-border">
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
              {item.id === 'assinaturas' && pendentes.length > 0 && (
                <span className="rounded-full bg-warning/20 px-1.5 text-[11px] font-semibold text-text-secondary">{pendentes.length}</span>
              )}
            </button>
          )
        })}
      </div>

      {aba === 'resumo' && c && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader titulo="Dados do contrato" />
            <CardBody>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                {[
                  ['Cliente', c.cliente],
                  ['Objeto', c.objeto],
                  ['Gestor responsável', c.gestor],
                  ['Início da vigência', date(c.inicio)],
                  ['Fim da vigência', date(c.fim)],
                  ['Data-base do reajuste', date(c.dataBaseReajuste)],
                  ['Último reajuste', c.ultimoReajusteEm ? date(c.ultimoReajusteEm) : 'Nunca reajustado'],
                  ['Aviso prévio', `${number(c.avisoPrevioDias)} dias`],
                ].map(([rotulo, valor]) => (
                  <div key={rotulo}>
                    <dt className="text-[12px] uppercase tracking-wide text-text-muted">{rotulo}</dt>
                    <dd className="mt-0.5 text-sm font-medium text-text">{valor}</dd>
                  </div>
                ))}
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader titulo="Faturamento" descricao="O contrato gera os lançamentos, não os substitui" />
            <CardBody className="space-y-3">
              <div>
                <p className="text-[12px] uppercase tracking-wide text-text-muted">Receita reconhecida no prazo</p>
                <p className="mt-0.5 text-xl font-semibold tabular-nums text-text">
                  {money(c.valorMensal * Math.max(Math.round((+new Date(c.fim) - +new Date(c.inicio)) / (30 * 86400000)), 1))}
                </p>
              </div>
              <p className="text-[13px] leading-relaxed text-text-secondary">
                O valor do contrato é o compromisso; o que entra no caixa são os lançamentos gerados a
                partir dele. Os dois não se confundem — e é por isso que a cobrança vive em
                <Link to="/financeiro/contas" className="ml-1 font-medium text-primary hover:underline">Contas a pagar e receber</Link>.
              </p>
              <Button variant="secondary" block>
                <Link to={`/clientes/${c.clienteId}`}>Abrir conta do cliente</Link>
              </Button>
            </CardBody>
          </Card>
        </div>
      )}

      {aba === 'aditivos' && (
        <Card>
          <CardHeader
            titulo="Aditivos"
            descricao="A linha do tempo do que mudou depois da assinatura"
            acoes={<Button size="sm" onClick={() => { setErroAditivo(null); setAditivoAberto(true) }}>＋ Novo aditivo</Button>}
          />
          {aditivos.data?.length ? (
            <ol className="divide-y divide-border">
              {aditivos.data.map((aditivo) => (
                <li key={aditivo.id} className="flex flex-wrap items-start gap-3 px-4 py-3.5 sm:px-5">
                  <Badge tom={aditivo.tipo === 'rescisao' ? 'critical' : 'info'}>{tipoAditivo[aditivo.tipo]}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[12px] text-text-muted">{aditivo.numero}</p>
                    <p className="text-[13px] font-medium text-text">{aditivo.descricao}</p>
                    {/* O "de → para" é o que faz o aditivo valer alguma coisa. */}
                    {aditivo.valorNovo != null && (
                      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px]">
                        <span className="rounded bg-surface-3 px-1.5 py-0.5 font-mono tabular-nums text-text-muted line-through">
                          {money(aditivo.valorAnterior ?? 0)}
                        </span>
                        <span aria-hidden className="text-text-muted">→</span>
                        <span className="rounded bg-good/10 px-1.5 py-0.5 font-mono tabular-nums text-good">{money(aditivo.valorNovo)}</span>
                      </p>
                    )}
                    {aditivo.fimNovo && (
                      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px]">
                        <span className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-text-muted line-through">{date(aditivo.fimAnterior ?? '')}</span>
                        <span aria-hidden className="text-text-muted">→</span>
                        <span className="rounded bg-good/10 px-1.5 py-0.5 font-mono text-good">{date(aditivo.fimNovo)}</span>
                      </p>
                    )}
                    <p className="mt-1 text-[11px] text-text-muted">
                      Vigora a partir de {date(aditivo.vigenciaEm)} · registrado por {aditivo.autor}
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-[12px] tabular-nums text-text-muted">{date(aditivo.criadoEm)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState
              icone="📝"
              titulo="Nenhum aditivo"
              descricao="O contrato está exatamente como foi assinado. Toda mudança daqui em diante entra como aditivo."
            />
          )}
        </Card>
      )}

      {aba === 'assinaturas' && (
        <Card>
          <CardHeader
            titulo="Partes e assinaturas"
            descricao="O contrato só passa a vigorar quando todas as partes assinam"
          />
          <ul className="divide-y divide-border">
            {assinaturas.data?.map((assinatura) => (
              <li key={assinatura.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-base">
                  {assinatura.assinadoEm ? '✅' : '⏳'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-text">{assinatura.parte}</p>
                  <p className="truncate text-[12px] text-text-muted">{assinatura.email}</p>
                </div>
                <Badge tom="neutro">
                  {assinatura.papel === 'contratante' ? 'Contratante' : assinatura.papel === 'contratada' ? 'Contratada' : 'Testemunha'}
                </Badge>
                {assinatura.assinadoEm ? (
                  <span className="whitespace-nowrap text-[12px] text-text-muted">
                    assinou em {date(assinatura.assinadoEm)} ({assinatura.meio === 'digital' ? 'digital' : 'físico'})
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={assinar.isPending && assinar.variables === assinatura.id}
                    onClick={() => assinar.mutate(assinatura.id)}
                  >
                    Registrar assinatura
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <p className="border-t border-border px-4 py-3 text-[12px] text-text-muted">
            Enquanto faltar uma assinatura, o contrato fica <strong className="text-text-secondary">em
            assinatura</strong> — não vigente. Tratar como vigente o que ninguém assinou é o caminho mais
            curto para cobrar o que não pode ser cobrado.
          </p>
        </Card>
      )}

      {aba === 'historico' && (
        <Card>
          <CardHeader titulo="Histórico" descricao="Quem fez o quê neste contrato" />
          <ol className="divide-y divide-border">
            {historico.data?.map((evento) => (
              <li key={evento.id} className="flex gap-3 px-4 py-3.5 sm:px-5">
                <span aria-hidden className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary/40 ring-4 ring-primary/10" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-text-secondary">
                    <span className="font-semibold text-text">{evento.autor}</span> {evento.acao}
                  </p>
                  <p className="text-[13px] text-text-muted">{evento.detalhe}</p>
                </div>
                <span className="shrink-0 whitespace-nowrap text-[12px] tabular-nums text-text-muted">{datetime(evento.criadoEm)}</span>
              </li>
            ))}
          </ol>
        </Card>
      )}

      <AditivoModal
        contrato={aditivoAberto ? c ?? null : null}
        salvando={novoAditivo.isPending}
        erro={erroAditivo}
        onFechar={() => { setAditivoAberto(false); setErroAditivo(null) }}
        onConfirmar={(dados) => novoAditivo.mutate(dados)}
      />
    </div>
  )
}
