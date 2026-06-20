import type * as Scope from 'effect/Scope'
import type { Effect } from 'effect'
import type { BiomeService, ChunkManagerService } from '@ts-minecraft/world'
import type { GameStateService, TimeService } from '@ts-minecraft/game'
import type { PlayerCameraStateService } from '@ts-minecraft/entity/application/camera-state'
import type { FPSCounterService } from '@ts-minecraft/presentation/fps-counter'
import type {
  DebugFeatureCatalogEntry,
  DebugFeatureFlagGroup,
  DebugFeatureFlagId,
  DebugFeatureFlagsService,
} from '@ts-minecraft/app/application/debug-feature-flags'

export type DebugOverlayDeps = {
  readonly biomeService: BiomeService
  readonly chunkManager: ChunkManagerService
  readonly gameState: GameStateService
  readonly timeService: TimeService
  readonly cameraState: PlayerCameraStateService
  readonly fpsCounter: FPSCounterService
  readonly debugFeatureFlags: DebugFeatureFlagsService
}

export interface DebugOverlayInterface {
  readonly attach: (deps: DebugOverlayDeps) => Effect.Effect<void, never, Scope.Scope>
  readonly toggle: () => Effect.Effect<void, never>
  readonly show: () => Effect.Effect<void, never>
  readonly hide: () => Effect.Effect<void, never>
  readonly isVisible: () => Effect.Effect<boolean, never>
}

export type ToggleRowNodes = {
  readonly id: DebugFeatureFlagId
  readonly entry: DebugFeatureCatalogEntry
  readonly row: HTMLDivElement
  readonly button: HTMLButtonElement
  readonly stateText: Text
}

export type GroupSectionNodes = {
  readonly group: DebugFeatureFlagGroup
  readonly section: HTMLDivElement
}

export type TogglePanelNodes = {
  readonly panel: HTMLDivElement
  readonly searchInput: HTMLInputElement
  readonly enabledCountText: Text
  readonly statusText: Text
  readonly resetAllButton: HTMLButtonElement
  readonly toggleRows: ReadonlyArray<ToggleRowNodes>
  readonly groupSections: ReadonlyArray<GroupSectionNodes>
}

export type DebugOverlayDomNodes = TogglePanelNodes & {
  readonly overlay: HTMLDivElement
  readonly metricsPanel: HTMLDivElement
  readonly textNodes: ReadonlyArray<Text>
}
