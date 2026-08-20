/**
 * Cinematic camera for the ambient scene — makes the backdrop read as a 3D
 * stage rather than a flat wallpaper:
 *
 *   1. CURSOR PARALLAX + 3D TILT (the "wow"): the fluid board (far) and the
 *      star-river (near) shift, tilt (rotateX/rotateY under perspective) and
 *      roll at different rates as the pointer moves — the near layer travels
 *      ~2× further, so moving the mouse parallax-reveals real depth.
 *   2. IDLE DRIFT (the "breathe"): a slow low-frequency sine sway + roll so
 *      the scene keeps floating when the pointer is still — a 2D port of
 *      Mineradio's `cineTheta = sin(t*0.08)*0.012` idle orbit.
 *
 * Pure CSS-transform work (one rAF, GPU-composited); reduced-motion renders
 * nothing (the scene stays a clean static frame).
 */

/** Cursor parallax: translate (px), 3D tilt (deg) and in-plane roll (deg).
 *  Near layer ≈ 2× the far layer. */
const FAR_PTR_X = 20
const FAR_PTR_Y = 13
const FAR_TILT = 0.8
const FAR_ROLL = 0.6
const NEAR_PTR_X = 40
const NEAR_PTR_Y = 26
const NEAR_TILT = 1.5
const NEAR_ROLL = 1.2

/** Idle drift amplitude (CSS px) — subtle, for when the pointer is still. */
const FAR_IDLE_X = 10
const FAR_IDLE_Y = 6
const NEAR_IDLE_X = 20
const NEAR_IDLE_Y = 12

/** The fluid board stays overscaled so sway/tilt never exposes an edge; the
 *  star-river canvas is transparent, so it moves without any scale. */
const FLUID_SCALE = 1.08

/** Perspective distance for the 3D tilt (px): smaller = stronger tilt. */
const PERSPECTIVE = 1200

/** Pointer smoothing rate (per second): ~98% settled in ~0.4s. */
const POINTER_EASE = 10

export interface CinemaDriftHandle {
  dispose(): void
}

/** Start the cinematic camera over the ambient scene. */
export function startCinemaDrift(ambient: HTMLElement): CinemaDriftHandle {
  const fluid = ambient.querySelector<HTMLElement>('[data-dsh-aqua-fluid-canvas]')
  const stars = ambient.querySelector<HTMLElement>('canvas[data-dsh-mineradio-stars]')
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')

  let disposed = false
  let raf = 0
  let last = performance.now()
  const start = last
  // Pointer target (-1..1 from screen centre) and its smoothed value.
  let mx = 0
  let my = 0
  let smx = 0
  let smy = 0

  const onMove = (e: PointerEvent): void => {
    mx = (e.clientX / window.innerWidth) * 2 - 1
    my = (e.clientY / window.innerHeight) * 2 - 1
  }
  const onLeave = (): void => {
    mx = 0
    my = 0
  }

  const apply = (t: number): void => {
    const idleX = Math.sin(t * 0.08)
    const idleY = Math.sin(t * 0.06 + 1.0)
    const roll = Math.sin(t * 0.05 + 2.0)
    // Pointer parallax is opposite the pointer (depth), plus the idle sway.
    const fx = -smx * FAR_PTR_X + idleX * FAR_IDLE_X
    const fy = -smy * FAR_PTR_Y + idleY * FAR_IDLE_Y
    const fRotY = smx * FAR_TILT
    const fRotX = -smy * FAR_TILT
    const fRoll = -smx * FAR_ROLL + roll * 0.2
    const nx = -smx * NEAR_PTR_X + idleX * NEAR_IDLE_X
    const ny = -smy * NEAR_PTR_Y + idleY * NEAR_IDLE_Y
    const nRotY = smx * NEAR_TILT
    const nRotX = -smy * NEAR_TILT
    const nRoll = -smx * NEAR_ROLL + roll * 0.35
    if (fluid !== null) {
      fluid.style.transform = `perspective(${PERSPECTIVE}px) translate3d(${fx.toFixed(2)}px, ${fy.toFixed(2)}px, 0) rotateX(${fRotX.toFixed(3)}deg) rotateY(${fRotY.toFixed(3)}deg) rotate(${fRoll.toFixed(3)}deg) scale(${FLUID_SCALE})`
    }
    if (stars !== null) {
      stars.style.transform = `perspective(${PERSPECTIVE}px) translate3d(${nx.toFixed(2)}px, ${ny.toFixed(2)}px, 0) rotateX(${nRotX.toFixed(3)}deg) rotateY(${nRotY.toFixed(3)}deg) rotate(${nRoll.toFixed(3)}deg)`
    }
  }

  const reset = (): void => {
    if (fluid !== null) fluid.style.transform = ''
    if (stars !== null) stars.style.transform = ''
  }

  if (fluid !== null) fluid.style.willChange = 'transform'
  if (stars !== null) stars.style.willChange = 'transform'

  if (reduced.matches) {
    return {
      dispose(): void {
        disposed = true
        reset()
        if (fluid !== null) fluid.style.willChange = ''
        if (stars !== null) stars.style.willChange = ''
      },
    }
  }

  window.addEventListener('pointermove', onMove, { passive: true })
  window.addEventListener('pointerout', onLeave, { passive: true })

  const frame = (now: number): void => {
    if (disposed) return
    raf = requestAnimationFrame(frame)
    const dt = Math.min((now - last) / 1000, 0.1)
    last = now
    const k = 1 - Math.exp(-POINTER_EASE * dt)
    smx += (mx - smx) * k
    smy += (my - smy) * k
    apply((now - start) / 1000)
  }
  raf = requestAnimationFrame(frame)

  return {
    dispose(): void {
      disposed = true
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerout', onLeave)
      reset()
      if (fluid !== null) fluid.style.willChange = ''
      if (stars !== null) stars.style.willChange = ''
    },
  }
}
