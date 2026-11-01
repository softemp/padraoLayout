import { useParametrosDaTela } from './useParametrosDaTela'

/**
 * Aba/recorte da tela no `state` da navegação (`aba`, ou outro nome em `parametro`): sobrevive ao F5 na mesma aba e a
 * URL fica limpa. Valor fora de `validas` cai no primeiro, que não é gravado. Trocar descarta os outros parâmetros,
 * exceto os de `manter`.
 */
export function useAbaDaTela<T extends string>(
  validas: readonly T[],
  { manter = [] as string[], parametro = 'aba' }: { manter?: string[]; parametro?: string } = {},
) {
  const [busca, setBusca] = useParametrosDaTela()
  const pedida = busca.get(parametro)
  const ativa = (validas.find((v) => v === pedida) ?? validas[0]) as T
  const trocar = (aba: T) => {
    const p = new URLSearchParams()
    for (const k of manter) {
      const v = busca.get(k)
      if (v !== null) p.set(k, v)
    }
    if (aba !== validas[0]) p.set(parametro, aba)
    setBusca(p, { replace: true })
  }
  return [ativa, trocar, busca] as const
}
