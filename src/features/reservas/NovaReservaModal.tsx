import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { noites, tarifaDaNoite, unidadesDisponiveis } from '@/shared/api/reservas'
import type { CanalReserva, UnidadeHospedagem } from '@/shared/api/types'
import { Button } from '@/shared/ui/Button'
import { Input, Select } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'
import { Skeleton } from '@/shared/ui/Skeleton'
import { cn } from '@/shared/lib/cn'
import { money } from '@/shared/lib/format'
import { CANAL, COMODIDADE, TIPO } from './comum'

const maisDias = (base: string, n: number) =>
  new Date(+new Date(`${base}T12:00:00`) + n * 86400000).toISOString().slice(0, 10)

export function NovaReservaModal({
  aberto, onFechar, onCriar, carregando, erro, inicial,
}: {
  aberto: boolean
  onFechar: () => void
  onCriar: (dados: { unidadeId: number; hospede: string; telefone: string; adultos: number; criancas: number; entrada: string; saida: string; canal: CanalReserva }) => void
  carregando: boolean
  erro: string | null
  inicial: { unidadeId?: number; data?: string } | null
}) {
  const [entrada, setEntrada] = useState(inicial?.data ?? new Date().toISOString().slice(0, 10))
  const [saida, setSaida] = useState(maisDias(inicial?.data ?? new Date().toISOString().slice(0, 10), 2))
  const [adultos, setAdultos] = useState(2)
  const [criancas, setCriancas] = useState(0)
  const [hospede, setHospede] = useState('')
  const [telefone, setTelefone] = useState('')
  const [canal, setCanal] = useState<CanalReserva>('direto')
  const [unidadeId, setUnidadeId] = useState<number | null>(inicial?.unidadeId ?? null)

  useEffect(() => {
    if (!aberto || !inicial) return
    if (inicial.data) { setEntrada(inicial.data); setSaida(maisDias(inicial.data, 2)) }
    if (inicial.unidadeId) setUnidadeId(inicial.unidadeId)
  }, [aberto, inicial])

  const n = noites(entrada, saida)
  const pessoas = adultos + criancas
  const { data: livres, isFetching } = useQuery({
    queryKey: ['reservas-disponiveis', entrada, saida, pessoas],
    queryFn: () => unidadesDisponiveis(entrada, saida, pessoas),
    enabled: aberto && n >= 1,
  })
  const escolhida = livres?.find((u) => u.id === unidadeId) ?? null
  const total = escolhida
    ? Array.from({ length: n }, (_, i) => tarifaDaNoite(escolhida, maisDias(entrada, i))).reduce((s, v) => s + v, 0)
    : 0

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo="Nova reserva"
      descricao="Entrada 14h · saída 12h — o que se cobra é a noite"
      largura="max-w-2xl"
      rodape={
        <>
          <Button variant="ghost" onClick={onFechar}>Cancelar</Button>
          <Button
            disabled={!escolhida || !hospede.trim() || n < 1}
            loading={carregando}
            onClick={() => escolhida && onCriar({ unidadeId: escolhida.id, hospede, telefone, adultos, criancas, entrada, saida, canal })}
          >
            Criar pré-reserva{total > 0 && ` · ${money(total)}`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:gap-6 sm:grid-cols-4">
          <Input label="Entrada" type="date" value={entrada} onChange={(e) => setEntrada(e.target.value)} />
          <Input label="Saída" type="date" value={saida} onChange={(e) => setSaida(e.target.value)} />
          <Input label="Adultos" type="number" min={1} value={adultos} onChange={(e) => setAdultos(Math.max(1, +e.target.value))} />
          <Input label="Crianças" type="number" min={0} value={criancas} onChange={(e) => setCriancas(Math.max(0, +e.target.value))} />
        </div>

        <p className={cn('rounded-lg p-2 text-[13px] sm:p-4', n < 1 ? 'bg-critical/10 text-text-secondary' : 'bg-surface-2 text-text-secondary')}>
          {n < 1 ? (
            <>A saída precisa ser <strong className="text-text">pelo menos um dia</strong> depois da entrada — reserva sem noite não existe.</>
          ) : (
            <>
              <strong className="text-text">{n} {n === 1 ? 'diária' : 'diárias'}</strong> para {pessoas} {pessoas === 1 ? 'pessoa' : 'pessoas'}.
              A noite de <strong className="text-text">{saida}</strong> não é cobrada: o hóspede sai nesse dia às {'12h'}, e a unidade já pode receber outra entrada.
            </>
          )}
        </p>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-[13px] font-medium text-text-secondary">
            Unidades livres no período {isFetching && <span className="text-text-muted">· procurando…</span>}
          </legend>
          {isFetching && <Skeleton className="h-16 rounded-lg" />}
          {!isFetching && livres?.length === 0 && (
            <p className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-[13px] text-text-secondary">
              Nenhuma unidade livre para {pessoas} pessoas nesse período. Mude as datas, divida o grupo — ou confira se alguma reserva pode ser realocada.
            </p>
          )}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-4 lg:gap-6">
            {livres?.map((u: UnidadeHospedagem) => {
              const escolhido = unidadeId === u.id
              const valor = Array.from({ length: n }, (_, i) => tarifaDaNoite(u, maisDias(entrada, i))).reduce((s, v) => s + v, 0)
              return (
                <button
                  key={u.id}
                  type="button"
                  aria-pressed={escolhido}
                  onClick={() => setUnidadeId(u.id)}
                  className={cn(
                    'rounded-lg border p-2 text-left transition-colors sm:p-4',
                    escolhido ? 'border-primary bg-primary/8' : 'border-border hover:border-border-strong hover:bg-surface-2',
                  )}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-[14px] font-semibold text-text">
                      <span aria-hidden>{TIPO[u.tipo].icone} </span>{u.nome}
                    </span>
                    <span className="text-[13px] font-semibold tabular-nums text-text">{money(valor)}</span>
                  </span>
                  <span className="mt-0.5 block text-[12px] text-text-muted">
                    {u.camas} · até {u.capacidade} pessoas · {money(valor / Math.max(n, 1))}/noite
                  </span>
                  <span className="mt-1.5 flex flex-wrap gap-1">
                    {u.comodidades.slice(0, 5).map((c) => (
                      <span key={c} className="rounded bg-surface-3 px-1.5 py-0.5 text-[11px] text-text-secondary">
                        <span aria-hidden>{COMODIDADE[c].icone} </span>{COMODIDADE[c].rotulo}
                      </span>
                    ))}
                  </span>
                </button>
              )
            })}
          </div>
        </fieldset>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-4 lg:gap-6">
          <Input label="Hóspede" value={hospede} onChange={(e) => setHospede(e.target.value)} placeholder="Nome de quem se hospeda" />
          <Input label="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(48) 9…" />
          <Select label="Canal" value={canal} onChange={(e) => setCanal(e.target.value as CanalReserva)}>
            {Object.entries(CANAL).map(([id, rotulo]) => <option key={id} value={id}>{rotulo}</option>)}
          </Select>
        </div>

        {erro && (
          <p role="alert" className="rounded-lg border border-critical/40 bg-critical/10 px-4 py-3 text-[13px] text-text-secondary">{erro}</p>
        )}
      </div>
    </Modal>
  )
}
