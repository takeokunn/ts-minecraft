import { Effect, Ref } from 'effect'
import { buildPlayerXP, addXPToPlayer, INITIAL_PLAYER_XP, type PlayerXP } from '../domain/player-xp'

export class XPService extends Effect.Service<XPService>()(
  '@minecraft/application/XPService',
  {
    effect: Ref.make(INITIAL_PLAYER_XP).pipe(Effect.map((xpRef) => ({
      getXP: (): Effect.Effect<PlayerXP, never> =>
        Ref.get(xpRef),

      addXP: (amount: number): Effect.Effect<PlayerXP, never> =>
        Ref.modify(xpRef, (current): [PlayerXP, PlayerXP] => {
          const next = addXPToPlayer(current, amount)
          return [next, next]
        }),

      setTotalXP: (totalXP: number): Effect.Effect<void, never> =>
        Ref.set(xpRef, buildPlayerXP(Math.max(0, totalXP))),

      reset: (): Effect.Effect<void, never> =>
        Ref.set(xpRef, INITIAL_PLAYER_XP),
    }))),
  },
) {}

export const XPServiceLive = XPService.Default
