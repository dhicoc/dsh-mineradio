/**
 * Mineradio glass dispersion filter — a reworked, single-tint port of the
 * player's `mineradio-control-glass-filter`.
 *
 * The original couples refraction and RGB channel split (which screen-blends
 * into an ugly magenta/purple). Here the two are separated:
 *
 *   - REFRACTION: a colourless `feDisplacementMap` warps the backdrop through
 *     a generated noise map (a blurred rounded-rect "clear centre" + red/blue
 *     gradients), so the things behind the glass visibly bend at the edges.
 *   - EDGE TINT: the refracted backdrop is laterally shifted and differenced
 *     against itself (`feBlend mode="difference"`), which isolates the edge
 *     signal only; a `feColorMatrix` then fills that signal with a SINGLE
 *     user-picked hue, luminance-driven alpha (so it stays transparent and
 *     edge-only), screen-blended over the refraction.
 *
 * The tint hue is adjustable at runtime via `setTint(hue)`. Chromium-only
 * (SVG `url()` in `backdrop-filter` is unsupported by Safari/Firefox); the
 * layer keeps its plain blur fallback there.
 */

const FILTER_ID = 'mineradio-glass-dispersion'
const TINT_ID = 'mineradio-glass-dispersion-tint'
const REFRACT_ID = 'mineradio-glass-dispersion-refract'
const TALL_FILTER_ID = 'mineradio-glass-dispersion-tall'
const TALL_TINT_ID = 'mineradio-glass-dispersion-tall-tint'
const TALL_REFRACT_ID = 'mineradio-glass-dispersion-tall-refract'
const ATTR = 'data-dsh-dispersion'

/** Default refraction strength (0-100) — the colourless warp of the backdrop.
 *  Kept modest so the refracted image stays close to the original. */
const DEFAULT_REF_SCALE = 60
/** Lateral shift that isolates the edge-only tint signal (halved from -28 to
 *  tighten the coloured fringe). */
const EDGE_DX = -14
/** Edge-tint opacity (kept high-transparency per the shipped look). */
const TINT_OPACITY = 0.45
/** Tint saturation / lightness for the hue→RGB conversion. */
const TINT_SAT = 0.85
const TINT_LIGHT = 0.6
/** Tint hue baked into the first paint before the layer applies its setting. */
const DEFAULT_TINT_HUE = 44

export interface GlassDispersionHandle {
  /** Re-colour the edge tint (hue in degrees, continuous). */
  setTint(hue: number): void
  /** Set the refraction strength (0-100 — the feDisplacementMap scale). */
  setRefraction(scale: number): void
  dispose(): void
}

/** Build the displacement map as a data URL (Mineradio's exact SVG recipe). */
function buildDisplacementMapDataUrl(width = 400, height = 92, radius = 50): string {
  const w = Math.max(240, Math.round(width))
  const h = Math.max(48, Math.round(height))
  const r = Math.max(12, Math.round(radius))
  const borderWidth = 0.07
  const edge = Math.min(w, h) * (borderWidth * 0.5)
  const innerW = Math.max(1, w - edge * 2)
  const innerH = Math.max(1, h - edge * 2)
  // Convex "lens" field: R channel = X (black left → red right), B channel =
  // Y (black top → blue bottom), so feDisplacementMap pushes content OUTWARD
  // from the centre (magnify) — the Liquid-Glass bulge. A blurred grey
  // rounded-rect flattens the centre, leaving the refraction only at the
  // curved rim/corners where a physical lens bends light most.
  const svg =
    `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">` +
    `<defs>` +
    `<linearGradient id="glass-x" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#000"/><stop offset="100%" stop-color="#f00"/></linearGradient>` +
    `<linearGradient id="glass-y" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#000"/><stop offset="100%" stop-color="#00f"/></linearGradient>` +
    `</defs>` +
    `<rect x="0" y="0" width="${w}" height="${h}" fill="#000"/>` +
    `<rect x="0" y="0" width="${w}" height="${h}" rx="${r}" fill="url(#glass-x)"/>` +
    `<rect x="0" y="0" width="${w}" height="${h}" rx="${r}" fill="url(#glass-y)" style="mix-blend-mode:screen"/>` +
    `<rect x="${edge.toFixed(2)}" y="${edge.toFixed(2)}" width="${innerW.toFixed(2)}" height="${innerH.toFixed(2)}" rx="${r}" fill="hsl(0 0% 50% / 1)" style="filter:blur(11px)"/>` +
    `</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

/** Convert HSL (h degrees, s/l 0-1) to RGB 0-1. */
function hslToRgb01(h: number, s: number, l: number): [number, number, number] {
  const hue = (((h % 360) + 360) % 360) / 360
  if (s === 0) return [l, l, l]
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const channel = (t: number): number => {
    let tt = t
    if (tt < 0) tt += 1
    if (tt > 1) tt -= 1
    if (tt < 1 / 6) return p + (q - p) * 6 * tt
    if (tt < 1 / 2) return q
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
    return p
  }
  return [channel(hue + 1 / 3), channel(hue), channel(hue - 1 / 3)]
}

/** Build the feColorMatrix `values` string: solid tint colour + luminance alpha. */
function tintMatrix(hue: number, opacity: number): string {
  const [r, g, b] = hslToRgb01(hue, TINT_SAT, TINT_LIGHT)
  const lr = (0.2126 * opacity).toFixed(4)
  const lg = (0.7152 * opacity).toFixed(4)
  const lb = (0.0722 * opacity).toFixed(4)
  return `0 0 0 0 ${r.toFixed(4)}  0 0 0 0 ${g.toFixed(4)}  0 0 0 0 ${b.toFixed(4)}  ${lr} ${lg} ${lb} 0 0`
}

/** Chromium-only, and `url()` must survive a backdrop-filter assignment. */
function supportsSvgBackdropFilter(): boolean {
  try {
    const ua = navigator.userAgent || ''
    if ((/Safari/.test(ua) && !/Chrome/.test(ua)) || /Firefox/.test(ua)) return false
    const div = document.createElement('div')
    div.style.backdropFilter = `url(#${FILTER_ID})`
    return div.style.backdropFilter !== ''
  } catch {
    return false
  }
}

