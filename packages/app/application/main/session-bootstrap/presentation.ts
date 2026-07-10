import { Effect } from 'effect'
import { CrosshairService } from '@ts-minecraft/presentation'
import { ControlsHintService } from '@ts-minecraft/presentation'
import { DebugFeatureFlagsService } from '@ts-minecraft/app/application/debug-feature-flags'
import { DebugOverlayService } from '@ts-minecraft/presentation'
import { LoadingScreenService } from '@ts-minecraft/presentation'
import { BlockHighlightService } from '@ts-minecraft/presentation'
import { DamageOverlayService } from '@ts-minecraft/presentation'
import { AchievementToastService } from '@ts-minecraft/presentation'
import { DimensionFadeService } from '@ts-minecraft/presentation'
import { SleepOverlayService } from '@ts-minecraft/presentation'
import { InputService } from '@ts-minecraft/presentation'
import { HotbarRendererService } from '@ts-minecraft/presentation'
import { FPSCounterService } from '@ts-minecraft/presentation'
import { SettingsOverlayService } from '@ts-minecraft/presentation'
import { PauseMenuService } from '@ts-minecraft/presentation'
import { DeathScreenService } from '@ts-minecraft/presentation'
import { TradingPresentationService } from '@ts-minecraft/presentation'
import { ChatPanelService } from '@ts-minecraft/presentation'
import { ConnectionPanelService } from '@ts-minecraft/presentation'
import { PlayerListPanelService } from '@ts-minecraft/presentation'

export const buildPresentationBootstrapServices = Effect.gen(function* () {
  const [
    crosshair,
    damageOverlay,
    achievementToast,
    dimensionFade,
    sleepOverlay,
    controlsHint,
    blockHighlight,
    inputService,
    hotbarRenderer,
    fpsCounter,
    settingsOverlay,
    pauseMenu,
    debugFeatureFlags,
    debugOverlay,
    tradingPresentation,
    chatPanel,
    connectionPanel,
    playerListPanel,
  ] = yield* Effect.all([
    CrosshairService,
    DamageOverlayService,
    AchievementToastService,
    DimensionFadeService,
    SleepOverlayService,
    ControlsHintService,
    BlockHighlightService,
    InputService,
    HotbarRendererService,
    FPSCounterService,
    SettingsOverlayService,
    PauseMenuService,
    DebugFeatureFlagsService,
    DebugOverlayService,
    TradingPresentationService,
    ChatPanelService,
    ConnectionPanelService,
    PlayerListPanelService,
  ], { concurrency: 'unbounded' })

  return {
    crosshair,
    damageOverlay,
    achievementToast,
    dimensionFade,
    sleepOverlay,
    controlsHint,
    blockHighlight,
    inputService,
    hotbarRenderer,
    fpsCounter,
    settingsOverlay,
    pauseMenu,
    debugFeatureFlags,
    debugOverlay,
    tradingPresentation,
    chatPanel,
    connectionPanel,
    playerListPanel,
  }
})

export const buildSessionLoadingServices = Effect.gen(function* () {
  const [loadingScreen, deathScreen] = yield* Effect.all([
    LoadingScreenService,
    DeathScreenService,
  ], { concurrency: 'unbounded' })

  return {
    loadingScreen,
    deathScreen,
  }
})
