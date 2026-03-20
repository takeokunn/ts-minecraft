// Stateful application service (PlayerService + PlayerState schema) — not a pure domain model.
// Moved from src/domain/ because it contains Ref.make<Map<...>>() state.
import { Effect, Ref, Schema } from 'effect'
import { PlayerIdSchema, PositionSchema, PlayerId, Position } from '@/shared/kernel'
import { PlayerError } from '@/domain/errors'
import { Vector3Schema, QuaternionSchema, zero, identity, type Vector3 } from '@/shared/math/three'

// PlayerState Schema
export const PlayerStateSchema = Schema.Struct({
  id: PlayerIdSchema,
  position: PositionSchema,
  velocity: Vector3Schema,
  rotation: QuaternionSchema,
})
export type PlayerState = Schema.Schema.Type<typeof PlayerStateSchema>

export class PlayerService extends Effect.Service<PlayerService>()(
  '@minecraft/application/PlayerService',
  {
    effect: Effect.gen(function* () {
      const playersRef = yield* Ref.make<Map<PlayerId, PlayerState>>(new Map())

      return {
        create: (id: PlayerId, position: Position): Effect.Effect<void, PlayerError> =>
          Effect.gen(function* () {
            const players = yield* Ref.get(playersRef)
            if (players.has(id)) {
              return yield* Effect.fail(new PlayerError({ playerId: id, reason: 'Player already exists' }))
            }

            const playerState: PlayerState = {
              id,
              position,
              velocity: zero,
              rotation: identity,
            }

            yield* Ref.update(playersRef, (players) => {
              const newMap = new Map(players)
              newMap.set(id, playerState)
              return newMap
            })
          }),

        updatePosition: (id: PlayerId, position: Position): Effect.Effect<void, PlayerError> =>
          Effect.gen(function* () {
            const players = yield* Ref.get(playersRef)
            const player = players.get(id)

            if (!player) {
              return yield* Effect.fail(new PlayerError({ playerId: id, reason: 'Player not found' }))
            }

            const updatedPlayer: PlayerState = {
              ...player,
              position,
            }

            yield* Ref.update(playersRef, (players) => {
              const newMap = new Map(players)
              newMap.set(id, updatedPlayer)
              return newMap
            })
          }),

        updateVelocity: (id: PlayerId, velocity: Vector3): Effect.Effect<void, PlayerError> =>
          Effect.gen(function* () {
            const players = yield* Ref.get(playersRef)
            const player = players.get(id)

            if (!player) {
              return yield* Effect.fail(new PlayerError({ playerId: id, reason: 'Player not found' }))
            }

            yield* Ref.update(playersRef, (players) => {
              const newMap = new Map(players)
              newMap.set(id, { ...player, velocity })
              return newMap
            })
          }),

        getPosition: (id: PlayerId): Effect.Effect<Position, PlayerError> =>
          Effect.gen(function* () {
            const players = yield* Ref.get(playersRef)
            const player = players.get(id)

            if (!player) {
              return yield* Effect.fail(new PlayerError({ playerId: id, reason: 'Player not found' }))
            }

            return player.position
          }),

        getVelocity: (id: PlayerId): Effect.Effect<Vector3, PlayerError> =>
          Effect.gen(function* () {
            const players = yield* Ref.get(playersRef)
            const player = players.get(id)

            if (!player) {
              return yield* Effect.fail(new PlayerError({ playerId: id, reason: 'Player not found' }))
            }

            return player.velocity
          }),

        getState: (id: PlayerId): Effect.Effect<PlayerState, PlayerError> =>
          Effect.gen(function* () {
            const players = yield* Ref.get(playersRef)
            const player = players.get(id)

            if (!player) {
              return yield* Effect.fail(new PlayerError({ playerId: id, reason: 'Player not found' }))
            }

            return player
          }),
      }
    }),
  }
) {}
export const PlayerServiceLive = PlayerService.Default
