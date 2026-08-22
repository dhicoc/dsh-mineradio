/**
 * Mineradio client plugin body: the toggleable cinematic glass skin. Owns the
 * durable enable flag (localStorage), applies/retracts the theme layer through
 * {@link MineradioLayer}, and registers two settings surfaces:
 * - the master on/off card into the Plugins section (`settings.plugin.item`,
 *   same shape as the other plugin cards);
 * - every glass knob into the General section's Appearance row area
 *   (`settings.general.item`, right under 外观).
 * One click on the master switch returns the stock UI (every layer is an
 * effect, disposed on flip).
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { BoundActions } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the `settings.plugin.item` SlotMap merge.
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
// Type-only: pulls the `settings.general.item` SlotMap merge.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { MineradioPluginCard, type MineradioPluginCardInjected } from './MineradioPluginCard.tsx'
import { MineradioAppearanceRow, type MineradioAppearanceRowInjected } from './MineradioAppearanceRow.tsx'
import { createMineradioRowStore, type MineradioSettingsPayload } from './settings-store.ts'
import { en, NS, zh } from './locales.ts'
import { MineradioLayer } from './theme-layer.ts'
// Side-effect imports: the theme-layer stylesheet (unloaded with the plugin)
// and the self-hosted font @font-face (no shell dependency).
import './mineradio.module.css'
import './fonts.module.css'

/** Required services: theme override stack plus the settings-card surfaces. */
export const inject = ['theme', 'slots', 'locale']

