import type { InventoryItem, Position } from '@ts-minecraft/core'
import type { DebugFeatureFlagGroup, DebugFeatureFlagId, DebugFeatureSnapshot } from '@ts-minecraft/app/application/debug-feature-flags.config'
import type { RemotePlayerSnapshot } from '@ts-minecraft/app/application/multiplayer/multiplayer-service'
import type { QaRenderingSnapshot } from './rendering'
import type { QaDebugState } from '@ts-minecraft/app/main/qa-api-debug-state'
import type { QaFrameStats } from '@ts-minecraft/app/main/qa-api-perf'
import type { QaVillageState } from '@ts-minecraft/app/main/qa-api-village'
import type { QaMobAi } from '@ts-minecraft/app/main/qa-api-mob-ai'
import type { CapturedLogEntry } from '@ts-minecraft/app/main/debug-log-capture'
import type { FrameSpikeEntry } from '@ts-minecraft/app/main/debug-frame-spikes'

export type QaApi = {
  readonly getInventorySnapshot: () => Promise<ReadonlyArray<null | {
    readonly slot: number
    readonly itemType: InventoryItem
    readonly count: number
    readonly durability: number | null
    readonly customName?: string
    readonly enchantments?: ReadonlyArray<{ readonly type: string; readonly level: number }>
  }>>
  readonly openInventoryForQA: () => Promise<boolean>
  readonly openSettingsForQA: () => Promise<boolean>
  readonly craftRecipeForQA: (recipeId: string) => Promise<void>
  readonly stageProgressionScenario: () => Promise<void>
  readonly collectStagedResources: () => Promise<void>
  readonly spawnLowHealthZombieInFront: () => Promise<void>
  readonly aimAtStagedResource: (resourceIndex: number) => Promise<void>
  readonly aimAtBuildSpot: () => Promise<void>
  readonly aimAtBlockForQA: (x: number, y: number, z: number) => Promise<void>
  readonly aimNaturalForQA: (target: { x: number; y: number; z: number }) => Promise<void>
  readonly aimAtStagedZombie: () => Promise<void>
  readonly clearBlocksInFront: () => Promise<void>
  readonly stageBuildSupportBlock: () => Promise<void>
  readonly dispatchMouseClick: (button: 0 | 1 | 2) => Promise<void>
  readonly consumeMouseClickForQA: (button: 0 | 1 | 2) => Promise<boolean>
  readonly getCurrentTargetForQA: () => Promise<unknown>
  readonly attackFirstZombie: () => Promise<boolean>
  readonly placeSelectedItemInFront: () => Promise<{ readonly placed: boolean; readonly position: { readonly x: number; readonly y: number; readonly z: number } | null; readonly reason: string | null }>
  readonly moveItemToHotbar: (itemType: InventoryItem, hotbarIndex: number) => Promise<boolean>
  readonly giveItemForQA: (itemType: InventoryItem, count: number) => Promise<boolean>
  readonly grantXpForQA: (amount: number) => Promise<{ readonly level: number; readonly totalXP: number }>
  readonly damageSlotForQA: (slotIndex: number, amount: number) => Promise<void>
  readonly setMouseHeldForQA: (button: 0 | 1 | 2, held: boolean) => Promise<void>
  readonly setWeatherForQA: (weather: 'clear' | 'rain' | 'thunder') => Promise<void>
  readonly setDimensionForQA: (dimension: 'overworld' | 'nether' | 'end') => Promise<void>
  readonly selectHotbarSlot: (hotbarIndex: number) => Promise<void>
  readonly getRecipeButtons: () => ReadonlyArray<string>
  readonly getEntitySnapshot: () => Promise<ReadonlyArray<{ entityId: string; type: string }>>
  readonly getDroppedItemsForQA: () => Promise<ReadonlyArray<{
    readonly id: string
    readonly itemType: string
    readonly count: number
    readonly position: { readonly x: number; readonly y: number; readonly z: number }
  }>>
  readonly getRemotePlayersForQA: () => Promise<ReadonlyArray<RemotePlayerSnapshot>>
  readonly getLoadedWaterBlockCount: () => Promise<number>
  readonly getBlockTypeAtForQA: (x: number, y: number, z: number) => Promise<string | null>
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
  readonly getDebugStateForQA: () => Promise<QaDebugState>
  readonly getFrameStatsForQA: (durationMs?: number) => Promise<QaFrameStats>
  readonly getVillagesForQA: () => Promise<QaVillageState>
  readonly setRedstoneComponentForQA: (x: number, y: number, z: number, type: string) => Promise<boolean>
  readonly toggleLeverForQA: (x: number, y: number, z: number) => Promise<boolean>
  readonly tickRedstoneForQA: (ticks: number) => Promise<void>
  readonly getRedstonePowerAtForQA: (x: number, y: number, z: number) => Promise<number>
  readonly getMobAiForQA: () => Promise<QaMobAi>
  readonly killPlayerForQA: () => Promise<void>
  // Sync readers over boot-installed ring buffers (debug-log-capture /
  // debug-frame-spikes) — empty arrays when the installer never ran (SSR/tests).
  readonly getCapturedLogsForQA: () => ReadonlyArray<CapturedLogEntry>
  readonly clearCapturedLogsForQA: () => void
  readonly getFrameSpikesForQA: () => ReadonlyArray<FrameSpikeEntry>
  readonly clearFrameSpikesForQA: () => void
  readonly getDebugFeatureSnapshot: () => Promise<DebugFeatureSnapshot>
  readonly setDebugFeatureEnabled: (id: DebugFeatureFlagId, enabled: boolean) => Promise<boolean>
  readonly resetDebugFeatures: (group?: DebugFeatureFlagGroup) => Promise<void>
}
