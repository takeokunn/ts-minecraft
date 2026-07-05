import { Effect, MutableRef } from 'effect'
import type { DebugFeatureFlagGroup, DebugFeatureFlagId } from '@ts-minecraft/app/application/debug-feature-flags.config'
import { DEFAULT_PLAYER_ID } from '@ts-minecraft/core'
import type { InventoryItem } from '@ts-minecraft/core'
import { isQaApiEnabled } from '@ts-minecraft/app/main/qa-api-env'
import {
  craftRecipeForQA,
  getInventorySnapshot,
  giveItemForQA,
  grantXpForQA,
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
import { aimAtBuildSpot, aimAtStagedResource, aimAtStagedZombie, aimNaturalForQA, dispatchMouseClick, setMouseHeldForQA } from '@ts-minecraft/app/main/qa-api-visual'
import { getBlockTypeAtForQA, getLoadedWaterBlockCount, getRenderingSnapshot, setTimeOfDayForQA } from '@ts-minecraft/app/main/qa-api-rendering'
import { getDebugStateForQA } from '@ts-minecraft/app/main/qa-api-debug-state'
import { getFrameStatsForQA } from '@ts-minecraft/app/main/qa-api-perf'
import type { QaApi } from '@ts-minecraft/app/main/qa-api-types/api'
import type { QaApiDeps } from '@ts-minecraft/app/main/qa-api-types/deps'
import type { StagedResourceBlock, StagedZombiePosition } from '@ts-minecraft/app/main/qa-api-types/staged'

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
  aimNaturalForQA: (target: { x: number; y: number; z: number }) =>
    aimNaturalForQA(deps.camera, deps.scene, deps.playerCameraState, deps.blockHighlight, target),
  aimAtStagedZombie: () => aimAtStagedZombie(deps.camera, deps.scene, deps.playerCameraState, deps.blockHighlight, stagedZombiePositionRef, deps.entityManager),
  clearBlocksInFront: () => clearBlocksInFront(deps.camera, deps.blockService, deps.blockHighlight),
  stageBuildSupportBlock: () =>
    stageBuildSupportBlock(deps.camera, deps.scene, deps.chunkManagerService, deps.worldRendererService, deps.blockHighlight),
  dispatchMouseClick: (button: 0 | 1 | 2) => dispatchMouseClick(button),
  setMouseHeldForQA: (button: 0 | 1 | 2, held: boolean) => setMouseHeldForQA(button, held),
  setWeatherForQA: (weather: 'clear' | 'rain' | 'thunder') => Effect.runPromise(deps.weatherService.setWeather(weather)),
  // Mirrors the portal-travel core (physics-stage-portal.ts): dimension flag,
  // chunk-cache switch, respawn. Skips portal construction — QA teleports.
  setDimensionForQA: (dimension: 'overworld' | 'nether' | 'end') =>
    Effect.runPromise(Effect.gen(function* () {
      yield* deps.netherService.setDimension(dimension)
      yield* deps.chunkManagerService.setActiveDimension(dimension)
      const spawnY = dimension === 'nether' ? 70 : 80
      yield* deps.gameState.respawn({ x: 8, y: spawnY, z: 8 })
    })),
  consumeMouseClickForQA: (button: 0 | 1 | 2) => Effect.runPromise(deps.inputService.consumeMouseClick(button)),
  getCurrentTargetForQA: () => Effect.runPromise(deps.blockHighlight.getTargetBlock()),
  attackFirstZombie: () => attackFirstZombie(deps.hotbarService, deps.entityManager),
  placeSelectedItemInFront: () => placeSelectedItemInFront(deps.camera, deps.hotbarService, deps.blockService, deps.blockHighlight),
  giveItemForQA: (itemType: InventoryItem, count: number) => giveItemForQA(deps.inventoryService, itemType, count),
  grantXpForQA: (amount: number) => grantXpForQA(deps.xpService, amount),
  moveItemToHotbar: (itemType: InventoryItem, hotbarIndex: number) =>
    moveItemToHotbar(deps.inventoryService, deps.hotbarService, itemType, hotbarIndex),
  selectHotbarSlot: (hotbarIndex: number) => selectHotbarSlot(deps.hotbarService, hotbarIndex),
  getRecipeButtons: () => getRecipeButtons(deps.recipeService),
  getEntitySnapshot: () => Effect.runPromise(deps.entityManager.getEntities()),
  getDroppedItemsForQA: () =>
    Effect.runPromise(Effect.map(deps.droppedItemService.getAll(), (items) =>
      items.map((item) => ({ id: item.id, itemType: item.itemType, count: item.count, position: item.position })),
    )),
  getRemotePlayersForQA: () =>
    Effect.runPromise(
      deps.multiplayer === undefined
        ? Effect.succeed([])
        : Effect.map(deps.multiplayer.getRemotePlayers(), (remotePlayers) => Array.from(remotePlayers.values())),
    ),
  getLoadedWaterBlockCount: () => getLoadedWaterBlockCount(deps.chunkManagerService),
  getBlockTypeAtForQA: (x: number, y: number, z: number) => getBlockTypeAtForQA(deps.chunkManagerService, x, y, z),
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
  getDebugStateForQA: () => getDebugStateForQA({
    gameState: deps.gameState,
    netherService: deps.netherService,
    timeService: deps.timeService,
    weatherService: deps.weatherService,
    chunkManagerService: deps.chunkManagerService,
    entityManager: deps.entityManager,
    inventoryService: deps.inventoryService,
    xpService: deps.xpService,
    camera: deps.camera,
    scene: deps.scene,
  }),
  getFrameStatsForQA: (durationMs?: number) => getFrameStatsForQA(durationMs),
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
