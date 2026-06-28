import { Effect } from 'effect'
import { CrosshairService, DamageOverlayService, FPSCounterService } from '@ts-minecraft/presentation'
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

/** Creates a crosshair fake with no-op visual effects. */
export const makeCrosshair = () =>
  CrosshairService.of({
    _tag: '@minecraft/presentation/Crosshair' as const,
    show: () => Effect.void,
    hide: () => Effect.void,
    toggle: () => Effect.void,
    pulse: () => Effect.void,
    isVisible: () => Effect.succeed(false),
  })

/** Creates a damage overlay fake with no-op flash behavior. */
export const makeDamageOverlay = () =>
  DamageOverlayService.of({
    _tag: '@minecraft/presentation/DamageOverlay' as const,
    element: {} as HTMLElement,
    flash: () => Effect.void,
    hide: () => Effect.void,
  })
