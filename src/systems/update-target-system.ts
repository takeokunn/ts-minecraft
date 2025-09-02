import { Data, Effect, Option, Array as A } from 'effect'
import { createTargetBlock, createTargetNone } from '@/domain/components'
import { playerTargetQuery } from '@/domain/queries'
import { RaycastResultService } from '@/runtime/services'
import * as World from '@/runtime/world-pure'

export const updateTargetSystem = Effect.gen(function* ($) {
  const raycastResult = yield* $(Effect.flatMap(RaycastResultService, (ref) => ref.get))
  const players = yield* $(World.query(playerTargetQuery))

  const playerOption = A.get(players, 0)
  if (Option.isNone(playerOption)) {
    return
  }
  const player = playerOption.value

  const newTarget = Option.match(raycastResult, {
    onNone: () => createTargetNone(),
    onSome: (hit) => createTargetBlock(hit.entityId, hit.face),
  })

  // Only update if the target has changed
  if (!Data.equals(player.target, newTarget)) {
    yield* $(World.updateComponent(player.entityId, 'target', newTarget))
  }
}).pipe(Effect.catchAllCause((cause) => Effect.logError('An error occurred in updateTargetSystem', cause)))