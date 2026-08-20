/**
 * Specular-highlight parallax: Apple Liquid Glass's edge light follows the
 * cursor. A pointer feed writes two normalized CSS vars (-1..1) onto the
 * hovered glass pane — `--dsh-aqua-spec-x` / `--dsh-aqua-spec-y` — and the
 * stylesheet's `--dsh-aqua-glass-shadow-*` reads them in `calc()`, so the rim
 * brightens on the edge facing the cursor and dims on the far edge.
 *
 * Document-level delegation + one rAF merge (no per-pane listeners, zero
 * layout reads per frame — geometry is captured once per hover session from
 * spot-core's visual rect). Unlike the tilt, this only changes box-shadow
 * alphas, so the sidebar keeps it even while its settings dialog is open.
 */
import { closestSpot, inside, visualRect } from './spot-core.ts'

/** CSS vars written on the hovered pane (cursor offset, -1..1). */
const SPEC_X = '--dsh-aqua-spec-x'
const SPEC_Y = '--dsh-aqua-spec-y'

/**
 * Attach the specular parallax feed.
 * @returns a disposer that drops listeners and inline vars.
 */
export function startSpecularParallax(): () => void {
  let current: HTMLElement | null = null
  let visual: DOMRect | null = null
  let raf = 0

  const clear = (): void => {
    if (current === null) return
    current.style.removeProperty(SPEC_X)
    current.style.removeProperty(SPEC_Y)
    current = null
    visual = null
  }

  const paint = (clientX: number, clientY: number): void => {
    if (raf !== 0) return
    raf = requestAnimationFrame(() => {
      raf = 0
      if (current === null || visual === null) return
      if (!inside(visual, clientX, clientY)) {
        clear()
        return
      }
      const sx = Math.min(1, Math.max(-1, ((clientX - visual.left) / visual.width) * 2 - 1))
      const sy = Math.min(1, Math.max(-1, ((clientY - visual.top) / visual.height) * 2 - 1))
      current.style.setProperty(SPEC_X, sx.toFixed(4))
      current.style.setProperty(SPEC_Y, sy.toFixed(4))
    })
  }

  const onMove = (event: PointerEvent): void => {
    const spot = closestSpot(event.target)
    if (spot === null || spot !== current) return
    paint(event.clientX, event.clientY)
  }

  const onOver = (event: PointerEvent): void => {
    const spot = closestSpot(event.target)
    if (spot === null) return
    const rect = visualRect(spot)
    if (!inside(rect, event.clientX, event.clientY)) return
    current = spot
    visual = rect
    paint(event.clientX, event.clientY)
  }

  const onOut = (event: PointerEvent): void => {
    const spot = closestSpot(event.target)
    if (spot === null || spot !== current) return
    if (visual !== null && inside(visual, event.clientX, event.clientY)) return
    clear()
  }

  document.addEventListener('pointermove', onMove, { passive: true })
  document.addEventListener('pointerover', onOver, { passive: true })
  document.addEventListener('pointerout', onOut, { passive: true })

  return () => {
    document.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerover', onOver)
    document.removeEventListener('pointerout', onOut)
    if (raf !== 0) cancelAnimationFrame(raf)
    clear()
  }
}
