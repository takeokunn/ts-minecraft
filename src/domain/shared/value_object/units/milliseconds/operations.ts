/**
 * @fileoverview Milliseconds Operations
 * Milliseconds型の操作関数
 */

import * as Effect from 'effect/Effect'
import * as Order from 'effect/Order'
import * as Schema from 'effect/Schema'
import type { Milliseconds } from './schema'
import { MillisecondsSchema } from './schema'

/**
 * Create Milliseconds from number with validation
 *
 * 数値からMilliseconds型を生成（バリデーション付き）
 */
export const make = (value: number): Effect.Effect<Milliseconds, Schema.ParseError> =>
  Schema.decodeUnknown(MillisecondsSchema)(value)

/**
 * Create Milliseconds from number without validation
 *
 * 数値からMilliseconds型を生成（バリデーションなし）
 * 信頼できるソースからの値のみ使用すること
 */
export const makeUnsafe = (value: number): Milliseconds => MillisecondsSchema.make(value, { disableValidation: true })

/**
 * Add two Milliseconds
 */
export const add = (a: Milliseconds, b: Milliseconds): Milliseconds =>
  MillisecondsSchema.make(a + b, { disableValidation: true })

/**
 * Subtract two Milliseconds
 */
export const subtract = (a: Milliseconds, b: Milliseconds): Milliseconds =>
  MillisecondsSchema.make(Math.max(0, a - b), { disableValidation: true })

/**
 * Multiply Milliseconds by scalar
 */
export const multiply = (ms: Milliseconds, scalar: number): Milliseconds =>
  MillisecondsSchema.make(ms * scalar, { disableValidation: true })

/**
 * Divide Milliseconds by scalar
 */
export const divide = (ms: Milliseconds, scalar: number): Milliseconds =>
  MillisecondsSchema.make(ms / scalar, { disableValidation: true })

/**
 * Convert to seconds
 */
export const toSeconds = (ms: Milliseconds): number => ms / 1000

/**
 * Convert from seconds
 */
export const fromSeconds = (seconds: number): Milliseconds =>
  MillisecondsSchema.make(seconds * 1000, { disableValidation: true })

/**
 * Clamp Milliseconds between min and max
 */
export const clamp = (value: Milliseconds, min: Milliseconds, max: Milliseconds): Milliseconds =>
  MillisecondsSchema.make(Math.max(min, Math.min(max, value)), { disableValidation: true })

/**
 * Check if Milliseconds is zero
 */
export const isZero = (ms: Milliseconds): boolean => ms === 0

/**
 * Check if Milliseconds is positive
 */
export const isPositive = (ms: Milliseconds): boolean => ms > 0

/**
 * Compare two Milliseconds
 */
export const compare = (a: Milliseconds, b: Milliseconds): -1 | 0 | 1 => Order.number(a, b)

/**
 * Get minimum of two Milliseconds
 */
export const min = (a: Milliseconds, b: Milliseconds): Milliseconds =>
  MillisecondsSchema.make(Math.min(a, b), { disableValidation: true })

/**
 * Get maximum of two Milliseconds
 */
export const max = (a: Milliseconds, b: Milliseconds): Milliseconds =>
  MillisecondsSchema.make(Math.max(a, b), { disableValidation: true })
