/**
 * Per-quality preset values for resolved graphics settings.
 *
 * - low:    no post-processing, no sky, no shadows (maximum performance)
 * - medium: + shadows + bloom (balanced)
 * - high:   + ssao (matches original defaults — good quality)
 * - ultra:  + god rays + dof (maximum quality)
 */
export const GRAPHICS_PRESETS = {
  low: {
    shadowsEnabled: false, ssaoEnabled: false, bloomEnabled: false,
    smaaEnabled: false,  skyEnabled: false,  dofEnabled: false, godRaysEnabled: false,
    godRaysSamples: 0,  bloomStrength: 0,    refractionThrottleFrames: 0, pixelRatioCap: 0.5,
  },
  medium: {
    shadowsEnabled: true,  ssaoEnabled: false, bloomEnabled: true,
    smaaEnabled: true,  skyEnabled: true,  dofEnabled: false, godRaysEnabled: false,
    godRaysSamples: 25, bloomStrength: 0.2,  refractionThrottleFrames: 3, pixelRatioCap: 0.75,
  },
  high: {
    shadowsEnabled: true,  ssaoEnabled: true,  bloomEnabled: true,
    smaaEnabled: true,  skyEnabled: true,  dofEnabled: false, godRaysEnabled: false,
    godRaysSamples: 25, bloomStrength: 0.25, refractionThrottleFrames: 2, pixelRatioCap: 1,
  },
  ultra: {
    shadowsEnabled: true,  ssaoEnabled: true,  bloomEnabled: true,
    smaaEnabled: true,  skyEnabled: true,  dofEnabled: true,  godRaysEnabled: true,
    godRaysSamples: 40, bloomStrength: 0.3,  refractionThrottleFrames: 1, pixelRatioCap: 1.25,
  },
} as const
