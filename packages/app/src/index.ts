// @ts-minecraft/app — composition root package
// Layer wiring, frame stages, presentation/UI, worker entry points

// Frame handler (public API consumed by src/main.ts + tests)
export {
  createFrameHandler,
  createFrameHandlers,
} from './frame-handler'
export type {
  FrameHandlerDeps,
  FrameHandlerServices,
  FrameLoopHandlers,
} from './frame/types'

// Layer wiring (consumed by src/layers.ts + tests via @/layers)
export * from './main/layers'

// Boot + session (consumed by src/main.ts)
export { bootProgram } from './main/boot'
export type { BootContext } from './main/boot'
export { sessionProgram } from './main/session'

// Presentation services (consumed by src/main.ts + tests)
export { MainMenuService, MainMenuLive } from './presentation/menu/main-menu'
export { SettingsOverlayService, SettingsOverlayLive } from './presentation/settings/settings-overlay'
export { FPSCounterService } from './presentation/fps-counter'
export { BlockHighlightService, BlockHighlightLive } from './presentation/highlight/block-highlight'
export { HotbarRendererService, HotbarRendererLive } from './presentation/hud/hotbar-three'
export { DebugOverlayService, DebugOverlayLive } from './presentation/hud/debug-overlay'
export { DomOperationsService } from './presentation/hud/crosshair'
export { InputService, InputServiceLive } from './presentation/input/input-service'
export { InventoryRendererService, InventoryRendererLive } from './presentation/inventory/inventory-renderer'
export { LoadingScreenService, LoadingScreenLive } from './presentation/loading/loading-screen'
export { ConfirmDialogService, ConfirmDialogLive } from './presentation/menu/confirm-dialog'
export { DeathScreenService, DeathScreenLive } from './presentation/menu/death-screen'
export { PauseMenuService, PauseMenuLive } from './presentation/menu/pause-menu'
export { TradingPresentationService, TradingPresentationLive } from './presentation/trading'

// QA helpers (used in E2E / debug builds)
export { installQaApi } from './main/qa-api'
export { installBrowserEventBridge, wrapFrameHandlerWithBrowserEffects } from './main/browser-runtime'
