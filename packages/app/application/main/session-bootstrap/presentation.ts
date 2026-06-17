import { Effect } from 'effect'
import { CrosshairService } from '@ts-minecraft/presentation'
import { DebugFeatureFlagsService } from '@ts-minecraft/app/debug-feature-flags'
import { DebugOverlayService } from '@ts-minecraft/presentation'
import { LoadingScreenService } from '@ts-minecraft/presentation'
import { BlockHighlightService } from '@ts-minecraft/presentation'
import { InputService } from '@ts-minecraft/presentation'
import { HotbarRendererService } from '@ts-minecraft/presentation'
import { FPSCounterService } from '@ts-minecraft/presentation'
import { SettingsOverlayService } from '@ts-minecraft/presentation'
import { PauseMenuService } from '@ts-minecraft/presentation'
import { DeathScreenService } from '@ts-minecraft/presentation'
import { TradingPresentationService } from '@ts-minecraft/presentation'

export const buildPresentationBootstrapServices = Effect.gen(function* () {
  const crosshair = yield* CrosshairService
  const blockHighlight = yield* BlockHighlightService
  const inputService = yield* InputService
  const hotbarRenderer = yield* HotbarRendererService
  const fpsCounter = yield* FPSCounterService
  const settingsOverlay = yield* SettingsOverlayService
  const pauseMenu = yield* PauseMenuService
  const debugFeatureFlags = yield* DebugFeatureFlagsService
  const debugOverlay = yield* DebugOverlayService
  const tradingPresentation = yield* TradingPresentationService

  return {
    crosshair,
    blockHighlight,
    inputService,
    hotbarRenderer,
    fpsCounter,
    settingsOverlay,
    pauseMenu,
    debugFeatureFlags,
    debugOverlay,
    tradingPresentation,
  }
})

export const buildSessionLoadingServices = Effect.gen(function* () {
  const loadingScreen = yield* LoadingScreenService
  const deathScreen = yield* DeathScreenService

  return {
    loadingScreen,
    deathScreen,
  }
})
