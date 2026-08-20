/**
 * the Mineradio layer: one toggleable visual skin over the whole Web surface.
 * Everything this layer owns is an effect — token overrides ride the theme
 * service's override stack, the CSS hooks ride a `data-dsh-aqua` attribute on
 * <html> (the stylesheet only applies under it), the ambient scene and page
 * fades are mounted/removed with the layer — so switching the flag off (or
 * unloading the plugin) restores the stock UI exactly: no residue, no reload.
 *
 * The enable flag persists in localStorage: a client-only visual preference
 * (like the selected-session key), written and read by this plugin alone.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { ThemeTokenOverrides } from '@deepseek-ai/dsh-client-ui-theme/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { ensureAmbientScene, removeAmbientScene, ensurePageFades, removePageFades } from './critters.ts'
import { attachFluidShader, SITE_FLUID_PARAMS, type FluidParams, type FluidShaderHandle } from './fluid-shader.ts'
import { fluidToneColors, HUE_BASE } from './fluid-tones.ts'
import { deleteVideoBlob, loadVideoBlob, loadVideoHandle } from './wallpaper-store.ts'
import { attachFluidInteractions } from './fluid-interactions.ts'
import { startSeamStamper } from './seam-stamper.ts'
import { mountWhale, type WhaleHandle } from './whale.ts'
import { mountMesh, type MeshHandle } from './mesh.ts'
import { startSpotlight, SPOTLIGHT_ATTRIBUTE, PRESS_ATTRIBUTE } from './spotlight.ts'
import { mountStarRiver, type StarRiverHandle } from './star-river.ts'
import { startCinemaDrift, type CinemaDriftHandle } from './cinema-drift.ts'
import { startGlassDispersion, type GlassDispersionHandle } from './glass-dispersion.ts'
import { startSpecularParallax } from './specular-parallax.ts'
import { createAudioReactivity, type AudioReactivityHandle } from './audio-reactivity.ts'
import { extractDominantHue } from './color-extract.ts'

/** html attribute selecting the Mineradio layer: CSS hooks and ambient effects.
 *  Kept as the internal `data-dsh-aqua` seam so the stylesheet's 100+ gated
 *  selectors and the helper modules stay consistent across the skin. */
export const MINERADIO_ATTRIBUTE = 'data-dsh-aqua'

/** localStorage key carrying the layer enable flag. */
export const MINERADIO_ENABLED_KEY = 'dsh.ui-mineradio.enabled'

/** Default state when nothing is stored yet: on. */
export const DEFAULT_ENABLED = true

/** The layer's identity in the theme override stack (inspection-visible). */
const OVERRIDE_SOURCE = 'dsh-theme-mineradio'

const FONT_STACK = "'Inter', 'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', "
  + "'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif"

// Mineradio palette tokens (the "cinema gold" identity).
const CHAMPAGNE = '#f4d28a'
const CHAMPAGNE_DEEP = '#9a6f2c'
const CHAMPAGNE_RGB = '244, 210, 138'
const MINT = '#7ad7c2'
const MINT_RGB = '122, 215, 194'
const ROSE = '#ff5367'
const ROSE_RGB = '255, 83, 103'
const INK = '#08090B'
const PAPER = '#0E1014'
const INK_SOFT = '#1A1D22'

/** Scheme-invariant override value (applied to both palettes). */
const both = (value: string): { light: string; dark: string } => ({ light: value, dark: value })

/**
 * Alias-token override layer: the Mineradio "cinema gold" palette. Every
 * value is a `{ light, dark }` pair so the layer stays legible when the user
 * switches the Appearance preference — dark is the near-black studio
 * ({INK}), light is a warm paper white. The brand accent is champagne gold
 * with mint + ember rose echoes, straight from the Mineradio wordmark.
 */
