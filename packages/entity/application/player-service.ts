import { Effect, Ref, HashMap, Option } from 'effect'
import type { PlayerId, Position } from '@ts-minecraft/core'
import { zero, identity } from '@ts-minecraft/core'
import type { Vector3 } from '@ts-minecraft/core'
import { PlayerError } from '../domain/errors'
import type { PlayerState } from '../domain/player-state'

export class PlayerService extends Effect.Service<PlayerService>()(
  '@minecraft/application/PlayerService',
  {
    effect: Effect.gen(function* () {
      const playersRef = yield* Ref.make(HashMap.empty<PlayerId, PlayerState>())
      const notFound = (id: PlayerId) => new PlayerError({ playerId: id, reason: 'Player not found' })
      return {
        create: (id: PlayerId, position: Position): Effect.Effect<void, PlayerError> =>
          Effect.gen(function* () {
            const alreadyExists = yield* Ref.modify(playersRef, (players): [boolean, HashMap.HashMap<PlayerId, PlayerState>] => {
              const exists = Option.isSome(HashMap.get(players, id))
              return exists
                ? [true, players]
                : [false, HashMap.set(players, id, { id, position, velocity: zero, rotation: identity })]
            })
            if (alreadyExists) yield* Effect.fail(new PlayerError({ playerId: id, reason: 'Player already exists' }))
          }),

        updatePosition: (id: PlayerId, position: Position): Effect.Effect<void, PlayerError> =>
          Effect.gen(function* () {
            const playerNotFound = yield* Ref.modify(playersRef, (players): [boolean, HashMap.HashMap<PlayerId, PlayerState>] => {
              const player = Option.getOrNull(HashMap.get(players, id))
              if (!player) return [true, players]
              return [false, HashMap.set(players, id, { ...player, position })]
            })
            if (playerNotFound) yield* Effect.fail(notFound(id))
          }),

        updateVelocity: (id: PlayerId, velocity: Vector3): Effect.Effect<void, PlayerError> =>
          Effect.gen(function* () {
            const playerNotFound = yield* Ref.modify(playersRef, (players): [boolean, HashMap.HashMap<PlayerId, PlayerState>] => {
              const player = Option.getOrNull(HashMap.get(players, id))
              if (!player) return [true, players]
              return [false, HashMap.set(players, id, { ...player, velocity })]
            })
            if (playerNotFound) yield* Effect.fail(notFound(id))
          }),

        getPosition: (id: PlayerId): Effect.Effect<Position, PlayerError> =>
          Effect.gen(function* () {
            const players = yield* Ref.get(playersRef)
            const player = Option.getOrNull(HashMap.get(players, id))
            if (player === null) return yield* Effect.fail(notFound(id))
            return player.position
          }),

        getVelocity: (id: PlayerId): Effect.Effect<Vector3, PlayerError> =>
          Effect.gen(function* () {
            const players = yield* Ref.get(playersRef)
            const player = Option.getOrNull(HashMap.get(players, id))
            if (player === null) return yield* Effect.fail(notFound(id))
            return player.velocity
          }),

        getState: (id: PlayerId): Effect.Effect<PlayerState, PlayerError> =>
          Effect.gen(function* () {
            const players = yield* Ref.get(playersRef)
            const player = Option.getOrNull(HashMap.get(players, id))
            if (player === null) return yield* Effect.fail(notFound(id))
            return player
          }),
      }
    }),
  }
) {}
