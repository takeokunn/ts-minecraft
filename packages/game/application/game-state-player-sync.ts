import { Effect, Ref } from 'effect'
import { PhysicsBodyId, type Position, type Vector3 } from '@ts-minecraft/core'
import { PlayerService } from '@ts-minecraft/entity/application/player-service'
import { PlayerError } from '@ts-minecraft/entity/domain/errors'
import { PlayerId } from '@ts-minecraft/core'

import { PhysicsService } from './physics-service'
import type { PhysicsServiceError } from './physics-service-error'
import { ZERO_VEC3 } from './game-state-support'

type PhysicsStatePort = Pick<PhysicsService, 'setPosition' | 'setVelocity'>
type PlayerStatePort = Pick<PlayerService, 'updatePosition' | 'updateVelocity'>

export const syncPlayerTransformAndResetState = (
  physicsService: PhysicsStatePort,
  playerService: PlayerStatePort,
  playerId: PlayerId,
  playerBodyId: PhysicsBodyId,
  position: Position,
  isGroundedRef: Ref.Ref<boolean>,
  lastChunkCoordRef: Ref.Ref<{ cx: number; cz: number }>,
): Effect.Effect<void, PhysicsServiceError | PlayerError> =>
  Effect.gen(function* () {
    yield* physicsService.setPosition(playerBodyId, position)
    yield* physicsService.setVelocity(playerBodyId, ZERO_VEC3)
    yield* playerService.updatePosition(playerId, position)
    yield* playerService.updateVelocity(playerId, ZERO_VEC3 as Vector3)
    yield* Ref.set(isGroundedRef, false)
    yield* Ref.set(lastChunkCoordRef, { cx: Number.NaN, cz: Number.NaN })
  })