/**
 * Client plugin body.
 * @param ctx - client cordis context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-mineradio: settings dictionaries')

  // The layer owns its lifecycle: enable flag, token stack, and CSS attribute
  // are all effects released on disable/dispose.
  const layer = new MineradioLayer(ctx)

  // Two store mirrors of the same layer state: one for the Plugins card
  // (master switch) and one for the General section's Appearance row (knobs).
  const pluginStore = createMineradioRowStore()
  const appearanceStore = createMineradioRowStore()
  let pluginBound: BoundActions<typeof pluginStore> | undefined
  let appearanceBound: BoundActions<typeof appearanceStore> | undefined
  let revision = 0
  const payload = (): MineradioSettingsPayload => {
    const s = layer.getSettings()
    return {
      enabled: layer.getEnabled(),
      mode: s.mode,
      textStyle: s.textStyle,
      blur: s.blur,
      frost: s.frost,
      fluidHue: s.fluidHue,
      fluidDepth: s.fluidDepth,
      dispersionHue: s.dispersionHue,
      dispersionRefract: s.dispersionRefract,
      bgBrightness: s.bgBrightness,
      dark: layer.getDark(),
      background: s.background,
      wallpaper: s.wallpaper,
      autoTint: s.autoTint,
      whale: s.whale,
      critters: s.critters,
      mesh: s.mesh,
      starDensity: s.starDensity,
      spotlight: s.spotlight,
      press: s.press,
      audioReact: s.audioReact,
      wallpaperBlur: s.wallpaperBlur,
      wallpaperFrost: s.wallpaperFrost,
      wallpaperMask: s.wallpaperMask,
      wallpaperMaskBlur: s.wallpaperMaskBlur,
      wallpaperMaskOpacity: s.wallpaperMaskOpacity,
      videoBlur: s.videoBlur,
      videoBrightness: s.videoBrightness,
    }
  }
  const sync = (): void => {
    const next = payload()
    pluginBound?.sync(next, revision)
    appearanceBound?.sync(next, revision)
    revision += 1
  }
  // The Appearance switch flips the brightness knob's half-range; re-sync
  // both stores so the row re-renders with the new range.
  ctx.effect(() => ctx.on('theme/change', () => { sync() }), 'ui-mineradio: appearance scheme sync')

  const pluginInjected = (actions: BoundActions<typeof pluginStore>): MineradioPluginCardInjected => {
    pluginBound = actions
    // Re-sync from the layer so no flip is lost between registration and
    // first render (the store's revision guard drops stale duplicates).
    sync()
    return {
      setEnabled: (enabled) => {
        layer.setEnabled(enabled)
        sync()
      },
    }
  }
  const appearanceInjected = (actions: BoundActions<typeof appearanceStore>): MineradioAppearanceRowInjected => {
    appearanceBound = actions
    sync()
    return {
      setMode: (mode) => {
        layer.setMode(mode)
        sync()
      },
      setTextStyle: (textStyle) => {
        layer.setTextStyle(textStyle)
        sync()
      },
      setBlur: (blur) => {
        layer.setBlur(blur)
        sync()
      },
      setFrost: (frost) => {
        layer.setFrost(frost)
        sync()
      },
      setFluidHue: (fluidHue) => {
        layer.setFluidHue(fluidHue)
        sync()
      },
      setFluidDepth: (fluidDepth) => {
        layer.setFluidDepth(fluidDepth)
        sync()
      },
      setDispersionHue: (dispersionHue) => {
        layer.setDispersionHue(dispersionHue)
        sync()
      },
      setDispersionRefract: (dispersionRefract) => {
        layer.setDispersionRefract(dispersionRefract)
        sync()
      },
      setBgBrightness: (bgBrightness) => {
        layer.setBgBrightness(bgBrightness)
        sync()
      },
      setBackground: (background) => {
        layer.setBackground(background)
        sync()
      },
      setWallpaper: (wallpaper) => {
        layer.setWallpaper(wallpaper)
        sync()
      },
      setAutoTint: (autoTint) => {
        layer.setAutoTint(autoTint)
        sync()
      },
      setWhale: (whale) => {
        layer.setWhale(whale)
        sync()
      },
      setCritters: (critters) => {
        layer.setCritters(critters)
        sync()
      },
      setMesh: (mesh) => {
        layer.setMesh(mesh)
        sync()
      },
      setStarDensity: (starDensity) => {
        layer.setStarDensity(starDensity)
        sync()
      },
      setSpotlight: (spotlight) => {
        layer.setSpotlight(spotlight)
        sync()
      },
      setPress: (press) => {
        layer.setPress(press)
        sync()
      },
      setAudioReact: (audioReact) => {
        layer.setAudioReact(audioReact)
        sync()
      },
      setWallpaperBlur: (wallpaperBlur) => {
        layer.setWallpaperBlur(wallpaperBlur)
        sync()
      },
      setWallpaperFrost: (wallpaperFrost) => {
        layer.setWallpaperFrost(wallpaperFrost)
        sync()
      },
      setWallpaperMask: (wallpaperMask) => {
        layer.setWallpaperMask(wallpaperMask)
        sync()
      },
      setWallpaperMaskBlur: (wallpaperMaskBlur) => {
        layer.setWallpaperMaskBlur(wallpaperMaskBlur)
        sync()
      },
      setWallpaperMaskOpacity: (wallpaperMaskOpacity) => {
        layer.setWallpaperMaskOpacity(wallpaperMaskOpacity)
        sync()
      },
      setVideoBlur: (videoBlur) => {
        layer.setVideoBlur(videoBlur)
        sync()
      },
      setVideoBrightness: (videoBrightness) => {
        layer.setVideoBrightness(videoBrightness)
        sync()
      },
      authorizeVideo: () => {
        layer.authorizeVideo()
      },
    }
  }

  // Master switch card in the Plugins configurable tab.
  ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
    name: 'settings.plugin.item',
    key: 'mineradio',
    order: 5,
    store: pluginStore,
    locale: NS,
    inject: pluginInjected,
  }, MineradioPluginCard))

  // Glass knobs row in the General section, directly under Appearance (10).
  ctx.slots.inject('settings.general.item', () => ctx.slots.register({
    name: 'settings.general.item',
    id: 'mineradio',
    order: 11,
    store: appearanceStore,
    locale: NS,
    inject: appearanceInjected,
  }, MineradioAppearanceRow), { key: 'mineradio' })
}
