import { Effect } from 'effect'
import { DEFAULT_PLAYER_ID, type Position } from '@ts-minecraft/core'
import { blockOverlapsPlayer } from '../domain/block-utils'
import { BlockServiceError } from './block-service-error'
import type { PlayerServiceForPlace } from './block-service-place-helpers'
import type { PlaceBlockPlan } from './block-service-place-model'

const loadPlayerPosition = (
  playerService: PlayerServiceForPlace,
  operation: string,
): Effect.Effect<Position, BlockServiceError> =>
  playerService.getPosition(DEFAULT_PLAYER_ID).pipe(
    Effect.mapError(
      (e) =>
        new BlockServiceError({
          operation,
          reason: `Player position error: ${e.message}`,
          cause: e,
        }),
    ),
  )

export const ensurePlacementDoesNotOverlapPlayer = (
  playerService: PlayerServiceForPlace,
  plan: PlaceBlockPlan,
): Effect.Effect<void, BlockServiceError> =>
  loadPlayerPosition(playerService, plan.target.operation).pipe(
    Effect.flatMap((playerPosition) =>
      plan.placedBlocks.some((block) =>
        blockOverlapsPlayer(block.position, playerPosition),
      )
        ? Effect.fail(
            new BlockServiceError({
              operation: plan.target.operation,
              reason: 'Cannot place block inside player',
            }),
          )
        : Effect.void,
    ),
  )
