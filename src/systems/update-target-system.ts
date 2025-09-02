import { Effect, Option } from 'effect'
import { createTargetBlock, createTargetNone, Target } from '@/domain/components'
import { playerTargetQuery } from '@/domain/queries'
import { RaycastResultService } from '@/runtime/services'
import * as World from '@/runtime/world-pure'

const areTargetsEqual = (a: Target, b: Target): boolean => {
  if (a._tag !== b._tag) {
    return false
  }
  if (a._tag === 'none' && b._tag === 'none') {
    return true
  }
  if (a._tag === 'block' && b._tag === 'block') {
    return a.entityId === b.entityId && a.face.x === b.face.x && a.face.y === b.face.y && a.face.z === b.face.z
  }
  return false
}

export const updateTargetSystem = Effect.gen(function* ($) {
  const raycastResultRef = yield* $(RaycastResultService)
  const players = yield* $(World.query(playerTargetQuery))

  // Assuming a single player for now
  const player = players[0]
  if (!player) {
    return
  }

  const newTarget = Option.match(yield* $(raycastResultRef.get), {
    onNone: () => createTargetNone(),
    onSome: (hit) => createTargetBlock(hit.entityId, hit.face),
  })

  // Only update if the target has changed
  if (!areTargetsEqual(player.target, newTarget)) {
    yield* $(World.updateComponent(player.entityId, 'target', newTarget))
  }
})