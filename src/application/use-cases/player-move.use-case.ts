import { Effect, Layer, Context, pipe } from 'effect'
import { CHUNK_SIZE } from '@shared/constants/world'
import { PlayerMovementCommand } from '@application/commands/player-movement'
import { PhysicsDomainService } from '@domain/services/physics-domain.service'
import { WorldDomainService } from '@domain/services/world-domain.service'
import { EntityDomainService } from '@domain/services/entity-domain.service'

/**
 * Player Move Use Case Service interface
 */
export interface PlayerMoveUseCaseService {
  readonly execute: (command: PlayerMovementCommand) => Effect.Effect<void, Error>
}

/**
 * Player Move Use Case Service
 */
export const PlayerMoveUseCase = Context.GenericTag<PlayerMoveUseCaseService>('PlayerMoveUseCase')

export const PlayerMoveUseCaseLive = Layer.succeed(PlayerMoveUseCase, {
  execute: (command) =>
    pipe(
      Effect.all({
        physicsService: PhysicsDomainService,
        worldService: WorldDomainService,
        entityService: EntityDomainService,
      }),
      Effect.flatMap(({ physicsService, worldService, entityService }) =>
        pipe(
          physicsService.validateMovement(command.entityId, command.position, command.velocity),
          Effect.flatMap((isValidMove) =>
            isValidMove
              ? pipe(
                  Effect.all([entityService.updatePosition(command.entityId, command.position), physicsService.updateEntityVelocity(command.entityId, command.velocity)]),
                  Effect.flatMap(() => {
                    const chunkCoord = {
                      x: Math.floor(command.position.x / CHUNK_SIZE),
                      z: Math.floor(command.position.z / CHUNK_SIZE),
                    }
                    return pipe(
                      worldService.ensureChunkLoaded(chunkCoord),
                      Effect.flatMap(() => applyMovementEffects(command)),
                    )
                  }),
                )
              : Effect.fail(new Error('Invalid movement')),
          ),
        ),
      ),
    ),
} satisfies PlayerMoveUseCaseService)

const applyMovementEffects = (command: PlayerMovementCommand) =>
  pipe(
    Effect.log(`Movement effects applied for entity ${command.entityId}`),
    Effect.asVoid
  )

// Layer dependencies will be provided by the main Application layer
