/**
 * Per-quality preset values for resolved graphics settings.
 *
 * - low:    sky + smaa only (maximum performance)
 * - medium: + shadows + bloom (balanced)
 * - high:   + ssao (matches original defaults — good quality)
 * - ultra:  + god rays + dof (maximum quality)
 */
export const GRAPHICS_PRESETS = {
  low: {
    shadowsEnabled: false, ssaoEnabled: false, bloomEnabled: false,
    smaaEnabled: true,  skyEnabled: true,  dofEnabled: false, godRaysEnabled: false,
    godRaysSamples: 0,  bloomStrength: 0,    refractionThrottleFrames: 0,
  },
  medium: {
    shadowsEnabled: true,  ssaoEnabled: false, bloomEnabled: true,
    smaaEnabled: true,  skyEnabled: true,  dofEnabled: false, godRaysEnabled: false,
    godRaysSamples: 25, bloomStrength: 0.2,  refractionThrottleFrames: 3,
  },
  high: {
    shadowsEnabled: true,  ssaoEnabled: true,  bloomEnabled: true,
    smaaEnabled: true,  skyEnabled: true,  dofEnabled: false, godRaysEnabled: false,
    godRaysSamples: 25, bloomStrength: 0.25, refractionThrottleFrames: 2,
  },
  ultra: {
    shadowsEnabled: true,  ssaoEnabled: true,  bloomEnabled: true,
    smaaEnabled: true,  skyEnabled: true,  dofEnabled: true,  godRaysEnabled: true,
    godRaysSamples: 40, bloomStrength: 0.3,  refractionThrottleFrames: 1,
  },
} as const
