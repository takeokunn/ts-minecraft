import type { GraphicsQuality, ResolvedGraphics } from './settings.schema'

// Tuning philosophy: typical desktop hardware should hit 60+ FPS at "medium",
// which is the recommended preset for new users. Bloom and SMAA are full-res
// post-process passes that compound with shadows; on integrated GPUs they
// dominate frame time, so medium keeps shadows + sky (the day/night feel)
// but skips bloom/smaa to free ~3-6 ms of GPU time.
//
// pixelRatioCap is the LARGEST visual-quality lever: it caps
// renderer.setPixelRatio(min(devicePixelRatio, cap)). A cap BELOW 1.0 renders
// below native CSS resolution and upscales to the canvas → a permanently soft,
// blurry image. medium therefore renders at 1.0 (native, crisp): the previous
// 0.65 traded sharpness for fillrate, but on typical hardware the frame budget
// is CPU-bound (chunk meshing / terrain gen), so sub-native rendering mostly
// added blur without buying back framerate. low keeps a reduced 0.75 for weak
// GPUs (softer but not mushy); ultra renders at 2.0 for high-DPI crispness.
//
// - low:    no post-processing, no sky, no shadows (maximum performance, DPR 0.75)
// - medium: + shadows + sky (balanced; recommended default, DPR 1.0 native)
// - high:   + ssao + bloom + smaa (DPR 1.25)
// - ultra:  + god rays + dof (maximum quality, DPR 2.0)
//
// FR-4.3: `useCompositePass` merges Bloom + GodRays + Bokeh into a single
// full-screen shader pass (~25 MB/frame bandwidth savings). Only enabled on
// presets that actually use HDR effects (high/ultra) — on low/medium the
// CompositePass would have no inputs to composite.
export const GRAPHICS_PRESETS = {
  low: {
    shadowsEnabled: false, ssaoEnabled: false, bloomEnabled: false,
    smaaEnabled: false,  skyEnabled: false,  dofEnabled: false, godRaysEnabled: false,
    godRaysSamples: 0,  bloomStrength: 0,    refractionThrottleFrames: 0, pixelRatioCap: 0.75,
    refractionMinScreenRatio: 0.05, // FR-4.4: aggressive skip on low — refraction is throttled to 0 anyway
    composerRtType: 1009, // THREE.UnsignedByteType — no HDR pass, save VRAM bandwidth
    useCompositePass: false, // FR-4.3: no HDR effects — CompositePass would no-op
  },
  medium: {
    shadowsEnabled: true,  ssaoEnabled: false, bloomEnabled: false,
    smaaEnabled: false, skyEnabled: true,  dofEnabled: false, godRaysEnabled: false,
    godRaysSamples: 0,  bloomStrength: 0,    refractionThrottleFrames: 5, pixelRatioCap: 1.0,
    refractionMinScreenRatio: 0.05, // FR-4.4: aggressive — already throttled, drop sub-5% water frames
    composerRtType: 1009, // THREE.UnsignedByteType — no HDR pass, save VRAM bandwidth
    useCompositePass: false, // FR-4.3: no HDR effects — CompositePass would no-op
  },
  high: {
    shadowsEnabled: true,  ssaoEnabled: true,  bloomEnabled: true,
    smaaEnabled: true,  skyEnabled: true,  dofEnabled: false, godRaysEnabled: false,
    godRaysSamples: 25, bloomStrength: 0.25, refractionThrottleFrames: 2, pixelRatioCap: 1.25,
    refractionMinScreenRatio: 0.005, // FR-4.4: conservative — only drop frames where water is <0.5% of screen
    composerRtType: 1016, // THREE.HalfFloatType — bloom needs HDR
    useCompositePass: true, // FR-4.3: bloom merged into CompositePass; standalone bloomPass disabled
  },
  ultra: {
    shadowsEnabled: true,  ssaoEnabled: true,  bloomEnabled: true,
    smaaEnabled: true,  skyEnabled: true,  dofEnabled: true,  godRaysEnabled: true,
    godRaysSamples: 40, bloomStrength: 0.3,  refractionThrottleFrames: 1, pixelRatioCap: 2.0,
    refractionMinScreenRatio: 0.005, // FR-4.4: conservative — preserve quality
    composerRtType: 1016, // THREE.HalfFloatType — bloom + god rays need HDR
    useCompositePass: true, // FR-4.3: bloom + godRays + bokeh merged; ~25MB/frame savings
  },
} as const

export const resolvePreset = (quality: GraphicsQuality): ResolvedGraphics =>
  GRAPHICS_PRESETS[quality]
