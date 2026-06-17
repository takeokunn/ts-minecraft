import type { GraphicsQuality, ResolvedGraphics } from './settings.schema'

// Tuning philosophy: the default path targets low-spec hardware. Bloom and
// SMAA are full-res post-process passes that compound with shadows; on
// integrated GPUs they dominate frame time, so low removes those passes and
// keeps heavier visual features opt-in through medium/high/ultra.
//
// pixelRatioCap is the LARGEST visual-quality lever: it caps
// renderer.setPixelRatio(min(devicePixelRatio, cap)). A cap BELOW 1.0 renders
// below native CSS resolution and upscales to the canvas → a permanently soft,
// blurry image. medium therefore renders at 1.0 (native, crisp): the previous
// 0.65 traded sharpness for fillrate, but on typical hardware the frame budget
// is CPU-bound (chunk meshing / terrain gen), so sub-native rendering mostly
// added blur without buying back framerate. low uses the schema minimum 0.5 for
// weak GPUs; ultra renders at 2.0 for high-DPI crispness.
//
// - low:    no post-processing, no sky, no shadows (low-spec default, DPR 0.5)
// - medium: + shadows + sky (balanced, DPR 1.25)
// - high:   + bloom (HDR), higher DPR, crisper shadows
// - ultra:  + god rays + dof + max DPR (maximum quality)
//
// FR-4.3: `useCompositePass` merges Bloom + GodRays + Bokeh into a single
// full-screen shader pass (~25 MB/frame bandwidth savings). Only enabled on
// presets that actually use HDR effects (high/ultra) — on low/medium the
// CompositePass would have no inputs to composite.
export const GRAPHICS_PRESETS = {
  low: {
    shadowsEnabled: false, ssaoEnabled: false, bloomEnabled: false,
    smaaEnabled: false,  skyEnabled: false,  dofEnabled: false, godRaysEnabled: false,
    godRaysSamples: 0,  bloomStrength: 0,    refractionThrottleFrames: 0, pixelRatioCap: 0.5,
    refractionMinScreenRatio: 0.05, // FR-4.4: aggressive skip on low — refraction is throttled to 0 anyway
    composerRtType: 1009, // THREE.UnsignedByteType — no HDR pass, save VRAM bandwidth
    useCompositePass: false, // FR-4.3: no HDR effects — CompositePass would no-op
    shadowMapSize: 512, shadowRadius: 0, // shadows OFF on low; minimal values for the unused buffer
  },
  medium: {
    shadowsEnabled: true,  ssaoEnabled: false, bloomEnabled: false,
    smaaEnabled: false, skyEnabled: true,  dofEnabled: false, godRaysEnabled: false,
    // refractionThrottleFrames: 0 → water uses its shader but SKIPS doRefractionPrePass, the
    // full second scene render. Since oceans/lakes now generate water everywhere, that prepass
    // would fire on the default preset whenever water is on-screen; the live refraction texture
    // is a high/ultra-only luxury, not worth a per-frame extra scene pass on the balanced default.
    godRaysSamples: 0,  bloomStrength: 0,    refractionThrottleFrames: 0, pixelRatioCap: 1.25,
    refractionMinScreenRatio: 0.05,
    composerRtType: 1009, // THREE.UnsignedByteType — no HDR pass, save VRAM bandwidth
    useCompositePass: false, // FR-4.3: no HDR effects — CompositePass would no-op
    shadowMapSize: 3072, shadowRadius: 4, // sharper shadow silhouette without jumping to HDR
  },
  high: {
    shadowsEnabled: true,  ssaoEnabled: true,  bloomEnabled: true,
    smaaEnabled: true,  skyEnabled: true,  dofEnabled: false, godRaysEnabled: false,
    godRaysSamples: 25, bloomStrength: 0.25, refractionThrottleFrames: 2, pixelRatioCap: 1.5,
    refractionMinScreenRatio: 0.005, // FR-4.4: conservative — only drop frames where water is <0.5% of screen
    composerRtType: 1016, // THREE.HalfFloatType — bloom needs HDR
    useCompositePass: true, // FR-4.3: bloom merged into CompositePass; standalone bloomPass disabled
    shadowMapSize: 4096, shadowRadius: 6, // high-fidelity soft shadow with more DPR headroom
  },
  ultra: {
    shadowsEnabled: true,  ssaoEnabled: true,  bloomEnabled: true,
    smaaEnabled: true,  skyEnabled: true,  dofEnabled: true,  godRaysEnabled: true,
    godRaysSamples: 40, bloomStrength: 0.3,  refractionThrottleFrames: 1, pixelRatioCap: 2.0,
    refractionMinScreenRatio: 0.005, // FR-4.4: conservative — preserve quality
    composerRtType: 1016, // THREE.HalfFloatType — bloom + god rays need HDR
    useCompositePass: true, // FR-4.3: bloom + godRays + bokeh merged; ~25MB/frame savings
    shadowMapSize: 4096, shadowRadius: 8, // maximum softness without exceeding the shadow atlas cap
  },
} as const

export const resolvePreset = (quality: GraphicsQuality): ResolvedGraphics =>
  GRAPHICS_PRESETS[quality]
