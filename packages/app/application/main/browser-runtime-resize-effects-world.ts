import { Effect } from 'effect'
import type { WorldRendererService } from '@ts-minecraft/rendering'

import type { BrowserRuntimeResizeLayout } from './browser-runtime-resize-layout'

export type BrowserRuntimeResizeWorldDeps = {
  readonly layout: BrowserRuntimeResizeLayout
  readonly worldRendererService: WorldRendererService
}

export const applyBrowserRuntimeResizeWorld = ({
  layout,
  worldRendererService,
}: BrowserRuntimeResizeWorldDeps): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    yield* worldRendererService.updateWaterResolution(layout.displaySize.width, layout.displaySize.height)
    yield* worldRendererService.resizeRefractionRT(layout.displaySize.width, layout.displaySize.height)
    yield* worldRendererService.resizeRefractionCamera(layout.cameraAspect)
  })
