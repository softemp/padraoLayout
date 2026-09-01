import { useEffect, useState } from 'react'
import type { PedidoCompra } from '@/shared/api/types'
import type { LinhaRecebimento } from '@/shared/api/compras'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'
import { cn } from '@/shared/lib/cn'
import { money, number } from '@/shared/lib/format'

/**
 * Conferência a três pontas na tela: o que foi PEDIDO, o que está CHEGANDO e
 * o que a NOTA cobra. A divergência é mostrada na hora — e não impede receber:
 * o caminhão vai embora, e mercadoria na doca é problema pior.
 */
export function RecebimentoModal({
  pedido, salvando, erro, onFechar, onConfirmar,
}: {
  pedido: PedidoCompra | null
  salvando: boolean
  erro?: string | null
  onFechar: () => void
  onConfirmar: (linhas: LinhaRecebimento[], documento: string) => void
}) {
  const [linhas, setLinhas] = useState<Record<number, { quantidade: number; precoNota: number }>>({})
  const [documento, setDocumento] = useState('')

  useEffect(() => {
    if (pedido) {
      setDocumento('')
      setLinhas(
        Object.fromEntries(
          pedido.itens.map((i) => [i.id, { quantidade: i.quantidade - i.quantidadeRecebida, precoNota: i.precoUnitario }]),
        ),
      )
    }
  }, [pedido])

  const total = pedido?.itens.reduce((s, i) => s + (linhas[i.id]?.quantidade ?? 0) * (linhas[i.id]?.precoNota ?? 0), 0) ?? 0

  const divergencias = (pedido?.itens ?? []).flatMap((item) => {
    const linha = linhas[item.id]
    if (!linha || linha.quantidade <= 0) return []
    const faltavam = item.quantidade - item.quantidadeRecebida
    const avisos: string[] = []
    if (linha.quantidade > faltavam) avisos.push(`${item.sku}: ${linha.quantidade} recebidos contra ${faltavam} pendentes`)
    if (Math.abs(linha.precoNota - item.precoUnitario) > 0.009) {
      avisos.push(`${item.sku}: nota ${money(linha.precoNota)} × pedido ${money(item.precoUnitario)}`)
    }
    return avisos
  })

  return (
    <Modal
      aberto={!!pedido}
      titulo="Receber mercadoria"
      descricao={pedido ? `${pedido.numero} · ${pedido.fornecedor}` : undefined}
      largura="max-w-3xl"
      onFechar={salvando ? () => {} : onFechar}
      rodape={
        <>
          <Button variant="ghost" onClick={onFechar} disabled={salvando}>Cancelar</Button>
          <Button
            loading={salvando}
            onClick={() =>
              onConfirmar(
                Object.entries(linhas)
                  .map(([id, l]) => ({ itemPedidoId: Number(id), quantidade: l.quantidade, precoNota: l.precoNota }))
                  .filter((l) => l.quantidade > 0),
                documento,
              )
            }
          >
            Confirmar recebimento
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {erro && (
          <p role="alert" className="rounded-lg border border-critical/30 bg-critical/10 px-3 py-2.5 text-[13px] text-critical">⚠️ {erro}</p>
        )}

        <Input
          label="Nota fiscal do recebimento"
          data-foco-inicial
          placeholder="NF 45231"
          hint="O custo da NOTA é o que forma o custo médio no estoque — não o preço do pedido."
          value={documento}
          onChange={(e) => setDocumento(e.target.value)}
        />

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2/60 text-[12px] uppercase tracking-wide text-text-muted">
                <th className="px-3 py-2.5 text-left font-semibold">Item</th>
                <th className="px-2 py-2.5 text-right font-semibold">Pedido</th>
                <th className="px-2 py-2.5 text-right font-semibold">Já recebido</th>
                <th className="px-2 py-2.5 text-right font-semibold">Recebendo</th>
                <th className="px-3 py-2.5 text-right font-semibold">Preço da nota</th>
              </tr>
            </thead>
            <tbody>
              {pedido?.itens.map((item) => {
                const linha = linhas[item.id] ?? { quantidade: 0, precoNota: item.precoUnitario }
                const divergePreco = Math.abs(linha.precoNota - item.precoUnitario) > 0.009
                return (
                  <tr key={item.id} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2">
                      <p className="text-[13px] font-medium text-text">{item.nome}</p>
                      <p className="font-mono text-[11px] text-text-muted">{item.sku}</p>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-text-secondary">{number(item.quantidade)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-text-muted">{number(item.quantidadeRecebida)}</td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        min={0}
                        value={linha.quantidade}
                        onChange={(e) => setLinhas((a) => ({ ...a, [item.id]: { ...linha, quantidade: Number(e.target.value) } }))}
                        className="h-8 w-20 rounded-md border border-border bg-surface px-2 text-right text-[13px] tabular-nums text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={linha.precoNota}
                        onChange={(e) => setLinhas((a) => ({ ...a, [item.id]: { ...linha, precoNota: Number(e.target.value) } }))}
                        className={cn(
                          'h-8 w-24 rounded-md border bg-surface px-2 text-right text-[13px] tabular-nums text-text focus:outline-none focus:ring-2',
                          divergePreco ? 'border-warning focus:border-warning focus:ring-warning/25' : 'border-border focus:border-primary focus:ring-primary/25',
                        )}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {divergencias.length > 0 && (
          <div className="space-y-1.5 rounded-lg border border-warning/40 bg-warning/10 px-3.5 py-3 text-[13px]">
            <p className="font-semibold text-text">Divergências na conferência</p>
            <ul className="space-y-0.5 text-text-secondary">
              {divergencias.map((d) => <li key={d}>· {d}</li>)}
            </ul>
            <p className="pt-1 text-[12px] text-text-muted">
              A divergência não impede receber — a mercadoria está na doca. Ela marca a conta a pagar
              como <strong className="text-text-secondary">retida</strong>: receber errado se resolve depois;
              pagar errado é dinheiro que já saiu.
            </p>
          </div>
        )}

        <dl className="flex items-baseline justify-between rounded-lg border border-border bg-surface-2 px-3.5 py-3">
          <dt className="text-[13px] text-text-secondary">Valor da nota (do que está entrando)</dt>
          <dd className="text-[15px] font-semibold tabular-nums text-text">{money(total)}</dd>
        </dl>

        <p className="text-[12px] text-text-muted">
          Confirmar gera <strong className="text-text-secondary">entrada no estoque</strong> de cada item (com o
          custo da nota) e a <strong className="text-text-secondary">conta a pagar</strong> do fornecedor.
        </p>
      </div>
    </Modal>
  )
}
