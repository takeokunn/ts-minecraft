import { Effect, HashMap, MutableRef, Option } from 'effect'
import { runMobMaintenance } from '@ts-minecraft/entity/application/mob/mob-maintenance'
import { runVillageMaintenance } from '@ts-minecraft/entity/application/village/village-maintenance'
import type { EntityId } from '@ts-minecraft/entity/domain/mob/entity'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'
import type { DeltaTimeSecs, Position } from '@ts-minecraft/core'
import { runCropGrowthMaintenance, runFallingBlockMaintenance, runFireMaintenance, type FallingBlockMaintenanceState } from '@ts-minecraft/world'
import type { DirtyChunkEntry } from './frame-maintenance-dirty'
import { runFurnaceMaintenance } from './frame-maintenance-furnace'
import { resolveMaintenanceTimeOfDay } from './frame-maintenance-time-of-day'
import {
  resolveMaintenanceSimulationPlan,
  type MaintenanceSimulationPlanInput,
} from './frame-maintenance-simulation.plan'

type MaintenanceSimulationState = {
  readonly cropTickAccumulatorRef: MutableRef.MutableRef<number>
  readonly fireTickAccumulatorRef: MutableRef.MutableRef<number>
  readonly fallingBlockState: FallingBlockMaintenanceState
  // Read (not drained) to gate the falling-block scan to chunks whose blocks
  // changed this cycle; runMaintenanceSync drains it AFTER simulation runs.
  readonly dirtyChunksRef: MutableRef.MutableRef<HashMap.HashMap<string, DirtyChunkEntry>>
}

type MaintenanceSimulationServices = Pick<
  FrameHandlerServices,
  'entityManager' | 'chunkManagerService' | 'furnaceService' | 'mobSpawner' | 'villageService' | 'timeService' | 'blockService' | 'cropGrowthService' | 'weatherService' | 'biomeService' | 'netherService'
>

type MaintenanceSimulationInput = MaintenanceSimulationPlanInput & {
  readonly playerPos: Position
  readonly maintenanceDeltaTime: DeltaTimeSecs
  readonly mobsEnabled: boolean
}

export type MaintenanceSimulationResult = {
  readonly despawnedCount: number
  readonly spawnResult: Option.Option<EntityId>
}

export const runMaintenanceSimulation = (
  services: MaintenanceSimulationServices,
  state: MaintenanceSimulationState,
  input: MaintenanceSimulationInput,
): Effect.Effect<MaintenanceSimulationResult, never> =>
  Effect.gen(function* () {
    const {
      entityManager,
      chunkManagerService,
      furnaceService,
      mobSpawner,
      villageService,
      timeService,
      blockService,
      cropGrowthService,
      weatherService,
      biomeService,
      netherService,
    } = services
    const { playerPos, maintenanceDeltaTime, mobsEnabled, mobsSpawnEnabled } = input
    const plan = resolveMaintenanceSimulationPlan(input)
    const timeOfDay = yield* resolveMaintenanceTimeOfDay(timeService, plan.shouldResolveTimeOfDay)
    // Dimension-aware spawning: the nether spawns Blazes near fortresses (and
    // hostiles at any hour), the end spawns endermen.
    const dimension = yield* netherService.getDimension()

    const { despawnedCount, spawnResult } = yield* runMobMaintenance(
      { entityManager, chunkManagerService, mobSpawner },
      {
        playerPos,
        maintenanceDeltaTime,
        mobsEnabled,
        mobsSpawnEnabled,
        timeOfDay,
        dimension,
      },
    )

    if (plan.shouldRunFurnace) {
      yield* runFurnaceMaintenance({ furnaceService }, maintenanceDeltaTime)
    }

    const dirtyCoordKeys = new Set(HashMap.keys(MutableRef.get(state.dirtyChunksRef)))
    yield* runFallingBlockMaintenance({ blockService, chunkManagerService }, state.fallingBlockState, dirtyCoordKeys)
    yield* runFireMaintenance({ blockService, chunkManagerService }, state, maintenanceDeltaTime)

    // Crop growth tick — advance all player-planted crops every CROP_GROWTH_INTERVAL_SECS.
    // Village / world-generated crops are not tracked and default to ripe on break.
    yield* runCropGrowthMaintenance(
      {
        blockService,
        chunkManagerService,
        cropGrowthService,
        biomeService,
        getWeather: () => weatherService.getWeather(),
      },
      state,
      maintenanceDeltaTime,
    )

    // Village maintenance reuses the already-fetched timeOfDay so we do not
    // call TimeService twice in the same maintenance pass. Villages are an
    // overworld feature: running this in the nether/end would spawn villagers
    // next to the player in the wrong dimension.
    if (plan.shouldRunVillage && dimension === 'overworld') {
      yield* runVillageMaintenance(
        { chunkManagerService, blockService, villageService, entityManager },
        playerPos,
        timeOfDay,
        maintenanceDeltaTime,
      )
    }

    return { despawnedCount, spawnResult }
  })