export const MINERADIO_TOKEN_OVERRIDES: ThemeTokenOverrides = {
  // Typography: Inter + Noto Sans SC, CJK keeps the system stack.
  '--dsw-font-family': both(FONT_STACK),

  // Backgrounds. The base stays opaque (the fallback behind the fluid); every
  // LAYERED surface is translucent so the fluid/wallpaper shows through the
  // controls, dropdowns and cards — no solid black slabs anywhere.
  '--dsw-alias-bg-base': { light: '#F7F3EA', dark: INK },
  '--dsw-alias-bg-layer-1': { light: 'rgba(255, 255, 255, 0.55)', dark: 'rgba(14, 16, 20, 0.55)' },
  '--dsw-alias-bg-layer-2': { light: 'rgba(240, 234, 224, 0.50)', dark: 'rgba(21, 23, 28, 0.55)' },
  '--dsw-alias-bg-layer-3': { light: 'rgba(233, 226, 214, 0.45)', dark: 'rgba(28, 31, 37, 0.50)' },
  '--dsw-alias-bg-overlay': { light: 'rgba(227, 219, 203, 0.60)', dark: 'rgba(35, 38, 45, 0.60)' },
  '--dsw-alias-bg-module-platform': { light: 'rgba(255, 255, 255, 0.55)', dark: 'rgba(14, 16, 20, 0.55)' },
  '--dsw-alias-bg-multi-select': { light: 'rgba(255, 255, 255, 0.55)', dark: 'rgba(21, 23, 28, 0.55)' },
  '--dsw-alias-bg-skeleton': { light: 'rgba(154, 111, 44, 0.10)', dark: 'rgba(244, 210, 138, 0.12)' },
  '--dsw-alias-bg-mask-1': { light: 'rgba(24, 22, 18, 0.30)', dark: 'rgba(4, 5, 6, 0.55)' },
  '--dsw-alias-bg-mask-2': { light: 'rgba(24, 22, 18, 0.12)', dark: 'rgba(4, 5, 6, 0.25)' },
  '--dsw-alias-bg-mask-3': { light: 'rgba(24, 22, 18, 0.30)', dark: 'rgba(4, 5, 6, 0.50)' },
  '--dsw-alias-bg-mask-drop': { light: 'rgba(247, 243, 234, 0.72)', dark: 'rgba(8, 9, 11, 0.70)' },

  // Hairlines and strokes.
  '--dsw-alias-border-l1': { light: 'rgba(154, 111, 44, 0.12)', dark: 'rgba(244, 210, 138, 0.09)' },
  '--dsw-alias-border-l2': { light: 'rgba(154, 111, 44, 0.18)', dark: 'rgba(244, 210, 138, 0.16)' },
  '--dsw-alias-border-l2-darkmode-thin': { light: 'rgba(154, 111, 44, 0.12)', dark: 'rgba(244, 210, 138, 0.10)' },
  '--dsw-alias-border-l3': { light: 'rgba(154, 111, 44, 0.26)', dark: 'rgba(244, 210, 138, 0.26)' },
  '--dsw-alias-border-l4': { light: 'rgba(154, 111, 44, 0.36)', dark: 'rgba(244, 210, 138, 0.36)' },
  '--dsw-alias-border-inverted': { light: 'rgba(154, 111, 44, 0.08)', dark: 'rgba(244, 210, 138, 0.12)' },
  '--dsw-alias-border-inverted2': { light: 'rgba(154, 111, 44, 0.10)', dark: 'rgba(244, 210, 138, 0.08)' },

  // Text ink.
  '--dsw-alias-label-primary': { light: '#2A241A', dark: '#F2F0EA' },
  '--dsw-alias-label-secondary': { light: '#5C5240', dark: '#CBC4B8' },
  '--dsw-alias-label-tertiary': { light: '#7A6F5A', dark: '#98917F' },
  '--dsw-alias-label-caption': { light: '#8F8572', dark: '#7A7468' },
  '--dsw-alias-label-dimmed': { light: '#C8BFAB', dark: '#5A564C' },
  '--dsw-alias-label-primary-bluish': { light: '#A97A2A', dark: '#E8CEA0' },
  '--dsw-alias-label-primary-dimmed': { light: '#4A3A1E', dark: '#EADFC6' },
  '--dsw-alias-label-primary-inverted': { light: '#FFFFFF', dark: '#15171C' },
  '--dsw-alias-label-primary-foreground': { light: '#FFFFFF', dark: '#FFFFFF' },

  // Brand (wordmark ink stays scheme ink; accents go champagne gold).
  '--dsw-alias-brand-primary': { light: '#2A241A', dark: '#F2F0EA' },
  '--dsw-alias-brand-text': { light: '#2A241A', dark: '#F2F0EA' },
  '--dsw-alias-brand-primary-invert': { light: '#FFFFFF', dark: INK },
  '--dsw-alias-brand-primary-new-colorprimary-new-color': { light: CHAMPAGNE_DEEP, dark: CHAMPAGNE },

  // States.
  '--dsw-alias-state-business-primary': { light: CHAMPAGNE_DEEP, dark: CHAMPAGNE },
  '--dsw-alias-state-business-tertiary': { light: 'rgba(244, 210, 138, 0.22)', dark: 'rgba(244, 210, 138, 0.16)' },
  '--dsw-alias-state-success-tertiary': { light: 'rgba(122, 215, 194, 0.22)', dark: 'rgba(122, 215, 194, 0.14)' },
  '--dsw-alias-state-warn-tertiary': { light: 'rgba(255, 83, 103, 0.18)', dark: 'rgba(255, 83, 103, 0.14)' },

  // Buttons: the primary action becomes champagne gold with dark ink.
  '--dsw-alias-button-primary-fill': { light: CHAMPAGNE_DEEP, dark: CHAMPAGNE },
  '--dsw-alias-button-primary-hover': { light: '#B68A38', dark: '#F7DDA2' },
  '--dsw-alias-button-primary-dimmed': { light: 'rgba(244, 210, 138, 0.24)', dark: 'rgba(244, 210, 138, 0.16)' },
  '--dsw-alias-button-info-fill': { light: CHAMPAGNE_DEEP, dark: CHAMPAGNE },
  '--dsw-alias-button-info-hover': { light: '#B68A38', dark: '#F7DDA2' },
  '--dsw-alias-button-elevated-fill': { light: '#FFFFFF', dark: 'rgba(21, 23, 28, 0.55)' },
  '--dsw-alias-button-floating-fill': { light: '#FFFFFF', dark: 'rgba(21, 23, 28, 0.55)' },
  '--dsw-alias-button-floating-hover': { light: '#F2EAE0', dark: 'rgba(28, 31, 37, 0.55)' },
  '--dsw-alias-button-contrast-fill': { light: '#2A241A', dark: '#F2F0EA' },
  '--dsw-alias-button-ghost-active-fill': { light: 'rgba(244, 210, 138, 0.16)', dark: 'rgba(28, 31, 37, 0.55)' },
  '--dsw-alias-button-ghost-active-hover': { light: 'rgba(244, 210, 138, 0.22)', dark: 'rgba(21, 23, 28, 0.55)' },
  '--dsw-alias-button-ghost-active-border': { light: CHAMPAGNE_DEEP, dark: '#BF9E5B' },

  // Interaction fills.
  '--dsw-alias-interactive-bg-hover': { light: 'rgba(154, 111, 44, 0.10)', dark: 'rgba(244, 210, 138, 0.10)' },
  '--dsw-alias-interactive-bg-hover-accent': { light: 'rgba(154, 111, 44, 0.16)', dark: 'rgba(244, 210, 138, 0.20)' },
  '--dsw-alias-interactive-bg-active': { light: 'rgba(154, 111, 44, 0.22)', dark: 'rgba(244, 210, 138, 0.26)' },
  '--dsw-alias-interactive-bg-hover-danger': { light: 'rgba(255, 83, 103, 0.06)', dark: 'rgba(255, 83, 103, 0.14)' },
  '--dsw-alias-interactive-bg-hover-solid': { light: '#F2EAE0', dark: 'rgba(28, 31, 37, 0.55)' },

  // Markdown / code surfaces — translucent so code blocks read as glass.
  '--dsw-alias-markdown-code-block': { light: '#F2EAE0', dark: 'rgba(13, 14, 17, 0.55)' },
  '--dsw-alias-markdown-code-block-banner': { light: '#F5EEE4', dark: 'rgba(18, 20, 24, 0.55)' },
  '--dsw-alias-markdown-inline-code': { light: 'rgba(244, 210, 138, 0.20)', dark: 'rgba(244, 210, 138, 0.10)' },
  '--dsw-alias-markdown-citation': { light: '#F0E9DC', dark: 'rgba(25, 27, 32, 0.55)' },
  '--dsw-alias-markdown-tag': { light: 'rgba(244, 210, 138, 0.18)', dark: 'rgba(21, 23, 28, 0.55)' },
  '--dsw-alias-markdown-placeholder': { light: '#F0E9DC', dark: 'rgba(18, 20, 24, 0.55)' },
  '--dsw-alias-markdown-code-segment-selected': { light: '#FFFFFF', dark: 'rgba(28, 31, 37, 0.55)' },
  '--dsw-alias-markdown-code-segment-unselected': { light: '#F2EAE0', dark: 'rgba(14, 16, 19, 0.55)' },

  // Scrollbars.
  '--dsw-alias-scrollbar-bg-l1': { light: 'rgba(154, 111, 44, 0.28)', dark: 'rgba(244, 210, 138, 0.28)' },
  '--dsw-alias-scrollbar-bg-l2': { light: 'rgba(154, 111, 44, 0.40)', dark: 'rgba(244, 210, 138, 0.36)' },
  '--dsw-alias-scrollbar-hover-l1': { light: 'rgba(154, 111, 44, 0.50)', dark: 'rgba(244, 210, 138, 0.44)' },
  '--dsw-alias-scrollbar-hover-l2': { light: 'rgba(154, 111, 44, 0.60)', dark: 'rgba(244, 210, 138, 0.52)' },

  // Specific surfaces. The sidebar root fill goes transparent — the glass
  // panel styling lives on the column itself, so no double tint. The small
  // surfaces (nav item, menu, selector, bubble, tip, toast, tooltip) are
  // translucent so the fluid reads through them instead of solid slabs.
  '--dsw-specific-sidebar-fill': { light: 'transparent', dark: 'transparent' },
  '--dsw-specific-sidebar-nav-item-active': { light: 'rgba(244, 210, 138, 0.18)', dark: 'rgba(26, 29, 34, 0.55)' },
  '--dsw-specific-sidebar-nav-item-hover': { light: 'rgba(244, 210, 138, 0.12)', dark: 'rgba(21, 23, 28, 0.55)' },
  '--dsw-specific-sidebar-nav-item-active-accent': { light: CHAMPAGNE_DEEP, dark: CHAMPAGNE },
  '--dsw-specific-input-major': { light: '#FFFFFF', dark: 'rgba(16, 18, 22, 0.55)' },
  '--dsw-specific-login-input': { light: '#F2EAE0', dark: 'rgba(13, 14, 17, 0.55)' },
  '--dsw-specific-menu': { light: '#F0E9DC', dark: 'rgba(21, 23, 28, 0.60)' },
  '--dsw-specific-selector': { light: '#F0E9DC', dark: 'rgba(28, 31, 37, 0.55)' },
  '--dsw-specific-bubble': { light: '#F4EEE2', dark: 'rgba(18, 20, 24, 0.55)' },
  '--dsw-specific-bubble-highlight': { light: 'rgba(244, 210, 138, 0.24)', dark: 'rgba(26, 29, 34, 0.55)' },
  '--dsw-specific-tip': { light: '#F0E9DC', dark: 'rgba(18, 20, 24, 0.60)' },
  '--dsw-alias-toast-bg': { light: '#4A3A1E', dark: 'rgba(28, 31, 37, 0.60)' },
  '--dsw-alias-tooltip-bg': { light: '#2A241A', dark: 'rgba(21, 23, 28, 0.72)' },

  // Elevation shadows (warm-tinted depth with a champagne bloom).
  '--dsw-shadow-lv1': { light: '0 2px 4px rgba(60, 43, 17, 0.08)', dark: '0 2px 4px rgba(0, 0, 0, 0.5)' },
  '--dsw-shadow-lv1-blur': { light: '0 4px 12px rgba(60, 43, 17, 0.06)', dark: '0 4px 12px rgba(0, 0, 0, 0.4)' },
  '--dsw-shadow-lv2': {
    light: '0 4px 12px rgba(60, 43, 17, 0.07), 0 2px 8px rgba(60, 43, 17, 0.08)',
    dark: '0 4px 12px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.35)',
  },
  '--dsw-shadow-lv3': {
    light: '0 0 1px rgba(60, 43, 17, 0.10), 0 12px 32px rgba(60, 43, 17, 0.12)',
    dark: '0 0 1px rgba(0, 0, 0, 0.6), 0 12px 32px rgba(0, 0, 0, 0.55)',
  },
}

/**
 * Compatibility-mode token set: the same palette as the floating mode, but
 * every surface token turns translucent, so the fluid/wallpaper backdrop
 * shows through the STOCK layout. This is what makes the material generic —
 * any plugin that consumes the shared design tokens gets the glass for free.
 */
