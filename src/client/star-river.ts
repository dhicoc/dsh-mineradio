/**
 * Mineradio-style particle stage — a from-scratch Canvas 2D re-creation of the
 * music player's signature backdrop motion (no code copied from the player):
 *
 *   1. STAR RIVER — hundreds of dust points organised in horizontal "bands"
 *      that drift sideways while sine waves carry them up/down. Cool
 *      blue→violet particles with a warm champagne ridge per band, plus a
 *      slow twinkle. Reads as a slow galaxy river flowing behind the glass.
 *   2. POINTER FIELD — particles near the cursor brighten and swell, like
 *      the player's silk cover reacting to the mouse.
 *   3. RIPPLES — a click drops a ripple: particles ride the expanding ring
 *      outwards and flash brighter, then everything settles back.
 *
 * Performance discipline: fixed particle cap, DPR capped at 1.5, sprite-based
 * rendering (one pre-baked radial dot per colour, no per-particle gradients),
 * `requestAnimationFrame` loop paused on `visibilitychange`, and a single
 * static frame under `prefers-reduced-motion`.
 */

/** Cap on device pixel ratio — 2x screens render indistinguishably at 1.5x. */
const DPR_CAP = 1.5

/** Hard particle ceiling regardless of viewport size (2× the default field). */
const MAX_PARTICLES = 1400

/** Ripple lifetime in seconds and simultaneous cap (mirrors the feel of the
 *  player's 2s ripple window). */
const RIPPLE_LIFE = 2
const RIPPLE_CAP = 8

/** Pointer influence radius, CSS pixels. */
const POINTER_RADIUS = 130

/** Pointer drag radius, CSS pixels — particles within this get pulled along
 *  the cursor's motion. */
const DRAG_RADIUS = 190

/** Sprite variants: cool blue, violet, warm champagne, near-white. */
type SpriteKind = 0 | 1 | 2 | 3

interface StarParticle {
  /** Band index (0..BANDS-1) — drives lane height and colour mix. */
  band: number
  /** Normalised position inside the band (0..1) — the ridge profile keys off it. */
  local: number
  /** Lateral phase (0..1); the flow animation advances it. */
  flow: number
  /** Per-particle speed multiplier (0.6..1.4). */
  pace: number
  /** Twinkle phase offset. */
  twinkleSeed: number
  /** Depth factor 0..1 — far particles are smaller, slower, dimmer. */
  depth: number
  /** Sprite kind — chosen from band + warmth. */
  kind: SpriteKind
  /** Live screen coordinates (recomputed each frame). */
  x: number
  y: number
  /** Live rendered alpha (ripple/pointer boosts included). */
  alpha: number
  /** Live rendered radius. */
  radius: number
  /** Drag offset (px) — pushed along the pointer's motion, decays back. */
  ox: number
  oy: number
}

interface Ripple {
  x: number
  y: number
  /** Age in seconds; dies at RIPPLE_LIFE. */
  age: number
  /** 0.5..1.6 strength. */
  strength: number
}

/** Public knob: dark scheme runs the full galaxy, light scheme dims it. */
export interface StarRiverOptions {
  dark: boolean
  /** Particle density, 0-100 (50 = 1× the default field, 100 = 2×). */
  density?: number
  /** Respect the OS reduced-motion preference by rendering one static frame
   *  instead of animating. OFF by default: the star river is the skin's
   *  signature motion, so it animates unless an app-level switch opts in to
   *  accessibility static frames. */
  respectReducedMotion?: boolean
}

/** Handle returned by {@link mountStarRiver}. */
export interface StarRiverHandle {
  /** Update the scheme knob. */
  setDark(dark: boolean): void
  /** Update the particle density (0-100) and rebuild the field live. */
  setDensity(density: number): void
  /** Audio reactivity: bass `low` drives the hop, treble `high` the sparkle. */
  setAudio(low: number, high: number): void
  /** Tear the stage down (canvas, listeners, animation). */
  dispose(): void
}

/** Number of horizontal bands in the river. */
const BANDS = 6

function hash(n: number): number {
  return (Math.sin(n * 127.1) * 43758.5453123) % 1
}

