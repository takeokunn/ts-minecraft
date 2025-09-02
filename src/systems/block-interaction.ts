import { Effect } from 'effect'
import { playerTargetQuery } from '@/domain/queries'
import * as W from '@/domain/world'

export const blockInteractionSystem = Effect.gen(function* ($) {
  const players = yield* $(W.query(playerTargetQuery))

  yield* $(
    Effect.forEach(
      players,
      (player) => {
        const { inputState, target } = player

        return Effect.if(
          Effect.succeed(target._tag === 'block'),
          {
            onTrue: () => Effect.gen(function* ($) {
              const destroyEffect = Effect.when(
                () => inputState.destroy,
                () => W.recordBlockDestruction(target.position),
              )

              const placeEffect = Effect.when(
                () => inputState.place,
                () => Effect.sync(() => {
                  const { position, face } = target
                  return {
                    x: position.x + face.x,
                    y: position.y + face.y,
                    z: position.z + face.z,
                  }
                }).pipe(
                  Effect.flatMap((newPosition) =>
                    W.recordBlockPlacement({
                      position: newPosition,
                      blockType: 'stone', // TODO: Use hotbar selection
                    }),
                  ),
                ),
              )

              yield* $(Effect.all([destroyEffect, placeEffect], { discard: true }))
            }),
            onFalse: () => Effect.void,
          }
        )
      },
      { concurrency: 'inherit' },
    ),
  )
})
