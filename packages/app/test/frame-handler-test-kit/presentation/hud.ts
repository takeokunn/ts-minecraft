import { Effect } from 'effect'
import { FPSCounterService } from '@ts-minecraft/presentation'
import { HotbarRendererService } from '@ts-minecraft/presentation/hud'

/** Creates a hotbar renderer fake with no-op update and render methods. */
export const makeHotbarRenderer = () =>
  HotbarRendererService.of({
    _tag: '@minecraft/presentation/HotbarRenderer' as const,
    initialize: (_width: number, _height: number) => Effect.void,
    update: (_slots: unknown, _sel: unknown) => Effect.void,
    render: (_renderer: unknown) => Effect.void,
  })

/** Creates an FPS counter fake pinned to 60 FPS and zero frames. */
export const makeFPSCounter = () =>
  FPSCounterService.of({
    _tag: '@minecraft/presentation/FPSCounter' as const,
    tick: (_dt: number) => Effect.succeed(60),
    getFPS: () => Effect.succeed(60),
    getFrameCount: () => Effect.succeed(0),
  })