const COMPAT_SURFACE_OVERRIDES: ThemeTokenOverrides = {
  '--dsw-alias-bg-layer-1': { light: 'rgba(255, 255, 255, 0.55)', dark: 'rgba(17, 26, 39, 0.55)' },
  '--dsw-alias-bg-layer-2': { light: 'rgba(236, 242, 250, 0.5)', dark: 'rgba(22, 33, 48, 0.55)' },
  '--dsw-alias-bg-layer-3': { light: 'rgba(226, 235, 247, 0.45)', dark: 'rgba(28, 42, 61, 0.5)' },
  '--dsw-alias-bg-overlay': { light: 'rgba(220, 231, 244, 0.6)', dark: 'rgba(34, 51, 74, 0.6)' },
  '--dsw-alias-bg-module-platform': { light: 'rgba(255, 255, 255, 0.55)', dark: 'rgba(17, 26, 39, 0.55)' },
  '--dsw-alias-bg-multi-select': { light: 'rgba(255, 255, 255, 0.55)', dark: 'rgba(22, 33, 48, 0.55)' },
  '--dsw-specific-menu': { light: 'rgba(234, 241, 249, 0.6)', dark: 'rgba(22, 33, 48, 0.6)' },
  '--dsw-specific-selector': { light: 'rgba(234, 241, 249, 0.55)', dark: 'rgba(28, 42, 61, 0.55)' },
  '--dsw-specific-bubble': { light: 'rgba(240, 245, 252, 0.55)', dark: 'rgba(18, 28, 42, 0.55)' },
  '--dsw-specific-bubble-highlight': { light: 'rgba(220, 233, 251, 0.55)', dark: 'rgba(26, 40, 58, 0.55)' },
  '--dsw-specific-tip': { light: 'rgba(234, 241, 249, 0.6)', dark: 'rgba(19, 29, 43, 0.6)' },
  '--dsw-specific-input-major': { light: 'rgba(255, 255, 255, 0.5)', dark: 'rgba(16, 25, 39, 0.5)' },
  '--dsw-specific-login-input': { light: 'rgba(240, 245, 251, 0.5)', dark: 'rgba(13, 20, 31, 0.5)' },
  '--dsw-alias-markdown-code-block': { light: 'rgba(240, 245, 251, 0.5)', dark: 'rgba(13, 20, 31, 0.5)' },
  '--dsw-alias-markdown-code-block-banner': { light: 'rgba(245, 248, 253, 0.55)', dark: 'rgba(18, 27, 41, 0.55)' },
  '--dsw-alias-markdown-inline-code': { light: 'rgba(228, 237, 248, 0.5)', dark: 'rgba(23, 35, 52, 0.5)' },
  '--dsw-alias-markdown-citation': { light: 'rgba(234, 241, 249, 0.55)', dark: 'rgba(26, 37, 52, 0.55)' },
  '--dsw-alias-markdown-tag': { light: 'rgba(228, 237, 248, 0.5)', dark: 'rgba(22, 33, 48, 0.5)' },
  '--dsw-alias-markdown-placeholder': { light: 'rgba(234, 241, 249, 0.55)', dark: 'rgba(19, 29, 43, 0.55)' },
  '--dsw-alias-toast-bg': { light: 'rgba(27, 50, 86, 0.85)', dark: 'rgba(28, 42, 61, 0.85)' },
  '--dsw-alias-tooltip-bg': { light: 'rgba(19, 36, 62, 0.88)', dark: 'rgba(22, 33, 48, 0.88)' },
}

/** Compatibility token layer: the palette plus the translucent surfaces. */
const COMPAT_TOKEN_OVERRIDES: ThemeTokenOverrides = { ...MINERADIO_TOKEN_OVERRIDES, ...COMPAT_SURFACE_OVERRIDES }

/** Read the persisted enable flag (absent storage means on). */
function readEnabled(): boolean {
  try {
    const raw = localStorage.getItem(MINERADIO_ENABLED_KEY)
    return raw === null ? DEFAULT_ENABLED : raw === 'true'
  } catch {
    return DEFAULT_ENABLED
  }
}

/** Persist the enable flag (storage failures keep the in-memory state). */
function writeEnabled(value: boolean): void {
  try {
    localStorage.setItem(MINERADIO_ENABLED_KEY, String(value))
  } catch {
    /* in-memory state still applies for this tab */
  }
}

/** Tunable layer knobs, persisted independently of the enable flag. */
export interface MineradioSettings {
  /** Rendering mode: mica (frosted floating cards) or the stock layout with a generic glass material. */
  mode: 'mica' | 'compat'
  /** Glass backdrop blur radius, px. */
  blur: number
  /** Glass fill opacity, 0-100 (50 = the shipped look; drives the frost multiplier). */
  frost: number
  /** Fluid hue, degrees (0-360, continuous). */
  fluidHue: number
  /** Fluid depth, 0-100 (0 = deep saturated, 100 = pale light, continuous). */
  fluidDepth: number
  /** Glass dispersion tint hue, degrees (0-360, continuous). */
  dispersionHue: number
  /** Glass refraction strength, 0-100 (0 = none, 100 = strong). */
  dispersionRefract: number
  /** Background brightness, 0-100 (0 = pure black, 50 = transparent, 100 = pure white). */
  bgBrightness: number
  /** Backdrop source: the living fluid board or a custom wallpaper. */
  background: 'fluid' | 'wallpaper'
  /** Wallpaper image data URL (empty until one is picked). */
  wallpaper: string
  /** Auto-derive the accent hue from the wallpaper (spotlight/bloom/dispersion). */
  autoTint: boolean
  /** Particle whale in the chat area center (opt-in extra; off by default —
   *  the Mineradio star river is the shipped particle stage). */
  whale: boolean
  /** Ambient marine life (fish / bubbles / plankton). */
  critters: boolean
  /** Interactive mesh (the site's dot-grid with pointer repel). */
  mesh: boolean
  /** Star-river particle density, 0-100 (50 = 1×, 100 = 2× the default field). */
  starDensity: number
  /** Cursor spotlight glow that follows the pointer over the glass panes. */
  spotlight: boolean
  /** Hover press-down: the pane under the cursor sinks a touch (tactile depth). */
  press: boolean
  /** Audio reactivity: the backdrop pulses with mic audio (fluid/stars/glow). */
  audioReact: boolean
  /** Wallpaper blur radius, px. */
  wallpaperBlur: number
  /** Wallpaper frost veil, 0-100. */
  wallpaperFrost: number
  /** Frosted-glass mask over the wallpaper (readability veil + stronger blur). */
  wallpaperMask: boolean
  /** Frost mask blur radius, px (0 = none, 40 = heavy frosted glass). */
  wallpaperMaskBlur: number
  /** Frost mask veil opacity, 0-100 (0 = clear, 100 = fully opaque scrim). */
  wallpaperMaskOpacity: number
  /** Video wallpaper blur radius, px (0 = crisp, 40 = heavy acrylic). */
  videoBlur: number
  /** Video wallpaper brightness, 0-100 (100 = fully lit, 0 = deepest dim). */
  videoBrightness: number
}

/** Shipped defaults — what a first-time install sees (the tuned look). */
const SETTINGS_DEFAULTS: MineradioSettings = {
  mode: 'mica',
  blur: 22,
  frost: 50,
  bgBrightness: 50,
  background: 'fluid',
  wallpaper: '',
  autoTint: true,
  whale: false,
  critters: false,
  mesh: false,
  starDensity: 60,
  spotlight: true,
  press: true,
  audioReact: false,
  fluidHue: 44,
  fluidDepth: 22,
  dispersionHue: 44,
  dispersionRefract: 60,
  wallpaperBlur: 0,
  wallpaperFrost: 0,
  wallpaperMask: false,
  wallpaperMaskBlur: 24,
  wallpaperMaskOpacity: 62,
  videoBlur: 6,
  videoBrightness: 45,
}

/** Numeric knob keys and their localStorage names. */
const NUMERIC_KEYS = {
  blur: 'dsh.ui-mineradio.blur',
  frost: 'dsh.ui-mineradio.frost',
  fluidHue: 'dsh.ui-mineradio.fluidHue',
  fluidDepth: 'dsh.ui-mineradio.fluidDepth',
  starDensity: 'dsh.ui-mineradio.starDensity',
  dispersionHue: 'dsh.ui-mineradio.dispersionHue',
  dispersionRefract: 'dsh.ui-mineradio.dispersionRefract',
  bgBrightness: 'dsh.ui-mineradio.bgBrightness',
  wallpaperBlur: 'dsh.ui-mineradio.wallpaperBlur',
  wallpaperFrost: 'dsh.ui-mineradio.wallpaperFrost',
  wallpaperMaskBlur: 'dsh.ui-mineradio.wallpaperMaskBlur',
  wallpaperMaskOpacity: 'dsh.ui-mineradio.wallpaperMaskOpacity',
  videoBlur: 'dsh.ui-mineradio.videoBlur',
  videoBrightness: 'dsh.ui-mineradio.videoBrightness',
} as const
type NumericKey = keyof typeof NUMERIC_KEYS

