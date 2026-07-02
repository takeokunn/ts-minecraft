import { Schema } from 'effect'

// Status-effect substrate (potion foundation). v1 ships REGENERATION and
// POISON with vanilla periodic semantics; SPEED/SLOWNESS/HUNGER are typed so
// potions/movement can attach later without a schema migration.
export const StatusEffectTypeSchema = Schema.Literal(
  'REGENERATION',
  'POISON',
  'SPEED',
  'SLOWNESS',
  'HUNGER',
)
export type StatusEffectType = Schema.Schema.Type<typeof StatusEffectTypeSchema>

export type ActiveStatusEffect = {
  readonly type: StatusEffectType
  // 0-based like vanilla internals: amplifier 0 = level I.
  readonly amplifier: number
  readonly remainingTicks: number
  // Ticks since the effect was applied — drives periodic fires.
  readonly elapsedTicks: number
}

export const TICKS_PER_SECOND = 20

// Vanilla periods, halved per amplifier step (floored at 1 tick):
// Regeneration I heals 1 HP every 50 ticks (2.5s), II every 25 ticks.
// Poison I damages 1 HP every 25 ticks (1.25s), II every 12 ticks.
const REGENERATION_BASE_INTERVAL_TICKS = 50
const POISON_BASE_INTERVAL_TICKS = 25

export const statusEffectIntervalTicks = (effect: ActiveStatusEffect): number => {
  const base =
    effect.type === 'REGENERATION' ? REGENERATION_BASE_INTERVAL_TICKS :
    effect.type === 'POISON' ? POISON_BASE_INTERVAL_TICKS :
    0
  if (base === 0) return 0
  return Math.max(1, base >> effect.amplifier)
}

export const makeStatusEffect = (
  type: StatusEffectType,
  amplifier: number,
  durationSecs: number,
): ActiveStatusEffect => ({
  type,
  amplifier: Math.max(0, Math.floor(amplifier)),
  remainingTicks: Math.max(0, Math.round(durationSecs * TICKS_PER_SECOND)),
  elapsedTicks: 0,
})

// Vanilla stacking: a stronger effect replaces a weaker one; an equal-strength
// effect keeps the LONGER remaining duration; a weaker application is ignored
// while the stronger one is active.
export const upsertStatusEffect = (
  effects: ReadonlyArray<ActiveStatusEffect>,
  next: ActiveStatusEffect,
): ReadonlyArray<ActiveStatusEffect> => {
  const index = effects.findIndex((effect) => effect.type === next.type)
  if (index === -1) return [...effects, next]
  const current = effects[index]!
  if (next.amplifier > current.amplifier) {
    return effects.map((effect, i) => (i === index ? next : effect))
  }
  if (next.amplifier === current.amplifier && next.remainingTicks > current.remainingTicks) {
    return effects.map((effect, i) =>
      i === index ? { ...current, remainingTicks: next.remainingTicks } : effect,
    )
  }
  return effects
}

export type StatusEffectTickResult = {
  readonly effects: ReadonlyArray<ActiveStatusEffect>
  readonly healAmount: number
  readonly poisonDamage: number
}

// Advance every effect by ONE game tick (the caller runs on the fixed
// HEALTH_TICK cadence). Returns the surviving effects plus this tick's
// periodic regen/poison amounts for the health layer to apply.
export const advanceStatusEffectsOneTick = (
  effects: ReadonlyArray<ActiveStatusEffect>,
): StatusEffectTickResult => {
  if (effects.length === 0) return { effects, healAmount: 0, poisonDamage: 0 }
  let healAmount = 0
  let poisonDamage = 0
  const survivors: Array<ActiveStatusEffect> = []
  for (const effect of effects) {
    const elapsedTicks = effect.elapsedTicks + 1
    const interval = statusEffectIntervalTicks(effect)
    if (interval > 0 && elapsedTicks % interval === 0) {
      if (effect.type === 'REGENERATION') healAmount += 1
      if (effect.type === 'POISON') poisonDamage += 1
    }
    const remainingTicks = effect.remainingTicks - 1
    if (remainingTicks > 0) {
      survivors.push({ ...effect, elapsedTicks, remainingTicks })
    }
  }
  return { effects: survivors, healAmount, poisonDamage }
}

// HUD projection of an active effect. Level is 1-based (amplifier 0 → "I");
// remaining time is rounded UP so the display never shows 0:00 while active.
export type StatusEffectHudEntry = {
  readonly type: StatusEffectType
  readonly label: string
  readonly remainingSeconds: number
  readonly display: string
}

const STATUS_EFFECT_LABELS: Record<StatusEffectType, string> = {
  REGENERATION: 'Regeneration',
  POISON: 'Poison',
  SPEED: 'Speed',
  SLOWNESS: 'Slowness',
  HUNGER: 'Hunger',
}

const ROMAN_LEVELS = ['I', 'II', 'III', 'IV', 'V'] as const

export const statusEffectLevelLabel = (amplifier: number): string => {
  const level = Math.max(0, Math.floor(amplifier))
  return ROMAN_LEVELS[level] ?? String(level + 1)
}

export const formatStatusEffectDuration = (remainingTicks: number): string => {
  const totalSeconds = Math.max(0, Math.ceil(remainingTicks / TICKS_PER_SECOND))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export const toStatusEffectHudEntry = (effect: ActiveStatusEffect): StatusEffectHudEntry => {
  const label = effect.amplifier > 0
    ? `${STATUS_EFFECT_LABELS[effect.type]} ${statusEffectLevelLabel(effect.amplifier)}`
    : STATUS_EFFECT_LABELS[effect.type]
  return {
    type: effect.type,
    label,
    remainingSeconds: Math.max(0, Math.ceil(effect.remainingTicks / TICKS_PER_SECOND)),
    display: `${label} ${formatStatusEffectDuration(effect.remainingTicks)}`,
  }
}

// Vanilla Hunger effect: 0.005 exhaustion per game tick per level
// = 0.1/s per level (level = amplifier + 1).
export const statusEffectHungerExhaustionPerSecond = (
  effects: ReadonlyArray<ActiveStatusEffect>,
): number => {
  let rate = 0
  for (const effect of effects) {
    if (effect.type === 'HUNGER') rate += 0.1 * (effect.amplifier + 1)
  }
  return rate
}

// Horizontal-speed multiplier from active effects (vanilla: Speed +20% per
// level, Slowness -15% per level; level = amplifier + 1). Both stack
// multiplicatively; the result never goes negative.
export const statusEffectSpeedMultiplier = (
  effects: ReadonlyArray<ActiveStatusEffect>,
): number => {
  let multiplier = 1
  for (const effect of effects) {
    const level = effect.amplifier + 1
    if (effect.type === 'SPEED') multiplier *= 1 + 0.2 * level
    if (effect.type === 'SLOWNESS') multiplier *= Math.max(0, 1 - 0.15 * level)
  }
  return multiplier
}
