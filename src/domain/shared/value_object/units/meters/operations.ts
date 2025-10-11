/**
 * @fileoverview Meters Operations
 * Meters型の操作関数
 */

import * as Effect from 'effect/Effect'
import * as Order from 'effect/Order'
import * as Schema from 'effect/Schema'
import type { Meters } from './schema'
import { MetersSchema } from './schema'

/**
 * Create Meters from number with validation
 *
 * 数値からMeters型を生成（バリデーション付き）
 */
export const make = (value: number): Effect.Effect<Meters, Schema.ParseError> =>
  Schema.decodeUnknown(MetersSchema)(value)

/**
 * Create Meters from number without validation
 *
 * 数値からMeters型を生成（バリデーションなし）
 * 信頼できるソースからの値のみ使用すること
 */
export const makeUnsafe = (value: number): Meters => MetersSchema.make(value, { disableValidation: true })

/**
 * Add two Meters
 */
export const add = (a: Meters, b: Meters): Meters => MetersSchema.make(a + b, { disableValidation: true })

/**
 * Subtract two Meters
 */
export const subtract = (a: Meters, b: Meters): Meters => MetersSchema.make(a - b, { disableValidation: true })

/**
 * Multiply Meters by scalar
 */
export const multiply = (meters: Meters, scalar: number): Meters =>
  MetersSchema.make(meters * scalar, { disableValidation: true })

/**
 * Divide Meters by scalar
 */
export const divide = (meters: Meters, scalar: number): Meters =>
  MetersSchema.make(meters / scalar, { disableValidation: true })

/**
 * Get absolute value of Meters
 */
export const abs = (meters: Meters): Meters => MetersSchema.make(Math.abs(meters), { disableValidation: true })

/**
 * Negate Meters
 */
export const negate = (meters: Meters): Meters => MetersSchema.make(-meters, { disableValidation: true })

/**
 * Compare two Meters
 */
export const compare = (a: Meters, b: Meters): -1 | 0 | 1 => Order.number(a, b)

/**
 * Get minimum of two Meters
 */
export const min = (a: Meters, b: Meters): Meters => MetersSchema.make(Math.min(a, b), { disableValidation: true })

/**
 * Get maximum of two Meters
 */
export const max = (a: Meters, b: Meters): Meters => MetersSchema.make(Math.max(a, b), { disableValidation: true })

/**
 * Clamp Meters between min and max
 */
export const clamp = (value: Meters, minValue: Meters, maxValue: Meters): Meters =>
  MetersSchema.make(Math.max(minValue, Math.min(maxValue, value)), { disableValidation: true })

/**
 * Check if Meters is zero
 */
export const isZero = (meters: Meters): boolean => meters === 0

/**
 * Check if Meters is positive
 */
export const isPositive = (meters: Meters): boolean => meters > 0

/**
 * Check if Meters is negative
 */
export const isNegative = (meters: Meters): boolean => meters < 0

/**
 * Convert to centimeters
 */
export const toCentimeters = (meters: Meters): number => meters * 100

/**
 * Convert from centimeters
 */
export const fromCentimeters = (cm: number): Meters => MetersSchema.make(cm / 100, { disableValidation: true })

/**
 * Convert to kilometers
 */
export const toKilometers = (meters: Meters): number => meters / 1000

/**
 * Convert from kilometers
 */
export const fromKilometers = (km: number): Meters => MetersSchema.make(km * 1000, { disableValidation: true })

/**
 * Round Meters to specified decimal places
 */
export const round = (meters: Meters, decimalPlaces = 0): Meters => {
  const multiplier = Math.pow(10, decimalPlaces)
  return MetersSchema.make(Math.round(meters * multiplier) / multiplier, { disableValidation: true })
}
