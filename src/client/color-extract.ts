/**
 * Wallpaper color extraction — a small, dependency-free dominant-hue finder.
 *
 * The wallpaper (image or video frame) is drawn onto a tiny canvas, and the
 * pixels are folded into a circular hue histogram weighted by saturation and
 * mid-lightness, so gray/black/white areas contribute nothing and the result
 * is the image's most vivid, representative hue. Returns a single hue in
 * degrees (0-360), or null when the source is too desaturated to read.
 */

const SAMPLE = 32
const BINS = 36
const BIN_DEG = 360 / BINS

/** RGB 0-1 → HSL hue in degrees (0-360). */
function rgbHue(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  if (d < 1e-4) return 0
  let h: number
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60
  else if (max === g) h = ((b - r) / d + 2) * 60
  else h = ((r - g) / d + 4) * 60
  return h < 0 ? h + 360 : h
}

/**
 * Extract the dominant hue from a canvas-image source (img / video / canvas).
 * @returns a hue in degrees, or null when the source yields no vivid color.
 */
export function extractDominantHue(source: CanvasImageSource): number | null {
  const canvas = document.createElement('canvas')
  canvas.width = SAMPLE
  canvas.height = SAMPLE
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (ctx === null) return null
  try {
    ctx.drawImage(source, 0, 0, SAMPLE, SAMPLE)
  } catch {
    return null
  }

  let data: Uint8ClampedArray
  try {
    data = ctx.getImageData(0, 0, SAMPLE, SAMPLE).data
  } catch {
    return null // tainted canvas (cross-origin) — bail out
  }

  const counts = new Array<number>(BINS).fill(0)
  const sumsSin = new Array<number>(BINS).fill(0)
  const sumsCos = new Array<number>(BINS).fill(0)
  let totalWeight = 0

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255
    const g = data[i + 1] / 255
    const b = data[i + 2] / 255
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const l = (max + min) / 2
    const d = max - min
    if (d < 0.06) continue // near-gray: no meaningful hue
    if (l < 0.10 || l > 0.92) continue // near-black / near-white
    const s = l <= 0 || l >= 1 ? 0 : d / (1 - Math.abs(2 * l - 1))
    if (s < 0.10) continue
    // Favour saturated, mid-lightness pixels (a bright sky counts, a dark
    // shadow or a blown highlight does not dominate).
    const weight = s * Math.max(0, 1 - Math.abs(l - 0.5) * 1.6)
    if (weight <= 0) continue
    const h = rgbHue(r, g, b)
    const bin = Math.floor(h / BIN_DEG) % BINS
    const rad = (h * Math.PI) / 180
    counts[bin] += weight
    sumsSin[bin] += Math.sin(rad) * weight
    sumsCos[bin] += Math.cos(rad) * weight
    totalWeight += weight
  }

  if (totalWeight < 5) return null

  // Peak bin, then the circular weighted mean around it (±1 bin) for a
  // smooth, non-quantised hue.
  let peak = 0
  for (let i = 1; i < BINS; i++) if (counts[i] > counts[peak]) peak = i
  let sin = 0
  let cos = 0
  for (let d = -1; d <= 1; d++) {
    const bin = (peak + d + BINS) % BINS
    sin += sumsSin[bin]
    cos += sumsCos[bin]
  }
  let hue = (Math.atan2(sin, cos) * 180) / Math.PI
  if (hue < 0) hue += 360
  return hue
}
