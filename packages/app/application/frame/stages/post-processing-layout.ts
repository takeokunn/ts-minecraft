import type { ResolvedGraphics } from '@ts-minecraft/game'

export type PostProcessingSetupSize = {
  readonly width: number
  readonly height: number
}

export type PostProcessingSetupPassLayout = {
  readonly enabled: boolean
  readonly size: PostProcessingSetupSize
}

export type PostProcessingSetupLayoutInput = {
  readonly width: number
  readonly height: number
  readonly pixelRatio: number
  readonly isWebGL2: boolean
  readonly resolvedGraphics: ResolvedGraphics
}

export type PostProcessingSetupLayout = {
  readonly renderSize: PostProcessingSetupSize
  readonly shadowCastEnabled: boolean
  readonly gtao: PostProcessingSetupPassLayout
  readonly bloom: PostProcessingSetupPassLayout & {
    readonly strength: number
  }
  readonly dof: PostProcessingSetupPassLayout
  readonly smaa: PostProcessingSetupPassLayout
  readonly godRays: PostProcessingSetupPassLayout & {
    readonly samples: number
  }
}

const resolvePassSize = (width: number, height: number, enabled: boolean): PostProcessingSetupSize => ({
  width: enabled ? Math.max(1, Math.ceil(width)) : 1,
  height: enabled ? Math.max(1, Math.ceil(height)) : 1,
})

export const resolvePostProcessingSetupLayout = ({
  width,
  height,
  pixelRatio,
  isWebGL2,
  resolvedGraphics,
}: PostProcessingSetupLayoutInput): PostProcessingSetupLayout => {
  const renderWidth = Math.max(1, Math.ceil(width * pixelRatio))
  const renderHeight = Math.max(1, Math.ceil(height * pixelRatio))
  const halfRenderWidth = Math.max(1, Math.ceil(renderWidth / 2))
  const halfRenderHeight = Math.max(1, Math.ceil(renderHeight / 2))
  const gtaoEnabled = resolvedGraphics.ssaoEnabled && isWebGL2

  return {
    renderSize: {
      width: renderWidth,
      height: renderHeight,
    },
    shadowCastEnabled: resolvedGraphics.shadowsEnabled,
    gtao: {
      enabled: gtaoEnabled,
      size: resolvePassSize(halfRenderWidth, halfRenderHeight, gtaoEnabled),
    },
    bloom: {
      enabled: resolvedGraphics.bloomEnabled,
      strength: resolvedGraphics.bloomStrength,
      size: resolvePassSize(renderWidth, renderHeight, resolvedGraphics.bloomEnabled),
    },
    dof: {
      enabled: resolvedGraphics.dofEnabled,
      size: resolvePassSize(renderWidth, renderHeight, resolvedGraphics.dofEnabled),
    },
    smaa: {
      enabled: resolvedGraphics.smaaEnabled,
      size: resolvePassSize(renderWidth, renderHeight, resolvedGraphics.smaaEnabled),
    },
    godRays: {
      enabled: resolvedGraphics.godRaysEnabled,
      samples: resolvedGraphics.godRaysSamples,
      size: resolvePassSize(renderWidth, renderHeight, resolvedGraphics.godRaysEnabled),
    },
  }
}
