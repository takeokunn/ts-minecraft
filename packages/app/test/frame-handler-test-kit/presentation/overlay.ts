import { Effect } from 'effect'
import type { SessionControl } from '@ts-minecraft/app/main/session-control'
import { InventoryRendererService } from '@ts-minecraft/presentation/inventory'
import { PauseMenuService } from '@ts-minecraft/presentation/menu/pause-menu'
import { SettingsOverlayService } from '@ts-minecraft/presentation/settings'
import { TradingPresentationService } from '@ts-minecraft/presentation/trading'
import type { OverlayState } from '../shared'

/** Creates an inventory renderer fake backed by mutable overlay state. */
export const makeInventoryRenderer = (state: OverlayState) =>
  InventoryRendererService.of({
    _tag: '@minecraft/presentation/InventoryRenderer' as const,
    isOpen: () => Effect.sync(() => state.open),
    toggle: () =>
      Effect.sync(() => {
        state.open = !state.open
        return state.open
      }),
    update: () => Effect.void,
    cycleRecipes: (_delta: number) => Effect.void,
    craftSelectedRecipe: () => Effect.succeed(false),
  })

/** Creates a settings overlay fake backed by mutable overlay state. */
export const makeSettingsOverlay = (state: OverlayState) =>
  SettingsOverlayService.of({
    _tag: '@minecraft/presentation/SettingsOverlay' as const,
    isOpen: () => Effect.sync(() => state.open),
    toggle: () =>
      Effect.sync(() => {
        state.open = !state.open
        return state.open
      }),
    syncFromSettings: () => Effect.void,
    applyToSettings: () => Effect.void,
  })

/** Creates a pause menu fake with mutable open state. */
export const makePauseMenu = (state: OverlayState = { open: false }) =>
  PauseMenuService.of({
    _tag: '@minecraft/presentation/PauseMenu' as const,
    isOpen: () => Effect.sync(() => state.open),
    openIfClosed: () => Effect.sync(() => {
      state.open = true
    }),
    attach: (_control: SessionControl) => Effect.acquireRelease(Effect.void, () => Effect.void),
  })

/** Creates a trading presentation fake backed by mutable overlay state. */
export const makeTradingPresentation = (state: OverlayState) =>
  TradingPresentationService.of({
    _tag: '@minecraft/presentation/TradingPresentationService' as const,
    open: (_villagerId: string) =>
      Effect.sync(() => {
        state.open = true
        return true
      }),
    close: () =>
      Effect.sync(() => {
        state.open = false
      }),
    isOpen: () => Effect.sync(() => state.open),
    cycleSelection: (_delta: number) => Effect.void,
    refresh: () => Effect.void,
    executeSelectedTrade: () => Effect.succeed(false),
  })
