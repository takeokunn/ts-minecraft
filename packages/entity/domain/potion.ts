import { Option } from 'effect'
import type { StatusEffectType } from './status-effect'

// Drinkable potion definitions (v1 — recipe-book brewed until the brewing
// stand ships). Drinking consumes the potion, applies its payload, and
// returns an empty GLASS_BOTTLE to the inventory.
export type PotionUse = {
  // Periodic/timed status effect granted on drink (Swiftness etc.).
  readonly effect: Option.Option<{
    readonly type: StatusEffectType
    readonly amplifier: number
    readonly durationSecs: number
  }>
  // Instant health restored on drink (Healing).
  readonly instantHeal: number
}

const POTION_TABLE: Readonly<Record<string, PotionUse>> = {
  // Vanilla Potion of Swiftness: Speed I for 3:00.
  POTION_SWIFTNESS: {
    effect: Option.some({ type: 'SPEED', amplifier: 0, durationSecs: 180 }),
    instantHeal: 0,
  },
  // Vanilla Potion of Healing: instant 4 HP (2 hearts).
  POTION_HEALING: {
    effect: Option.none(),
    instantHeal: 4,
  },
  // Awkward potion: the nether-wart base brew — drinkable but does nothing,
  // exactly like vanilla. Real potions are brewed FROM it.
  POTION_AWKWARD: {
    effect: Option.none(),
    instantHeal: 0,
  },
}

export const getPotionUse = (item: string): Option.Option<PotionUse> =>
  Option.fromNullable(POTION_TABLE[item])
