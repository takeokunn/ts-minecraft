import type * as THREE from 'three'
import type { BlockService, ChunkManagerService } from '@ts-minecraft/world'
import type { PlayerCameraStateService } from '@ts-minecraft/entity'
import type { GameStateService, TimeService } from '@ts-minecraft/game'
import type { FurnaceService, HotbarService, InventoryService, RecipeService } from '@ts-minecraft/inventory'
import type { EntityManager } from '@ts-minecraft/entity'
import type { WorldRendererService } from '@ts-minecraft/rendering'
import type { DebugFeatureFlagsService } from '@ts-minecraft/app/debug-feature-flags'
import type { BlockHighlightService, InputService, InventoryRendererService } from '@ts-minecraft/presentation'

export type QaApiDeps = {
  readonly camera: THREE.PerspectiveCamera
  readonly scene: THREE.Scene
  readonly playerCameraState: PlayerCameraStateService
  readonly blockHighlight: BlockHighlightService
  readonly inputService: InputService
  readonly inventoryService: InventoryService
  readonly inventoryRenderer: InventoryRendererService
  readonly gameState: GameStateService
  readonly timeService: TimeService
  readonly chunkManagerService: ChunkManagerService
  readonly blockService: BlockService
  readonly hotbarService: HotbarService
  readonly recipeService: RecipeService
  readonly furnaceService: FurnaceService
  readonly worldRendererService: WorldRendererService
  readonly entityManager: EntityManager
  readonly debugFeatureFlags: DebugFeatureFlagsService
}