const MODE_KEY = 'dsh.ui-mineradio.mode'
const BACKGROUND_KEY = 'dsh.ui-mineradio.background'
const WALLPAPER_KEY = 'dsh.ui-mineradio.wallpaper'
const AUTO_TINT_KEY = 'dsh.ui-mineradio.autoTint'
const WALLPAPER_MASK_KEY = 'dsh.ui-mineradio.wallpaperMask'
const WHALE_KEY = 'dsh.ui-mineradio.whale'
const CRITTERS_KEY = 'dsh.ui-mineradio.critters'
const MESH_KEY = 'dsh.ui-mineradio.mesh'
const SPOTLIGHT_KEY = 'dsh.ui-mineradio.spotlight'
const PRESS_KEY = 'dsh.ui-mineradio.press'
const AUDIO_REACT_KEY = 'dsh.ui-mineradio.audioReact'

/** Clamp a numeric knob into its sane range. */
function clampSetting(key: NumericKey, value: number): number {
  const max = key === 'blur' || key === 'wallpaperBlur' || key === 'wallpaperMaskBlur' || key === 'videoBlur' ? 40
    : key === 'frost' || key === 'wallpaperFrost' || key === 'wallpaperMaskOpacity' || key === 'starDensity' || key === 'bgBrightness' || key === 'videoBrightness' || key === 'dispersionRefract' ? 100
      : 360
  return Number.isFinite(value) ? Math.min(max, Math.max(0, value)) : SETTINGS_DEFAULTS[key]
}

/** Read one numeric knob from localStorage (absent/parse failure means the default). */
function readSetting(key: NumericKey): number {
  try {
    const raw = localStorage.getItem(NUMERIC_KEYS[key])
    return raw === null ? SETTINGS_DEFAULTS[key] : clampSetting(key, Number(raw))
  } catch {
    return SETTINGS_DEFAULTS[key]
  }
}

/** Persist one numeric knob (storage failures keep the in-memory state). */
function writeSetting(key: NumericKey, value: number): void {
  try {
    localStorage.setItem(NUMERIC_KEYS[key], String(value))
  } catch {
    /* in-memory state still applies for this tab */
  }
}

/** Read the backdrop source ('fluid' or 'wallpaper'). */
function readBackground(): 'fluid' | 'wallpaper' {
  try {
    return localStorage.getItem(BACKGROUND_KEY) === 'wallpaper' ? 'wallpaper' : 'fluid'
  } catch {
    return 'fluid'
  }
}

/** Persist the backdrop source. */
function writeBackground(value: 'fluid' | 'wallpaper'): void {
  try {
    localStorage.setItem(BACKGROUND_KEY, value)
  } catch {
    /* in-memory state still applies */
  }
}

/** Read the rendering mode ('mica' or 'compat'; legacy 'float'/'liquid'
 *  values migrate to 'mica'). */
function readMode(): 'mica' | 'compat' {
  try {
    const stored = localStorage.getItem(MODE_KEY)
    if (stored === 'compat') return 'compat'
    return 'mica'
  } catch {
    return 'mica'
  }
}

/** Persist the rendering mode. */
function writeMode(value: 'mica' | 'compat'): void {
  try {
    localStorage.setItem(MODE_KEY, value)
  } catch {
    /* in-memory state still applies */
  }
}

/** Read the wallpaper data URL (absent/oversized means empty). */
function readWallpaper(): string {
  try {
    return localStorage.getItem(WALLPAPER_KEY) ?? ''
  } catch {
    return ''
  }
}

/** Persist the wallpaper data URL (quota failures keep it in memory only). */
function writeWallpaper(value: string): void {
  try {
    localStorage.setItem(WALLPAPER_KEY, value)
  } catch {
    /* in-memory state still applies for this tab */
  }
}

/** Read the wallpaper auto-tint flag (absent means on). */
function readAutoTint(): boolean {
  try {
    const raw = localStorage.getItem(AUTO_TINT_KEY)
    return raw === null ? true : raw === 'true'
  } catch {
    return true
  }
}

/** Persist the wallpaper auto-tint flag. */
function writeAutoTint(value: boolean): void {
  try {
    localStorage.setItem(AUTO_TINT_KEY, String(value))
  } catch {
    /* in-memory state still applies for this tab */
  }
}

/** Read the wallpaper frost-mask flag (absent means off). */
function readWallpaperMask(): boolean {
  try {
    const raw = localStorage.getItem(WALLPAPER_MASK_KEY)
    return raw === null ? false : raw === 'true'
  } catch {
    return false
  }
}

/** Persist the wallpaper frost-mask flag. */
function writeWallpaperMask(value: boolean): void {
  try {
    localStorage.setItem(WALLPAPER_MASK_KEY, String(value))
  } catch {
    /* in-memory state still applies for this tab */
  }
}

/** Read the particle-whale flag (absent means off — the star river is the
 *  default particle stage; the whale is an opt-in extra). */
function readWhale(): boolean {
  try {
    const raw = localStorage.getItem(WHALE_KEY)
    return raw === null ? false : raw === 'true'
  } catch {
    return false
  }
}

/** Persist the particle-whale flag. */
function writeWhale(value: boolean): void {
  try {
    localStorage.setItem(WHALE_KEY, String(value))
  } catch {
    /* in-memory state still applies for this tab */
  }
}

/** Read the critters flag (absent means off — retired Aqua decoration). */
function readCritters(): boolean {
  try {
    const raw = localStorage.getItem(CRITTERS_KEY)
    return raw === null ? false : raw === 'true'
  } catch {
    return false
  }
}

/** Persist the critters flag. */
function writeCritters(value: boolean): void {
  try {
    localStorage.setItem(CRITTERS_KEY, String(value))
  } catch {
    /* in-memory state still applies for this tab */
  }
}

/** Read the interactive-mesh flag (absent means off — retired Aqua decoration). */
function readMesh(): boolean {
  try {
    const raw = localStorage.getItem(MESH_KEY)
    return raw === null ? false : raw === 'true'
  } catch {
    return false
  }
}

/** Persist the interactive-mesh flag. */
function writeMesh(value: boolean): void {
  try {
    localStorage.setItem(MESH_KEY, String(value))
  } catch {
    /* in-memory state still applies for this tab */
  }
}

/** Read the cursor-spotlight flag (absent means on). */
function readSpotlight(): boolean {
  try {
    const raw = localStorage.getItem(SPOTLIGHT_KEY)
    return raw === null ? true : raw === 'true'
  } catch {
    return true
  }
}

/** Persist the cursor-spotlight flag. */
function writeSpotlight(value: boolean): void {
  try {
    localStorage.setItem(SPOTLIGHT_KEY, String(value))
  } catch {
    /* in-memory state still applies for this tab */
  }
}

/** Read the hover-press flag (absent means on). */
function readPress(): boolean {
  try {
    // One-shot migration: the entrance-rise key from the earlier iteration
    // never shipped — drop it so no stale preference lingers.
    localStorage.removeItem('dsh.ui-mineradio.entrance')
    const raw = localStorage.getItem(PRESS_KEY)
    return raw === null ? true : raw === 'true'
  } catch {
    return true
  }
}

/** Persist the hover-press flag. */
function writePress(value: boolean): void {
  try {
    localStorage.setItem(PRESS_KEY, String(value))
  } catch {
    /* in-memory state still applies for this tab */
  }
}

/** Read the audio-reactivity flag (absent means off — mic access is opt-in). */
function readAudioReact(): boolean {
  try {
    const raw = localStorage.getItem(AUDIO_REACT_KEY)
    return raw === null ? false : raw === 'true'
  } catch {
    return false
  }
}

/** Persist the audio-reactivity flag. */
function writeAudioReact(value: boolean): void {
  try {
    localStorage.setItem(AUDIO_REACT_KEY, String(value))
  } catch {
    /* in-memory state still applies for this tab */
  }
}

/** Current scheme from the presenter-owned body attribute. */
function activeScheme(): 'light' | 'dark' {
  return document.body.hasAttribute('data-ds-dark-theme') ? 'dark' : 'light'
}

/**
 * Owns the Mineradio layer lifecycle: reads the durable enable flag, and applies /
 * retracts every layer on change. Cross-tab flips arrive through the storage
 * event; every subscription and mounted effect are released when the plugin
 * fiber is disposed.
 */
