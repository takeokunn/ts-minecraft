/**
 * Presentation-tier Layers — overlays, menus, HUDs, settings UI, and the
 * presentation-level camera/highlight services that depend on application
 * state but are consumed exclusively by UI code.
 *
 * Depends on infrastructure-tier and game-logic-tier layers.
 */
import { Layer } from 'effect'

import { FPSCounterLive } from '@ts-minecraft/app/presentation/fps-counter'
import { CrosshairLive, DomOperationsLive } from '@ts-minecraft/app/presentation/hud/crosshair'
import { DebugOverlayLive } from '@ts-minecraft/app/presentation/hud/debug-overlay'
import { LoadingScreenLive } from '@ts-minecraft/app/presentation/loading/loading-screen'
import { BlockHighlightLive } from '@ts-minecraft/app/presentation/highlight/block-highlight'
import { SettingsServiceLive } from '@ts-minecraft/settings-manager'
import { SettingsOverlayLive } from '@ts-minecraft/app/presentation/settings/settings-overlay'
import { ConfirmDialogLive } from '@ts-minecraft/app/presentation/menu/confirm-dialog'
import { MainMenuLive } from '@ts-minecraft/app/presentation/menu/main-menu'
import { PauseMenuLive } from '@ts-minecraft/app/presentation/menu/pause-menu'
import { DeathScreenLive } from '@ts-minecraft/app/presentation/menu/death-screen'
import { InventoryRendererLive } from '@ts-minecraft/app/presentation/inventory/inventory-renderer'
import { TradingPresentationLive } from '@ts-minecraft/app/presentation/trading'

// Camera services — application-layer implementations, presentation-tier wiring
import { FirstPersonCameraServiceLive } from '@ts-minecraft/camera-controller'
import { ThirdPersonCameraServiceLive } from '@ts-minecraft/camera-controller'

// Cross-tier deps
import { StorageServiceLive } from '@ts-minecraft/block-storage'
import { HealthServiceLive } from '@ts-minecraft/player-controller'
import { RecipeServiceLive } from '@ts-minecraft/crafting-system'
import { GameModeServiceLive } from '@ts-minecraft/game-mode'

import { EnvironmentLayer } from './infrastructure'
import {
  ChunkManagerLayer,
  CameraStateLayer,
  FurnaceLayer,
  GameLayer,
  HotbarLayer,
  HotbarRendererLayer,
  InventoryLayer,
  PlayerInputLayer,
  RaycastingLayer,
  TradingLayer,
  VillageLayer,
} from './game-logic'

// Level 3: Crosshair depends on DomOperations
export const CrosshairLayer = CrosshairLive.pipe(
  Layer.provide(DomOperationsLive),
)

// BlockHighlight depends on RaycastingService
export const BlockHighlightLayer = BlockHighlightLive.pipe(
  Layer.provide(RaycastingLayer),
)

// FirstPersonCameraService depends on PlayerInputService and PlayerCameraState
export const FirstPersonCameraLayer = FirstPersonCameraServiceLive.pipe(
  Layer.provide(PlayerInputLayer),
  Layer.provide(CameraStateLayer),
)

// ThirdPersonCameraService depends on PlayerCameraState
export const ThirdPersonCameraLayer = ThirdPersonCameraServiceLive.pipe(
  Layer.provide(CameraStateLayer),
)

// SettingsService: reads/writes localStorage and queries EnvironmentPort for localhost detection
export const SettingsLayer = SettingsServiceLive.pipe(
  Layer.provide(EnvironmentLayer),
)

// SettingsOverlay depends on SettingsService and DomOperations
export const SettingsOverlayLayer = SettingsOverlayLive.pipe(
  Layer.provide(SettingsLayer),
  Layer.provide(DomOperationsLive),
)

// ConfirmDialog depends only on DomOperations — generic modal reusable by
// PauseMenu (Save & Quit) and W2a MainMenu (world delete).
export const ConfirmDialogLayer = ConfirmDialogLive.pipe(
  Layer.provide(DomOperationsLive),
)

// PauseMenu depends on DomOperations, SettingsOverlay, ChunkManager, ConfirmDialog.
export const PauseMenuLayer = PauseMenuLive.pipe(
  Layer.provide(DomOperationsLive),
  Layer.provide(SettingsOverlayLayer),
  Layer.provide(ChunkManagerLayer),
  Layer.provide(ConfirmDialogLayer),
)

// MainMenu (Phase 1, FR-1.1/1.9/1.11/1.12) — boot-scope world selection menu.
// Depends on StorageService, DomOperations, and ConfirmDialog (for delete
// confirmation). Lives ABOVE session scope so it persists across worlds.
export const MainMenuLayer = MainMenuLive.pipe(
  Layer.provide(StorageServiceLive),
  Layer.provide(DomOperationsLive),
  Layer.provide(ConfirmDialogLayer),
)

// DeathScreen (Phase 1, FR-1.3) — survival-mode death overlay. Depends on
// DOM, GameState (for respawn), GameMode (creative skips overlay),
// HealthService (awaitDeath signal), and InventoryService (Phase-3 drop hook).
export const DeathScreenLayer = DeathScreenLive.pipe(
  Layer.provide(DomOperationsLive),
  Layer.provide(GameLayer),
  Layer.provide(GameModeServiceLive),
  Layer.provide(HealthServiceLive),
  Layer.provide(InventoryLayer),
)

// LoadingScreen (Phase 1, FR-1.7) — depends on DomOperations only. The overlay
// is created when the service is acquired and torn down via the scope finalizer.
export const LoadingScreenLayer = LoadingScreenLive.pipe(
  Layer.provide(DomOperationsLive),
)

// DebugOverlay (Phase 1, FR-1.5) — F3-toggled debug HUD. Service has no
// Effect dependencies (deps are passed at attach() time).
export const DebugOverlayLayer = DebugOverlayLive

// InventoryRenderer depends on InventoryService, HotbarService, RecipeService, and DomOperations
export const InventoryRendererLayer = InventoryRendererLive.pipe(
  Layer.provide(InventoryLayer),
  Layer.provide(HotbarLayer),
  Layer.provide(RecipeServiceLive),
  Layer.provide(FurnaceLayer),
  Layer.provide(GameLayer),
  Layer.provide(ChunkManagerLayer),
  Layer.provide(DomOperationsLive),
)

// Trading overlay depends on trading + village services and DOM operations
export const TradingPresentationLayer = TradingPresentationLive.pipe(
  Layer.provide(TradingLayer),
  Layer.provide(VillageLayer),
  Layer.provide(DomOperationsLive),
)

// Top-level bundle re-exported by index.ts
export const PresentationLayers = Layer.mergeAll(
  CrosshairLayer,
  BlockHighlightLayer,
  FirstPersonCameraLayer,
  ThirdPersonCameraLayer,
  HotbarRendererLayer,
  SettingsLayer,
  SettingsOverlayLayer,
  ConfirmDialogLayer,
  PauseMenuLayer,
  MainMenuLayer,
  DeathScreenLayer,
  LoadingScreenLayer,
  DebugOverlayLayer,
  InventoryRendererLayer,
  TradingPresentationLayer,
  FPSCounterLive,  // presentation service: reads FPS counter state for HUD display
)
