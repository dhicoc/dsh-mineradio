/** `settings.mineradio` namespace dictionaries (the settings-row copy). */

/** Dictionary namespace owned by this plugin. */
export const NS = 'settings.mineradio'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'mineradio.title': 'Mineradio 主题',
  'mineradio.description': '影院级私人视觉电台玻璃主题——香槟金辉光，流体/壁纸双背景，模糊度、磨砂度、色调与辉光都可自由调节',
  'mineradio.enable': '开启',
  'mineradio.disable': '关闭',
  'mineradio.mode': '模式',
  'mineradio.modeMica': '云母效果',
  'mineradio.modeCompat': '兼容模式',
  'mineradio.materialGroup': '玻璃材质',
  'mineradio.decorAmbient': '环境装饰',
  'mineradio.decorHover': '悬停效果',
  'mineradio.whale': '粒子金鲸',
  'mineradio.critters': '星尘粒子',
  'mineradio.mesh': '网状交互',
  'mineradio.starDensity': '粒子密度',
  'mineradio.spotlight': '香槟辉光',
  'mineradio.press': '悬停下压',
  'mineradio.audioReact': '音频响应',
  'mineradio.blur': '玻璃模糊度',
  'mineradio.frost': '磨砂度',
  'mineradio.fluidHue': '色调',
  'mineradio.fluidDepth': '颜色深浅',
  'mineradio.dispersionHue': '色散颜色',
  'mineradio.dispersionRefract': '折射强度',
  'mineradio.bgBrightness': '背景亮度',
  'mineradio.bgBrightnessHintDark': '深色模式：0 压暗至纯黑，50 原样',
  'mineradio.bgBrightnessHintLight': '浅色模式：50 原样，100 提亮至纯白',
  'mineradio.background': '背景',
  'mineradio.backgroundFluid': '流体',
  'mineradio.backgroundWallpaper': '壁纸',
  'mineradio.wallpaper': '壁纸',
  'mineradio.autoTint': '自动取色',
  'mineradio.wallpaperHint': '浅色壁纸用浅色模式，深色壁纸用深色模式⚠️',
  'mineradio.chooseImage': '选择图片',
  'mineradio.chooseVideo': '选择视频',
  'mineradio.deleteWallpaper': '删除',
  'mineradio.wallpaperBlur': '壁纸模糊度',
  'mineradio.wallpaperFrost': '壁纸磨砂度',
  'mineradio.wallpaperMask': '磨砂遮罩',
  'mineradio.wallpaperMaskBlur': '遮罩模糊度',
  'mineradio.wallpaperMaskOpacity': '遮罩透明度',
  'mineradio.videoBlur': '视频模糊度',
  'mineradio.videoBrightness': '视频亮度',
  'mineradio.videoHint': '⚠️视频会自动压暗以保证文字清晰，可用模糊度和亮度调节；刷新后未自动播放时点一下"选择视频"即可恢复',
} satisfies Record<string, string>

export type MineradioLocaleKey = keyof typeof zh

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The Mineradio settings row's copy. */
    'settings.mineradio': MineradioLocaleKey
  }
}

/** English dictionary. */
export const en = {
  'mineradio.title': 'Mineradio theme',
  'mineradio.description': 'A cinematic private-visual-radio glass theme — champagne glow, fluid/wallpaper backdrop, blur, frost, hue, and glow all adjustable',
  'mineradio.enable': 'On',
  'mineradio.disable': 'Off',
  'mineradio.mode': 'Mode',
  'mineradio.modeMica': 'Mica',
  'mineradio.modeCompat': 'Compatibility',
  'mineradio.materialGroup': 'Glass material',
  'mineradio.decorAmbient': 'Ambient',
  'mineradio.decorHover': 'Hover effects',
  'mineradio.whale': 'Particle whale',
  'mineradio.critters': 'Star particles',
  'mineradio.mesh': 'Interactive mesh',
  'mineradio.starDensity': 'Particle density',
  'mineradio.spotlight': 'Champagne glow',
  'mineradio.press': 'Hover tilt',
  'mineradio.audioReact': 'Audio reactive',
  'mineradio.blur': 'Glass blur',
  'mineradio.frost': 'Frost',
  'mineradio.fluidHue': 'Hue',
  'mineradio.fluidDepth': 'Color depth',
  'mineradio.dispersionHue': 'Dispersion color',
  'mineradio.dispersionRefract': 'Refraction',
  'mineradio.bgBrightness': 'Background brightness',
  'mineradio.bgBrightnessHintDark': 'Dark mode: 0 fades to pure black, 50 is unchanged',
  'mineradio.bgBrightnessHintLight': 'Light mode: 50 is unchanged, 100 brightens to pure white',
  'mineradio.background': 'Backdrop',
  'mineradio.backgroundFluid': 'Fluid',
  'mineradio.backgroundWallpaper': 'Wallpaper',
  'mineradio.wallpaper': 'Wallpaper',
  'mineradio.autoTint': 'Auto color',
  'mineradio.wallpaperHint': 'Use light mode for light wallpapers, dark mode for dark wallpapers ⚠️',
  'mineradio.chooseImage': 'Choose image',
  'mineradio.chooseVideo': 'Choose video',
  'mineradio.deleteWallpaper': 'Delete',
  'mineradio.wallpaperBlur': 'Wallpaper blur',
  'mineradio.wallpaperFrost': 'Wallpaper frost',
  'mineradio.wallpaperMask': 'Frost mask',
  'mineradio.wallpaperMaskBlur': 'Mask blur',
  'mineradio.wallpaperMaskOpacity': 'Mask opacity',
  'mineradio.videoBlur': 'Video blur',
  'mineradio.videoBrightness': 'Video brightness',
  'mineradio.videoHint': '⚠️ The video is dimmed automatically to keep text readable — adjust blur and brightness here; if it does not play after a reload, click "Choose video" once to restore access',
} satisfies Record<MineradioLocaleKey, string>