export class MineradioLayer {
  private enabled = false
  private settings: MineradioSettings = { ...SETTINGS_DEFAULTS }
  /** Resolved palette scheme: dark = the brightness knob darkens, light = it brightens. */
  private dark = false
  private tokenDisposer: (() => void) | undefined
  private mainFluid: FluidShaderHandle | undefined
  private interactionDisposer: (() => void) | undefined
  private themeListener: (() => void) | undefined
  private seamDisposer: (() => void) | undefined
  private spotlightDisposer: (() => void) | undefined
  private whaleHandle: WhaleHandle | undefined
  private meshHandle: MeshHandle | undefined
  private starRiverHandle: StarRiverHandle | undefined
  private audioHandle: AudioReactivityHandle | undefined
  private cinemaDrift: CinemaDriftHandle | undefined
  private dispersion: GlassDispersionHandle | undefined
  private specularParallaxDisposer: (() => void) | undefined
  /** Object URL of the current large-video wallpaper (revoked on replace). */
  private videoObjectUrl: string | undefined
  /** IndexedDB id backing the current object URL (guards against reloads). */
  private videoBlobId: string | undefined
  /** Extracted accent hue from the wallpaper (undefined until read). */
  private extractedHue: number | undefined
  /** Wallpaper source the extracted hue was computed from (guards re-reads). */
  private extractedWallpaper: string | undefined
  private readonly ctx: Context

  /**
   * @param ctx - owning client context.
   */
  constructor(ctx: Context) {
    this.ctx = ctx
    ctx.effect(() => {
      const onStorage = (event: StorageEvent): void => {
        if (event.key === MINERADIO_ENABLED_KEY) {
          this.enabled = readEnabled()
          this.sync()
        }
        const key = event.key
        if (key !== null && (key in NUMERIC_KEYS || key === BACKGROUND_KEY || key === WALLPAPER_KEY || key === AUTO_TINT_KEY || key === WALLPAPER_MASK_KEY || key === MODE_KEY || key === WHALE_KEY || key === CRITTERS_KEY || key === MESH_KEY || key === SPOTLIGHT_KEY || key === PRESS_KEY || key === AUDIO_REACT_KEY)) {
          this.reloadSettings()
          if (this.enabled) { this.applySettings(); this.applyTokens(); this.applyFluidPalettes(); this.syncWhale(); this.syncAudioReact() }
        }
      }
      window.addEventListener('storage', onStorage)
      // Follow the Appearance switch: the brightness knob's half-range and
      // the overlay direction flip with the resolved scheme (`system` follows
      // the OS). Runs even while disabled so the settings row stays correct.
      this.themeListener = this.ctx.on('theme/change', () => {
        this.dark = this.resolveScheme()
        this.whaleHandle?.setDark(this.dark)
        this.starRiverHandle?.setDark(this.dark)
        if (this.enabled) {
          this.applySettings()
          this.applyFluidPalettes()
        }
      })
      return () => {
        window.removeEventListener('storage', onStorage)
        this.themeListener?.()
        this.themeListener = undefined
        this.unmount()
      }
    }, 'ui-mineradio: layer lifecycle')
    this.enabled = readEnabled()
    this.reloadSettings()
    this.dark = this.resolveScheme()
    this.sync()
  }

  /** Current enable state (the settings row mirrors this). */
  getEnabled(): boolean {
    return this.enabled
  }

  /** Current knob values (the settings row mirrors these). */
  getSettings(): MineradioSettings {
    return { ...this.settings }
  }

  /** Whether the resolved palette is dark (the brightness knob darkens). */
  getDark(): boolean {
    return this.dark
  }

  /** Resolved scheme from the theme service (falls back to the body attribute). */
  private resolveScheme(): boolean {
    try {
      return this.ctx.theme.getTheme().active.colorScheme === 'dark'
    } catch {
      return activeScheme() === 'dark'
    }
  }

  /** Re-read every knob from localStorage into memory. */
  private reloadSettings(): void {
    try {
      // One-shot cleanup: knobs from reverted iterations never shipped.
      localStorage.removeItem('dsh.ui-mineradio.tilt')
      localStorage.removeItem('dsh.ui-mineradio.lens')
      localStorage.removeItem('dsh.ui-mineradio.fluidTone')
      // One-shot decoration migration: the Mineradio rework ships the star
      // river as the particle stage, so stale whale/critters/mesh = on
      // preferences from the Aqua era are dropped once and re-defaulted.
      if (localStorage.getItem('dsh.ui-mineradio.decor.v2') === null) {
        localStorage.removeItem(WHALE_KEY)
        localStorage.removeItem(CRITTERS_KEY)
        localStorage.removeItem(MESH_KEY)
        localStorage.setItem('dsh.ui-mineradio.decor.v2', '1')
      }
    } catch {
      /* ignore */
    }
    this.settings = {
      mode: readMode(),
      blur: readSetting('blur'),
      frost: readSetting('frost'),
      fluidHue: readSetting('fluidHue'),
      fluidDepth: readSetting('fluidDepth'),
      starDensity: readSetting('starDensity'),
      dispersionHue: readSetting('dispersionHue'),
      dispersionRefract: readSetting('dispersionRefract'),
      bgBrightness: readSetting('bgBrightness'),
      background: readBackground(),
      wallpaper: readWallpaper(),
      autoTint: readAutoTint(),
      whale: readWhale(),
      critters: readCritters(),
      mesh: readMesh(),
      spotlight: readSpotlight(),
      press: readPress(),
      audioReact: readAudioReact(),
      wallpaperBlur: readSetting('wallpaperBlur'),
      wallpaperFrost: readSetting('wallpaperFrost'),
      wallpaperMask: readWallpaperMask(),
      wallpaperMaskBlur: readSetting('wallpaperMaskBlur'),
      wallpaperMaskOpacity: readSetting('wallpaperMaskOpacity'),
      videoBlur: readSetting('videoBlur'),
      videoBrightness: readSetting('videoBrightness'),
    }
  }

  /** Flip the layer: persist, then apply or retract every owned effect. */
  setEnabled(value: boolean): void {
    if (value === this.enabled) return
    this.enabled = value
    writeEnabled(value)
    this.sync()
  }

  /** Set the rendering mode ('mica' or 'compat'). */
  setMode(value: 'mica' | 'compat'): void {
    if (value === this.settings.mode) return
    this.settings.mode = value
    writeMode(value)
    if (this.enabled) { this.applySettings(); this.applyTokens() }
  }

  /** Set the glass blur radius (px). */
  setBlur(value: number): void {
    const next = clampSetting('blur', value)
    if (next === this.settings.blur) return
    this.settings.blur = next
    writeSetting('blur', next)
    if (this.enabled) this.applySettings()
  }

  /** Set the glass frost amount (0-100). */
  setFrost(value: number): void {
    const next = clampSetting('frost', value)
    if (next === this.settings.frost) return
    this.settings.frost = next
    writeSetting('frost', next)
    if (this.enabled) this.applySettings()
  }

  /** Set the fluid hue (degrees, continuous). */
  setFluidHue(value: number): void {
    const next = clampSetting('fluidHue', value)
    if (next === this.settings.fluidHue) return
    this.settings.fluidHue = next
    writeSetting('fluidHue', next)
    if (this.enabled) {
      this.applySettings()
      this.applyFluidPalettes()
    }
  }

  /** Set the glass dispersion tint hue (degrees, continuous). */
  setDispersionHue(value: number): void {
    const next = clampSetting('dispersionHue', value)
    if (next === this.settings.dispersionHue) return
    this.settings.dispersionHue = next
    writeSetting('dispersionHue', next)
    if (this.enabled) this.dispersion?.setTint(this.dispersionTintHue())
  }

  /** Set the glass refraction strength (0-100). */
  setDispersionRefract(value: number): void {
    const next = clampSetting('dispersionRefract', value)
    if (next === this.settings.dispersionRefract) return
    this.settings.dispersionRefract = next
    writeSetting('dispersionRefract', next)
    if (this.enabled) this.dispersion?.setRefraction(next)
  }

  /** Set the fluid depth (0-100, continuous: deep ↔ pale). */
  setFluidDepth(value: number): void {
    const next = clampSetting('fluidDepth', value)
    if (next === this.settings.fluidDepth) return
    this.settings.fluidDepth = next
    writeSetting('fluidDepth', next)
    if (this.enabled) this.applyFluidPalettes()
  }

  /** Set the background brightness (0-100: 0 = pure black, 50 = transparent, 100 = pure white). */
  setBgBrightness(value: number): void {
    const next = clampSetting('bgBrightness', value)
    if (next === this.settings.bgBrightness) return
    this.settings.bgBrightness = next
    writeSetting('bgBrightness', next)
    if (this.enabled) this.applySettings()
  }

  /** Set the backdrop source (fluid board or custom wallpaper). */
  setBackground(value: 'fluid' | 'wallpaper'): void {
    if (value === this.settings.background) return
    this.settings.background = value
    writeBackground(value)
    if (this.enabled) this.applySettings()
  }

