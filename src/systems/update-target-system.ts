import { Effect, Option, pipe } from 'effect'
import { createTargetBlock, createTargetNone } from '@/domain/components'
import { playerTargetQuery } from '@/domain/queries'
import { RaycastResultService, System } from '@/runtime/loop'
import { World } from '@/runtime/world'

export const updateTargetSystem: System = Effect.gen(function* () {
  const world = yield* World
  const raycastResultRef = yield* RaycastResultService
  const raycastResult = yield* raycastResultRef.get
  const players = yield* world.query(playerTargetQuery)

  if (players.length === 0) {
    return
  }

  const newTarget = pipe(
    raycastResult,
    Option.match({
      onNone: () => createTargetNone(),
      onSome: (result) => createTargetBlock(result.entityId, result.face),
    }),
  )

  yield* Effect.forEach(
    players,
    (player) => {
      // Avoid unnecessary updates
      if (JSON.stringify(player.target) !== JSON.stringify(newTarget)) {
        return world.updateComponent(player.entityId, 'target', newTarget)
      }
      return Effect.void
    },
    { discard: true },
  )
})