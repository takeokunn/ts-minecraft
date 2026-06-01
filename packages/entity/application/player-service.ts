import { Effect, Ref, HashMap, Option } from 'effect'
import type { PlayerId, Position } from '@ts-minecraft/core'
import { zero, identity } from '@ts-minecraft/core'
import type { Vector3 } from '@ts-minecraft/core'
import { PlayerError } from '../domain/errors'
import type { PlayerState } from '../domain/player-state'

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
