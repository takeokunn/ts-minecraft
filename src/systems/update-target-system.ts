import { Effect, Equal, Option, Array as A, pipe } from 'effect'
import { createTargetBlock, createTargetNone, Position } from '@/domain/components'
import { playerTargetQuery } from '@/domain/queries'
import { RaycastResultService } from '@/runtime/services'
import * as World from '@/domain/world'

export const updateTargetSystem = Effect.gen(function* ($) {
  const raycastResult = yield* $(Effect.flatMap(RaycastResultService, (ref) => ref.get))
  const players = yield* $(World.query(playerTargetQuery))

  const playerOption = A.get(players, 0)
  if (Option.isNone(playerOption)) {
    return
  }
  const player = playerOption.value

  const newTarget = yield* $(
    Option.match(raycastResult, {
      onNone: () => Effect.succeed(createTargetNone()),
      onSome: (hit) =>
        pipe(
          World.getComponent(hit.entityId, 'position'),
          Effect.map((position: Position) => createTargetBlock(hit.entityId, hit.face, position)),
        ),
    }),
  )

  // Only update if the target has changed
  if (!Equal.equals(player.target, newTarget)) {
    yield* $(World.updateComponent(player.entityId, 'target', newTarget))
  }
}).pipe(Effect.catchAllCause((cause) => Effect.logError('An error occurred in updateTargetSystem', cause)))