  /** Set the wallpaper image (a data URL; empty clears it) or a large video
   *  (`idb:<id>` marker whose blob lives in IndexedDB). */
  setWallpaper(value: string): void {
    const previous = this.settings.wallpaper
    this.settings.wallpaper = value
    writeWallpaper(value)
    if (previous.startsWith('idb:') && value !== previous) {
      void deleteVideoBlob(previous.slice(4))
    }
    if (!value.startsWith('idb:') && this.videoObjectUrl !== undefined) {
      URL.revokeObjectURL(this.videoObjectUrl)
      this.videoObjectUrl = undefined
      this.videoBlobId = undefined
    }
    if (this.enabled) this.applySettings()
  }

  /** Set the wallpaper auto-tint flag (derive accent hues from the wallpaper). */
  setAutoTint(value: boolean): void {
    if (value === this.settings.autoTint) return
    this.settings.autoTint = value
    writeAutoTint(value)
    if (this.enabled) this.applySettings()
  }

  /** Set the particle-whale flag (chat-area center decoration). */
  setWhale(value: boolean): void {
    if (value === this.settings.whale) return
    this.settings.whale = value
    writeWhale(value)
    if (this.enabled) this.syncWhale()
  }

  /** Set the ambient marine-life flag (fish / bubbles / plankton). */
  setCritters(value: boolean): void {
    if (value === this.settings.critters) return
    this.settings.critters = value
    writeCritters(value)
    if (this.enabled) this.applySettings()
  }

  /** Set the interactive-mesh flag (dot-grid decoration). */
  setMesh(value: boolean): void {
    if (value === this.settings.mesh) return
    this.settings.mesh = value
    writeMesh(value)
    if (this.enabled) this.syncMesh()
  }

  /** Set the star-river particle density (0-100). */
  setStarDensity(value: number): void {
    const next = clampSetting('starDensity', value)
    if (next === this.settings.starDensity) return
    this.settings.starDensity = next
    writeSetting('starDensity', next)
    this.starRiverHandle?.setDensity(next)
  }

  /** Set the cursor-spotlight flag (pointer-tracking glass glow). */
  setSpotlight(value: boolean): void {
    if (value === this.settings.spotlight) return
    this.settings.spotlight = value
    writeSpotlight(value)
    if (this.enabled) this.applySettings()
  }

  /** Set the hover-press flag (pane sinks a touch under the cursor). */
  setPress(value: boolean): void {
    if (value === this.settings.press) return
    this.settings.press = value
    writePress(value)
    if (this.enabled) this.applySettings()
  }

  /** Set the audio-reactivity flag (mic-driven backdrop pulse). */
  setAudioReact(value: boolean): void {
    if (value === this.settings.audioReact) return
    this.settings.audioReact = value
    writeAudioReact(value)
    if (this.enabled) this.syncAudioReact()
  }

  /** Set the wallpaper blur radius (px). */
  setWallpaperBlur(value: number): void {
    const next = clampSetting('wallpaperBlur', value)
    if (next === this.settings.wallpaperBlur) return
    this.settings.wallpaperBlur = next
    writeSetting('wallpaperBlur', next)
    if (this.enabled) this.applySettings()
  }

  /** Set the wallpaper frost veil (0-100). */
  setWallpaperFrost(value: number): void {
    const next = clampSetting('wallpaperFrost', value)
    if (next === this.settings.wallpaperFrost) return
    this.settings.wallpaperFrost = next
    writeSetting('wallpaperFrost', next)
    if (this.enabled) this.applySettings()
  }

  /** Set the wallpaper frost-mask flag (readability veil + stronger blur). */
  setWallpaperMask(value: boolean): void {
    if (value === this.settings.wallpaperMask) return
    this.settings.wallpaperMask = value
    writeWallpaperMask(value)
    if (this.enabled) this.applySettings()
  }

  /** Set the frost-mask blur radius (px). */
  setWallpaperMaskBlur(value: number): void {
    const next = clampSetting('wallpaperMaskBlur', value)
    if (next === this.settings.wallpaperMaskBlur) return
    this.settings.wallpaperMaskBlur = next
    writeSetting('wallpaperMaskBlur', next)
    if (this.enabled) this.applySettings()
  }

  /** Set the frost-mask veil opacity (0-100). */
  setWallpaperMaskOpacity(value: number): void {
    const next = clampSetting('wallpaperMaskOpacity', value)
    if (next === this.settings.wallpaperMaskOpacity) return
    this.settings.wallpaperMaskOpacity = next
    writeSetting('wallpaperMaskOpacity', next)
    if (this.enabled) this.applySettings()
  }

  /** Set the video wallpaper blur radius (px). */
  setVideoBlur(value: number): void {
    const next = clampSetting('videoBlur', value)
    if (next === this.settings.videoBlur) return
    this.settings.videoBlur = next
    writeSetting('videoBlur', next)
    if (this.enabled) this.applySettings()
  }

  /** Set the video wallpaper brightness (0-100, 100 = fully lit). */
  setVideoBrightness(value: number): void {
    const next = clampSetting('videoBrightness', value)
    if (next === this.settings.videoBrightness) return
    this.settings.videoBrightness = next
    writeSetting('videoBrightness', next)
    if (this.enabled) this.applySettings()
  }

  /** After the user re-grants file access (选择视频 click on an fsa: video),
   *  drop the mount guard and re-apply so the file is re-read and played. */
  authorizeVideo(): void {
    if (this.videoObjectUrl !== undefined) {
      URL.revokeObjectURL(this.videoObjectUrl)
      this.videoObjectUrl = undefined
    }
    this.videoBlobId = undefined
    if (this.enabled) this.applySettings()
  }

  private sync(): void {
    if (this.enabled) this.mount()
    else this.unmount()
  }

