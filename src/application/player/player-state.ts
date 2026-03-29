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
    effect: Ref.make(HashMap.empty<PlayerId, PlayerState>()).pipe(Effect.map((playersRef) => ({
        create: (id: PlayerId, position: Position): Effect.Effect<void, PlayerError> =>
          Ref.modify(playersRef, (players): [boolean, HashMap.HashMap<PlayerId, PlayerState>] =>
            Option.match(HashMap.get(players, id), {
              onSome: () => [true, players],
              onNone: () => [false, HashMap.set(players, id, { id, position, velocity: zero, rotation: identity })],
            })
          ).pipe(
            Effect.flatMap((alreadyExists) =>
              alreadyExists
                ? Effect.fail(new PlayerError({ playerId: id, reason: 'Player already exists' }))
                : Effect.void
            )
          ),

        updatePosition: (id: PlayerId, position: Position): Effect.Effect<void, PlayerError> =>
          Ref.modify(playersRef, (players): [boolean, HashMap.HashMap<PlayerId, PlayerState>] =>
            Option.match(HashMap.get(players, id), {
              onNone: () => [true, players],
              onSome: (player) => [false, HashMap.set(players, id, { ...player, position })],
            })
          ).pipe(
            Effect.flatMap((notFound) =>
              notFound
                ? Effect.fail(new PlayerError({ playerId: id, reason: 'Player not found' }))
                : Effect.void
            )
          ),

        updateVelocity: (id: PlayerId, velocity: Vector3): Effect.Effect<void, PlayerError> =>
          Ref.modify(playersRef, (players): [boolean, HashMap.HashMap<PlayerId, PlayerState>] =>
            Option.match(HashMap.get(players, id), {
              onNone: () => [true, players],
              onSome: (player) => [false, HashMap.set(players, id, { ...player, velocity })],
            })
          ).pipe(
            Effect.flatMap((notFound) =>
              notFound
                ? Effect.fail(new PlayerError({ playerId: id, reason: 'Player not found' }))
                : Effect.void
            )
          ),

        getPosition: (id: PlayerId): Effect.Effect<Position, PlayerError> =>
          Ref.get(playersRef).pipe(
            Effect.flatMap((players) =>
              Option.match(HashMap.get(players, id), {
                onNone: () => Effect.fail(new PlayerError({ playerId: id, reason: 'Player not found' })),
                onSome: (player) => Effect.succeed(player.position),
              })
            )
          ),

        getVelocity: (id: PlayerId): Effect.Effect<Vector3, PlayerError> =>
          Ref.get(playersRef).pipe(
            Effect.flatMap((players) =>
              Option.match(HashMap.get(players, id), {
                onNone: () => Effect.fail(new PlayerError({ playerId: id, reason: 'Player not found' })),
                onSome: (player) => Effect.succeed(player.velocity),
              })
            )
          ),

        getState: (id: PlayerId): Effect.Effect<PlayerState, PlayerError> =>
          Ref.get(playersRef).pipe(
            Effect.flatMap((players) =>
              Option.match(HashMap.get(players, id), {
                onNone: () => Effect.fail(new PlayerError({ playerId: id, reason: 'Player not found' })),
                onSome: Effect.succeed,
              })
            )
          ),
    })))
  }
) {}
export const PlayerServiceLive = PlayerService.Default
