import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { criarProjeto, responsaveisProjeto } from '@/shared/api/projetos'
import { clientes } from '@/shared/api/mock-db'
import { Button } from '@/shared/ui/Button'
import { Input, Select } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'
import { money, number } from '@/shared/lib/format'

const hoje = () => new Date().toISOString().slice(0, 10)
const daquiA = (dias: number) => new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10)

export function NovoProjetoModal({ aberto, onFechar, onCriado }: { aberto: boolean; onFechar: () => void; onCriado: (id: number) => void }) {
  const qc = useQueryClient()
  const [nome, setNome] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [responsavel, setResponsavel] = useState<string>(responsaveisProjeto[0])
  const [inicio, setInicio] = useState(hoje())
  const [prazo, setPrazo] = useState(daquiA(90))
  const [valorContrato, setValor] = useState(0)
  const [custoHora, setCustoHora] = useState(150)
  const [horasOrcadas, setHoras] = useState(0)
  const [erro, setErro] = useState<string | null>(null)

  const ativos = clientes.filter((c) => c.excluidoEm === null).slice(0, 40)

  const criar = useMutation({
    mutationFn: () => {
      const cliente = ativos.find((c) => String(c.id) === clienteId)
      if (!cliente) throw new Error('Escolha o cliente.')
      return criarProjeto({
        nome, cliente: cliente.nome, clienteId: cliente.id, responsavel,
        inicio: new Date(`${inicio}T12:00:00`).toISOString(),
        prazo: new Date(`${prazo}T12:00:00`).toISOString(),
        valorContrato, custoHora, horasOrcadas,
      })
    },
    onSuccess: (projeto) => {
      void qc.invalidateQueries({ queryKey: ['projetos'] })
      void qc.invalidateQueries({ queryKey: ['projetos-totais'] })
      setErro(null)
      onCriado(projeto.id)
    },
    onError: (e: Error) => setErro(e.message),
  })

  // O número que ninguém calcula na hora de vender: quanto sobra por hora.
  const custoTotal = horasOrcadas * custoHora
  const margem = valorContrato > 0 ? (valorContrato - custoTotal) / valorContrato : 0

  return (
    <Modal
      aberto={aberto}
      titulo="Novo projeto"
      descricao="O plano começa aqui; as fases e tarefas entram depois, na estrutura."
      largura="max-w-2xl"
      onFechar={criar.isPending ? () => {} : onFechar}
      rodape={
        <>
          <Button variant="ghost" onClick={onFechar} disabled={criar.isPending}>Cancelar</Button>
          <Button loading={criar.isPending} onClick={() => criar.mutate()}>Criar projeto</Button>
        </>
      }
    >
      <div className="space-y-4">
        {erro && <p role="alert" className="rounded-lg border border-critical/30 bg-critical/10 px-3 py-2.5 text-[13px] text-critical">⚠️ {erro}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 lg:gap-6">
          <Input label="Nome do projeto" className="sm:col-span-2" data-foco-inicial value={nome} onChange={(e) => setNome(e.target.value)} />
          <Select label="Cliente" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
            <option value="">Selecione…</option>
            {ativos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </Select>
          <Select label="Responsável" value={responsavel} onChange={(e) => setResponsavel(e.target.value)}>
            {responsaveisProjeto.map((r) => <option key={r} value={r}>{r}</option>)}
          </Select>
          <Input label="Início" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          <Input label="Prazo" type="date" hint="Vira a linha de base — replanejar depois não a apaga." value={prazo} onChange={(e) => setPrazo(e.target.value)} />
          <Input label="Valor do contrato (R$)" type="number" step="0.01" min={0} value={valorContrato} onChange={(e) => setValor(Number(e.target.value))} />
          <Input label="Horas orçadas" type="number" min={1} value={horasOrcadas} onChange={(e) => setHoras(Number(e.target.value))} />
          <Input label="Custo por hora (R$)" type="number" step="0.01" min={0} hint="Copiado no projeto: reajuste futuro não reescreve esta margem." value={custoHora} onChange={(e) => setCustoHora(Number(e.target.value))} />
        </div>

        <dl className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-surface-2 p-2 sm:p-4 text-center">
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-text-muted">Custo previsto</dt>
            <dd className="mt-0.5 text-[13px] font-semibold tabular-nums text-text">{money(custoTotal)}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-text-muted">Margem prevista</dt>
            <dd className={`mt-0.5 text-[13px] font-semibold tabular-nums ${margem < 0.2 ? 'text-warning' : 'text-good'}`}>
              {(margem * 100).toFixed(1)}%
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-text-muted">Valor por hora</dt>
            <dd className="mt-0.5 text-[13px] font-semibold tabular-nums text-text">
              {horasOrcadas > 0 ? money(valorContrato / horasOrcadas) : '—'}
            </dd>
          </div>
        </dl>

        <p className="rounded-md bg-surface-2 px-3 py-2 text-[12px] text-text-secondary">
          As <strong className="text-text">{number(horasOrcadas)}h</strong> aqui são a promessa comercial. O plano real
          nasce das tarefas — e a tela de estrutura mostra quando os dois discordam.
        </p>
      </div>
    </Modal>
  )
}
