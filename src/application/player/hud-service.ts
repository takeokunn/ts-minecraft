import { Context, Effect, Layer, Schema } from 'effect'

import type { PlayerId } from '@/domain/player'
import { PlayerDomainService } from '@/domain/player/services'
import type { PlayerVitals } from '@/domain/player/types'
import { ErrorCauseSchema, toErrorCause } from '@shared/schema/error'
import { makeErrorFactory } from '@shared/schema/tagged_error_factory'

export interface PlayerHUDViewModel {
  readonly playerId: PlayerId
  readonly health: number
  readonly maxHealth: number
  readonly hunger: number
  readonly maxHunger: number
  readonly saturation: number
  readonly experienceLevel: number
}

export const PlayerHUDServiceErrorSchema = Schema.TaggedError('PlayerHUDServiceError', {
  cause: ErrorCauseSchema,
})

export type PlayerHUDServiceError = Schema.Schema.Type<typeof PlayerHUDServiceErrorSchema>

export const PlayerHUDServiceError = makeErrorFactory(PlayerHUDServiceErrorSchema)

export interface PlayerHUDService {
  readonly getViewModel: (playerId: PlayerId) => Effect.Effect<PlayerHUDViewModel, PlayerHUDServiceError>
}

export const PlayerHUDService = Context.GenericTag<PlayerHUDService>('@minecraft/application/player/PlayerHUDService')

const toViewModel = (playerId: PlayerId, vitals: PlayerVitals): PlayerHUDViewModel => ({
  playerId,
  health: vitals.health,
  maxHealth: 20,
  hunger: vitals.hunger,
  maxHunger: 20,
  saturation: vitals.saturation,
  experienceLevel: vitals.experienceLevel,
})

const fromError = (error: unknown): PlayerHUDServiceError =>
  PlayerHUDServiceError({ cause: toErrorCause(error) ?? { message: 'Unknown player HUD error' } })

export const PlayerHUDServiceLive = Layer.effect(
  PlayerHUDService,
  Effect.gen(function* () {
    const playerDomain = yield* PlayerDomainService

    const getViewModel: PlayerHUDService['getViewModel'] = (playerId) =>
      playerDomain.snapshot(playerId).pipe(
        Effect.map((snapshot) => toViewModel(playerId, snapshot.aggregate.vitals)),
        Effect.mapError(fromError)
      )

    return PlayerHUDService.of({
      getViewModel,
    })
  })
)
