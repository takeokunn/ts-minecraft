/**
 * @fileoverview MetersPerSecond Operations
 * MetersPerSecond型の操作関数と物理計算
 */

import * as Effect from 'effect/Effect'
import * as Order from 'effect/Order'
import * as Schema from 'effect/Schema'
import type { Meters } from '../meters'
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
export const makeUnsafe = (value: number): MetersPerSecond => value as MetersPerSecond

/**
 * Calculate velocity from distance and time
 *
 * 距離と時間から速度を計算（v = d / t）
 */
export const fromDistanceAndTime = (distance: Meters, time: Milliseconds): MetersPerSecond => {
  const timeInSeconds = MillisecondsOps.toSeconds(time)
  const isZero = timeInSeconds === 0
  return isZero ? (0 as MetersPerSecond) : ((distance / timeInSeconds) as MetersPerSecond)
}

/**
 * Calculate distance traveled given velocity and time
 *
 * 速度と時間から移動距離を計算（d = v * t）
 */
export const toDistance = (velocity: MetersPerSecond, time: Milliseconds): Meters => {
  const timeInSeconds = MillisecondsOps.toSeconds(time)
  return (velocity * timeInSeconds) as Meters
}

/**
 * Add two velocities
 */
export const add = (a: MetersPerSecond, b: MetersPerSecond): MetersPerSecond => (a + b) as MetersPerSecond

/**
 * Subtract two velocities
 */
export const subtract = (a: MetersPerSecond, b: MetersPerSecond): MetersPerSecond => (a - b) as MetersPerSecond

/**
 * Multiply velocity by scalar
 */
export const multiply = (velocity: MetersPerSecond, scalar: number): MetersPerSecond =>
  (velocity * scalar) as MetersPerSecond

/**
 * Divide velocity by scalar
 */
export const divide = (velocity: MetersPerSecond, scalar: number): MetersPerSecond =>
  (velocity / scalar) as MetersPerSecond

/**
 * Get absolute value of velocity
 */
export const abs = (velocity: MetersPerSecond): MetersPerSecond => Math.abs(velocity) as MetersPerSecond

/**
 * Negate velocity (reverse direction)
 */
export const negate = (velocity: MetersPerSecond): MetersPerSecond => -velocity as MetersPerSecond

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
  return (velocity + acceleration * timeInSeconds) as MetersPerSecond
}

/**
 * Apply damping/friction (exponential decay)
 *
 * 減衰・摩擦を適用（指数減衰）
 */
export const applyDamping = (velocity: MetersPerSecond, dampingFactor: number, time: Milliseconds): MetersPerSecond => {
  const timeInSeconds = MillisecondsOps.toSeconds(time)
  const decayFactor = Math.pow(dampingFactor, timeInSeconds)
  return (velocity * decayFactor) as MetersPerSecond
}

/**
 * Clamp velocity to maximum magnitude
 *
 * 速度を最大値でクランプ
 */
export const clamp = (velocity: MetersPerSecond, maxVelocity: MetersPerSecond): MetersPerSecond => {
  const absMax = Math.abs(maxVelocity)
  return Math.max(-absMax, Math.min(absMax, velocity)) as MetersPerSecond
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
export const fromKilometersPerHour = (kph: number): MetersPerSecond => (kph / 3.6) as MetersPerSecond

/**
 * Get minimum of two velocities
 */
export const min = (a: MetersPerSecond, b: MetersPerSecond): MetersPerSecond => Math.min(a, b) as MetersPerSecond

/**
 * Get maximum of two velocities
 */
export const max = (a: MetersPerSecond, b: MetersPerSecond): MetersPerSecond => Math.max(a, b) as MetersPerSecond
