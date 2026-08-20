/**
 * Audio reactivity — microphone → Web Audio AnalyserNode → three smoothed
 * energy envelopes (bass "low", mid/high "high", overall "volume") that drive
 * the living backdrop:
 *   - `low`  stirs the fluid (ripple amplitude + flow speed);
 *   - `high` brightens/swells the star river (perceived density);
 *   - `volume` lifts the cursor spotlight glow.
 *
 * The mic stream + AudioContext are released on stop/dispose, and the OS
 * reduced-motion preference disables the feed entirely. Capture uses the raw
 * stream's own mic gain (AGC + noise suppression off) so the envelopes track
 * real loudness instead of the browser's leveled output.
 */

/** One analysis-frame envelope, each value normalised 0..1. */
export interface AudioEnvelope {
  /** Bass energy (≈30–700 Hz) — drives fluid ripple amplitude/speed. */
  low: number
  /** Mid/high energy (≈700 Hz–8 kHz) — drives star brightness/density. */
  high: number
  /** Overall loudness — drives the spotlight glow lift. */
  volume: number
}

/** Live handle returned by {@link createAudioReactivity}. */
export interface AudioReactivityHandle {
  /** Request the mic and start the analysis loop; resolves true on success. */
  start(): Promise<boolean>
  /** Stop the loop and release the stream/context (the handle stays reusable). */
  stop(): void
  /** Permanent teardown: stop plus a guard that blocks any later start. */
  dispose(): void
}

/** Analyser FFT size: 2048 → 1024 frequency bins. */
const FFT_SIZE = 2048

/** Start the analyser loop and forward smoothed envelopes to the callback. */
export function createAudioReactivity(
  onEnvelope: (env: AudioEnvelope) => void,
): AudioReactivityHandle {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')

  let audioCtx: AudioContext | null = null
  let analyser: AnalyserNode | null = null
  let source: MediaStreamAudioSourceNode | null = null
  let stream: MediaStream | null = null
  let raf = 0
  let running = false
  let disposed = false
  const bins = new Uint8Array(FFT_SIZE)

  // Smoothed envelopes — fast attack, slow release, so the visuals surge with
  // each beat and melt back instead of flickering.
  let low = 0
  let high = 0
  let volume = 0
  // Slow-decaying peaks per band: the level is normalised against these so the
  // envelope swings 0..1 regardless of the absolute mic level (quiet laptop
  // speakers and loud speakers drive the same full-range pulse).
  let lowPeak = 0.01
  let highPeak = 0.01
  let volPeak = 0.01

  const smooth = (prev: number, target: number, up: number, down: number): number => {
    const k = target > prev ? up : down
    return prev + (target - prev) * k
  }

  const analyze = (): void => {
    if (!running || analyser === null) return
    analyser.getByteFrequencyData(bins)

    const n = analyser.frequencyBinCount
    // Bands as bin indices: low = 1..~n*0.03, high = ~n*0.03..~n*0.35, and
    // volume = every bin. Indices scale with the FFT size, so the split stays
    // frequency-consistent across sample rates.
    const loEnd = Math.max(2, Math.floor(n * 0.03))
    const hiEnd = Math.max(loEnd + 1, Math.floor(n * 0.35))
    let loSum = 0
    let hiSum = 0
    let allSum = 0
    for (let i = 1; i < n; i += 1) {
      const b = bins[i] as number
      allSum += b
      if (i < loEnd) loSum += b
      else if (i < hiEnd) hiSum += b
    }

    // Band means in 0..1 (byte / 255).
    const lo = (loSum / Math.max(1, loEnd - 1)) / 255
    const hi = (hiSum / Math.max(1, hiEnd - loEnd)) / 255
    const vol = (allSum / Math.max(1, n - 1)) / 255

    // Adaptive peak tracking (slow decay), then headroom-normalise so the
    // envelope reflects the music's dynamics rather than the absolute mic
    // gain. A silence gate keeps the backdrop at rest when there is no signal.
    lowPeak = Math.max(lo, lowPeak * 0.997)
    highPeak = Math.max(hi, highPeak * 0.997)
    volPeak = Math.max(vol, volPeak * 0.997)
    const norm = (value: number, peak: number): number =>
      value < 0.006 ? 0 : Math.min(1, value / Math.max(0.02, peak * 0.85))

    low = smooth(low, norm(lo, lowPeak), 0.5, 0.14)
    high = smooth(high, norm(hi, highPeak), 0.5, 0.16)
    volume = smooth(volume, norm(vol, volPeak), 0.45, 0.12)

    onEnvelope({ low, high, volume })
    raf = requestAnimationFrame(analyze)
  }

  async function start(): Promise<boolean> {
    if (disposed || running || reduced.matches) return false
    if (navigator.mediaDevices?.getUserMedia === undefined) return false
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      })
      const Ctor = window.AudioContext
      audioCtx = new Ctor()
      // Chromium starts a fresh AudioContext "suspended"; resume it (the mic
      // grant is a user gesture) or the analyser reads silence forever.
      if (audioCtx.state === 'suspended') await audioCtx.resume().catch(() => {})
      source = audioCtx.createMediaStreamSource(stream)
      analyser = audioCtx.createAnalyser()
      analyser.fftSize = FFT_SIZE
      analyser.smoothingTimeConstant = 0.5
      source.connect(analyser)
      running = true
      raf = requestAnimationFrame(analyze)
      return true
    } catch (error) {
      // The mic grant failed (denied / no device / policy). Surfacing it makes
      // "no effect" diagnosable from the console instead of silently inert.
      console.warn('[mineradio audio] mic capture failed:', error)
      stop()
      return false
    }
  }

  function stop(): void {
    running = false
    cancelAnimationFrame(raf)
    raf = 0
    source?.disconnect()
    source = null
    stream?.getTracks().forEach((track) => track.stop())
    stream = null
    if (audioCtx !== null) {
      void audioCtx.close().catch(() => {})
      audioCtx = null
    }
    analyser = null
    // Settle consumers back to neutral so the backdrop stops pulsing instantly.
    low = 0
    high = 0
    volume = 0
    onEnvelope({ low, high, volume })
  }

  return {
    start,
    stop,
    dispose(): void {
      disposed = true
      stop()
    },
  }
}