import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarPlus, DotsThreeVertical, PencilSimple, PlusSquare, Trash } from '@phosphor-icons/react'
import type { PpmRow } from '../ppm/types'

type RowActionsProps = {
  row: PpmRow
  canDelete: boolean
  onOpen: (mode: 'os' | 'avancement' | 'edit', row: PpmRow) => void
  onDelete: (row: PpmRow) => void
}

const MENU_WIDTH = 246
const GUTTER = 8

type Position = { top: number; left: number }

/** Menu d'actions d'une ligne : un seul déclencheur neutre, les libellés lèvent l'ambiguïté. */
export default function RowActions({ row, canDelete, onOpen, onDelete }: RowActionsProps) {
  const [position, setPosition] = useState<Position | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const close = () => setPosition(null)

  const open = () => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return

    const menuHeight = canDelete ? 196 : 152
    const below = rect.bottom + 6
    const top = below + menuHeight > window.innerHeight - GUTTER
      ? Math.max(GUTTER, rect.top - menuHeight - 6)
      : below
    const left = Math.min(Math.max(GUTTER, rect.right - MENU_WIDTH), window.innerWidth - MENU_WIDTH - GUTTER)

    setPosition({ top, left })
  }

  useEffect(() => {
    if (!position) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    const handleViewportChange = () => close()

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('scroll', handleViewportChange, true)
    window.addEventListener('resize', handleViewportChange)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('scroll', handleViewportChange, true)
      window.removeEventListener('resize', handleViewportChange)
    }
  }, [position])

  const run = (action: () => void) => {
    close()
    action()
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`icon-button${position ? ' is-open' : ''}`}
        aria-haspopup="menu"
        aria-expanded={Boolean(position)}
        aria-label={`Actions — ${row.objet}`}
        title="Actions"
        onClick={(e) => { e.stopPropagation(); (position ? close() : open()) }}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <DotsThreeVertical size={16} weight="bold" aria-hidden="true" />
      </button>

      {position &&
        createPortal(
          <>
            <div
              className="row-actions__scrim"
              onClick={(e) => { e.stopPropagation(); close() }}
              onMouseDown={(e) => e.stopPropagation()}
            />
            <div
              className="row-actions__menu"
              role="menu"
              style={{ top: position.top, left: position.left, width: MENU_WIDTH }}
            >
              <button
                type="button"
                role="menuitem"
                className="row-actions__item"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); run(() => onOpen('os', row)) }}
              >
                <CalendarPlus size={15} weight="bold" aria-hidden="true" />
                Nouvel OS / Avenant
              </button>

              <button
                type="button"
                role="menuitem"
                className="row-actions__item"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); run(() => onOpen('avancement', row)) }}
              >
                <PlusSquare size={15} weight="bold" aria-hidden="true" />
                Nouveau relevé d'avancement
              </button>

              <button
                type="button"
                role="menuitem"
                className="row-actions__item"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); run(() => onOpen('edit', row)) }}
              >
                <PencilSimple size={15} weight="bold" aria-hidden="true" />
                Modifier le marché
              </button>

              {canDelete && (
                <>
                  <div className="row-actions__sep" role="separator" />
                  <button
                    type="button"
                    role="menuitem"
                    className="row-actions__item row-actions__item--danger"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); run(() => onDelete(row)) }}
                  >
                    <Trash size={15} weight="bold" aria-hidden="true" />
                    Supprimer
                  </button>
                </>
              )}
            </div>
          </>,
          document.body,
        )}
    </>
  )
}
