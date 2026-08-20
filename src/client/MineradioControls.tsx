/**
 * Shared controls for the Mineradio General-settings appearance row: the Knob
 * (stepless slider + number box), a two-option Segmented picker, and the
 * wallpaper file reader. Kept in one file so the row stays a single surface.
 */
import { useRef } from 'react'
import css from './MineradioAppearanceRow.module.css'
import { fluidHueSwatch } from './fluid-tones.ts'

/** One slider + number box, wired to a single value. */
export interface KnobProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  onChange: (value: number) => void
}

/** Render one knob row. */
export function Knob({ label, value, min, max, step, unit, onChange }: KnobProps) {
  const clamp = (n: number) => Math.min(max, Math.max(min, Number.isFinite(n) ? n : min))
  return (
    <label className={css.knob}>
      <span className={css.knobLabel}>{label}</span>
      <input
        type="range"
        className={css.slider}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => { onChange(clamp(Number(e.target.value))) }}
      />
      <span className={css.numberWrap}>
        <input
          type="number"
          className={css.number}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => { onChange(clamp(Number(e.target.value))) }}
        />
        <span className={css.unit}>{unit}</span>
      </span>
    </label>
  )
}

/** One segment of a Segmented picker. */
export interface SegmentedOption<T extends string> {
  id: T
  label: string
}

export interface SegmentedProps<T extends string> {
  /** Accessible name for the button group. */
  label: string
  value: T
  options: readonly SegmentedOption<T>[]
  onSelect: (value: T) => void
}

/** Render a two-button segmented picker. */
export function Segmented<T extends string>({ label, value, options, onSelect }: SegmentedProps<T>) {
  return (
    <div className={css.segmented} role="group" aria-label={label}>
      {options.map(option => (
        <button
          key={option.id}
          type="button"
          className={option.id === value ? css.segActive : css.seg}
          aria-pressed={option.id === value}
          onClick={() => { onSelect(option.id) }}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** A continuous rainbow strip for the fluid hue (0-360): click or drag to
 *  pick any hue, with a colour-filled thumb marking the current value. */
export interface HueStripProps {
  label: string
  value: number
  onChange: (hue: number) => void
}

/** Render the fluid-hue rainbow strip. */
export function HueStrip({ label, value, onChange }: HueStripProps) {
  const stripRef = useRef<HTMLDivElement | null>(null)
  const dragging = useRef(false)

  const hueFromClientX = (clientX: number): number => {
    const el = stripRef.current
    if (el === null) return 0
    const rect = el.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    return Math.round(ratio * 360) % 360
  }

  const hue = ((Math.round(value) % 360) + 360) % 360

  return (
    <div className={css.hueStripRow}>
      <span className={css.knobLabel}>{label}</span>
      <div
        ref={stripRef}
        className={css.hueStrip}
        role="slider"
        aria-label={label}
        aria-orientation="horizontal"
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={hue}
        tabIndex={0}
        onPointerDown={(e) => {
          dragging.current = true
          e.currentTarget.setPointerCapture(e.pointerId)
          onChange(hueFromClientX(e.clientX))
        }}
        onPointerMove={(e) => {
          if (dragging.current) onChange(hueFromClientX(e.clientX))
        }}
        onPointerUp={() => { dragging.current = false }}
        onPointerCancel={() => { dragging.current = false }}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
          e.preventDefault()
          const step = e.shiftKey ? 30 : 5
          onChange((hue + (e.key === 'ArrowLeft' ? -step : step) + 360) % 360)
        }}
      >
        <span
          className={css.hueStripThumb}
          style={{ left: `${hue / 3.6}%`, backgroundColor: fluidHueSwatch(hue) }}
        />
      </div>
      <span className={css.hueStripValue}>{hue}°</span>
    </div>
  )
}

/** Read a file, downscale to ≤1920px, and return a compact JPEG data URL. */
export async function fileToDataUrl(file: File): Promise<string> {
  const raw = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => { resolve(String(reader.result)) }
    reader.onerror = () => { reject(reader.error) }
    reader.readAsDataURL(file)
  })
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image()
    im.onload = () => { resolve(im) }
    im.onerror = () => { reject(new Error('image load failed')) }
    im.src = raw
  })
  const scale = Math.min(1, 1920 / Math.max(image.width, image.height))
  const w = Math.max(1, Math.round(image.width * scale))
  const h = Math.max(1, Math.round(image.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (ctx === null) return raw
  ctx.drawImage(image, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', 0.82)
}
