import { Match } from 'effect'
import type { TradeResult } from '@ts-minecraft/entity'

export const normalizeSelection = (length: number, index: number): number => {
  if (length <= 0) {
    return 0
  }

  const wrapped = index % length
  return wrapped < 0 ? wrapped + length : wrapped
}

export const tradeResultText = (result: TradeResult): string =>
  Match.value(result).pipe(
    Match.tag('TradeSuccess', (r) =>
      r.levelUp
        ? `Trade complete. ${r.villager.profession} reached level ${r.villager.level}.`
        : 'Trade complete.',
    ),
    Match.tag('TradeFailure', (r) => `Trade failed: ${r.reason.replaceAll('_', ' ')}`),
    Match.exhaustive,
  )
