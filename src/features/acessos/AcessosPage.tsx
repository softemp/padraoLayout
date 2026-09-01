import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ACOES, listarModulos, listarPapeis, listarPermissoes, listarUsuariosSistema } from '@/shared/api/rbac'
import type { Painel, Papel } from '@/shared/api/types'
import { Avatar } from '@/shared/ui/Avatar'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card, CardBody, CardHeader } from '@/shared/ui/Card'
import { PageHeader } from '@/shared/ui/PageHeader'
import { Skeleton } from '@/shared/ui/Skeleton'
import { cn } from '@/shared/lib/cn'
import { number, timeAgo } from '@/shared/lib/format'
import { MatrizPermissoes } from './MatrizPermissoes'

const ABAS = [
  { id: 'papeis', rotulo: 'Papéis', icone: '🎭' },
  { id: 'permissoes', rotulo: 'Permissões', icone: '🔐' },
  { id: 'modulos', rotulo: 'Módulos', icone: '🧱' },
  { id: 'usuarios', rotulo: 'Usuários', icone: '👥' },
] as const
type AbaId = (typeof ABAS)[number]['id']

const rotuloPainel: Record<Painel, string> = { admin: 'Administrativo', gerencia: 'Gerência', cliente: 'Cliente' }

function PainelBadge({ painel }: { painel: Painel | null }) {
  if (!painel) return <Badge tom="warning">Todos os painéis</Badge>
  return <Badge tom="info">{rotuloPainel[painel]}</Badge>
}

