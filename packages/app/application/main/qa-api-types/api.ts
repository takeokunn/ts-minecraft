import type { InventoryItem, Position } from '@ts-minecraft/core'
import type { DebugFeatureFlagGroup, DebugFeatureFlagId, DebugFeatureSnapshot } from '@ts-minecraft/app/debug-feature-flags'
import type { QaRenderingSnapshot } from './rendering'

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
  readonly dispatchMouseClick: (button: 0 | 1 | 2) => Promise<void>
  readonly consumeMouseClickForQA: (button: 0 | 1 | 2) => Promise<boolean>
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
  readonly movePlayerForQA: (offset: { readonly x?: number; readonly y?: number; readonly z?: number }) => Promise<Position>
  readonly getRenderingSnapshot: () => QaRenderingSnapshot
  readonly getDebugFeatureSnapshot: () => Promise<DebugFeatureSnapshot>
  readonly setDebugFeatureEnabled: (id: DebugFeatureFlagId, enabled: boolean) => Promise<boolean>
  readonly resetDebugFeatures: (group?: DebugFeatureFlagGroup) => Promise<void>
}
