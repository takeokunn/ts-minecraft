import { Effect, MutableRef } from 'effect'
import type { DeltaTimeSecs } from '@ts-minecraft/core'

import { collectFireMaintenanceActions, FIRE_MAINTENANCE_INTERVAL_SECS } from '../domain/fire-lifecycle'
import type { BlockService } from './block-service'
import type { ChunkManagerService } from './chunk-manager-service'

type FireMaintenanceState = {
  readonly fireTickAccumulatorRef: MutableRef.MutableRef<number>
}

type FireMaintenanceServices = {
  readonly blockService: Pick<BlockService, 'forceSetBlock'>
  readonly chunkManagerService: Pick<ChunkManagerService, 'getLoadedChunks'>
}

export const runFireMaintenance = (
  services: FireMaintenanceServices,
  state: FireMaintenanceState,
  maintenanceDeltaTime: DeltaTimeSecs,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const newFireAcc = MutableRef.get(state.fireTickAccumulatorRef) + Number(maintenanceDeltaTime)
    if (newFireAcc < FIRE_MAINTENANCE_INTERVAL_SECS) {
      MutableRef.set(state.fireTickAccumulatorRef, newFireAcc)
      return
    }

    MutableRef.set(state.fireTickAccumulatorRef, newFireAcc - FIRE_MAINTENANCE_INTERVAL_SECS)

    const loadedChunks = yield* services.chunkManagerService
      .getLoadedChunks()
      .pipe(Effect.catchAllCause(() => Effect.succeed([])))
    const actions = yield* collectFireMaintenanceActions(loadedChunks).pipe(Effect.catchAllCause(() => Effect.succeed([])))

    for (const action of actions) {
      yield* services.blockService.forceSetBlock(action.position, action.blockType).pipe(Effect.catchAllCause(() => Effect.void))
    }
  })