  /** Write the knob-driven CSS variables and mode attributes onto <html>. */
  private applySettings(): void {
    const style = document.documentElement.style
    style.setProperty('--dsh-aqua-blur', `${this.settings.blur}px`)
    // Frost 0-100 → a 0-1.4 alpha multiplier (50 = 1x). Capped so max frost
    // stays translucent frosted glass instead of collapsing to a solid
    // opaque slab (the dark card would otherwise hit 100% and read as solid
    // navy).
    style.setProperty('--dsh-aqua-frost', String(Math.min(this.settings.frost / 50, 1.4)))
    // The new-session button's frost rides the same knob, +20 points.
    style.setProperty('--dsh-aqua-surface-frost', String(Math.min((this.settings.frost + 20) / 50, 1.4)))
    // Accent hue: auto-extracted from the wallpaper when auto-tint is on and
    // a wallpaper is active, otherwise the fluid tone (spotlight/bloom) and
    // the dispersion knob.
    this.applyAccentTint()
    style.setProperty('--dsh-aqua-wallpaper-blur', `${this.settings.wallpaperBlur}px`)
    style.setProperty('--dsh-aqua-wallpaper-frost', String(this.settings.wallpaperFrost / 100))
    style.setProperty('--dsh-aqua-wallpaper-mask-blur', `${this.settings.wallpaperMaskBlur}px`)
    style.setProperty('--dsh-aqua-wallpaper-mask-veil', String(this.settings.wallpaperMaskOpacity / 100))
    // Video wallpaper: blur rides the video's own filter; brightness drives
    // the scrim veil's alpha (100 = fully lit / no veil, 0 = deepest dim,
    // capped at 0.65 so the film never goes fully black).
    style.setProperty('--dsh-aqua-video-blur', `${this.settings.videoBlur}px`)
    style.setProperty('--dsh-aqua-video-dim', String(((100 - this.settings.videoBrightness) / 100) * 0.65))
    // Background brightness: dark mode darkens (0 = pure black, 50 = off),
    // light mode brightens (50 = off, 100 = pure white) — the knob's range
    // and the overlay direction both follow the resolved scheme.
    const dark = this.dark
    style.setProperty('--dsh-aqua-brightness-black', String(dark ? Math.max(0, (50 - this.settings.bgBrightness) / 50) : 0))
    style.setProperty('--dsh-aqua-brightness-white', String(dark ? 0 : Math.max(0, (this.settings.bgBrightness - 50) / 50)))

    // Rendering mode: the float rules key off data-dsh-float; the compat
    // (generic glass) rules key off data-dsh-compat.
    const compat = this.settings.mode === 'compat'
    document.documentElement.toggleAttribute('data-dsh-float', !compat)
    document.documentElement.toggleAttribute('data-dsh-compat', compat)

    // Cursor spotlight and hover press ride the floating glass only —
    // compat keeps the stock layout, so neither effect applies there.
    document.documentElement.toggleAttribute(SPOTLIGHT_ATTRIBUTE, !compat && this.settings.spotlight)
    document.documentElement.toggleAttribute(PRESS_ATTRIBUTE, !compat && this.settings.press)

    // Backdrop source: flip the ambient container between fluid and wallpaper.
    const ambient = document.querySelector<HTMLElement>('[data-dsh-aqua-ambient]')
    if (ambient !== null) ambient.dataset.background = this.settings.background
    if (ambient !== null) ambient.dataset.critters = this.settings.critters ? 'on' : 'off'
    // The wallpaper may be an image or a video: images and small videos are
    // data URLs; large videos are `idb:<id>` markers (blob in IndexedDB);
    // File System Access videos are `fsa:<name>` markers (the handle lives
    // in IndexedDB and re-reads the original file).
    const wallpaper = this.settings.wallpaper
    const isVideo = wallpaper.startsWith('data:video/') || wallpaper.startsWith('idb:') || wallpaper.startsWith('fsa:')
    const wallpaperLayer = document.querySelector<HTMLElement>('[data-dsh-aqua-wallpaper-layer]')
    if (wallpaperLayer !== null) {
      wallpaperLayer.dataset.background = this.settings.background
      wallpaperLayer.dataset.media = isVideo ? 'video' : 'image'
    }
    // Mirror the wallpaper state onto <html> so the stylesheet can scope
    // video-mode readability rules (bubble plates) without touching the app.
    const wallpaperOn = this.settings.background === 'wallpaper' && wallpaper !== ''
    document.documentElement.toggleAttribute('data-dsh-aqua-wallpaper', wallpaperOn)
    // Frost mask: readable frosted glass over the wallpaper (blur + veil) and
    // the particle stage is silenced while it is on.
    document.documentElement.toggleAttribute('data-dsh-aqua-wallpaper-mask', wallpaperOn && this.settings.wallpaperMask)
    if (wallpaperOn) {
      document.documentElement.setAttribute('data-dsh-aqua-media', isVideo ? 'video' : 'image')
    } else {
      document.documentElement.removeAttribute('data-dsh-aqua-media')
    }
    const img = document.querySelector<HTMLImageElement>('[data-dsh-aqua-wallpaper-img]')
    if (img !== null) {
      if (this.settings.background === 'wallpaper' && wallpaper !== '' && !isVideo) {
        img.src = wallpaper
      } else {
        img.removeAttribute('src')
      }
    }
    const video = document.querySelector<HTMLVideoElement>('[data-dsh-aqua-wallpaper-video]')
    if (video !== null) {
      if (this.settings.background === 'wallpaper' && isVideo) {
        if (wallpaper.startsWith('idb:')) {
          const id = wallpaper.slice(4)
          if (this.videoBlobId === id && this.videoObjectUrl !== undefined) {
            // Already mounted — never reload/revoke on repeated applySettings
            // runs (knob tweaks would otherwise restart the video).
          } else {
            void loadVideoBlob(id).then((blob) => {
              if (blob === null) return
              if (this.settings.wallpaper !== wallpaper) return // stale load
              const url = URL.createObjectURL(blob)
              if (this.videoObjectUrl !== undefined) URL.revokeObjectURL(this.videoObjectUrl)
              this.videoObjectUrl = url
              this.videoBlobId = id
              video.setAttribute('src', url)
              this.configureWallpaperVideo(video)
            })
          }
        } else if (wallpaper.startsWith('fsa:')) {
          if (this.videoBlobId === wallpaper && this.videoObjectUrl !== undefined) {
            // Already mounted — knob tweaks must not reload the file.
          } else {
            void loadVideoHandle().then(async (handle) => {
              if (handle === null) return
              if (this.settings.wallpaper !== wallpaper) return // stale load
              try {
                // The browser remembers the file authorization; only a live
                // grant lets us re-read the original file automatically.
                const permission = await handle.queryPermission({ mode: 'read' })
                if (permission !== 'granted') return // re-authorize on 选择视频 click
                const file = await handle.getFile()
                const url = URL.createObjectURL(file)
                if (this.videoObjectUrl !== undefined) URL.revokeObjectURL(this.videoObjectUrl)
                this.videoObjectUrl = url
                this.videoBlobId = wallpaper
                video.setAttribute('src', url)
                this.configureWallpaperVideo(video)
              } catch {
                /* file moved/deleted or access revoked — stays empty until re-picked */
              }
            })
          }
        } else if (video.getAttribute('src') !== wallpaper) {
          video.setAttribute('src', wallpaper)
          this.configureWallpaperVideo(video)
        }
      } else {
        video.pause()
        video.removeAttribute('src')
        video.load()
      }
    }

    // Re-run wallpaper color extraction when the source changes.
    this.ensureWallpaperTint()
  }

  /** The wallpaper plays as a plain <video> element (the browser's own
   *  decoder, no player chrome at all): looping on, cover fill via CSS, and
   *  autoplay with a muted fallback where policy requires it. A direct
   *  element (not an iframe) keeps backdrop-filter working over it, so the
   *  glass panels stay frosted above the video. */
  private configureWallpaperVideo(video: HTMLVideoElement): void {
    video.loop = true
    if (!video.paused) return
    void video.play().catch(() => {
      // Autoplay policy blocked unmuted playback — mute and retry.
      video.muted = true
      void video.play().catch(() => { /* ignore */ })
    })
  }

  /** The hue driving the spotlight glow + ambient bloom right now. */
  private accentHue(): number {
    if (this.settings.autoTint && this.settings.background === 'wallpaper'
      && this.settings.wallpaper !== '' && this.extractedHue !== undefined) {
      return this.extractedHue
    }
    return ((this.settings.fluidHue + HUE_BASE) % 360 + 360) % 360
  }

  /** The dispersion edge-tint hue (auto-extracted, or the user's knob). */
  private dispersionTintHue(): number {
    if (this.settings.autoTint && this.settings.background === 'wallpaper'
      && this.settings.wallpaper !== '' && this.extractedHue !== undefined) {
      return this.extractedHue
    }
    return this.settings.dispersionHue
  }

  /** Write the hue-driven accent vars (spotlight glow + bloom + dispersion). */
  private applyAccentTint(): void {
    const glowHue = this.accentHue()
    const style = document.documentElement.style
    // The champagne-bloom hue drives the ambient gold behind the glass,
    // scoped to amber→mint so the brand stays warm.
    style.setProperty('--dsh-aqua-bloom-h', String(((glowHue - 44) * 0.5 + 44 + 360) % 360))
    style.setProperty('--dsh-aqua-spot-color', this.dark
      ? `hsla(${glowHue}, 90%, 62%, 0.17)`
      : `hsla(${glowHue}, 90%, 45%, 0.16)`)
    this.dispersion?.setTint(this.dispersionTintHue())
  }

  /** Kick off (or clear) wallpaper color extraction, guarded by source. */
  private ensureWallpaperTint(): void {
    const wallpaper = this.settings.wallpaper
    const active = this.settings.autoTint && this.settings.background === 'wallpaper' && wallpaper !== ''
    if (!active) {
      if (this.extractedHue !== undefined || this.extractedWallpaper !== undefined) {
        this.extractedHue = undefined
        this.extractedWallpaper = undefined
        this.applyAccentTint()
      }
      return
    }
    if (this.extractedWallpaper === wallpaper) return
    this.extractedWallpaper = wallpaper
    void this.extractWallpaperTint(wallpaper)
  }

  /** Extract the dominant hue and repaint the accents (async, guarded). */
  private async extractWallpaperTint(wallpaper: string): Promise<void> {
    const isVideo = wallpaper.startsWith('data:video/') || wallpaper.startsWith('idb:') || wallpaper.startsWith('fsa:')
    const hue = isVideo ? await this.extractVideoHue() : await this.extractImageHue(wallpaper)
    if (this.settings.wallpaper !== wallpaper) return // stale load
    this.extractedHue = hue ?? undefined
    this.applyAccentTint()
  }

