import { Context, Effect, Layer, Match, Schema } from 'effect'

import { PlayerDomainService } from '@domain/player/services'
import { PlayerGameModeSchema, PlayerNameSchema, PlayerPositionSchema, type PlayerSnapshot } from '@domain/player/types'
import { PlayerIdOperations } from '@domain/shared/entities/player_id'
import { ErrorCauseSchema, toErrorCause } from '@shared/schema/error'
import { makeErrorFactory } from '@shared/schema/tagged_error_factory'

/**
 * プレイヤーセッション初期化入力
 */
export interface EnsurePlayerSessionInput {
  readonly id: string
  readonly name: string
  readonly gameMode: string
  readonly position: Schema.Schema.Input<typeof PlayerPositionSchema>
}

export const PlayerLifecycleErrorSchema = Schema.TaggedError('PlayerLifecycleApplicationError', {
  cause: ErrorCauseSchema,
})

export type PlayerLifecycleApplicationError = Schema.Schema.Type<typeof PlayerLifecycleErrorSchema>

export const PlayerLifecycleApplicationError = makeErrorFactory(PlayerLifecycleErrorSchema)

export interface PlayerLifecycleApplicationService {
  readonly ensurePlayerSession: (
    input: EnsurePlayerSessionInput
  ) => Effect.Effect<PlayerSnapshot, PlayerLifecycleApplicationError>
}

export const PlayerLifecycleApplicationService = Context.GenericTag<PlayerLifecycleApplicationService>(
  '@minecraft/application/player/PlayerLifecycleApplicationService'
)

const fromDomainError = (error: unknown): PlayerLifecycleApplicationError =>
  PlayerLifecycleApplicationError({
    cause: toErrorCause(error) ?? { message: 'Player lifecycle operation failed' },
  })

export const PlayerLifecycleApplicationServiceLive = Layer.effect(
  PlayerLifecycleApplicationService,
  Effect.gen(function* () {
    const playerDomain = yield* PlayerDomainService

    const ensurePlayerSession: PlayerLifecycleApplicationService['ensurePlayerSession'] = (input) =>
      Effect.gen(function* () {
        const playerId = PlayerIdOperations.makeUnsafe(input.id)

        const snapshotAttempt = playerDomain.snapshot(playerId)

        return yield* snapshotAttempt.pipe(
          Effect.catchAll((error) =>
            Match.value(error).pipe(
              Match.tag('MissingEntity', () =>
                Effect.gen(function* () {
                  const name = yield* Schema.decode(PlayerNameSchema)(input.name)
                  const gameMode = yield* Schema.decode(PlayerGameModeSchema)(input.gameMode)
                  const position = yield* Schema.decode(PlayerPositionSchema)(input.position)

                  yield* playerDomain.spawn({
                    id: playerId,
                    name,
                    gameMode,
                    position,
                  })

                  return yield* playerDomain.snapshot(playerId)
                })
              ),
              Match.orElse(() => Effect.fail(fromDomainError(error)))
            )
          ),
          Effect.mapError(fromDomainError)
        )
      }).pipe(Effect.mapError(fromDomainError))

    return PlayerLifecycleApplicationService.of({
      ensurePlayerSession,
    })
  })
)
