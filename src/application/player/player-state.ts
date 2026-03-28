// Stateful application service (PlayerService + PlayerState schema) — not a pure domain model.
// Moved from src/domain/ because it contains Ref.make<HashMap<...>>() state.
import { Effect, Ref, Schema, HashMap, Option } from 'effect'
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
      const playersRef = yield* Ref.make(HashMap.empty<PlayerId, PlayerState>())

      return {
        create: (id: PlayerId, position: Position): Effect.Effect<void, PlayerError> =>
          Effect.gen(function* () {
            const alreadyExists = yield* Ref.modify(playersRef, (players): [boolean, HashMap.HashMap<PlayerId, PlayerState>] => {
              if (HashMap.has(players, id)) return [true, players]
              return [false, HashMap.set(players, id, { id, position, velocity: zero, rotation: identity })]
            })
            if (alreadyExists) {
              return yield* Effect.fail(new PlayerError({ playerId: id, reason: 'Player already exists' }))
            }
          }),

        updatePosition: (id: PlayerId, position: Position): Effect.Effect<void, PlayerError> =>
          Effect.gen(function* () {
            const notFound = yield* Ref.modify(playersRef, (players): [boolean, HashMap.HashMap<PlayerId, PlayerState>] =>
              Option.match(HashMap.get(players, id), {
                onNone: () => [true, players],
                onSome: (player) => [false, HashMap.set(players, id, { ...player, position })],
              })
            )
            if (notFound) {
              return yield* Effect.fail(new PlayerError({ playerId: id, reason: 'Player not found' }))
            }
          }),

        updateVelocity: (id: PlayerId, velocity: Vector3): Effect.Effect<void, PlayerError> =>
          Effect.gen(function* () {
            const notFound = yield* Ref.modify(playersRef, (players): [boolean, HashMap.HashMap<PlayerId, PlayerState>] =>
              Option.match(HashMap.get(players, id), {
                onNone: () => [true, players],
                onSome: (player) => [false, HashMap.set(players, id, { ...player, velocity })],
              })
            )
            if (notFound) {
              return yield* Effect.fail(new PlayerError({ playerId: id, reason: 'Player not found' }))
            }
          }),

        getPosition: (id: PlayerId): Effect.Effect<Position, PlayerError> =>
          Effect.gen(function* () {
            const players = yield* Ref.get(playersRef)
            return yield* Option.match(HashMap.get(players, id), {
              onNone: () => Effect.fail(new PlayerError({ playerId: id, reason: 'Player not found' })),
              onSome: (player) => Effect.succeed(player.position),
            })
          }),

        getVelocity: (id: PlayerId): Effect.Effect<Vector3, PlayerError> =>
          Effect.gen(function* () {
            const players = yield* Ref.get(playersRef)
            return yield* Option.match(HashMap.get(players, id), {
              onNone: () => Effect.fail(new PlayerError({ playerId: id, reason: 'Player not found' })),
              onSome: (player) => Effect.succeed(player.velocity),
            })
          }),

        getState: (id: PlayerId): Effect.Effect<PlayerState, PlayerError> =>
          Effect.gen(function* () {
            const players = yield* Ref.get(playersRef)
            return yield* Option.match(HashMap.get(players, id), {
              onNone: () => Effect.fail(new PlayerError({ playerId: id, reason: 'Player not found' })),
              onSome: Effect.succeed,
            })
          }),
      }
    }),
  }
) {}
export const PlayerServiceLive = PlayerService.Default
