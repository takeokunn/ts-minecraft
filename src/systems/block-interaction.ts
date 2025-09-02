import { Effect } from 'effect'
import { playerTargetQuery } from '@/domain/queries'
import * as W from '@/domain/world'
import { createTargetNone, setInputState, Target, InputState, ComponentName } from '@/domain/components'

export const blockInteractionSystem = Effect.gen(function* ($) {
  const players = yield* $(W.query(playerTargetQuery))

  yield* $(
    Effect.forEach(
      players,
      (player) => {
        const { entityId, inputState, target, hotbar } = player

        if (target._tag !== 'block') {
          return Effect.void
        }

        const handleDestroy = () =>
          Effect.all(
            [
              W.removeEntity(target.entityId),
              W.updateComponent(entityId, Target.name as ComponentName, createTargetNone()),
              W.recordBlockDestruction(target.position),
            ],
            { discard: true },
          )

        const handlePlace = () => {
          const blockType = hotbar.slots[hotbar.selectedIndex]
          if (!blockType) {
            return Effect.void
          }

          const newPosition = {
            x: target.position.x + target.face.x,
            y: target.position.y + target.face.y,
            z: target.position.z + target.face.z,
          }

          return Effect.all(
            [
              W.updateComponent(entityId, InputState.name as ComponentName, setInputState(inputState, { place: false })),
              W.recordBlockPlacement({
                position: newPosition,
                blockType,
              }),
            ],
            { discard: true },
          )
        }

        if (inputState.destroy) {
          return handleDestroy()
        }

        if (inputState.place) {
          return handlePlace()
        }

        return Effect.void
      },
      { concurrency: 'inherit' },
    ),
  )
})