/** Bake a soft radial dot sprite (white core → transparent rim). */
function bakeSprite(cr: number, cg: number, cb: number): HTMLCanvasElement {
  const size = 32
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx === null) return canvas
  const half = size / 2
  const g = ctx.createRadialGradient(half, half, 0, half, half, half)
  g.addColorStop(0.0, `rgba(${cr}, ${cg}, ${cb}, 0.95)`)
  g.addColorStop(0.4, `rgba(${cr}, ${cg}, ${cb}, 0.55)`)
  g.addColorStop(0.75, `rgba(${cr}, ${cg}, ${cb}, 0.14)`)
  g.addColorStop(1.0, `rgba(${cr}, ${cg}, ${cb}, 0)`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return canvas
}

/** Mount the particle stage inside the ambient container. Idempotent: a
 *  second call reuses the existing canvas. */
export function mountStarRiver(ambient: HTMLElement, options: StarRiverOptions): StarRiverHandle {
  const existing = ambient.querySelector<HTMLCanvasElement>('canvas[data-dsh-mineradio-stars]')
  const canvas = existing ?? document.createElement('canvas')
  if (existing === null) {
    canvas.setAttribute('data-dsh-mineradio-stars', '')
    canvas.setAttribute('aria-hidden', 'true')
    ambient.appendChild(canvas)
  }

  const ctx = canvas.getContext('2d', { alpha: true })
  const sprites = [
    bakeSprite(150, 205, 255), // cool blue
    bakeSprite(168, 140, 255), // violet
    bakeSprite(244, 210, 138), // champagne
    bakeSprite(238, 246, 255), // near-white
  ]

  let dark = options.dark
  let density = Math.max(0, Math.min(100, options.density ?? 60))
  let width = 0
  let height = 0
  let dpr = 1
  let disposed = false
  let frame = 0
  /** Audio-reactivity energy 0..1 (written by the layer's audio feed). */
  let audioHigh = 0
  let audioLow = 0

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
  let reducedMotion = !!options.respectReducedMotion && reduced.matches

  const stars: StarParticle[] = []
  const ripples: Ripple[] = []
  const pointer = { x: -9999, y: -9999, vx: 0, vy: 0, active: false, dragging: false }

  function build(): void {
    stars.length = 0
    const area = window.innerWidth * window.innerHeight
    const m = density / 50 // 0..2
    const byArea = Math.round(Math.max(30, Math.min(MAX_PARTICLES, (area / 3400) * m)))
    for (let i = 0; i < byArea; i++) {
      const band = i % BANDS
      const seed = i * 0.618
      const local = ((hash(seed * 3.7) % 1) + 1) % 1
      const depth = ((hash(seed * 9.13) % 1) + 1) % 1
      const bandN = (band + 0.5) / BANDS
      // Cool → violet across bands; a warm champagne minority everywhere.
      let kind: SpriteKind
      const pick = ((hash(seed * 17.7) % 1) + 1) % 1
      if (pick > 0.86) kind = 2
      else if (pick > 0.7) kind = 3
      else kind = bandN < 0.5 ? 0 : 1
      stars.push({
        band,
        local,
        flow: ((hash(seed * 5.1) % 1) + 1) % 1,
        pace: 0.6 + (((hash(seed * 11.3) % 1) + 1) % 1) * 0.8,
        twinkleSeed: seed * 9.0,
        depth,
        kind,
        x: 0,
        y: 0,
        alpha: 0,
        radius: 0,
        ox: 0,
        oy: 0,
      })
    }
  }

  function resize(): void {
    width = ambient.clientWidth || window.innerWidth
    height = ambient.clientHeight || window.innerHeight
    dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP)
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
  }

  /** Ripple displacement for a star, given the live ripple list. */
  function rippleAt(x: number, y: number): { push: number; glow: number } {
    let push = 0
    let glow = 0
    for (const r of ripples) {
      const dx = x - r.x
      const dy = y - r.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      const lifeN = r.age / RIPPLE_LIFE
      if (lifeN >= 1) continue
      const waveR = r.age * 260 * (0.7 + r.strength * 0.3)
      const ringW = 46 + r.age * 30
      const ring = Math.exp(-(((dist - waveR) / ringW) ** 2))
      const bulge = Math.exp(-((dist / (70 + r.age * 90)) ** 2)) * (1 - lifeN)
      const env = Math.min(1, r.age / 0.12) * (1 - lifeN * lifeN)
      push += (ring * 1.0 + bulge * 0.7) * env * r.strength
      glow += (ring * 0.9 + bulge * 0.5) * env * r.strength
    }
    return { push, glow }
  }

  function render(t: number): void {
    if (ctx === null) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    // Light scheme: much quieter river. Dark scheme is the full galaxy, but
    // kept a touch under full so the warm champagne particles don't read as a
    // glaring golden field on the near-black board.
    const master = dark ? 0.9 : 0.4
    ctx.globalCompositeOperation = 'lighter'

    for (const s of stars) {
      const bandN = (s.band + 0.5) / BANDS
      const speed = (0.008 + bandN * 0.012) * s.pace * (reducedMotion ? 0 : 1)
      s.flow = (s.flow + speed * 0.016) % 1

      // The drag offset relaxes back to the wave lane each frame.
      s.ox *= 0.93
      s.oy *= 0.93

      // Horizontal drift with a wide band-specific sweep.
      const sweep = width * (0.55 + bandN * 0.4)
      let bx = (s.flow * 2 - 0.5) * sweep + width / 2
      // Wrap into viewport.
      if (bx < -30) bx += width + 60
      else if (bx > width + 30) bx -= width + 60

      const wavePhase = s.flow * Math.PI * 2 * (1.1 + bandN * 0.5) + s.twinkleSeed
      const laneY = height * (0.06 + bandN * 0.88)
      const ridge = Math.exp(-(((s.local - 0.45) / 0.26) ** 2))
      const by = laneY + Math.sin(wavePhase) * (14 + bandN * 22) * (0.5 + s.depth) + (s.local - 0.5) * 26

      // Drag: the pointer pulls nearby particles along its motion — a gentle
      // stir on hover, a strong pull while the button is held.
      if (pointer.active) {
        const pdx = bx - pointer.x
        const pdy = by - pointer.y
        const pd = Math.sqrt(pdx * pdx + pdy * pdy)
        if (pd < DRAG_RADIUS) {
          const near = 1 - pd / DRAG_RADIUS
          const pull = near * near * (pointer.dragging ? 1.9 : 0.35)
          s.ox += pointer.vx * pull * 0.15
          s.oy += pointer.vy * pull * 0.15
        }
      }

      s.x = bx + s.ox
      s.y = by + s.oy

      const twinklePhase = t * (0.5 + ((s.twinkleSeed * 0.37) % 1) * 0.9) + s.twinkleSeed
      const twinkle = (0.5 + 0.5 * Math.sin(twinklePhase)) ** 3
      let alpha = (0.10 + ridge * 0.42 + twinkle * 0.30) * (0.45 + s.depth * 0.55) * master
      let radius = (0.9 + ridge * 1.9 + twinkle * 1.6 + s.depth * 0.8) * (dark ? 1 : 0.85)

      // Pointer field: near-cursor particles swell and brighten.
      if (pointer.active) {
        const pdx = s.x - pointer.x
        const pdy = s.y - pointer.y
        const pd = Math.sqrt(pdx * pdx + pdy * pdy)
        if (pd < POINTER_RADIUS) {
          const near = 1 - pd / POINTER_RADIUS
          const lift = near * near
          alpha += lift * 0.5 * master
          radius += lift * 2.2
        }
      }

      // Ripples: ride the ring outwards, flash brighter.
      const { push, glow } = rippleAt(s.x, s.y)
      if (push > 0.001) {
        for (const r of ripples) {
          const rdx = s.x - r.x
          const rdy = s.y - r.y
          const rd = Math.sqrt(rdx * rdx + rdy * rdy) || 1
          const lifeN = r.age / RIPPLE_LIFE
          if (lifeN >= 1) continue
          const waveR = r.age * 260 * (0.7 + r.strength * 0.3)
          const ringW = 46 + r.age * 30
          const ring = Math.exp(-(((rd - waveR) / ringW) ** 2))
          const env = Math.min(1, r.age / 0.12) * (1 - lifeN * lifeN)
          const move = ring * env * r.strength * 26
          s.x += (rdx / rd) * move
          s.y += (rdy / rd) * move
        }
        alpha += glow * 0.6 * master
        radius += glow * 2.0
      }

      // Audio reactivity, split by frequency so the field matches the music's
      // lows and highs dynamically:
      //  - treble "high" → brighten + swell (a fast sparkle);
      //  - bass "low"   → hop each particle upward (the beat's kick).
      if (audioHigh > 0.001) {
        alpha *= 1 + audioHigh * 0.9
        radius *= 1 + audioHigh * 0.5
      }
      if (audioLow > 0.001) {
        const hop = audioLow * 36 * (0.35 + s.depth * 0.65) * (0.7 + 0.3 * Math.sin(s.twinkleSeed * 6.1))
        s.y -= hop
      }

      if (alpha <= 0.012) continue
      const sprite = sprites[s.kind]
      const d = radius * 2
      ctx.globalAlpha = Math.min(alpha, 0.95)
      ctx.drawImage(sprite, s.x - radius, s.y - radius, d, d)
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }

  let last = performance.now()

  function tick(now: number): void {
    if (disposed) return
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    for (const r of ripples) r.age += dt
    for (let i = ripples.length - 1; i >= 0; i--) {
      if (ripples[i].age >= RIPPLE_LIFE) ripples.splice(i, 1)
    }
    render(now / 1000)
    frame = requestAnimationFrame(tick)
  }

  function onResize(): void {
    resize()
    build()
    if (reducedMotion) render(0)
  }

  function onPointerMove(event: PointerEvent): void {
    const rect = canvas.getBoundingClientRect()
    const nx = event.clientX - rect.left
    const ny = event.clientY - rect.top
    if (pointer.x < -9000) {
      // First move in: anchor without a velocity spike.
      pointer.vx = 0
      pointer.vy = 0
    } else {
      pointer.vx += (nx - pointer.x - pointer.vx) * 0.5
      pointer.vy += (ny - pointer.y - pointer.vy) * 0.5
    }
    pointer.x = nx
    pointer.y = ny
    pointer.active = true
  }

  function onPointerLeave(): void {
    pointer.active = false
    pointer.dragging = false
    pointer.x = -9999
    pointer.y = -9999
    pointer.vx = 0
    pointer.vy = 0
  }

  function onPointerDown(event: PointerEvent): void {
    // Hold-to-drag: while the button is down, particles near the cursor are
    // pulled along its motion (stronger than the hover stir).
    pointer.dragging = true
    // The click ripple only drops on the empty backdrop — never when clicking
    // through the UI.
    if (event.target instanceof Element && event.target.closest('button, a, input, textarea, [role="button"]') !== null) return
    const rect = canvas.getBoundingClientRect()
    if (ripples.length >= RIPPLE_CAP) ripples.shift()
    ripples.push({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      age: 0,
      strength: 0.8 + Math.random() * 0.5,
    })
  }

  function onPointerUp(): void {
    pointer.dragging = false
  }

  function onVisibility(): void {
    if (document.hidden) {
      cancelAnimationFrame(frame)
      frame = 0
    } else if (!disposed && frame === 0 && !reducedMotion) {
      last = performance.now()
      frame = requestAnimationFrame(tick)
    }
  }

  function onReducedChange(): void {
    reducedMotion = !!options.respectReducedMotion && reduced.matches
    if (reducedMotion) {
      cancelAnimationFrame(frame)
      frame = 0
      render(0)
    } else if (frame === 0 && !document.hidden) {
      last = performance.now()
      frame = requestAnimationFrame(tick)
    }
  }

  resize()
  build()
  window.addEventListener('resize', onResize)
  window.addEventListener('pointermove', onPointerMove, { passive: true })
  window.addEventListener('pointerdown', onPointerDown, { passive: true })
  window.addEventListener('pointerup', onPointerUp, { passive: true })
  window.addEventListener('pointerout', onPointerLeave, { passive: true })
  document.addEventListener('visibilitychange', onVisibility)
  reduced.addEventListener('change', onReducedChange)

  if (reducedMotion) render(0)
  else frame = requestAnimationFrame(tick)

  return {
    setDark(next: boolean): void {
      dark = next
      if (reducedMotion) render(0)
    },
    setDensity(next: number): void {
      density = Math.max(0, Math.min(100, next))
      build()
      if (reducedMotion) render(0)
    },
    setAudio(low: number, high: number): void {
      audioLow = Math.max(0, Math.min(1, low))
      audioHigh = Math.max(0, Math.min(1, high))
    },
    dispose(): void {
      disposed = true
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointerout', onPointerLeave)
      document.removeEventListener('visibilitychange', onVisibility)
      reduced.removeEventListener('change', onReducedChange)
      canvas.remove()
    },
  }
}
