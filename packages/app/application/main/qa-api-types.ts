import type * as THREE from 'three'
import type { BlockService, ChunkManagerService } from '@ts-minecraft/world'
import type { PlayerCameraStateService } from '@ts-minecraft/entity'
import type { GameStateService, TimeService } from '@ts-minecraft/game'
import type { FurnaceService, HotbarService, InventoryService, RecipeService } from '@ts-minecraft/inventory'
import type { BlockType, InventoryItem, Position } from '@ts-minecraft/core'
import type { WorldRendererService } from '@ts-minecraft/rendering'
import type { EntityManager } from '@ts-minecraft/entity'
import type {
  DebugFeatureFlagGroup,
  DebugFeatureFlagId,
  DebugFeatureSnapshot,
  DebugFeatureFlagsService,
} from '@ts-minecraft/app/debug-feature-flags'
import type { BlockHighlightService } from '@ts-minecraft/presentation/highlight/block-highlight'
import type { InputService } from '@ts-minecraft/presentation/input/input-service'
import type { InventoryRendererService } from '@ts-minecraft/presentation/inventory/inventory-renderer'

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

export type QaApi = {
  readonly getInventorySnapshot: () => Promise<ReadonlyArray<null | { readonly slot: number; readonly itemType: InventoryItem; readonly count: number }>>
  readonly openInventoryForQA: () => Promise<boolean>
  readonly craftRecipeForQA: (recipeId: string) => Promise<void>
  readonly stageProgressionScenario: () => Promise<void>
  readonly collectStagedResources: () => Promise<void>
  readonly spawnLowHealthZombieInFront: () => Promise<void>
  readonly aimAtStagedResource: (resourceIndex: number) => Promise<void>
  readonly aimAtBuildSpot: () => Promise<void>
  readonly aimAtStagedZombie: () => Promise<void>
  readonly clearBlocksInFront: () => Promise<void>
  readonly stageBuildSupportBlock: () => Promise<void>
  readonly dispatchMouseClick: (button: 0 | 2) => Promise<void>
  readonly consumeMouseClickForQA: (button: 0 | 2) => Promise<boolean>
  readonly getCurrentTargetForQA: () => Promise<unknown>
  readonly attackFirstZombie: () => Promise<boolean>
  readonly placeSelectedItemInFront: () => Promise<void>
  readonly moveItemToHotbar: (itemType: InventoryItem, hotbarIndex: number) => Promise<boolean>
  readonly selectHotbarSlot: (hotbarIndex: number) => Promise<void>
  readonly getRecipeButtons: () => ReadonlyArray<string>
  readonly getEntitySnapshot: () => Promise<ReadonlyArray<{ entityId: string; type: string }>>
  readonly getLoadedWaterBlockCount: () => Promise<number>
  readonly getMobMovementSnapshot: (durationMs: number) => Promise<{
    tracked: number
    moved: number
    maxDistance: number
    maxHorizontalDistance: number
    maxVerticalDistance: number
  }>
  readonly setTimeOfDayForQA: (timeOfDay: number) => Promise<void>
  readonly getRenderingSnapshot: () => QaRenderingSnapshot
  readonly getDebugFeatureSnapshot: () => Promise<DebugFeatureSnapshot>
  readonly setDebugFeatureEnabled: (id: DebugFeatureFlagId, enabled: boolean) => Promise<boolean>
  readonly resetDebugFeatures: (group?: DebugFeatureFlagGroup) => Promise<void>
}

export type QaChunkCoord = {
  readonly x: number
  readonly z: number
}

export type QaChunkMeshSnapshot = {
  readonly chunkCoord: QaChunkCoord
  readonly type: string
  readonly visible: boolean
  readonly vertexCount: number
  readonly indexCount: number
  readonly hasUv: boolean
  readonly hasTileIndex: boolean
  readonly tileIndexCount: number
  readonly materialType: string
  readonly textureLoaded: boolean
}

export type QaRenderingSnapshot = {
  readonly sceneChildren: number
  readonly chunkMeshCount: number
  readonly visibleChunkMeshCount: number
  readonly camera: { readonly x: number; readonly y: number; readonly z: number; readonly near: number; readonly far: number }
  readonly chunks: ReadonlyArray<QaChunkMeshSnapshot>
}

export type StagedResourceBlock = {
  readonly pos: { readonly x: number; readonly y: number; readonly z: number }
  readonly blockType: BlockType
}

export type StagedZombiePosition = Position | null
