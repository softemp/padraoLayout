import { useEffect, type RefObject } from 'react'

/** Fecha dropdown/drawer ao clicar fora ou apertar Esc. */
export function useOnClickOutside(ref: RefObject<HTMLElement>, onClose: () => void, ativo = true) {
  useEffect(() => {
    if (!ativo) return
    const clique = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('mousedown', clique)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('mousedown', clique)
      document.removeEventListener('keydown', tecla)
    }
  }, [ref, onClose, ativo])
}
