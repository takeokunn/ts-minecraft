import type { FPSCounterService, HotbarRendererService } from '@ts-minecraft/presentation'
import type { PerfHudService } from '@ts-minecraft/rendering'

export type FrameHudServices = {
  readonly fpsCounter: FPSCounterService
  readonly hotbarRenderer: HotbarRendererService
  readonly perfHud: PerfHudService
}
