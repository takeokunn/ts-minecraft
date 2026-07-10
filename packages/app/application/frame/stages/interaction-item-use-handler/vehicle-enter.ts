import { Effect, Option } from 'effect'
import { DEFAULT_PLAYER_ID } from '@ts-minecraft/core'
import { KeyMappings } from '@ts-minecraft/entity/domain/key-mappings'
import { VEHICLE_SURFACE_SAMPLE_OFFSET } from '@ts-minecraft/game/application/game-state-update-orchestration'
import { Option as EffectOption } from 'effect'
import { parseMirrorId, recordLocalClaim } from '@ts-minecraft/app/frame/stages/multiplayer-stage'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'

export type VehicleEnterServices = Pick<
  FrameHandlerServices,
  'gameState' | 'parkedVehicleService' | 'inventoryService' | 'blockService' | 'soundManager' | 'inputService' | 'multiplayer'
>

// Remember the claim so a server ClaimDenied (another player claimed the same
// vehicle within one round trip) can undo exactly this mount/pickup.
const trackVehicleClaim = (
  services: Pick<VehicleEnterServices, 'multiplayer'>,
  vehicleId: string,
  kind: 'boat' | 'minecart',
  mode: 'mount' | 'pickup',
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const mp = EffectOption.getOrNull(services.multiplayer)
    if (mp === null) return
    const parsed = parseMirrorId(vehicleId)
    const ownerId = parsed !== null
      ? parsed.ownerId
      : yield* mp.getLocalPlayerId().pipe(Effect.catchAll(() => Effect.succeed(null)))
    if (ownerId === null) return
    recordLocalClaim({ target: 'parkedVehicle', ownerId, itemId: parsed !== null ? parsed.itemId : vehicleId, kind, mode })
  })

// How close the player must stand to a parked vehicle to interact with it.
export const VEHICLE_INTERACT_DISTANCE = 2.5

// Right-click near a parked vehicle: mount it (re-entering the matching
// movement modality) — or, while sneaking, pick it up back into the inventory.
// Runs in the right-click chain before block placement so a boat bobbing in
// front of a beach can't be "built through".
export const handleParkedVehicleEnter = (
  services: VehicleEnterServices,
): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    // Cheap pre-check: no parked vehicles → no work on the common path.
    const parked = yield* services.parkedVehicleService.getAll()
    if (parked.length === 0) return false

    const alreadyRiding = (yield* services.gameState.isBoating()) || (yield* services.gameState.isMinecarting())
    if (alreadyRiding) return false

    const playerPos = yield* services.gameState.getPlayerPosition(DEFAULT_PLAYER_ID).pipe(
      Effect.catchAll(() => Effect.succeed(null)),
    )
    if (playerPos === null) return false

    const sneaking = yield* services.inputService.isKeyPressed(KeyMappings.SNEAK)

    if (sneaking) {
      // Pickup: claim first, then insert — a full inventory re-parks in place
      // so the vehicle is never destroyed.
      const claimed = Option.getOrNull(yield* services.parkedVehicleService.claimNearest(playerPos, VEHICLE_INTERACT_DISTANCE))
      if (claimed === null) return false
      const item = claimed.kind === 'boat' ? 'BOAT' as const : 'MINECART' as const
      yield* trackVehicleClaim(services, claimed.id, claimed.kind, 'pickup')
      const added = yield* services.inventoryService.addBlock(item, 1).pipe(
        Effect.as(true),
        Effect.catchAll(() => Effect.succeed(false)),
      )
      if (!added) {
        yield* services.parkedVehicleService.park(claimed.kind, claimed.position, claimed.yaw)
        return false
      }
      yield* services.soundManager.playEffect('blockBreak', { position: claimed.position }).pipe(Effect.catchAll(() => Effect.void))
      return true
    }

    // Mount: the player must satisfy the modality's environment (in water for
    // a boat, on a rail for a minecart) or the update loop would immediately
    // dismount and re-park on the next frame.
    const claimed = Option.getOrNull(yield* services.parkedVehicleService.claimNearest(playerPos, VEHICLE_INTERACT_DISTANCE))
    if (claimed === null) return false

    const sampleY = claimed.kind === 'boat'
      ? Math.floor(playerPos.y)
      : Math.floor(playerPos.y - VEHICLE_SURFACE_SAMPLE_OFFSET)
    const standingBlock = yield* services.blockService.getBlock({
      x: Math.floor(playerPos.x),
      y: sampleY,
      z: Math.floor(playerPos.z),
    }).pipe(Effect.catchAll(() => Effect.succeed(null)))
    const environmentOk = claimed.kind === 'boat'
      ? standingBlock === 'WATER'
      : standingBlock === 'RAIL' || standingBlock === 'POWERED_RAIL'

    if (!environmentOk) {
      // Not mountable from here: put the vehicle back untouched.
      yield* services.parkedVehicleService.park(claimed.kind, claimed.position, claimed.yaw)
      return false
    }

    yield* trackVehicleClaim(services, claimed.id, claimed.kind, 'mount')
    if (claimed.kind === 'boat') yield* services.gameState.enterBoat()
    else yield* services.gameState.enterMinecart()
    yield* services.soundManager.playEffect('blockPlace', { position: claimed.position }).pipe(Effect.catchAll(() => Effect.void))
    return true
  })
