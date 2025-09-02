import { Effect, Equal, Option, Array as A, pipe } from 'effect'
import { createTargetBlock, createTargetNone, Position, Target, ComponentName } from '@/domain/components'
import { playerQuery, terrainBlockQuery } from '@/domain/queries'
import { RaycastService } from '@/infrastructure/raycast-three'
import * as World from '@/domain/world'
import { ThreeContextService } from '@/infrastructure/types'
import { EntityId } from '@/domain/entity'

export const updateTargetSystem = Effect.gen(function* ($) {
  const threeContext = yield* $(ThreeContextService)
  const raycastService = yield* $(RaycastService)

  // TODO: This is a performance bottleneck. The terrainBlockMap should not be created every frame.
  // This requires refactoring RaycastService to not depend on this map.
  const terrainBlocks = yield* $(World.query(terrainBlockQuery))
  const terrainBlockMap = terrainBlocks.reduce(
    (map, { entityId, position }) => {
      const key = `${position.x},${position.y},${position.z}`
      map.set(key, entityId)
      return map
    },
    new Map<string, EntityId>(),
  )

  const raycastResult = yield* $(raycastService.cast(threeContext.scene, terrainBlockMap))

  const players = yield* $(World.query(playerQuery))
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
          World.getComponent(hit.entityId, Position.name as ComponentName),
          Effect.map((position) => createTargetBlock(hit.entityId, hit.face, position)),
          Effect.catchAll(() => Effect.succeed(createTargetNone())), // If component is gone, no target
        ),
    }),
  )

  // Only update if the target has changed
  if (!Equal.equals(player.target, newTarget)) {
    yield* $(World.updateComponent(player.entityId, Target.name as ComponentName, newTarget))
  }
})
