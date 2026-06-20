import { Effect, MutableRef, Option } from 'effect'
import { runMobMaintenance } from '@ts-minecraft/entity/application/mob/mob-maintenance'
import { runVillageMaintenance } from '@ts-minecraft/entity/application/village/village-maintenance'
import type { EntityId } from '@ts-minecraft/entity/domain/mob/entity'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'
import type { DeltaTimeSecs, Position } from '@ts-minecraft/core'
import { runCropGrowthMaintenance, runFallingBlockMaintenance } from '@ts-minecraft/world'
import { runFurnaceMaintenance } from './frame-maintenance-furnace'
import { resolveMaintenanceTimeOfDay } from './frame-maintenance-time-of-day'
import {
  resolveMaintenanceSimulationPlan,
  type MaintenanceSimulationPlanInput,
} from './frame-maintenance-simulation.plan'

type MaintenanceSimulationState = {
  readonly cropTickAccumulatorRef: MutableRef.MutableRef<number>
}

type MaintenanceSimulationServices = Pick<
  FrameHandlerServices,
  'entityManager' | 'chunkManagerService' | 'furnaceService' | 'mobSpawner' | 'villageService' | 'timeService' | 'blockService' | 'cropGrowthService' | 'weatherService' | 'biomeService'
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
    } = services
    const { playerPos, maintenanceDeltaTime, mobsEnabled, mobsSpawnEnabled } = input
    const plan = resolveMaintenanceSimulationPlan(input)
    const timeOfDay = yield* resolveMaintenanceTimeOfDay(timeService, plan.shouldResolveTimeOfDay)

    const { despawnedCount, spawnResult } = yield* runMobMaintenance(
      { entityManager, chunkManagerService, mobSpawner },
      {
        playerPos,
        maintenanceDeltaTime,
        mobsEnabled,
        mobsSpawnEnabled,
        timeOfDay,
      },
    )

    if (plan.shouldRunFurnace) {
      yield* runFurnaceMaintenance({ furnaceService }, maintenanceDeltaTime)
    }

    yield* runFallingBlockMaintenance({ blockService, chunkManagerService })

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
    // call TimeService twice in the same maintenance pass.
    if (plan.shouldRunVillage) {
      yield* runVillageMaintenance(
        { chunkManagerService, blockService, villageService },
        playerPos,
        timeOfDay,
        maintenanceDeltaTime,
      )
    }

    return { despawnedCount, spawnResult }
  })
