import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Desktop, DotsThreeVertical, Moon, Sun } from '@phosphor-icons/react'
import { useTheme } from '../../theme/ThemeProvider'
import type { ThemePreference } from '../../theme/ThemeProvider'

const MENU_WIDTH = 210
const MENU_HEIGHT = 140
const GUTTER = 8

const OPTIONS: Array<{ value: ThemePreference; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Clair', icon: Sun },
  { value: 'dark', label: 'Sombre', icon: Moon },
  { value: 'system', label: 'Système', icon: Desktop },
]

type Position = { top: number; left: number }

/**
 * Menu du bloc profil : le déclencheur reste neutre, ce sont les libellés
 * (Clair / Sombre / Système) qui portent le sens. Même mécanique que le menu
 * d'actions des lignes de tableau — voir `PpmRowActions`.
 */
export function ProfileMenu() {
  const { preference, setPreference } = useTheme()
  const [position, setPosition] = useState<Position | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const close = () => setPosition(null)

  const open = () => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return

    // Le déclencheur est au bas de la sidebar : on ouvre vers le haut.
    const below = rect.bottom + 6
    const top = below + MENU_HEIGHT > window.innerHeight - GUTTER
      ? Math.max(GUTTER, rect.top - MENU_HEIGHT - 6)
      : below
    const left = Math.min(
      Math.max(GUTTER, rect.right - MENU_WIDTH),
      window.innerWidth - MENU_WIDTH - GUTTER,
    )

    setPosition({ top, left })
  }

  useEffect(() => {
    if (!position) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    // Le menu est ancré au bouton : on le referme dès que la page bouge.
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

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`icon-button${position ? ' is-open' : ''}`}
        aria-haspopup="menu"
        aria-expanded={Boolean(position)}
        aria-label="Préférences d’affichage"
        title="Préférences d’affichage"
        onClick={() => (position ? close() : open())}
      >
        <DotsThreeVertical size={16} weight="bold" aria-hidden="true" />
      </button>

      {/* Rendu dans le body : la sidebar défile (overflow) et rognerait le menu. */}
      {position &&
        createPortal(
          <>
            <div className="row-actions__scrim" onClick={close} />
            <div
              className="row-actions__menu"
              role="menu"
              style={{ top: position.top, left: position.left, width: MENU_WIDTH }}
            >
              {OPTIONS.map((option) => {
                const Icon = option.icon
                const isActive = preference === option.value

                return (
                  <button
                    key={option.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={isActive}
                    className={`row-actions__item${isActive ? ' row-actions__item--active' : ''}`}
                    onClick={() => {
                      close()
                      setPreference(option.value)
                    }}
                  >
                    <Icon size={15} weight="bold" aria-hidden="true" />
                    {option.label}
                    {isActive && (
                      <Check size={14} weight="bold" aria-hidden="true" className="row-actions__check" />
                    )}
                  </button>
                )
              })}
            </div>
          </>,
          document.body,
        )}
    </>
  )
}
