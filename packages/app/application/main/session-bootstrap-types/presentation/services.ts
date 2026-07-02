import type { BlockHighlightService } from '@ts-minecraft/presentation'
import type { CrosshairService } from '@ts-minecraft/presentation'
import type { DamageOverlayService, SleepOverlayService } from '@ts-minecraft/presentation'
import type { ControlsHintService } from '@ts-minecraft/presentation'
import type { DebugFeatureFlagsService } from '@ts-minecraft/app/application/debug-feature-flags'
import type { DebugOverlayService } from '@ts-minecraft/presentation'
import type { FPSCounterService } from '@ts-minecraft/presentation'
import type { HotbarRendererService } from '@ts-minecraft/presentation'
import type { InputService } from '@ts-minecraft/presentation'
import type { PauseMenuService } from '@ts-minecraft/presentation'
import type { SettingsOverlayService } from '@ts-minecraft/presentation'
import type { TradingPresentationService } from '@ts-minecraft/presentation'
import type { ChatPanelService } from '@ts-minecraft/presentation'
import type { ConnectionPanelService } from '@ts-minecraft/presentation'
import type { PlayerListPanelService } from '@ts-minecraft/presentation'

export type SessionPresentationBootstrapServices = {
  readonly crosshair: CrosshairService
  readonly damageOverlay: DamageOverlayService
  readonly sleepOverlay: SleepOverlayService
  readonly controlsHint: ControlsHintService
  readonly blockHighlight: BlockHighlightService
  readonly inputService: InputService
  readonly hotbarRenderer: HotbarRendererService
  readonly fpsCounter: FPSCounterService
  readonly settingsOverlay: SettingsOverlayService
  readonly pauseMenu: PauseMenuService
  readonly debugFeatureFlags: DebugFeatureFlagsService
  readonly debugOverlay: DebugOverlayService
  readonly tradingPresentation: TradingPresentationService
  readonly chatPanel: ChatPanelService
  readonly connectionPanel: ConnectionPanelService
  readonly playerListPanel: PlayerListPanelService
}
