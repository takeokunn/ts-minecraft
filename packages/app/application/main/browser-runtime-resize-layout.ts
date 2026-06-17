export type BrowserRuntimeResizeSize = {
  readonly width: number
  readonly height: number
}

export type BrowserRuntimeResizeLayout = {
  readonly pixelRatio: number
  readonly displaySize: BrowserRuntimeResizeSize
  readonly scaledSize: BrowserRuntimeResizeSize
  readonly cameraAspect: number
  readonly passSizes: {
    readonly gtao: BrowserRuntimeResizeSize
    readonly bloom: BrowserRuntimeResizeSize
    readonly bokeh: BrowserRuntimeResizeSize
    readonly smaa: BrowserRuntimeResizeSize
    readonly godRays: BrowserRuntimeResizeSize
  }
}

export type BrowserRuntimeResizeLayoutInput = {
  readonly width: number
  readonly height: number
  readonly devicePixelRatio: number
  readonly pixelRatioCap: number
  readonly gtaoEnabled: boolean
  readonly bloomEnabled: boolean
  readonly bokehEnabled: boolean
  readonly smaaEnabled: boolean
  readonly godRaysEnabled: boolean
}

const resolveResizeSize = (width: number, height: number, enabled: boolean): BrowserRuntimeResizeSize => ({
  width: enabled ? Math.max(1, Math.ceil(width)) : 1,
  height: enabled ? Math.max(1, Math.ceil(height)) : 1,
})

export const resolveBrowserRuntimeResizeLayout = ({
  width,
  height,
  devicePixelRatio,
  pixelRatioCap,
  gtaoEnabled,
  bloomEnabled,
  bokehEnabled,
  smaaEnabled,
  godRaysEnabled,
}: BrowserRuntimeResizeLayoutInput): BrowserRuntimeResizeLayout => {
  const pixelRatio = Math.min(devicePixelRatio, pixelRatioCap)
  const scaledWidth = Math.max(1, Math.ceil(width * pixelRatio))
  const scaledHeight = Math.max(1, Math.ceil(height * pixelRatio))
  const halfScaledWidth = Math.max(1, Math.ceil(scaledWidth / 2))
  const halfScaledHeight = Math.max(1, Math.ceil(scaledHeight / 2))

  return {
    pixelRatio,
    displaySize: {
      width,
      height,
    },
    scaledSize: {
      width: scaledWidth,
      height: scaledHeight,
    },
    cameraAspect: width / height,
    passSizes: {
      gtao: resolveResizeSize(halfScaledWidth, halfScaledHeight, gtaoEnabled),
      bloom: resolveResizeSize(scaledWidth, scaledHeight, bloomEnabled),
      bokeh: resolveResizeSize(scaledWidth, scaledHeight, bokehEnabled),
      smaa: resolveResizeSize(scaledWidth, scaledHeight, smaaEnabled),
      godRays: resolveResizeSize(scaledWidth, scaledHeight, godRaysEnabled),
    },
  }
}