export function AcessosPage() {
  const [params, setParams] = useSearchParams()
  const aba = (params.get('aba') ?? 'papeis') as AbaId
  const [papelSelecionado, setPapel] = useState<number | null>(null)

  const { data: papeis, isLoading: carregandoPapeis } = useQuery({ queryKey: ['rbac-papeis'], queryFn: listarPapeis })
  const { data: modulos } = useQuery({ queryKey: ['rbac-modulos'], queryFn: listarModulos })
  const { data: permissoes } = useQuery({ queryKey: ['rbac-permissoes'], queryFn: listarPermissoes })
  const { data: usuarios } = useQuery({ queryKey: ['rbac-usuarios'], queryFn: listarUsuariosSistema })

  const papelAtual: Papel | undefined =
    papeis?.find((p) => p.id === papelSelecionado) ?? papeis?.find((p) => !p.irrestrito)

  const abrirMatriz = (papel: Papel) => {
    setPapel(papel.id)
    setParams({ aba: 'permissoes' }, { replace: true })
  }

  return (
    <div className="space-y-2 sm:space-y-4 lg:space-y-6">
      <PageHeader
        titulo="Acessos"
        descricao="Quem entra onde, e o que pode fazer lá dentro: papéis, módulos, permissões e usuários."
        acoes={
          <>
            <Button variant="secondary"><span aria-hidden>⬇️</span> Exportar catálogo</Button>
            <Button><span aria-hidden>＋</span> Novo papel</Button>
          </>
        }
      />

      <div role="tablist" aria-label="Seções de acesso" className="flex flex-wrap items-center gap-1 border-b border-border">
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

      {aba === 'papeis' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-4 lg:gap-6">
          {carregandoPapeis &&
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}><CardBody><Skeleton className="h-24 w-full" /></CardBody></Card>
            ))}

          {papeis?.map((papel) => {
            const quantas = permissoes
              ? modulos?.filter((m) => (papel.painel ? m.painel === papel.painel : true)).length ?? 0
              : 0
            return (
              <Card key={papel.id} className="flex flex-col">
                <CardBody className="flex-1 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-[15px] font-semibold text-text">{papel.label}</h3>
                      <p className="truncate font-mono text-[11px] text-text-muted">{papel.nome}</p>
                    </div>
                    <PainelBadge painel={papel.painel} />
                  </div>

                  <p className="text-[13px] leading-relaxed text-text-secondary">{papel.descricao}</p>

                  <div className="flex flex-wrap items-center gap-2 text-[12px] text-text-muted">
                    <span>👤 {number(papel.usuarios)} {papel.usuarios === 1 ? 'usuário' : 'usuários'}</span>
                    <span aria-hidden>·</span>
                    <span>🧱 {quantas} {quantas === 1 ? 'módulo' : 'módulos'}</span>
                    {papel.sistema && <Badge tom="neutro">De sistema</Badge>}
                    {papel.irrestrito && <Badge tom="warning">Irrestrito</Badge>}
                  </div>
                </CardBody>

                <div className="flex items-center gap-2 border-t border-border px-4 py-3">
                  <Button size="sm" variant="secondary" onClick={() => abrirMatriz(papel)}>
                    {papel.irrestrito ? 'Ver detalhes' : 'Editar permissões'}
                  </Button>
                  <Button size="sm" variant="ghost">Renomear</Button>
                  {!papel.sistema && <Button size="sm" variant="ghost" className="ml-auto text-critical">Excluir</Button>}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {aba === 'permissoes' && (
        <div className="space-y-4">
          {/* Seletor de papel: a matriz é sempre de UM papel — comparar dois na
              mesma grade parece útil e leva a marcar na coluna errada. */}
          <div className="flex flex-wrap gap-2">
            {papeis?.map((papel) => {
              const ativo = papelAtual?.id === papel.id
              return (
                <button
                  key={papel.id}
                  type="button"
                  onClick={() => setPapel(papel.id)}
                  aria-pressed={ativo}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors',
                    ativo ? 'border-primary bg-primary/[0.08] text-primary' : 'border-border bg-surface text-text-secondary hover:bg-surface-2 hover:text-text',
                  )}
                >
                  {papel.label}
                  <span className="font-mono text-[11px] opacity-60">{papel.nome}</span>
                </button>
              )
            })}
          </div>

          {papelAtual ? <MatrizPermissoes papel={papelAtual} /> : <Skeleton className="h-64 w-full rounded-xl" />}
        </div>
      )}

      {aba === 'modulos' && (
        <Card>
          <CardHeader
            titulo="Módulos"
            descricao="Cada módulo gera as seis permissões do catálogo; o painel viaja no slug"
            acoes={<Button size="sm"><span aria-hidden>＋</span> Novo módulo</Button>}
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2/60 text-[12px] uppercase tracking-wide text-text-muted">
                  <th className="px-4 py-2.5 text-left font-semibold">Módulo</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Painel</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Descrição</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Permissões</th>
                </tr>
              </thead>
              <tbody>
                {modulos?.map((modulo) => (
                  <tr key={modulo.id} className="border-b border-border/60 transition-colors last:border-0 hover:bg-surface-2">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-text">{modulo.label}</p>
                      <p className="font-mono text-[11px] text-text-muted">{modulo.painel}.{modulo.nome}.*</p>
                    </td>
                    <td className="px-3 py-2.5"><PainelBadge painel={modulo.painel} /></td>
                    <td className="px-3 py-2.5 text-text-secondary">{modulo.descricao}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-text-secondary">{ACOES.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-border px-4 py-3 text-[12px] text-text-muted">
            Módulo novo nasce com as seis ações. Não se cria permissão avulsa: o catálogo é derivado
            do par módulo × ação, e é isso que mantém a matriz sempre completa.
          </p>
        </Card>
      )}

      {aba === 'usuarios' && (
        <Card>
          <CardHeader
            titulo="Usuários do sistema"
            descricao="Um papel POR PAINEL — a mesma pessoa pode ser administradora aqui e cliente ali"
            acoes={<Button size="sm"><span aria-hidden>＋</span> Convidar usuário</Button>}
          />
          <ul className="divide-y divide-border">
            {usuarios?.map((usuario) => (
              <li key={usuario.id} className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 sm:px-5">
                <Avatar nome={usuario.nome} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-text">{usuario.nome}</p>
                  <p className="truncate text-[12px] text-text-muted">{usuario.email} · {timeAgo(usuario.ultimoAcesso)}</p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {(Object.entries(usuario.papeis) as [Painel, string][]).map(([painel, papel]) => (
                    <span
                      key={painel}
                      title={`${rotuloPainel[painel]}: ${papel}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-text-secondary"
                    >
                      <span className="text-text-muted">{rotuloPainel[painel]}</span>
                      <span className="font-mono text-text">{papel}</span>
                    </span>
                  ))}
                </div>

                <Badge tom={usuario.ativo ? 'good' : 'neutro'}>{usuario.ativo ? 'Ativo' : 'Desativado'}</Badge>
                <Button size="sm" variant="ghost">Editar acesso</Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
