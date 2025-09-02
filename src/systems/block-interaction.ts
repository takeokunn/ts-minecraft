import { Effect, Match } from 'effect'
import { createArchetype } from '@/domain/archetypes'
import { createTargetNone, InputState, Target } from '@/domain/components'
import { playerTargetQuery } from '@/domain/queries'
import * as W from '@/domain/world'

const handleDestroyBlock = (entityId: W.EntityId, target: Extract<Target, { _tag: 'block' }>) =>
  Effect.all(
    [
      W.removeEntity(target.entityId),
      W.updateComponent(entityId, 'target', createTargetNone()),
      W.recordBlockDestruction(target.position),
    ],
    { discard: true },
  )

const handlePlaceBlock = (
  entityId: W.EntityId,
  inputState: InputState,
  target: Extract<Target, { _tag: 'block' }>,
  hotbar: { slots: ReadonlyArray<string>; selectedIndex: number },
) => {
  const blockType = hotbar.slots[hotbar.selectedIndex]
  if (!blockType || blockType === 'air') {
    return Effect.void
  }

  const newPosition = {
    x: target.position.x + target.face[0],
    y: target.position.y + target.face[1],
    z: target.position.z + target.face[2],
  }

  const newBlockArchetype = createArchetype({
    type: 'block',
    pos: newPosition,
    blockType,
  })

  return Effect.all(
    [
      W.addArchetype(newBlockArchetype),
      W.updateComponent(entityId, 'inputState', { ...inputState, place: false }),
      W.recordBlockPlacement({
        position: newPosition,
        blockType,
      }),
    ],
    { discard: true },
  )
}

export const blockInteractionSystem = Effect.gen(function* ($) {
  const players = yield* $(W.query(playerTargetQuery))

  yield* $(
    Effect.forEach(
      players,
      ({ entityId, inputState, target, hotbar }) =>
        Match.value(target).pipe(
          Match.when({ _tag: 'block' }, (blockTarget) =>
            Match.value(inputState).pipe(
              Match.when({ destroy: true }, () => handleDestroyBlock(entityId, blockTarget)),
              Match.when({ place: true }, () => handlePlaceBlock(entityId, inputState, blockTarget, hotbar)),
              Match.orElse(() => Effect.void),
            ),
          ),
          Match.orElse(() => Effect.void),
        ),
      { concurrency: 'inherit' },
    ),
  )
})
