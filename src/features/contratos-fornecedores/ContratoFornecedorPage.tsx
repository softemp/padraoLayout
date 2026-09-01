import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  certidoesVencidas, custoAnual, desempenhoFornecedor, desviosDePreco, diasParaVencer,
  marcarNaoRenovar, naJanelaDeAviso, obterContratoFornecedor, perdaPorDesvio, reajusteDevido,
  renovouSemDecisao,
} from '@/shared/api/contratos-fornecedores'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card, CardBody, CardHeader } from '@/shared/ui/Card'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Input } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Skeleton } from '@/shared/ui/Skeleton'
import { cn } from '@/shared/lib/cn'
import { date, money, number, percent } from '@/shared/lib/format'

export function ContratoFornecedorPage() {
  const { id } = useParams()
  const contratoId = Number(id)
  const qc = useQueryClient()

  const [naoRenovar, setNaoRenovar] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  const contrato = useQuery({ queryKey: ['contrato-fornecedor', contratoId], queryFn: () => obterContratoFornecedor(contratoId) })

  const encerrar = useMutation({
    mutationFn: () => marcarNaoRenovar(contratoId, motivo),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['contrato-fornecedor', contratoId] })
      void qc.invalidateQueries({ queryKey: ['contratos-fornecedor'] })
      void qc.invalidateQueries({ queryKey: ['contratos-fornecedor-totais'] })
      setNaoRenovar(false); setMotivo(''); setErro(null)
    },
    onError: (e: Error) => setErro(e.message),
  })

  if (contrato.isError) {
    return <Card><EmptyState icone="🔍" titulo="Contrato não encontrado" acao={<Button variant="secondary" size="sm"><Link to="/contratos-fornecedores">Voltar</Link></Button>} /></Card>
  }

  const c = contrato.data
  const desvios = c ? desviosDePreco(c.id) : []
  const perdaTotal = desvios.reduce((s, d) => s + perdaPorDesvio(d), 0)
  const vencidas = c ? certidoesVencidas(c) : []
  const desempenho = c ? desempenhoFornecedor(c.fornecedor) : null

  return (
    <div className="space-y-2 sm:space-y-4 lg:space-y-6">
      <nav aria-label="Trilha" className="flex items-center gap-1.5 text-[13px] text-text-muted">
        <Link to="/contratos-fornecedores" className="font-medium text-primary hover:underline">Contratos de fornecedores</Link>
        <span aria-hidden>/</span>
        <span className="truncate text-text-secondary">{c?.numero ?? '…'}</span>
      </nav>

      <PageHeader
        titulo={c?.fornecedor ?? '…'}
        descricao={c ? `${c.numero} · ${c.objeto} · gestor ${c.gestor}` : undefined}
        acoes={
          <>
            <Button variant="secondary"><span aria-hidden>⬇️</span> Baixar contrato</Button>
            {c?.situacao === 'vigente' && c.renovacaoAutomatica && (
              <Button onClick={() => { setErro(null); setNaoRenovar(true) }}>
                <span aria-hidden>🚫</span> Não renovar
              </Button>
            )}
          </>
        }
      />

      {c && renovouSemDecisao(c) && (
        <p className="flex items-start gap-2 rounded-lg border border-critical/40 bg-critical/10 px-4 py-3 text-[13px] text-text-secondary">
          <span aria-hidden>💸</span>
          <span>
            <strong className="text-critical">O prazo de aviso passou e este contrato renova sozinho.</strong> Faltam{' '}
            {number(diasParaVencer(c))} dias para o fim e o aviso exigia {number(c.avisoPrevioDias)} — mais um ciclo
            de <strong className="text-text">{money(custoAnual(c))}</strong> já está contratado.
          </span>
        </p>
      )}
      {c && naJanelaDeAviso(c) && !renovouSemDecisao(c) && (
        <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-[13px] text-text-secondary">
          <span aria-hidden>⏳</span>
          <span>
            Decidir <strong className="text-text">agora</strong>: vence em {number(diasParaVencer(c))} dias e o aviso
            precisa sair com {number(c.avisoPrevioDias)} de antecedência.
          </span>
        </p>
      )}
      {vencidas.length > 0 && (
        <p className="flex items-start gap-2 rounded-lg border border-critical/40 bg-critical/10 px-4 py-3 text-[13px] text-text-secondary">
          <span aria-hidden>📄</span>
          <span>
            <strong className="text-critical">{vencidas.length} certidão(ões) vencida(s):</strong>{' '}
            {vencidas.map((v) => v.tipo).join(', ')}. Pagar fornecedor irregular é assumir a dívida dele — segure a
            liberação e cobre a regularização.
          </span>
        </p>
      )}

      <Card>
        <div className="grid grid-cols-2 gap-px bg-border lg:grid-cols-5">
          {[
            { rotulo: 'Custo mensal', valor: c ? (c.custoMensal ? money(c.custoMensal) : 'por demanda') : null },
            { rotulo: 'Custo anual', valor: c ? (c.custoMensal ? money(custoAnual(c)) : '—') : null },
            { rotulo: 'Vigência', valor: c ? `${date(c.inicio)} → ${date(c.fim)}` : null },
            { rotulo: 'Renovação', valor: c ? (c.renovacaoAutomatica ? `automática · aviso ${c.avisoPrevioDias}d` : 'manual') : null, destaque: c?.renovacaoAutomatica ? 'text-warning' : undefined },
            { rotulo: 'Reajuste', valor: c ? (c.indice === 'sem_reajuste' ? 'sem reajuste' : c.indice) : null, destaque: c && reajusteDevido(c) ? 'text-warning' : undefined },
          ].map((item) => (
            <div key={item.rotulo} className="bg-surface px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-text-muted">{item.rotulo}</p>
              {item.valor === null ? <Skeleton className="mt-1.5 h-5 w-24" /> : (
                <p className={cn('mt-0.5 text-[13px] font-semibold', item.destaque ?? 'text-text')}>{item.valor}</p>
              )}
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-2 sm:gap-4 lg:gap-6">
        {/* O confronto que faz o contrato valer: preço acordado × preço da compra. */}
        <Card className="xl:col-span-2">
          <CardHeader
            titulo="Preço contratado × praticado"
            descricao="O preço acordado só vale se alguém compara com o que a nota cobrou"
            acoes={desvios.length > 0 ? <Badge tom="warning">{money(perdaTotal)} a mais</Badge> : <Badge tom="good">Sem desvio</Badge>}
          />
          {c && c.itens.length === 0 ? (
            <CardBody>
              <p className="text-[13px] text-text-muted">
                Contrato sem tabela de preços — nada a conferir aqui. Contrato de {c.tipo} normalmente cobra por
                mensalidade, não por item.
              </p>
            </CardBody>
          ) : desvios.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-2/60 text-[12px] uppercase tracking-wide text-text-muted">
                    <th className="px-4 py-2.5 text-left font-semibold">Pedido</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Item</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Contratado</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Praticado</th>
                    <th className="px-4 py-2.5 text-right font-semibold">A mais</th>
                  </tr>
                </thead>
                <tbody>
                  {desvios.map((d, i) => (
                    <tr key={`${d.pedido}-${i}`} className="border-b border-border/60 transition-colors last:border-0 hover:bg-surface-2">
                      <td className="whitespace-nowrap px-4 py-2.5">
                        <p className="font-mono text-[12px] text-text">{d.pedido}</p>
                        <p className="text-[11px] text-text-muted">{date(d.data)}</p>
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="text-[13px] text-text">{d.descricao}</p>
                        <p className="font-mono text-[11px] text-text-muted">{d.sku} · {number(d.quantidade)} un</p>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-text-secondary">{money(d.precoContratado)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-warning">{money(d.precoPraticado)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-critical">{money(perdaPorDesvio(d))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icone="✅" titulo="Nenhuma compra acima do contratado" descricao="Os pedidos deste fornecedor respeitaram a tabela do contrato." />
          )}
          {c && c.itens.length > 0 && (
            <p className="border-t border-border px-4 py-3 text-[12px] text-text-muted">
              Sem esse confronto, o contrato vira um PDF na gaveta: o preço acordado não impede nada sozinho —
              ele só existe quando alguém compara com a nota.
            </p>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader titulo="Regularidade" descricao="Certidões do fornecedor" />
            <ul className="divide-y divide-border">
              {c?.certidoes.map((cert) => {
                const vencida = new Date(cert.validade) < new Date()
                const dias = Math.ceil((+new Date(cert.validade) - Date.now()) / 86400000)
                return (
                  <li key={cert.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="text-[13px] text-text-secondary">{cert.tipo}</span>
                    <span className="text-right">
                      <span className={cn('block text-[13px] tabular-nums', vencida ? 'font-semibold text-critical' : dias < 30 ? 'text-warning' : 'text-text')}>
                        {date(cert.validade)}
                      </span>
                      <span className="block text-[11px] text-text-muted">
                        {vencida ? `vencida há ${number(Math.abs(dias))}d` : `${number(dias)}d`}
                      </span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </Card>

          <Card>
            <CardHeader titulo="Desempenho real" descricao="O que o fornecedor entregou, não o que prometeu" />
            <CardBody className="space-y-3 text-[13px] text-text-secondary">
              {desempenho && c ? (
                <>
                  <div className="flex items-baseline justify-between">
                    <span>Prazo prometido</span>
                    <span className="font-medium tabular-nums text-text">{number(c.slaEntregaDias)} dias</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span>Pedidos no período</span>
                    <span className="font-medium tabular-nums text-text">{number(desempenho.pedidos)}</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span>Pontualidade</span>
                    <span className={cn('font-semibold tabular-nums', desempenho.pontualidade < 0.8 ? 'text-critical' : desempenho.pontualidade < 0.95 ? 'text-warning' : 'text-good')}>
                      {percent(desempenho.pontualidade)}
                    </span>
                  </div>
                  <Button variant="secondary" size="sm" block><Link to="/compras">Ver pedidos deste fornecedor</Link></Button>
                  <p className="border-t border-border pt-2 text-[12px] text-text-muted">
                    O SLA do contrato só vira gestão quando é confrontado com os pedidos reais — número no papel
                    não atrasa nada.
                  </p>
                </>
              ) : <Skeleton className="h-32 w-full" />}
            </CardBody>
          </Card>
        </div>
      </div>

      <Modal
        aberto={naoRenovar}
        titulo="Comunicar não renovação"
        descricao="Só vale antes do prazo de aviso — depois vira constatação."
        onFechar={encerrar.isPending ? () => {} : () => setNaoRenovar(false)}
        rodape={
          <>
            <Button variant="ghost" onClick={() => setNaoRenovar(false)} disabled={encerrar.isPending}>Cancelar</Button>
            <Button variant="danger" loading={encerrar.isPending} onClick={() => encerrar.mutate()}>Registrar não renovação</Button>
          </>
        }
      >
        <div className="space-y-3">
          {erro && <p role="alert" className="rounded-lg border border-critical/30 bg-critical/10 px-3 py-2.5 text-[13px] text-critical">⚠️ {erro}</p>}
          <Input label="Motivo (vai para o fornecedor)" data-foco-inicial value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          {c && (
            <p className="rounded-md bg-surface-2 px-3 py-2 text-[12px] text-text-secondary">
              Encerrando este contrato, a empresa deixa de gastar <strong className="text-text">{money(custoAnual(c))}</strong> por
              ano a partir de {date(c.fim)}.
            </p>
          )}
        </div>
      </Modal>
    </div>
  )
}
