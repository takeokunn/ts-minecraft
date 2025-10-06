import { Schema } from 'effect'
import {
  AccelerationSchema,
  HealthValueSchema,
  HungerValueSchema,
  PlayerAcceleration,
  PlayerHealthValue,
  PlayerHungerValue,
  PlayerSaturationValue,
  PlayerSpeed,
  SaturationValueSchema,
  SpeedSchema,
} from './index'

const decodeSpeed = Schema.decodeUnknownSync(SpeedSchema)
const decodeHealth = Schema.decodeUnknownSync(HealthValueSchema)
const decodeHunger = Schema.decodeUnknownSync(HungerValueSchema)
const decodeSaturation = Schema.decodeUnknownSync(SaturationValueSchema)
const decodeAcceleration = Schema.decodeUnknownSync(AccelerationSchema)
const decodeTickRate = Schema.decodeUnknownSync(
  Schema.Number.pipe(Schema.finite(), Schema.int(), Schema.between(1, 200))
)

export const JUMP_VELOCITY: PlayerSpeed = decodeSpeed(8.6)

export const MOVEMENT_SPEEDS: Readonly<Record<'walk' | 'sprint' | 'crouch' | 'swim', PlayerSpeed>> = {
  walk: decodeSpeed(4.317),
  sprint: decodeSpeed(5.612),
  crouch: decodeSpeed(2.158),
  swim: decodeSpeed(3.613),
} as const

export const HEALTH_CONSTANTS: Readonly<{
  readonly minimum: PlayerHealthValue
  readonly maximum: PlayerHealthValue
  readonly critical: PlayerHealthValue
  readonly healthy: PlayerHealthValue
}> = {
  minimum: decodeHealth(0),
  maximum: decodeHealth(20),
  critical: decodeHealth(4),
  healthy: decodeHealth(16),
} as const

export const HUNGER_CONSTANTS: Readonly<{
  readonly minimum: PlayerHungerValue
  readonly maximum: PlayerHungerValue
  readonly starving: PlayerHungerValue
  readonly replenished: PlayerHungerValue
}> = {
  minimum: decodeHunger(0),
  maximum: decodeHunger(20),
  starving: decodeHunger(0),
  replenished: decodeHunger(17),
} as const

export const SATURATION_CONSTANTS: Readonly<{
  readonly minimum: PlayerSaturationValue
  readonly maximum: PlayerSaturationValue
}> = {
  minimum: decodeSaturation(0),
  maximum: decodeSaturation(20),
} as const

export const PHYSICS_CONSTANTS: Readonly<{
  readonly gravity: PlayerAcceleration
  readonly drag: PlayerAcceleration
  readonly tickRate: number
}> = {
  gravity: decodeAcceleration(-0.08),
  drag: decodeAcceleration(0.91),
  tickRate: decodeTickRate(20),
} as const
