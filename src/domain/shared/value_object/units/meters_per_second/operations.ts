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
export const makeUnsafe = (value: number): MetersPerSecond => Schema.make(MetersPerSecondSchema)(value)

/**
 * Calculate velocity from distance and time
 *
 * 距離と時間から速度を計算（v = d / t）
 */
export const fromDistanceAndTime = (distance: Meters, time: Milliseconds): MetersPerSecond => {
  const timeInSeconds = MillisecondsOps.toSeconds(time)
  const isZero = timeInSeconds === 0
  return isZero ? Schema.make(MetersPerSecondSchema)(0) : Schema.make(MetersPerSecondSchema)(distance / timeInSeconds)
}

/**
 * Calculate distance traveled given velocity and time
 *
 * 速度と時間から移動距離を計算（d = v * t）
 */
export const toDistance = (velocity: MetersPerSecond, time: Milliseconds): Meters => {
  const timeInSeconds = MillisecondsOps.toSeconds(time)
  return Schema.make(MetersSchema)(velocity * timeInSeconds)
}

/**
 * Add two velocities
 */
export const add = (a: MetersPerSecond, b: MetersPerSecond): MetersPerSecond =>
  Schema.make(MetersPerSecondSchema)(a + b)

/**
 * Subtract two velocities
 */
export const subtract = (a: MetersPerSecond, b: MetersPerSecond): MetersPerSecond =>
  Schema.make(MetersPerSecondSchema)(a - b)

/**
 * Multiply velocity by scalar
 */
export const multiply = (velocity: MetersPerSecond, scalar: number): MetersPerSecond =>
  Schema.make(MetersPerSecondSchema)(velocity * scalar)

/**
 * Divide velocity by scalar
 */
export const divide = (velocity: MetersPerSecond, scalar: number): MetersPerSecond =>
  Schema.make(MetersPerSecondSchema)(velocity / scalar)

/**
 * Get absolute value of velocity
 */
export const abs = (velocity: MetersPerSecond): MetersPerSecond =>
  Schema.make(MetersPerSecondSchema)(Math.abs(velocity))

/**
 * Negate velocity (reverse direction)
 */
export const negate = (velocity: MetersPerSecond): MetersPerSecond => Schema.make(MetersPerSecondSchema)(-velocity)

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
  return Schema.make(MetersPerSecondSchema)(velocity + acceleration * timeInSeconds)
}

/**
 * Apply damping/friction (exponential decay)
 *
 * 減衰・摩擦を適用（指数減衰）
 */
export const applyDamping = (velocity: MetersPerSecond, dampingFactor: number, time: Milliseconds): MetersPerSecond => {
  const timeInSeconds = MillisecondsOps.toSeconds(time)
  const decayFactor = Math.pow(dampingFactor, timeInSeconds)
  return Schema.make(MetersPerSecondSchema)(velocity * decayFactor)
}

/**
 * Clamp velocity to maximum magnitude
 *
 * 速度を最大値でクランプ
 */
export const clamp = (velocity: MetersPerSecond, maxVelocity: MetersPerSecond): MetersPerSecond => {
  const absMax = Math.abs(maxVelocity)
  return Schema.make(MetersPerSecondSchema)(Math.max(-absMax, Math.min(absMax, velocity)))
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
export const fromKilometersPerHour = (kph: number): MetersPerSecond => Schema.make(MetersPerSecondSchema)(kph / 3.6)

/**
 * Get minimum of two velocities
 */
export const min = (a: MetersPerSecond, b: MetersPerSecond): MetersPerSecond =>
  Schema.make(MetersPerSecondSchema)(Math.min(a, b))

/**
 * Get maximum of two velocities
 */
export const max = (a: MetersPerSecond, b: MetersPerSecond): MetersPerSecond =>
  Schema.make(MetersPerSecondSchema)(Math.max(a, b))
