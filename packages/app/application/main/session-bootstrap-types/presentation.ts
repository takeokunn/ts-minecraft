import type { CrosshairService } from '@ts-minecraft/presentation'
import type { DebugFeatureFlagsService } from '@ts-minecraft/app/debug-feature-flags'
import type { DebugOverlayService } from '@ts-minecraft/presentation'
import type { LoadingScreenService } from '@ts-minecraft/presentation'
import type { BlockHighlightService } from '@ts-minecraft/presentation'
import type { InputService } from '@ts-minecraft/presentation'
import type { HotbarRendererService } from '@ts-minecraft/presentation'
import type { FPSCounterService } from '@ts-minecraft/presentation'
import type { SettingsOverlayService } from '@ts-minecraft/presentation'
import type { PauseMenuService } from '@ts-minecraft/presentation'
import type { DeathScreenService } from '@ts-minecraft/presentation'
import type { TradingPresentationService } from '@ts-minecraft/presentation'
import type { PlayerCameraStateService, FirstPersonCameraService, ThirdPersonCameraService } from '@ts-minecraft/entity'

export type SessionPresentationBootstrapServices = {
  readonly playerCameraState: PlayerCameraStateService
  readonly firstPersonCamera: FirstPersonCameraService
  readonly thirdPersonCamera: ThirdPersonCameraService
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

export type SessionBootstrapPresentationDeps = {
  readonly loadingScreen: LoadingScreenService
  readonly deathScreen: DeathScreenService
}
