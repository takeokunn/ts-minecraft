// Tuning philosophy: typical desktop hardware should hit 60+ FPS at "medium",
// which is the recommended preset for new users. Bloom and SMAA are full-res
// post-process passes that compound with shadows; on integrated GPUs they
// dominate frame time, so medium keeps shadows + sky (the day/night feel)
// but skips bloom/smaa to free ~3-6 ms of GPU time. High clamps DPR to 0.85
// because high-DPI displays at DPR=2 burn fillrate without proportional gain.
//
// - low:    no post-processing, no sky, no shadows (maximum performance)
// - medium: + shadows + sky (balanced; recommended default)
// - high:   + ssao + bloom + smaa (DPR clamped to 0.85)
// - ultra:  + god rays + dof (maximum quality)
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
  },
  medium: {
    shadowsEnabled: true,  ssaoEnabled: false, bloomEnabled: false,
    smaaEnabled: false, skyEnabled: true,  dofEnabled: false, godRaysEnabled: false,
    godRaysSamples: 0,  bloomStrength: 0,    refractionThrottleFrames: 5, pixelRatioCap: 0.65,
    refractionMinScreenRatio: 0.05, // FR-4.4: aggressive — already throttled, drop sub-5% water frames
    composerRtType: 1009, // THREE.UnsignedByteType — no HDR pass, save VRAM bandwidth
    useCompositePass: false, // FR-4.3: no HDR effects — CompositePass would no-op
  },
  high: {
    shadowsEnabled: true,  ssaoEnabled: true,  bloomEnabled: true,
    smaaEnabled: true,  skyEnabled: true,  dofEnabled: false, godRaysEnabled: false,
    godRaysSamples: 25, bloomStrength: 0.25, refractionThrottleFrames: 2, pixelRatioCap: 0.85,
    refractionMinScreenRatio: 0.005, // FR-4.4: conservative — only drop frames where water is <0.5% of screen
    composerRtType: 1016, // THREE.HalfFloatType — bloom needs HDR
    useCompositePass: true, // FR-4.3: bloom merged into CompositePass; legacy bloomPass disabled
  },
  ultra: {
    shadowsEnabled: true,  ssaoEnabled: true,  bloomEnabled: true,
    smaaEnabled: true,  skyEnabled: true,  dofEnabled: false,  godRaysEnabled: true,
    godRaysSamples: 40, bloomStrength: 0.3,  refractionThrottleFrames: 1, pixelRatioCap: 1.25,
    refractionMinScreenRatio: 0.005, // FR-4.4: conservative — preserve quality
    composerRtType: 1016, // THREE.HalfFloatType — bloom + god rays need HDR
    useCompositePass: true, // FR-4.3: bloom + godRays + bokeh merged; ~25MB/frame savings
  },
} as const
