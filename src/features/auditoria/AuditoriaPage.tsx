import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { acoesAuditoria, autoresAuditoria, listarEventos, modulosAuditoria } from '@/shared/api/operacao'
import type { EventoSistema } from '@/shared/api/types'
import { Avatar } from '@/shared/ui/Avatar'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { BotaoExportar } from '@/shared/ui/BotaoExportar'
import { Card, CardHeader } from '@/shared/ui/Card'
import { EmptyState } from '@/shared/ui/EmptyState'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Select } from '@/shared/ui/Field'
import { Skeleton } from '@/shared/ui/Skeleton'
import { datetime, number } from '@/shared/lib/format'

const tomAcao: Record<EventoSistema['acao'], 'good' | 'info' | 'warning' | 'critical' | 'neutro'> = {
  criou: 'good', editou: 'info', excluiu: 'warning', exportou: 'neutro', acessou: 'neutro', falhou: 'critical',
}

/**
 * Auditoria: linha do tempo filtrável. O que a torna útil não é a lista, é o
 * ANTES → DEPOIS na mesma linha — "editou o cliente" não responde nada; o que
 * responde é "plano: Pro → Enterprise".
 */
export function AuditoriaPage() {
  const [filtros, setFiltros] = useState<{ autor?: string; modulo?: string; acao?: string }>({})
  const { data, isLoading } = useQuery({ queryKey: ['auditoria', filtros], queryFn: () => listarEventos(filtros) })

  const temFiltro = Boolean(filtros.autor || filtros.modulo || filtros.acao)
  const trocar = (chave: keyof typeof filtros, valor: string) =>
    setFiltros((atual) => ({ ...atual, [chave]: valor || undefined }))

  return (
    <div className="space-y-2 sm:space-y-4 lg:space-y-6">
      <PageHeader
        titulo="Auditoria"
        descricao="Quem fez o quê, quando e de onde — inclusive o que mudou de valor."
        acoes={
          <BotaoExportar
            nomeArquivo="auditoria"
            titulo="Trilha de auditoria"
            subtitulo={temFiltro ? 'Recorte filtrado' : 'Todos os eventos'}
            orientacao="paisagem"
            rodape="Documento de auditoria · uso interno"
            colunas={[
              { chave: 'data', cabecalho: 'Data e hora', peso: 1.4, valor: (e: EventoSistema) => datetime(e.criadoEm), valorCsv: (e: EventoSistema) => e.criadoEm },
              { chave: 'autor', cabecalho: 'Autor', peso: 1.4, valor: (e: EventoSistema) => e.autor },
              { chave: 'modulo', cabecalho: 'Módulo', peso: 1.1, valor: (e: EventoSistema) => e.modulo },
              { chave: 'acao', cabecalho: 'Ação', peso: 1, valor: (e: EventoSistema) => e.acao },
              { chave: 'alvo', cabecalho: 'Alvo', peso: 2.2, valor: (e: EventoSistema) => e.alvo },
              { chave: 'mudanca', cabecalho: 'Mudança', peso: 2, valor: (e: EventoSistema) => (e.antes ? `${e.antes} → ${e.depois}` : '—') },
              { chave: 'ip', cabecalho: 'IP', peso: 1.2, valor: (e: EventoSistema) => e.ip },
            ]}
            buscarLinhas={() => data ?? []}
          />
        }
      />

      <Card>
        <CardHeader
          titulo="Filtros"
          descricao={data ? `${number(data.length)} eventos no recorte atual` : 'Carregando…'}
          acoes={temFiltro ? <Button size="sm" variant="ghost" onClick={() => setFiltros({})}>Limpar</Button> : undefined}
        />
        <div className="grid grid-cols-1 p-4 sm:grid-cols-3 sm:p-5 gap-2 sm:gap-4 lg:gap-6">
          <Select label="Autor" value={filtros.autor ?? ''} onChange={(e) => trocar('autor', e.target.value)}>
            <option value="">Todos os autores</option>
            {autoresAuditoria.map((a) => <option key={a} value={a}>{a}</option>)}
          </Select>
          <Select label="Módulo" value={filtros.modulo ?? ''} onChange={(e) => trocar('modulo', e.target.value)}>
            <option value="">Todos os módulos</option>
            {modulosAuditoria.map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
          <Select label="Ação" value={filtros.acao ?? ''} onChange={(e) => trocar('acao', e.target.value)}>
            <option value="">Todas as ações</option>
            {acoesAuditoria.map((a) => <option key={a} value={a}>{a}</option>)}
          </Select>
        </div>
      </Card>

      <Card>
        <CardHeader titulo="Linha do tempo" descricao="Do evento mais recente para o mais antigo" />

        {isLoading && <div className="p-4 sm:p-5"><Skeleton className="h-40 w-full" /></div>}

        {!isLoading && data?.length === 0 && (
          <EmptyState
            icone="🔍"
            titulo="Nenhum evento nesse recorte"
            descricao="Troque o autor, o módulo ou a ação para ver outros registros."
            acao={<Button size="sm" variant="secondary" onClick={() => setFiltros({})}>Limpar filtros</Button>}
          />
        )}

        <ol className="divide-y divide-border">
          {data?.slice(0, 40).map((evento) => (
            <li key={evento.id} className="flex flex-wrap items-start gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2 sm:px-5">
              <Avatar nome={evento.autor} />

              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-text-secondary">
                  <span className="font-semibold text-text">{evento.autor}</span> {evento.acao}{' '}
                  <span className="font-medium text-text">{evento.alvo}</span>
                </p>

                {/* O antes → depois é o que faz a trilha valer alguma coisa. */}
                {evento.antes && (
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px]">
                    <span className="rounded bg-critical/10 px-1.5 py-0.5 font-mono text-critical line-through decoration-critical/40">
                      {evento.antes}
                    </span>
                    <span aria-hidden className="text-text-muted">→</span>
                    <span className="rounded bg-good/10 px-1.5 py-0.5 font-mono text-good">{evento.depois}</span>
                  </p>
                )}

                <p className="mt-1 text-[11px] text-text-muted">
                  {evento.modulo} · IP {evento.ip}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Badge tom={tomAcao[evento.acao]}>{evento.acao}</Badge>
                <span className="whitespace-nowrap text-[12px] tabular-nums text-text-muted">{datetime(evento.criadoEm)}</span>
              </div>
            </li>
          ))}
        </ol>

        {data && data.length > 40 && (
          <div className="border-t border-border px-4 py-3 text-center">
            <Button variant="secondary" size="sm">Carregar mais eventos</Button>
          </div>
        )}
      </Card>
    </div>
  )
}
