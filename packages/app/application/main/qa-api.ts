import { Effect, MutableRef } from 'effect'
import type { DebugFeatureFlagGroup, DebugFeatureFlagId } from '@ts-minecraft/app/debug-feature-flags'
import { DEFAULT_PLAYER_ID } from '@ts-minecraft/core'
import type { InventoryItem } from '@ts-minecraft/core'
import type { QaApi, QaApiDeps, StagedResourceBlock, StagedZombiePosition } from '@ts-minecraft/app/main/qa-api-types'
import { isQaApiEnabled } from '@ts-minecraft/app/main/qa-api-env'
import {
  craftRecipeForQA,
  getInventorySnapshot,
  getRecipeButtons,
  moveItemToHotbar,
  openInventoryForQA,
  selectHotbarSlot,
} from '@ts-minecraft/app/main/qa-api-inventory'
import {
  clearBlocksInFront,
  collectStagedResources,
  placeSelectedItemInFront,
  stageBuildSupportBlock,
  stageProgressionScenario,
} from '@ts-minecraft/app/main/qa-api-world'
import { attackFirstZombie, getMobMovementSnapshot, spawnLowHealthZombieInFront } from '@ts-minecraft/app/main/qa-api-combat'
import { aimAtBuildSpot, aimAtStagedResource, aimAtStagedZombie, dispatchMouseClick } from '@ts-minecraft/app/main/qa-api-visual'
import { getLoadedWaterBlockCount, getRenderingSnapshot, setTimeOfDayForQA } from '@ts-minecraft/app/main/qa-api-rendering'

export type { QaApi, QaApiDeps } from '@ts-minecraft/app/main/qa-api-types'

const makeQaApi = (
  deps: QaApiDeps,
  stagedResourceBlocksRef: MutableRef.MutableRef<Array<StagedResourceBlock>>,
  stagedZombiePositionRef: MutableRef.MutableRef<StagedZombiePosition>,
): QaApi => ({
  getInventorySnapshot: () => getInventorySnapshot(deps.inventoryService),
  openInventoryForQA: () => openInventoryForQA(deps.inventoryRenderer),
  craftRecipeForQA: (recipeId: string) =>
    craftRecipeForQA(
      deps.inventoryService,
      deps.inventoryRenderer,
      deps.recipeService,
      deps.furnaceService,
      deps.gameState,
      deps.chunkManagerService,
      recipeId,
    ),
  stageProgressionScenario: () =>
    stageProgressionScenario(
      deps.camera,
      deps.scene,
      deps.chunkManagerService,
      deps.worldRendererService,
      deps.blockHighlight,
      stagedResourceBlocksRef,
      stagedZombiePositionRef,
    ),
  collectStagedResources: () => collectStagedResources(deps.blockService, stagedResourceBlocksRef),
  spawnLowHealthZombieInFront: () => spawnLowHealthZombieInFront(deps.camera, deps.entityManager, stagedZombiePositionRef),
  aimAtStagedResource: (resourceIndex: number) =>
    aimAtStagedResource(deps.camera, deps.scene, deps.playerCameraState, deps.blockHighlight, stagedResourceBlocksRef, resourceIndex),
  aimAtBuildSpot: () => aimAtBuildSpot(deps.camera, deps.scene, deps.playerCameraState, deps.blockHighlight),
  aimAtStagedZombie: () => aimAtStagedZombie(deps.camera, deps.scene, deps.playerCameraState, deps.blockHighlight, stagedZombiePositionRef),
  clearBlocksInFront: () => clearBlocksInFront(deps.camera, deps.blockService, deps.blockHighlight),
  stageBuildSupportBlock: () =>
    stageBuildSupportBlock(deps.camera, deps.scene, deps.chunkManagerService, deps.worldRendererService, deps.blockHighlight),
  dispatchMouseClick: (button: 0 | 1 | 2) => dispatchMouseClick(button),
  consumeMouseClickForQA: (button: 0 | 1 | 2) => Effect.runPromise(deps.inputService.consumeMouseClick(button)),
  getCurrentTargetForQA: () => Effect.runPromise(deps.blockHighlight.getTargetBlock()),
  attackFirstZombie: () => attackFirstZombie(deps.hotbarService, deps.entityManager),
  placeSelectedItemInFront: () => placeSelectedItemInFront(deps.camera, deps.hotbarService, deps.blockService, deps.blockHighlight),
  moveItemToHotbar: (itemType: InventoryItem, hotbarIndex: number) =>
    moveItemToHotbar(deps.inventoryService, deps.hotbarService, itemType, hotbarIndex),
  selectHotbarSlot: (hotbarIndex: number) => selectHotbarSlot(deps.hotbarService, hotbarIndex),
  getRecipeButtons: () => getRecipeButtons(deps.recipeService),
  getEntitySnapshot: () => Effect.runPromise(deps.entityManager.getEntities()),
  getLoadedWaterBlockCount: () => getLoadedWaterBlockCount(deps.chunkManagerService),
  getMobMovementSnapshot: (durationMs: number) => getMobMovementSnapshot(deps.entityManager, durationMs),
  setTimeOfDayForQA: (timeOfDay: number) => setTimeOfDayForQA(deps.timeService, timeOfDay),
  movePlayerForQA: (offset) =>
    Effect.runPromise(Effect.gen(function* () {
      const current = yield* deps.gameState.getPlayerPosition(DEFAULT_PLAYER_ID)
      const next = {
        x: current.x + (offset.x ?? 0),
        y: current.y + (offset.y ?? 0),
        z: current.z + (offset.z ?? 0),
      }
      yield* deps.gameState.setPlayerPosition(next)
      return next
    })),
  getRenderingSnapshot: () => getRenderingSnapshot(deps.camera, deps.scene),
  getDebugFeatureSnapshot: () => Effect.runPromise(deps.debugFeatureFlags.getSnapshot()),
  setDebugFeatureEnabled: (id: DebugFeatureFlagId, enabled: boolean) =>
    Effect.runPromise(deps.debugFeatureFlags.setEnabled(id, enabled)),
  resetDebugFeatures: (group?: DebugFeatureFlagGroup) =>
    Effect.runPromise(group === undefined ? deps.debugFeatureFlags.resetAll() : deps.debugFeatureFlags.resetGroup(group)),
})

// installQaApi — wires everything together and sets window.__TS_MINECRAFT_QA__.
export const installQaApi = (deps: QaApiDeps): Effect.Effect<void, never> =>
  Effect.sync(() => {
    if (!isQaApiEnabled() || typeof window === 'undefined') return

    const stagedResourceBlocksRef = MutableRef.make<Array<StagedResourceBlock>>([])
    const stagedZombiePositionRef = MutableRef.make<StagedZombiePosition>(null)
    Reflect.set(window, '__TS_MINECRAFT_QA__', makeQaApi(deps, stagedResourceBlocksRef, stagedZombiePositionRef))
  })
