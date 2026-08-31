import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ACOES, listarModulos, listarPermissoes, permissoesDoPapel, salvarPermissoesDoPapel,
} from '@/shared/api/rbac'
import type { AcaoPermissao, Papel } from '@/shared/api/types'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card, CardBody, CardHeader } from '@/shared/ui/Card'
import { Skeleton } from '@/shared/ui/Skeleton'
import { cn } from '@/shared/lib/cn'

/**
 * Matriz módulo × ação de UM papel.
 *
 * Por que matriz e não lista de caixas por módulo: com o conjunto de ações
 * FECHADO (ver/criar/editar/excluir/imprimir/exportar), a matriz mostra o
 * buraco — "suporte pode excluir cliente?" se responde correndo o olho, não
 * lendo 72 rótulos. Os atalhos de linha e de coluna existem porque conceder
 * "ver tudo" é o pedido mais comum e ninguém deveria marcar 12 caixas na mão.
 *
 * A gravação é da MATRIZ INTEIRA, não célula a célula: salvar por clique
 * deixa a tela metade aplicada quando a rede cai no meio.
 */
export function MatrizPermissoes({ papel }: { papel: Papel }) {
  const qc = useQueryClient()
  const [busca, setBusca] = useState('')
  const [selecionadas, setSelecionadas] = useState<Set<number> | null>(null)

  const { data: modulos } = useQuery({ queryKey: ['rbac-modulos'], queryFn: listarModulos })
  const { data: permissoes } = useQuery({ queryKey: ['rbac-permissoes'], queryFn: listarPermissoes })
  const { data: concedidas, isLoading } = useQuery({
    queryKey: ['rbac-papel-permissoes', papel.id],
    queryFn: () => permissoesDoPapel(papel.id),
  })

  // Trocar de papel descarta a edição em andamento do anterior.
  useEffect(() => { setSelecionadas(concedidas ? new Set(concedidas) : null) }, [concedidas, papel.id])

  const salvar = useMutation({
    mutationFn: (ids: number[]) => salvarPermissoesDoPapel(papel.id, ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rbac-papel-permissoes', papel.id] }),
  })

  // O papel só enxerga os módulos do PRÓPRIO painel: permissão de um painel
  // não pode ser concedida no outro, nem por engano de clique.
  const modulosDoPapel = useMemo(
    () => (modulos ?? []).filter((m) => (papel.painel ? m.painel === papel.painel : true)),
    [modulos, papel.painel],
  )
  const visiveis = useMemo(
    () =>
      modulosDoPapel.filter(
        (m) =>
          !busca.trim() ||
          m.label.toLowerCase().includes(busca.toLowerCase()) ||
          m.nome.includes(busca.toLowerCase()),
      ),
    [modulosDoPapel, busca],
  )

  if (papel.irrestrito) {
    return (
      <Card>
        <CardHeader titulo="Acesso irrestrito" descricao={`${papel.label} não passa por verificação de permissão`} />
        <CardBody className="space-y-2 text-[13px] leading-relaxed text-text-secondary">
          <p>
            Este papel <strong className="text-text">não recebe permissões</strong>. Dar a ele "todas as
            permissões de hoje" o deixaria sem as de amanhã: todo módulo novo nasceria invisível para
            quem deveria enxergar tudo, e o defeito só apareceria quando alguém reclamasse.
          </p>
          <p>
            A verificação é pulada pelo slug do papel. Por isso ele também não declara painel — amarrá-lo
            a um exigiria duas linhas para a mesma pessoa.
          </p>
        </CardBody>
      </Card>
    )
  }

  const total = modulosDoPapel.length * ACOES.length
  const marcadas = selecionadas?.size ?? 0
  const original = new Set(concedidas ?? [])
  const alteracoes =
    selecionadas
      ? [...new Set([...selecionadas, ...original])].filter((id) => selecionadas.has(id) !== original.has(id)).length
      : 0

  const idDa = (moduloId: number, acao: AcaoPermissao) =>
    permissoes?.find((p) => p.moduloId === moduloId && p.acao === acao)?.id

  const alternar = (id?: number) => {
    if (!id || !selecionadas) return
    const novo = new Set(selecionadas)
    novo.has(id) ? novo.delete(id) : novo.add(id)
    setSelecionadas(novo)
  }

  const alternarLinha = (moduloId: number) => {
    if (!selecionadas) return
    const ids = ACOES.map((a) => idDa(moduloId, a.id)).filter(Boolean) as number[]
    const todas = ids.every((id) => selecionadas.has(id))
    const novo = new Set(selecionadas)
    ids.forEach((id) => (todas ? novo.delete(id) : novo.add(id)))
    setSelecionadas(novo)
  }

  const alternarColuna = (acao: AcaoPermissao) => {
    if (!selecionadas) return
    const ids = visiveis.map((m) => idDa(m.id, acao)).filter(Boolean) as number[]
    const todas = ids.every((id) => selecionadas.has(id))
    const novo = new Set(selecionadas)
    ids.forEach((id) => (todas ? novo.delete(id) : novo.add(id)))
    setSelecionadas(novo)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          titulo={`Permissões · ${papel.label}`}
          descricao={`${marcadas} de ${total} concedidas · slug ${papel.painel}.<módulo>.<ação>`}
          acoes={
            <label className="relative">
              <span className="sr-only">Filtrar módulos</span>
              <span aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-text-muted">🔍</span>
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Filtrar módulo…"
                className="h-8 w-40 rounded-lg border border-border bg-surface pl-8 pr-2 text-[13px] text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 sm:w-52"
              />
            </label>
          }
        />

        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2/60">
                <th scope="col" className="sticky left-0 z-10 bg-surface-2 px-4 py-2.5 text-left text-[12px] font-semibold uppercase tracking-wide text-text-muted">
                  Módulo
                </th>
                {ACOES.map((acao) => (
                  <th key={acao.id} scope="col" className="px-2 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => alternarColuna(acao.id)}
                      title={`${acao.descricao} — marcar/desmarcar a coluna`}
                      className="mx-auto flex flex-col items-center gap-0.5 rounded-md px-2 py-1 transition-colors hover:bg-surface-3"
                    >
                      <span className="text-[12px] font-semibold uppercase tracking-wide text-text-muted">{acao.label}</span>
                      <span aria-hidden className="text-[9px] text-text-muted opacity-60">coluna</span>
                    </button>
                  </th>
                ))}
                <th scope="col" className="px-3 py-2.5 text-right text-[12px] font-semibold uppercase tracking-wide text-text-muted">
                  Linha
                </th>
              </tr>
            </thead>

            <tbody>
              {isLoading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/60">
                    <td colSpan={ACOES.length + 2} className="px-4 py-2.5"><Skeleton className="h-6 w-full" /></td>
                  </tr>
                ))}

              {!isLoading &&
                visiveis.map((modulo) => {
                  const ids = ACOES.map((a) => idDa(modulo.id, a.id)).filter(Boolean) as number[]
                  const todasDaLinha = selecionadas ? ids.every((id) => selecionadas.has(id)) : false
                  return (
                    <tr key={modulo.id} className="border-b border-border/60 transition-colors last:border-0 hover:bg-surface-2">
                      <th scope="row" className="sticky left-0 z-10 bg-surface px-4 py-2.5 text-left font-normal">
                        <span className="block text-[13px] font-medium text-text">{modulo.label}</span>
                        <span className="block font-mono text-[11px] text-text-muted">{modulo.nome}</span>
                      </th>

                      {ACOES.map((acao) => {
                        const id = idDa(modulo.id, acao.id)
                        const marcada = id ? selecionadas?.has(id) ?? false : false
                        const mudou = id ? marcada !== original.has(id) : false
                        return (
                          <td key={acao.id} className="px-2 py-2 text-center">
                            <label
                              className={cn(
                                'mx-auto flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-surface-3',
                                // Célula alterada fica visível: salvar sem saber o que mudou é como
                                // permissão errada entra em produção.
                                mudou && 'ring-1 ring-inset ring-primary/50 bg-primary/[0.08]',
                              )}
                            >
                              <span className="sr-only">{`${acao.label} ${modulo.label}`}</span>
                              <input
                                type="checkbox"
                                checked={marcada}
                                onChange={() => alternar(id)}
                                className="h-4 w-4 cursor-pointer rounded border-border-strong accent-[rgb(var(--primary))]"
                              />
                            </label>
                          </td>
                        )
                      })}

                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => alternarLinha(modulo.id)}
                          className="rounded-md px-2 py-1 text-[12px] font-medium text-primary transition-colors hover:bg-primary/10"
                        >
                          {todasDaLinha ? 'Limpar' : 'Tudo'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>

        <p className="border-t border-border px-4 py-3 text-[12px] text-text-muted">
          O token do usuário carrega o <strong className="text-text-secondary">papel</strong>, não a lista de
          permissões: por isso tirar um acesso aqui vale em segundos, e não só no próximo login.
        </p>
      </Card>

      {/* Barra de gravação: só aparece quando há o que salvar. */}
      {alteracoes > 0 && (
        <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-surface px-4 py-3 shadow-pop">
          <p className="text-[13px] text-text-secondary">
            <Badge tom="info">{alteracoes}</Badge>{' '}
            {alteracoes === 1 ? 'permissão alterada' : 'permissões alteradas'} em{' '}
            <strong className="font-semibold text-text">{papel.label}</strong>
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setSelecionadas(new Set(concedidas ?? []))} disabled={salvar.isPending}>
              Descartar
            </Button>
            <Button loading={salvar.isPending} onClick={() => selecionadas && salvar.mutate([...selecionadas])}>
              Salvar permissões
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
