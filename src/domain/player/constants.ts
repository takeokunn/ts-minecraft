import { PlayerAcceleration, PlayerHealthValue, PlayerHungerValue, PlayerSaturationValue, PlayerSpeed } from './index'

export const JUMP_VELOCITY: PlayerSpeed = 8.6 as PlayerSpeed

export const MOVEMENT_SPEEDS: Readonly<Record<'walk' | 'sprint' | 'crouch' | 'swim', PlayerSpeed>> = {
  walk: 4.317 as PlayerSpeed,
  sprint: 5.612 as PlayerSpeed,
  crouch: 2.158 as PlayerSpeed,
  swim: 3.613 as PlayerSpeed,
} as const

export const HEALTH_CONSTANTS: Readonly<{
  readonly minimum: PlayerHealthValue
  readonly maximum: PlayerHealthValue
  readonly critical: PlayerHealthValue
  readonly healthy: PlayerHealthValue
}> = {
  minimum: 0 as PlayerHealthValue,
  maximum: 20 as PlayerHealthValue,
  critical: 4 as PlayerHealthValue,
  healthy: 16 as PlayerHealthValue,
} as const

export const HUNGER_CONSTANTS: Readonly<{
  readonly minimum: PlayerHungerValue
  readonly maximum: PlayerHungerValue
  readonly starving: PlayerHungerValue
  readonly replenished: PlayerHungerValue
}> = {
  minimum: 0 as PlayerHungerValue,
  maximum: 20 as PlayerHungerValue,
  starving: 0 as PlayerHungerValue,
  replenished: 17 as PlayerHungerValue,
} as const

export const SATURATION_CONSTANTS: Readonly<{
  readonly minimum: PlayerSaturationValue
  readonly maximum: PlayerSaturationValue
}> = {
  minimum: 0 as PlayerSaturationValue,
  maximum: 20 as PlayerSaturationValue,
} as const

export const PHYSICS_CONSTANTS: Readonly<{
  readonly gravity: PlayerAcceleration
  readonly drag: PlayerAcceleration
  readonly tickRate: number
}> = {
  gravity: -0.08 as PlayerAcceleration,
  drag: 0.91 as PlayerAcceleration,
  tickRate: 20,
} as const
