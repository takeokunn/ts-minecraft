import { Effect, Ref, HashMap, Option } from 'effect';
import { zero, identity } from '@ts-minecraft/kernel';
import { PlayerError } from '../domain/errors';
export class PlayerService extends Effect.Service()('@minecraft/application/PlayerService', {
    effect: Ref.make(HashMap.empty()).pipe(Effect.map((playersRef) => ({
        create: (id, position) => Ref.modify(playersRef, (players) => Option.match(HashMap.get(players, id), {
            onSome: () => [true, players],
            onNone: () => [false, HashMap.set(players, id, { id, position, velocity: zero, rotation: identity })],
        })).pipe(Effect.flatMap((alreadyExists) => alreadyExists
            ? Effect.fail(new PlayerError({ playerId: id, reason: 'Player already exists' }))
            : Effect.void)),
        updatePosition: (id, position) => Ref.modify(playersRef, (players) => Option.match(HashMap.get(players, id), {
            onNone: () => [true, players],
            onSome: (player) => [false, HashMap.set(players, id, { ...player, position })],
        })).pipe(Effect.flatMap((notFound) => notFound
            ? Effect.fail(new PlayerError({ playerId: id, reason: 'Player not found' }))
            : Effect.void)),
        updateVelocity: (id, velocity) => Ref.modify(playersRef, (players) => Option.match(HashMap.get(players, id), {
            onNone: () => [true, players],
            onSome: (player) => [false, HashMap.set(players, id, { ...player, velocity })],
        })).pipe(Effect.flatMap((notFound) => notFound
            ? Effect.fail(new PlayerError({ playerId: id, reason: 'Player not found' }))
            : Effect.void)),
        getPosition: (id) => Ref.get(playersRef).pipe(Effect.flatMap((players) => Option.match(HashMap.get(players, id), {
            onNone: () => Effect.fail(new PlayerError({ playerId: id, reason: 'Player not found' })),
            onSome: (player) => Effect.succeed(player.position),
        }))),
        getVelocity: (id) => Ref.get(playersRef).pipe(Effect.flatMap((players) => Option.match(HashMap.get(players, id), {
            onNone: () => Effect.fail(new PlayerError({ playerId: id, reason: 'Player not found' })),
            onSome: (player) => Effect.succeed(player.velocity),
        }))),
        getState: (id) => Ref.get(playersRef).pipe(Effect.flatMap((players) => Option.match(HashMap.get(players, id), {
            onNone: () => Effect.fail(new PlayerError({ playerId: id, reason: 'Player not found' })),
            onSome: Effect.succeed,
        }))),
    })))
}) {
}
export const PlayerServiceLive = PlayerService.Default;
//# sourceMappingURL=../../../dist/packages/player/application/player-service.js.map