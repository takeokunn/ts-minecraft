import type { BlockHighlightService } from '@ts-minecraft/presentation'
import type { CrosshairService } from '@ts-minecraft/presentation'
import type { DebugFeatureFlagsService } from '@ts-minecraft/app/application/debug-feature-flags'
import type { DebugOverlayService } from '@ts-minecraft/presentation'
import type { FPSCounterService } from '@ts-minecraft/presentation'
import type { HotbarRendererService } from '@ts-minecraft/presentation'
import type { InputService } from '@ts-minecraft/presentation'
import type { PauseMenuService } from '@ts-minecraft/presentation'
import type { SettingsOverlayService } from '@ts-minecraft/presentation'
import type { TradingPresentationService } from '@ts-minecraft/presentation'

export type SessionPresentationBootstrapServices = {
  readonly crosshair: CrosshairService
  readonly blockHighlight: BlockHighlightService
  readonly inputService: InputService
  readonly hotbarRenderer: HotbarRendererService
  readonly fpsCounter: FPSCounterService
  readonly settingsOverlay: SettingsOverlayService
  readonly pauseMenu: PauseMenuService
  readonly debugFeatureFlags: DebugFeatureFlagsService
  readonly debugOverlay: DebugOverlayService
  readonly tradingPresentation: TradingPresentationService
}
