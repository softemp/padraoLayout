import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  criarCompartilhamento, diasParaVencer, enviarNovaVersao, estaVencendo, estaVencido,
  formatarTamanho, JANELA_RENOVACAO_DIAS, linkExpirado, listarCompartilhamentos, listarVersoes,
  obterDocumento, revogarCompartilhamento,
} from '@/shared/api/documentos'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card, CardBody, CardHeader } from '@/shared/ui/Card'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Input } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Skeleton } from '@/shared/ui/Skeleton'
import { cn } from '@/shared/lib/cn'
import { date, number, timeAgo } from '@/shared/lib/format'

const ABAS = [
  { id: 'resumo', rotulo: 'Resumo', icone: '📋' },
  { id: 'versoes', rotulo: 'Versões', icone: '🗂️' },
  { id: 'compartilhamento', rotulo: 'Compartilhamento', icone: '🔗' },
] as const
type AbaId = (typeof ABAS)[number]['id']

const schemaVersao = z.object({
  motivo: z.string().min(5, 'Descreva o motivo — é o que explica por que existe outra versão'),
  novaValidade: z.string().optional(),
})
const schemaLink = z.object({
  destinatario: z.string().email('Informe um e-mail válido'),
  dias: z.coerce.number().min(1, 'Mínimo de 1 dia').max(30, 'Máximo de 30 dias'),
})