/** One dispersion `<filter>` (colourless refraction + edge tint). */
function filterMarkup(id: string, refractId: string, tintId: string, map: string): string {
  return (
    `<filter id="${id}" color-interpolation-filters="sRGB" x="-12%" y="-28%" width="124%" height="156%">` +
    `<feImage href="${map}" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="map"></feImage>` +
    `<feDisplacementMap id="${refractId}" in="SourceGraphic" in2="map" scale="${DEFAULT_REF_SCALE}" xChannelSelector="R" yChannelSelector="B" result="refracted"></feDisplacementMap>` +
    `<feOffset in="refracted" dx="${EDGE_DX}" dy="0" result="shifted"></feOffset>` +
    `<feBlend in="shifted" in2="refracted" mode="difference" result="edgeDiff"></feBlend>` +
    `<feColorMatrix id="${tintId}" in="edgeDiff" type="matrix" values="${tintMatrix(DEFAULT_TINT_HUE, TINT_OPACITY)}" result="edgeTint"></feColorMatrix>` +
    `<feBlend in="refracted" in2="edgeTint" mode="screen" result="output"></feBlend>` +
    `<feGaussianBlur in="output" stdDeviation="0.5"></feGaussianBlur>` +
    `</filter>`
  )
}

/** Start the glass dispersion filter and stamp the enabling attribute. */
export function startGlassDispersion(): GlassDispersionHandle {
  const root = document.documentElement

  // Idempotent: a second call reuses the already-injected filter.
  if (root.hasAttribute(ATTR) || document.getElementById(FILTER_ID) !== null) {
    return { setTint(): void {}, setRefraction(): void {}, dispose(): void { /* shared instance */ } }
  }

  if (!supportsSvgBackdropFilter()) {
    return { setTint(): void {}, setRefraction(): void {}, dispose(): void {} }
  }

  // Two maps: a landscape one for the wide panes and a portrait one for the
  // tall sidebar, so each pane's refraction band keeps a sane aspect (one
  // shared 400×92 map stretched onto a 256×700 column smears the vertical
  // band to ~80px while pinching the horizontal to ~7px).
  const mapWide = buildDisplacementMapDataUrl(400, 92, 50)
  const mapTall = buildDisplacementMapDataUrl(92, 400, 50)

  const markup =
    `<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" width="0" height="0" style="position:absolute;overflow:hidden">` +
    `<defs>` +
    filterMarkup(FILTER_ID, REFRACT_ID, TINT_ID, mapWide) +
    filterMarkup(TALL_FILTER_ID, TALL_REFRACT_ID, TALL_TINT_ID, mapTall) +
    `</defs>` +
    `</svg>`

  const container = document.createElement('div')
  container.setAttribute('aria-hidden', 'true')
  container.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;'
  container.innerHTML = markup
  document.body.appendChild(container)

  const tint = container.querySelectorAll<Element>('feColorMatrix')
  const refract = container.querySelectorAll<Element>('feDisplacementMap')
  root.setAttribute(ATTR, '')

  return {
    setTint(hue: number): void {
      const values = tintMatrix(hue, TINT_OPACITY)
      tint.forEach((node) => node.setAttribute('values', values))
    },
    setRefraction(scale: number): void {
      const next = String(Math.max(0, Math.min(140, Number(scale) || 0)))
      refract.forEach((node) => node.setAttribute('scale', next))
    },
    dispose(): void {
      root.removeAttribute(ATTR)
      container.remove()
    },
  }
}
