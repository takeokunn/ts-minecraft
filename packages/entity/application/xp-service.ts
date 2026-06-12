import { Effect, Ref } from 'effect'
import { buildPlayerXP, addXPToPlayer, xpAtLevelStart, INITIAL_PLAYER_XP, type PlayerXP } from '../domain/player-xp'

export class XPService extends Effect.Service<XPService>()(
  '@minecraft/application/XPService',
  {
    effect: Effect.gen(function* () {
      const xpRef = yield* Ref.make(INITIAL_PLAYER_XP)
      return {
      getXP: (): Effect.Effect<PlayerXP, never> =>
        Ref.get(xpRef),

      addXP: (amount: number): Effect.Effect<PlayerXP, never> =>
        Ref.modify(xpRef, (current): [PlayerXP, PlayerXP] => {
          const next = addXPToPlayer(current, amount)
          return [next, next]
        }),

      setTotalXP: (totalXP: number): Effect.Effect<void, never> =>
        Ref.set(xpRef, buildPlayerXP(Math.max(0, totalXP))),

      // Reduce the player's XP by `levels` full levels. Sets totalXP to the
      // start of the resulting level so partial XP within a level is forfeit
      // (matches vanilla enchanting behaviour).
      spendLevels: (levels: number): Effect.Effect<PlayerXP, never> =>
        Ref.modify(xpRef, (current): [PlayerXP, PlayerXP] => {
          const newLevel = Math.max(0, current.level - levels)
          const next = buildPlayerXP(xpAtLevelStart(newLevel))
          return [next, next]
        }),

      reset: (): Effect.Effect<void, never> =>
        Ref.set(xpRef, INITIAL_PLAYER_XP),
      }
    }),
  },
) {}

export const XPServiceLive = XPService.Default
