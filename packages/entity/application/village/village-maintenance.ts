import { Cause, Effect } from 'effect'
import { type DeltaTimeSecs, type Position } from '@ts-minecraft/core'
import { type Village, resolveVillageMaintenancePlan } from '../../domain/village'
import { VillageService } from './village-service'
import { placeVillageStructures, type VillagePlacementServices } from './village-placement'

type VillageMaintenanceServices = {
  readonly blockService: VillagePlacementServices['blockService']
  readonly chunkManagerService: VillagePlacementServices['chunkManagerService']
  readonly villageService: Pick<VillageService, 'getVillages' | 'update'>
}

const logMaintenanceCause = (prefix: string) => (cause: Cause.Cause<unknown>) =>
  Effect.logError(`${prefix}: ${Cause.pretty(cause)}`)

const updateVillageState = (
  services: VillageMaintenanceServices,
  playerPos: Position,
  timeOfDay: number,
  maintenanceDeltaTime: DeltaTimeSecs,
) =>
  services.villageService.update(playerPos, timeOfDay, maintenanceDeltaTime).pipe(
    Effect.catchAllCause(logMaintenanceCause('Village system error')),
  )

const placeVillagePlan = (services: VillageMaintenanceServices, villages: ReadonlyArray<Village>) =>
  Effect.forEach(
    villages,
    (village) =>
      placeVillageStructures(village, {
        chunkManagerService: services.chunkManagerService,
        blockService: services.blockService,
      }).pipe(Effect.catchAllCause(logMaintenanceCause('Village placement error'))),
    { discard: true },
  )

export const runVillageMaintenance = (
  services: VillageMaintenanceServices,
  playerPos: Position,
  timeOfDay: number,
  maintenanceDeltaTime: DeltaTimeSecs,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const villagesBefore = yield* services.villageService.getVillages()

    yield* updateVillageState(services, playerPos, timeOfDay, maintenanceDeltaTime)

    const villagesAfter = yield* services.villageService.getVillages()
    const plan = resolveVillageMaintenancePlan({
      villagesBefore,
      villagesAfter,
    })

    yield* placeVillagePlan(services, plan.newVillages)
  })
