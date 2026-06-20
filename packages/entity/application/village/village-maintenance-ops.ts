import { Cause, Effect } from 'effect'
import { type DeltaTimeSecs, type Position } from '@ts-minecraft/core'
import { type Village } from '../../domain/village/village-model'
import { placeVillageStructures } from './village-placement'
import { type VillageMaintenanceServices } from './village-maintenance-services'

const logMaintenanceCause = (prefix: string) => (cause: Cause.Cause<unknown>) =>
  Effect.logError(`${prefix}: ${Cause.pretty(cause)}`)

export const updateVillageState = (
  services: VillageMaintenanceServices,
  playerPos: Position,
  timeOfDay: number,
  maintenanceDeltaTime: DeltaTimeSecs,
) =>
  services.villageService.update(playerPos, timeOfDay, maintenanceDeltaTime).pipe(
    Effect.catchAllCause(logMaintenanceCause('Village system error')),
  )

export const placeVillagePlan = (services: VillageMaintenanceServices, villages: ReadonlyArray<Village>) =>
  Effect.forEach(
    villages,
    (village) =>
      placeVillageStructures(village, {
        chunkManagerService: services.chunkManagerService,
        blockService: services.blockService,
      }).pipe(Effect.catchAllCause(logMaintenanceCause('Village placement error'))),
    { discard: true },
  )