export function DocumentoPage() {
  const { id } = useParams()
  const documentoId = Number(id)
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const aba = (params.get('aba') ?? 'resumo') as AbaId

  const [versaoAberta, setVersaoAberta] = useState(false)
  const [linkAberto, setLinkAberto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const documento = useQuery({ queryKey: ['documento', documentoId], queryFn: () => obterDocumento(documentoId) })
  const versoes = useQuery({ queryKey: ['documento-versoes', documentoId], queryFn: () => listarVersoes(documentoId) })
  const links = useQuery({ queryKey: ['documento-links', documentoId], queryFn: () => listarCompartilhamentos(documentoId) })

  const formVersao = useForm<z.infer<typeof schemaVersao>>({ resolver: zodResolver(schemaVersao) })
  const formLink = useForm<z.infer<typeof schemaLink>>({ resolver: zodResolver(schemaLink), defaultValues: { dias: 7 } })

  const novaVersao = useMutation({
    mutationFn: (d: z.infer<typeof schemaVersao>) =>
      enviarNovaVersao(documentoId, d.motivo, d.novaValidade ? new Date(`${d.novaValidade}T12:00:00`).toISOString() : undefined),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['documento', documentoId] })
      void qc.invalidateQueries({ queryKey: ['documento-versoes', documentoId] })
      void qc.invalidateQueries({ queryKey: ['documentos'] })
      setVersaoAberta(false)
      formVersao.reset()
      setErro(null)
    },
    onError: (e: Error) => setErro(e.message),
  })

  const novoLink = useMutation({
    mutationFn: (d: z.infer<typeof schemaLink>) => criarCompartilhamento(documentoId, d.destinatario, d.dias),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['documento-links', documentoId] })
      setLinkAberto(false)
      formLink.reset({ dias: 7 })
      setErro(null)
    },
    onError: (e: Error) => setErro(e.message),
  })

  const revogar = useMutation({
    mutationFn: (linkId: number) => revogarCompartilhamento(documentoId, linkId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documento-links', documentoId] }),
  })

  if (documento.isError) {
    return (
      <Card>
        <EmptyState icone="🔍" titulo="Documento não encontrado" acao={<Button variant="secondary" size="sm"><Link to="/documentos">Voltar</Link></Button>} />
      </Card>
    )
  }

  const d = documento.data
  const dias = d ? diasParaVencer(d) : null
  const ativos = links.data?.filter((l) => !linkExpirado(l)) ?? []

  return (
    <div className="space-y-4 sm:space-y-5">
      <nav aria-label="Trilha" className="flex items-center gap-1.5 text-[13px] text-text-muted">
        <Link to="/documentos" className="font-medium text-primary hover:underline">Documentos</Link>
        <span aria-hidden>/</span>
        <span className="truncate text-text-secondary">{d?.nome ?? '…'}</span>
      </nav>

      <PageHeader
        titulo={d?.nome ?? '…'}
        descricao={d ? `${d.vinculo.rotulo} · versão ${d.versaoAtual} · ${formatarTamanho(d.tamanhoBytes)}` : undefined}
        acoes={
          <>
            <Button variant="secondary"><span aria-hidden>⬇️</span> Baixar versão vigente</Button>
            <Button variant="secondary" onClick={() => { setErro(null); setLinkAberto(true) }} disabled={!d}>
              <span aria-hidden>🔗</span> Compartilhar
            </Button>
            {/* Não existe "substituir arquivo": existe nova versão. */}
            <Button onClick={() => { setErro(null); setVersaoAberta(true) }} disabled={!d}>
              <span aria-hidden>⬆️</span> Nova versão
            </Button>
          </>
        }
      />

      {d && estaVencido(d) && (
        <p className="flex items-start gap-2 rounded-lg border border-critical/40 bg-critical/10 px-4 py-3 text-[13px] text-text-secondary">
          <span aria-hidden>⛔</span>
          <span>
            <strong className="text-critical">Documento vencido há {number(Math.abs(dias ?? 0))} dias.</strong> Ele
            não vale mais como prova — enviar a versão renovada resolve, e a antiga continua guardada.
          </span>
        </p>
      )}
      {d && estaVencendo(d) && (
        <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-[13px] text-text-secondary">
          <span aria-hidden>⏳</span>
          <span>
            Vence em <strong className="text-text">{number(dias ?? 0)} dias</strong>. A janela de
            {' '}{JANELA_RENOVACAO_DIAS} dias existe porque emitir a via nova leva tempo — pedir no vencimento
            é pedir tarde.
          </span>
        </p>
      )}

      <div role="tablist" aria-label="Seções do documento" className="flex flex-wrap items-center gap-1 border-b border-border">
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
              {item.id === 'compartilhamento' && ativos.length > 0 && (
                <span className="rounded-full bg-primary/12 px-1.5 text-[11px] font-semibold text-primary">{ativos.length}</span>
              )}
            </button>
          )
        })}
      </div>

      {aba === 'resumo' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader titulo="Dados do documento" />
            <CardBody>
              {d ? (
                <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                  {[
                    ['Vinculado a', `${d.vinculo.rotulo} (${d.vinculo.tipo})`],
                    ['Tipo', d.tipo],
                    ['Sigilo', d.confidencialidade],
                    ['Versão vigente', `v${d.versaoAtual}`],
                    ['Validade', d.validade ? date(d.validade) : 'Não vence'],
                    ['Enviado por', `${d.enviadoPor} · ${timeAgo(d.enviadoEm)}`],
                    ['Formato', `${d.extensao.toUpperCase()} · ${formatarTamanho(d.tamanhoBytes)}`],
                    ['Etiquetas', d.tags.join(', ') || '—'],
                  ].map(([rotulo, valor]) => (
                    <div key={rotulo}>
                      <dt className="text-[12px] uppercase tracking-wide text-text-muted">{rotulo}</dt>
                      <dd className="mt-0.5 text-sm font-medium text-text">{valor}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <Skeleton className="h-32 w-full" />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader titulo="Onde este documento vive" />
            <CardBody className="space-y-3 text-[13px] leading-relaxed text-text-secondary">
              <p>
                Todo documento é <strong className="text-text">vinculado</strong> a um cliente, contrato,
                fornecedor, colaborador ou à própria empresa. Arquivo sem vínculo não é achado por quem
                precisa dele — é achado por quem lembra o nome que deram a ele.
              </p>
              {d?.vinculo.tipo === 'contrato' && d.vinculo.id && (
                <Button variant="secondary" block><Link to={`/contratos/${d.vinculo.id}`}>Abrir contrato</Link></Button>
              )}
              {d?.vinculo.tipo === 'cliente' && d.vinculo.id && (
                <Button variant="secondary" block><Link to={`/clientes/${d.vinculo.id}`}>Abrir conta do cliente</Link></Button>
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {aba === 'versoes' && (
        <Card>
          <CardHeader
            titulo="Versões"
            descricao="A versão antiga continua baixável — é ela que prova o que valia na data da decisão"
            acoes={<Button size="sm" onClick={() => { setErro(null); setVersaoAberta(true) }}>⬆️ Nova versão</Button>}
          />
          <ol className="divide-y divide-border">
            {versoes.data?.map((v) => (
              <li key={v.id} className={cn('flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5', v.vigente && 'bg-primary/[0.04]')}>
                <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-[13px] font-semibold text-text-secondary">
                  v{v.numero}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 truncate text-[13px] font-medium text-text">
                    {v.nome}
                    {v.vigente && <Badge tom="good">Vigente</Badge>}
                  </p>
                  <p className="truncate text-[12px] text-text-muted">
                    {v.motivo} · {v.enviadoPor} · {formatarTamanho(v.tamanhoBytes)}
                  </p>
                  {/* O hash prova que é outro arquivo, não o mesmo renomeado. */}
                  <p className="mt-0.5 font-mono text-[11px] text-text-muted">sha {v.hash}</p>
                </div>
                <span className="whitespace-nowrap text-[12px] tabular-nums text-text-muted">{date(v.enviadoEm)}</span>
                <Button size="sm" variant="ghost">Baixar</Button>
              </li>
            ))}
          </ol>
          <p className="border-t border-border px-4 py-3 text-[12px] text-text-muted">
            Substituir o arquivo no lugar apagaria a única prova do que estava valendo antes. Aqui a versão
            nova entra no topo e a anterior fica — com autor, data, motivo e impressão do arquivo.
          </p>
        </Card>
      )}

      {aba === 'compartilhamento' && (
        <Card>
          <CardHeader
            titulo="Links de acesso externo"
            descricao="Todo link nasce com prazo e pode ser revogado antes dele"
            acoes={<Button size="sm" onClick={() => { setErro(null); setLinkAberto(true) }}>🔗 Novo link</Button>}
          />
          {links.data?.length ? (
            <ul className="divide-y divide-border">
              {links.data.map((link) => {
                const expirado = linkExpirado(link)
                return (
                  <li key={link.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                    <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-base">
                      {expirado ? '🔒' : '🔗'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-text">{link.destinatario}</p>
                      <p className="truncate text-[12px] text-text-muted">
                        criado por {link.criadoPor} · {number(link.acessos)} acessos ·{' '}
                        {link.revogadoEm ? `revogado em ${date(link.revogadoEm)}` : `expira em ${date(link.expiraEm)}`}
                      </p>
                    </div>
                    <Badge tom={expirado ? 'neutro' : 'good'}>{expirado ? 'Inativo' : 'Ativo'}</Badge>
                    {!expirado && (
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={revogar.isPending && revogar.variables === link.id}
                        onClick={() => revogar.mutate(link.id)}
                      >
                        Revogar
                      </Button>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : (
            <EmptyState
              icone="🔗"
              titulo="Nenhum link criado"
              descricao="Compartilhar gera um endereço com prazo, para quem não tem acesso ao sistema."
            />
          )}
          <p className="border-t border-border px-4 py-3 text-[12px] text-text-muted">
            Link sem prazo vira a porta dos fundos do sistema: quem tem a URL entra para sempre, sem login e
            sem permissão. Por isso o prazo é obrigatório e vai no máximo a 30 dias.
          </p>
        </Card>
      )}

      <Modal
        aberto={versaoAberta}
        titulo="Enviar nova versão"
        descricao="A versão atual não é substituída — ela continua guardada e baixável."
        onFechar={novaVersao.isPending ? () => {} : () => setVersaoAberta(false)}
        rodape={
          <>
            <Button variant="ghost" onClick={() => setVersaoAberta(false)} disabled={novaVersao.isPending}>Cancelar</Button>
            <Button form="form-versao" type="submit" loading={novaVersao.isPending}>Enviar versão {(d?.versaoAtual ?? 0) + 1}</Button>
          </>
        }
      >
        <form id="form-versao" noValidate className="space-y-4" onSubmit={formVersao.handleSubmit((v) => novaVersao.mutate(v))}>
          {erro && (
            <p role="alert" className="rounded-lg border border-critical/30 bg-critical/10 px-3 py-2.5 text-[13px] text-critical">⚠️ {erro}</p>
          )}
          <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center">
            <p className="text-[13px] font-medium text-text">Arraste o arquivo ou clique para escolher</p>
            <p className="mt-0.5 text-[12px] text-text-muted">PDF, DOCX, XLSX ou imagem · até 20 MB</p>
          </div>
          <Input
            label="Motivo da nova versão"
            data-foco-inicial
            placeholder="Ex.: certidão reemitida com validade até dezembro"
            hint="Aparece na lista de versões e no histórico."
            error={formVersao.formState.errors.motivo?.message}
            {...formVersao.register('motivo')}
          />
          {d?.validade && (
            <Input label="Nova validade (opcional)" type="date" {...formVersao.register('novaValidade')} />
          )}
        </form>
      </Modal>

      <Modal
        aberto={linkAberto}
        titulo="Compartilhar documento"
        descricao="Gera um endereço com prazo para quem não tem acesso ao sistema."
        onFechar={novoLink.isPending ? () => {} : () => setLinkAberto(false)}
        rodape={
          <>
            <Button variant="ghost" onClick={() => setLinkAberto(false)} disabled={novoLink.isPending}>Cancelar</Button>
            <Button form="form-link" type="submit" loading={novoLink.isPending}>Gerar link</Button>
          </>
        }
      >
        <form id="form-link" noValidate className="space-y-4" onSubmit={formLink.handleSubmit((v) => novoLink.mutate(v))}>
          {erro && (
            <p role="alert" className="rounded-lg border border-critical/30 bg-critical/10 px-3 py-2.5 text-[13px] text-critical">⚠️ {erro}</p>
          )}
          <Input
            label="Enviar para"
            type="email"
            data-foco-inicial
            placeholder="pessoa@empresa.com.br"
            error={formLink.formState.errors.destinatario?.message}
            {...formLink.register('destinatario')}
          />
          <Input
            label="Validade do link (dias)"
            type="number"
            min={1}
            max={30}
            hint="Máximo de 30 dias. Depois disso, o endereço deixa de funcionar sozinho."
            error={formLink.formState.errors.dias?.message}
            {...formLink.register('dias')}
          />
          {d?.confidencialidade === 'confidencial' && (
            <p className="rounded-lg border border-critical/30 bg-critical/10 px-3 py-2.5 text-[13px] text-text-secondary">
              <strong className="text-critical">Documento confidencial.</strong> O acesso fica registrado com
              e-mail, data e contagem — e você pode revogar a qualquer momento.
            </p>
          )}
        </form>
      </Modal>
    </div>
  )
}
