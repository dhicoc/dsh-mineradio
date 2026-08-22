/**
 * Mineradio row slot store: a mirror of the layer's state (enable flag plus the
 * knobs and the backdrop source). The plugin's apply-world change listener is
 * the only writer; the row component reads via props.useStore.
 */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'
import type { TextStyle } from './theme-layer.ts'

/** Store state mirrored from the Mineradio settings scope. */
export interface MineradioRowState {
  /** Persisted layer enable flag. */
  enabled: boolean
  /** Rendering mode: mica or stock layout with generic glass. */
  mode: 'mica' | 'compat'
  /** Global text-ink tint preset. */
  textStyle: TextStyle
  /** Glass blur radius, px. */
  blur: number
  /** Glass frost amount, 0-100. */
  frost: number
  /** Fluid hue, degrees (0-360, continuous). */
  fluidHue: number
  /** Fluid depth, 0-100 (continuous). */
  fluidDepth: number
  /** Glass dispersion tint hue, degrees (0-360, continuous). */
  dispersionHue: number
  /** Glass refraction strength, 0-100. */
  dispersionRefract: number
  /** Background brightness, 0-100. */
  bgBrightness: number
  /** Resolved palette is dark (brightness knob = darkening half). */
  dark: boolean
  /** Backdrop source: fluid board or custom wallpaper. */
  background: 'fluid' | 'wallpaper'
  /** Wallpaper image data URL. */
  wallpaper: string
  /** Auto-derive the accent hue from the wallpaper. */
  autoTint: boolean
  /** Particle whale in the chat area center. */
  whale: boolean
  /** Ambient star particles. */
  critters: boolean
  /** Interactive mesh (the site's dot-grid with pointer repel). */
  mesh: boolean
  /** Star-river particle density, 0-100. */
  starDensity: number
  /** Cursor spotlight glow following the pointer over the glass panes. */
  spotlight: boolean
  /** Hover press-down for the glass panes. */
  press: boolean
  /** Audio reactivity (mic-driven backdrop pulse). */
  audioReact: boolean
  /** Wallpaper blur radius, px. */
  wallpaperBlur: number
  /** Wallpaper frost veil, 0-100. */
  wallpaperFrost: number
  /** Frosted-glass mask over the wallpaper (readability veil + stronger blur). */
  wallpaperMask: boolean
  /** Frost mask blur radius, px. */
  wallpaperMaskBlur: number
  /** Frost mask veil opacity, 0-100. */
  wallpaperMaskOpacity: number
  /** Video wallpaper blur radius, px. */
  videoBlur: number
  /** Video wallpaper brightness, 0-100. */
  videoBrightness: number
  /** Monotonic revision; -1 until first sync so revision 0 lands as a change. */
  revision: number
}

/** The full payload the layer pushes into the row store on every change. */
export interface MineradioSettingsPayload {
  enabled: boolean
  mode: 'mica' | 'compat'
  textStyle: TextStyle
  blur: number
  frost: number
  fluidHue: number
  fluidDepth: number
  dispersionHue: number
  dispersionRefract: number
  bgBrightness: number
  dark: boolean
  background: 'fluid' | 'wallpaper'
  wallpaper: string
  autoTint: boolean
  whale: boolean
  critters: boolean
  mesh: boolean
  starDensity: number
  spotlight: boolean
  press: boolean
  audioReact: boolean
  wallpaperBlur: number
  wallpaperFrost: number
  wallpaperMask: boolean
  wallpaperMaskBlur: number
  wallpaperMaskOpacity: number
  videoBlur: number
  videoBrightness: number
}

/** Declared action shape giving the exported factory a stable return type. */
type MineradioRowActions = {
  sync: (draft: MineradioRowState, next: MineradioSettingsPayload, revision: number) => void
}

/**
 * Declares the Mineradio row state and write surface.
 * @returns the store handle.
 */
export function createMineradioRowStore(): EngineStoreHandle<MineradioRowState, MineradioRowActions> {
  return defineStore({
    init: (): MineradioRowState => ({
      enabled: true,
      mode: 'mica',
      textStyle: 'champagne',
      blur: 24,
      frost: 14,
      fluidHue: 44,
      fluidDepth: 22,
      dispersionHue: 44,
      dispersionRefract: 60,
      bgBrightness: 50,
      dark: false,
      background: 'fluid',
      wallpaper: '',
      autoTint: true,
      whale: true,
      critters: true,
      mesh: true,
      starDensity: 60,
      spotlight: true,
      press: true,
      audioReact: false,
      wallpaperBlur: 0,
      wallpaperFrost: 0,
      wallpaperMask: false,
      wallpaperMaskBlur: 24,
      wallpaperMaskOpacity: 62,
      videoBlur: 6,
      videoBrightness: 48,
      revision: -1,
    }),
    actions: {
      sync: (d, next: MineradioSettingsPayload, revision: number) => {
        if (revision <= d.revision) return
        d.enabled = next.enabled
        d.mode = next.mode
        d.textStyle = next.textStyle
        d.blur = next.blur
        d.frost = next.frost
        d.fluidHue = next.fluidHue
        d.fluidDepth = next.fluidDepth
        d.dispersionHue = next.dispersionHue
        d.dispersionRefract = next.dispersionRefract
        d.bgBrightness = next.bgBrightness
        d.dark = next.dark
        d.background = next.background
        d.wallpaper = next.wallpaper
        d.autoTint = next.autoTint
        d.whale = next.whale
        d.critters = next.critters
        d.mesh = next.mesh
        d.starDensity = next.starDensity
        d.spotlight = next.spotlight
        d.press = next.press
        d.audioReact = next.audioReact
        d.wallpaperBlur = next.wallpaperBlur
        d.wallpaperFrost = next.wallpaperFrost
        d.wallpaperMask = next.wallpaperMask
        d.wallpaperMaskBlur = next.wallpaperMaskBlur
        d.wallpaperMaskOpacity = next.wallpaperMaskOpacity
        d.videoBlur = next.videoBlur
        d.videoBrightness = next.videoBrightness
        d.revision = revision
      },
    },
  })
}
