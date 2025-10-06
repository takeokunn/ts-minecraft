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
export const makeUnsafe = (value: number): Milliseconds => value as Milliseconds

/**
 * Add two Milliseconds
 */
export const add = (a: Milliseconds, b: Milliseconds): Milliseconds => (a + b) as Milliseconds

/**
 * Subtract two Milliseconds
 */
export const subtract = (a: Milliseconds, b: Milliseconds): Milliseconds => Math.max(0, a - b) as Milliseconds

/**
 * Multiply Milliseconds by scalar
 */
export const multiply = (ms: Milliseconds, scalar: number): Milliseconds => (ms * scalar) as Milliseconds

/**
 * Divide Milliseconds by scalar
 */
export const divide = (ms: Milliseconds, scalar: number): Milliseconds => (ms / scalar) as Milliseconds

/**
 * Convert to seconds
 */
export const toSeconds = (ms: Milliseconds): number => ms / 1000

/**
 * Convert from seconds
 */
export const fromSeconds = (seconds: number): Milliseconds => (seconds * 1000) as Milliseconds

/**
 * Clamp Milliseconds between min and max
 */
export const clamp = (value: Milliseconds, min: Milliseconds, max: Milliseconds): Milliseconds =>
  Math.max(min, Math.min(max, value)) as Milliseconds

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
export const min = (a: Milliseconds, b: Milliseconds): Milliseconds => Math.min(a, b) as Milliseconds

/**
 * Get maximum of two Milliseconds
 */
export const max = (a: Milliseconds, b: Milliseconds): Milliseconds => Math.max(a, b) as Milliseconds
