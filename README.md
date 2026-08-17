# @deepseek-ai/dsh-client-ui-mineradio

English | [中文](README.zh.md)

**Mineradio** is a cinematic glassmorphism theme for the DeepSeek Harness web UI — a faithful re-skin of the Mineradio "private visual radio" identity. The header, sidebar, composer, stats line, and trajectory view become panes of warm champagne glass over a near-black studio backdrop. You can put a video as wallpaper and switch it off and the stock UI comes back exactly, with no source changes to DSH itself.

## What ports from Mineradio

- **Champagne-gold identity** — the signature palette (`#f4d28a` champagne, `#7ad7c2` mint, `#ff5367` ember rose over a warm near-black `#08090B`) drives every alias token: surfaces, hairline strokes, text ink, buttons, scrollbars, and warm-tinted shadows with a gold bloom.
- **Typography** — Inter + Noto Sans SC for the UI, self-hosted so there's no shell/fontsource dependency.
- **Cinematic glow** — a champagne-gold ambient bloom sits behind the glass; the spotlight hue knob sweeps it from warm amber to mint while keeping the brand warm.
- **Fluid backdrop** — a living fluid board (hue + depth adjustable, defaults to warm gold) or your own wallpaper (image or video) with its own blur and frost.

## Features

- **Two modes**: **Mica** restyles the layout into floating glass cards (blur and frost adjustable), while **Compatibility Mode** keeps the stock layout byte-for-byte and only swaps the material to generic glass — other plugins' UI gets the same treatment automatically
- **Free backdrop**: a living fluid board (hue adjustable) or your own wallpaper (fills the page, aspect preserved, with its own blur and frost); light wallpapers look best in light mode, dark wallpapers in dark mode
- **Background brightness**: follows the resolved scheme — dark mode darkens (0–50), light mode brightens (50–100), 50 is unchanged
- **Ambient decor**: particle whale in the chat center, star particles, and an interactive dot-grid mesh — all toggleable
- **Champagne glow**: a pointer-tracking glow over the glass panes, plus a hover press-down for tactile depth
- One switch: off restores the stock UI exactly, and every effect is removed with the plugin

## Installation

### Windows (one command)

```powershell
powershell -ExecutionPolicy Bypass -Command "Invoke-WebRequest 'https://github.com/XxHuberrr/Mineradio-DSH-Theme/raw/main/install.ps1' -OutFile install.ps1; .\install.ps1"
```

Installs the **latest release** by default. No git needed — the installer falls back to a plain zip download. It links the plugin into the profile's `node_modules` and registers `ui-mineradio` in `cordis.patch.yml` (idempotent — safe to run again). Reload the web UI and it is on.

Pin a version or track the dev branch:

```powershell
.\install.ps1 -Version 'v1.0.0'   # a specific release
.\install.ps1 -Version 'main'     # the development branch
```

### Manual / via pnpm

```powershell
dsh plugin --profile web add https://github.com/XxHuberrr/Mineradio-DSH-Theme
```

Then add a `ui-mineradio` entry manually to `$DSH_HOME/profiles/web/cordis.patch.yml`:

```yaml
- insert:
    - id: ui-mineradio
      name: '@deepseek-ai/dsh-client-ui-mineradio'
```

Restart the web UI. To turn it off: Settings → Plugins → **Mineradio**.

## License

MIT. Mineradio visual identity (palette, typography, glow aesthetic) is a faithful re-skin of the Mineradio project by XxHuberrr, whose original is licensed GPL-3.0.
