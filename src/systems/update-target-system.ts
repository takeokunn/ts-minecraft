import { Effect, Option, pipe } from 'effect'
import { TargetBlock, TargetNone, Target } from '@/domain/components'
import { playerTargetQuery } from '@/domain/queries'
import { RaycastResultService } from '@/runtime/services'
import { World } from '@/runtime/world'

export const updateTargetSystem = Effect.gen(function* (_) {
  const world = yield* _(World)
  const raycastResultRef = yield* _(RaycastResultService)
  const raycastResult = yield* _(raycastResultRef.get)
  const players = yield* _(world.query(playerTargetQuery))

  if (players.length === 0) {
    return
  }

  const newTarget: Target = pipe(
    raycastResult,
    Option.match({
      onNone: () => new TargetNone({ _tag: 'none' }),
      onSome: (result) => new TargetBlock({ _tag: 'block', entityId: result.entityId, face: result.face }),
    }),
  )

  for (const player of players) {
    if (JSON.stringify(player.target) !== JSON.stringify(newTarget)) {
      yield* _(world.updateComponent(player.entityId, 'target', newTarget))
    }
  }
})
