/**
 * @fileoverview MetersPerSecond Operations
 * MetersPerSecond型の操作関数と物理計算
 */

import * as Effect from 'effect/Effect'
import * as Order from 'effect/Order'
import * as Schema from 'effect/Schema'
import type { Meters } from '../meters'
import { MetersSchema } from '../meters/schema'
import type { Milliseconds } from '../milliseconds'
import * as MillisecondsOps from '../milliseconds/operations'
import type { MetersPerSecond } from './schema'
import { MetersPerSecondSchema } from './schema'

/**
 * Create MetersPerSecond from number with validation
 *
 * 数値からMetersPerSecond型を生成（バリデーション付き）
 */
export const make = (value: number): Effect.Effect<MetersPerSecond, Schema.ParseError> =>
  Schema.decodeUnknown(MetersPerSecondSchema)(value)

/**
 * Create MetersPerSecond from number without validation
 *
 * 数値からMetersPerSecond型を生成（バリデーションなし）
 * 信頼できるソースからの値のみ使用すること
 */
export const makeUnsafe = (value: number): MetersPerSecond =>
  MetersPerSecondSchema.make(value, { disableValidation: true })

/**
 * Calculate velocity from distance and time
 *
 * 距離と時間から速度を計算（v = d / t）
 */
export const fromDistanceAndTime = (distance: Meters, time: Milliseconds): MetersPerSecond => {
  const timeInSeconds = MillisecondsOps.toSeconds(time)
  const isZero = timeInSeconds === 0
  return isZero
    ? MetersPerSecondSchema.make(0, { disableValidation: true })
    : MetersPerSecondSchema.make(distance / timeInSeconds, { disableValidation: true })
}

/**
 * Calculate distance traveled given velocity and time
 *
 * 速度と時間から移動距離を計算（d = v * t）
 */
export const toDistance = (velocity: MetersPerSecond, time: Milliseconds): Meters => {
  const timeInSeconds = MillisecondsOps.toSeconds(time)
  return MetersSchema.make(velocity * timeInSeconds, { disableValidation: true })
}

/**
 * Add two velocities
 */
export const add = (a: MetersPerSecond, b: MetersPerSecond): MetersPerSecond =>
  MetersPerSecondSchema.make(a + b, { disableValidation: true })

/**
 * Subtract two velocities
 */
export const subtract = (a: MetersPerSecond, b: MetersPerSecond): MetersPerSecond =>
  MetersPerSecondSchema.make(a - b, { disableValidation: true })

/**
 * Multiply velocity by scalar
 */
export const multiply = (velocity: MetersPerSecond, scalar: number): MetersPerSecond =>
  MetersPerSecondSchema.make(velocity * scalar, { disableValidation: true })

/**
 * Divide velocity by scalar
 */
export const divide = (velocity: MetersPerSecond, scalar: number): MetersPerSecond =>
  MetersPerSecondSchema.make(velocity / scalar, { disableValidation: true })

/**
 * Get absolute value of velocity
 */
export const abs = (velocity: MetersPerSecond): MetersPerSecond =>
  MetersPerSecondSchema.make(Math.abs(velocity), { disableValidation: true })

/**
 * Negate velocity (reverse direction)
 */
export const negate = (velocity: MetersPerSecond): MetersPerSecond =>
  MetersPerSecondSchema.make(-velocity, { disableValidation: true })

/**
 * Apply acceleration over time (v' = v + a * t)
 *
 * 加速度を時間分適用（v' = v + a * t）
 */
export const applyAcceleration = (
  velocity: MetersPerSecond,
  acceleration: MetersPerSecond,
  time: Milliseconds
): MetersPerSecond => {
  const timeInSeconds = MillisecondsOps.toSeconds(time)
  return MetersPerSecondSchema.make(velocity + acceleration * timeInSeconds, { disableValidation: true })
}

/**
 * Apply damping/friction (exponential decay)
 *
 * 減衰・摩擦を適用（指数減衰）
 */
export const applyDamping = (velocity: MetersPerSecond, dampingFactor: number, time: Milliseconds): MetersPerSecond => {
  const timeInSeconds = MillisecondsOps.toSeconds(time)
  const decayFactor = Math.pow(dampingFactor, timeInSeconds)
  return MetersPerSecondSchema.make(velocity * decayFactor, { disableValidation: true })
}

/**
 * Clamp velocity to maximum magnitude
 *
 * 速度を最大値でクランプ
 */
export const clamp = (velocity: MetersPerSecond, maxVelocity: MetersPerSecond): MetersPerSecond => {
  const absMax = Math.abs(maxVelocity)
  return MetersPerSecondSchema.make(Math.max(-absMax, Math.min(absMax, velocity)), { disableValidation: true })
}

/**
 * Compare two velocities
 */
export const compare = (a: MetersPerSecond, b: MetersPerSecond): -1 | 0 | 1 => Order.number(a, b)

/**
 * Check if velocity is zero
 */
export const isZero = (velocity: MetersPerSecond): boolean => velocity === 0

/**
 * Check if velocity is positive
 */
export const isPositive = (velocity: MetersPerSecond): boolean => velocity > 0

/**
 * Check if velocity is negative
 */
export const isNegative = (velocity: MetersPerSecond): boolean => velocity < 0

/**
 * Convert to kilometers per hour
 */
export const toKilometersPerHour = (velocity: MetersPerSecond): number => velocity * 3.6

/**
 * Convert from kilometers per hour
 */
export const fromKilometersPerHour = (kph: number): MetersPerSecond =>
  MetersPerSecondSchema.make(kph / 3.6, { disableValidation: true })

/**
 * Get minimum of two velocities
 */
export const min = (a: MetersPerSecond, b: MetersPerSecond): MetersPerSecond =>
  MetersPerSecondSchema.make(Math.min(a, b), { disableValidation: true })

/**
 * Get maximum of two velocities
 */
export const max = (a: MetersPerSecond, b: MetersPerSecond): MetersPerSecond =>
  MetersPerSecondSchema.make(Math.max(a, b), { disableValidation: true })