  /** Draw a wallpaper image into the extractor. */
  private extractImageHue(dataUrl: string): Promise<number | null> {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => resolve(extractDominantHue(img))
      img.onerror = () => resolve(null)
      img.src = dataUrl
    })
  }

  /** Draw the wallpaper video's first available frame into the extractor. */
  private extractVideoHue(): Promise<number | null> {
    return new Promise((resolve) => {
      const video = document.querySelector<HTMLVideoElement>('[data-dsh-aqua-wallpaper-video]')
      if (video === null) {
        resolve(null)
        return
      }
      const draw = (): void => resolve(extractDominantHue(video))
      if (video.readyState >= 2) {
        draw()
        return
      }
      video.addEventListener('loadeddata', draw, { once: true })
      video.addEventListener('error', () => resolve(null), { once: true })
    })
  }

  /** Apply the mode's token layer (floating palette, or translucent compat). */
  private applyTokens(): void {
    this.tokenDisposer?.()
    this.tokenDisposer = this.ctx.theme.overrideTokens(
      OVERRIDE_SOURCE,
      this.settings.mode === 'compat' ? COMPAT_TOKEN_OVERRIDES : MINERADIO_TOKEN_OVERRIDES,
    )
  }

  private mount(): void {
    document.documentElement.setAttribute(MINERADIO_ATTRIBUTE, '')
    ensureAmbientScene()
    ensurePageFades()
    this.syncStarRiver()
    this.startCinemaDrift()
    this.startGlassDispersion()
    this.startSpecularParallax()
    this.applySettings()
    this.applyTokens()
    this.mountFluid()
    this.startSeamStamper()
    this.startSpotlightFeed()
    this.syncWhale()
    this.syncMesh()
    this.syncAudioReact()
  }

  /** Mount the Mineradio star-river particle stage (always on with the layer:
   *  it is the skin's signature motion, like the player's backdrop). */
  private syncStarRiver(): void {
    if (!this.enabled) return
    if (this.starRiverHandle !== undefined) return
    const ambient = document.querySelector<HTMLElement>('[data-dsh-aqua-ambient]')
    if (ambient === null) return
    this.starRiverHandle = mountStarRiver(ambient, { dark: this.dark, density: this.settings.starDensity })
  }

  /** Start the cinematic camera drift over the fluid + star-river layers
   *  (idempotent per mount; the subtle parallax "breathe" of the backdrop). */
  private startCinemaDrift(): void {
    if (!this.enabled) return
    if (this.cinemaDrift !== undefined) return
    const ambient = document.querySelector<HTMLElement>('[data-dsh-aqua-ambient]')
    if (ambient === null) return
    this.cinemaDrift = startCinemaDrift(ambient)
  }

  /** Start the glass chromatic-dispersion filter (idempotent per mount). */
  private startGlassDispersion(): void {
    if (!this.enabled) return
    if (this.dispersion !== undefined) return
    this.dispersion = startGlassDispersion()
    this.dispersion.setTint(this.dispersionTintHue())
    this.dispersion.setRefraction(this.settings.dispersionRefract)
  }

  /** Start the specular-highlight cursor parallax (idempotent per mount). */
  private startSpecularParallax(): void {
    if (!this.enabled) return
    if (this.specularParallaxDisposer !== undefined) return
    this.specularParallaxDisposer = startSpecularParallax()
  }

  /** Mount or drop the particle whale to match enabled + the whale flag. */
  private syncWhale(): void {
    if (this.enabled && this.settings.whale) {
      if (this.whaleHandle !== undefined) return
      const ambient = document.querySelector<HTMLElement>('[data-dsh-aqua-ambient]')
      if (ambient === null) return
      this.whaleHandle = mountWhale(ambient, this.dark)
    } else {
      this.whaleHandle?.dispose()
      this.whaleHandle = undefined
    }
  }

  /** Mount or drop the interactive mesh to match enabled + the mesh flag. */
  private syncMesh(): void {
    if (this.enabled && this.settings.mesh) {
      if (this.meshHandle !== undefined) return
      const ambient = document.querySelector<HTMLElement>('[data-dsh-aqua-ambient]')
      if (ambient === null) return
      this.meshHandle = mountMesh(ambient)
    } else {
      this.meshHandle?.dispose()
      this.meshHandle = undefined
    }
  }

  /** Start or stop the mic audio feed to match enabled + the audioReact flag.
   *  The feed routes bass → fluid, mids/highs → star river, and overall
   *  loudness → a CSS var that lifts the spotlight glow. */
  private syncAudioReact(): void {
    const root = document.documentElement
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const shouldRun = this.enabled && this.settings.audioReact && !reducedMotion
    if (shouldRun) {
      if (this.audioHandle !== undefined) return
      root.dataset.dshAquaAudioStatus = 'starting'
      this.audioHandle = createAudioReactivity((env) => {
        // Only the star particles pulse with the music — bass drives the hop,
        // treble the sparkle. The fluid and spotlight glow stay audio-free.
        this.starRiverHandle?.setAudio(env.low, env.high)
        // Diagnostic: exposes the live envelope (low,high,volume) for DevTools.
        root.dataset.dshAquaAudioEnv =
          `${env.low.toFixed(2)},${env.high.toFixed(2)},${env.volume.toFixed(2)}`
      })
      void this.audioHandle.start().then((ok) => {
        if (ok) {
          root.dataset.dshAquaAudioStatus = 'running'
        } else {
          // Mic denied / no device: drop the inert handle so a re-toggle retries.
          root.dataset.dshAquaAudioStatus = 'failed'
          this.audioHandle?.dispose()
          this.audioHandle = undefined
        }
      })
    } else {
      root.dataset.dshAquaAudioStatus = !this.enabled ? 'theme-off'
        : !this.settings.audioReact ? 'toggle-off'
          : 'reduced-motion'
      this.audioHandle?.dispose()
      this.audioHandle = undefined
      root.style.removeProperty('--dsh-aqua-audio-glow')
      delete root.dataset.dshAquaAudioEnv
    }
  }

  private unmount(): void {
    document.documentElement.removeAttribute(MINERADIO_ATTRIBUTE)
    document.documentElement.removeAttribute('data-dsh-float')
    document.documentElement.removeAttribute('data-dsh-compat')
    document.documentElement.removeAttribute('data-dsh-aqua-wallpaper')
    document.documentElement.removeAttribute('data-dsh-aqua-wallpaper-mask')
    document.documentElement.removeAttribute('data-dsh-aqua-media')
    document.documentElement.removeAttribute(SPOTLIGHT_ATTRIBUTE)
    document.documentElement.removeAttribute(PRESS_ATTRIBUTE)
    this.spotlightDisposer?.()
    this.spotlightDisposer = undefined
    this.starRiverHandle?.dispose()
    this.starRiverHandle = undefined
    this.cinemaDrift?.dispose()
    this.cinemaDrift = undefined
    this.dispersion?.dispose()
    this.dispersion = undefined
    this.specularParallaxDisposer?.()
    this.specularParallaxDisposer = undefined
    this.whaleHandle?.dispose()
    this.whaleHandle = undefined
    this.meshHandle?.dispose()
    this.meshHandle = undefined
    this.audioHandle?.dispose()
    this.audioHandle = undefined
    document.documentElement.style.removeProperty('--dsh-aqua-audio-glow')
    delete document.documentElement.dataset.dshAquaAudioEnv
    delete document.documentElement.dataset.dshAquaAudioStatus
    this.tokenDisposer?.()
    this.tokenDisposer = undefined
    if (this.videoObjectUrl !== undefined) {
      URL.revokeObjectURL(this.videoObjectUrl)
      this.videoObjectUrl = undefined
      this.videoBlobId = undefined
    }
    this.teardownFluid()
    removeAmbientScene()
    removePageFades()
    this.seamDisposer?.()
    this.seamDisposer = undefined
  }

  /** Attach the fluid shader and the interaction feeds. */
  private mountFluid(): void {
    const mainCanvas = document.querySelector<HTMLCanvasElement>('[data-dsh-aqua-fluid-canvas]')
    try {
      if (mainCanvas !== null) this.mainFluid = attachFluidShader(mainCanvas, this.fluidParams())
      // Palette follows the Appearance switch via the layer-lifecycle
      // `theme/change` listener (which also refreshes the brightness overlay).
      this.applyFluidPalettes()
      if (this.mainFluid !== undefined && mainCanvas !== null) {
        this.interactionDisposer = attachFluidInteractions({
          main: this.mainFluid,
          mainCanvas,
        })
      }
    } catch {
      // A GPU / driver failure must never take the glass theme down with it:
      // the ambient CSS wash still paints, only the WebGL water is skipped.
      this.mainFluid = undefined
    }
  }

  private teardownFluid(): void {
    this.interactionDisposer?.()
    this.interactionDisposer = undefined
    this.mainFluid?.dispose()
    this.mainFluid = undefined
  }

  private fluidParams(): FluidParams {
    // Continuous hue + depth drive the palette through HSL interpolation —
    // the depth lives in the colors, so the canvas needs no global filter.
    return { ...SITE_FLUID_PARAMS, ...fluidToneColors(this.dark, this.settings.fluidHue, this.settings.fluidDepth) }
  }

  private applyFluidPalettes(): void {
    this.mainFluid?.setParams(this.fluidParams())
  }

  /** Stamp the data-* seams the stylesheet keys off (self-contained mode). */
  private startSeamStamper(): void {
    if (this.seamDisposer !== undefined) return
    this.seamDisposer = startSeamStamper()
  }

  /** Attach the cursor-spotlight pointer feeds (idempotent per mount). */
  private startSpotlightFeed(): void {
    if (this.spotlightDisposer !== undefined) return
    this.spotlightDisposer = startSpotlight()
  }
}
