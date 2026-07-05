import type * as THREE from 'three'
import type { BlockService, ChunkManagerService } from '@ts-minecraft/world'
import type { PlayerCameraStateService } from '@ts-minecraft/entity/application/camera-state'
import type { GameStateService, TimeService } from '@ts-minecraft/game'
import type { FurnaceService } from '@ts-minecraft/inventory/application/furnace-service'
import type { HotbarService } from '@ts-minecraft/inventory/application/hotbar-service'
import type { InventoryService } from '@ts-minecraft/inventory/application/inventory-service'
import type { RecipeService } from '@ts-minecraft/inventory/application/recipe-service'
import type { XPService } from '@ts-minecraft/entity/application/xp-service'
import type { VillageService } from '@ts-minecraft/entity/application/village/village-service'
import type { EntityManager } from '@ts-minecraft/entity/application/mob/entity-manager'
import type { WorldRendererService } from '@ts-minecraft/rendering'
import type { DebugFeatureFlagsService } from '@ts-minecraft/app/application/debug-feature-flags'
import type { MultiplayerService } from '@ts-minecraft/app/application/multiplayer/multiplayer-service'
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
  readonly weatherService: import('@ts-minecraft/game').WeatherService
  readonly netherService: { readonly getDimension: () => import('effect').Effect.Effect<'overworld' | 'nether' | 'end', never>; readonly setDimension: (d: 'overworld' | 'nether' | 'end') => import('effect').Effect.Effect<void, never> }
  readonly chunkManagerService: ChunkManagerService
  readonly blockService: BlockService
  readonly hotbarService: HotbarService
  readonly recipeService: RecipeService
  readonly furnaceService: FurnaceService
  readonly xpService: XPService
  readonly villageService: VillageService
  readonly worldRendererService: WorldRendererService
  readonly entityManager: EntityManager
  readonly droppedItemService: import('@ts-minecraft/entity/application/dropped-item-service').DroppedItemService
  readonly debugFeatureFlags: DebugFeatureFlagsService
  readonly multiplayer?: MultiplayerService
}
