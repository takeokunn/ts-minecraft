/**
 * Common types used across the application
 * Effect-TS compliant type definitions
 */

import * as Either from 'effect/Either'
import * as Option from 'effect/Option'
import * as Effect from 'effect/Effect'
import * as Brand from 'effect/Brand'
import { NonEmptyReadonlyArray } from 'effect/Array'

// JSON value type for better type safety than unknown
export type JsonValue = 
  | string 
  | number 
  | boolean 
  | null 
  | JsonValue[] 
  | { [key: string]: JsonValue }

// Basic utility types - Effect-TS compliant
export type Maybe<T> = Option.Option<T>
export type Optional<T> = T | undefined
export type Nullable<T> = T | null

// Function types - Effect-TS patterns
export type EffectFn<T = void, E = never, R = never> = () => Effect.Effect<T, E, R>
export type SyncFn<T = void> = () => T
export type AsyncFn<T = void> = () => Promise<T>
export type EventHandler<T = Event> = (event: T) => void
export type Callback<T = void, R = void> = (arg: T) => R

// Object utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

export type DeepRequired<T> = {
  [P in keyof T]-?: T[P] extends object ? DeepRequired<T[P]> : T[P]
}

export type Mutable<T> = {
  -readonly [P in keyof T]: T[P]
}

// Array utility types - Effect-TS compliant
export type NonEmptyArray<T> = NonEmptyReadonlyArray<T>
export type Head<T extends readonly JsonValue[]> = T extends readonly [infer H, ...JsonValue[]] ? H : never
export type Tail<T extends readonly JsonValue[]> = T extends readonly [JsonValue, ...infer Rest] ? Rest : never

// String utility types
export type StringKeys<T> = Extract<keyof T, string>
export type NumberKeys<T> = Extract<keyof T, number>

// Brand types for better type safety - Using Effect-TS Brand
export type ID<T extends string = string> = string & Brand.Brand<T>

// Export Brand namespace for external use
export { Brand }

// Result type for error handling - Effect-TS Either-based
export type Result<T, E = Error> = Either.Either<T, E>
export const Result = {
  success: <T>(data: T): Result<T, never> => Either.right(data),
  failure: <E>(error: E): Result<never, E> => Either.left(error),
  fromEither: <T, E>(either: Either.Either<T, E>): Result<T, E> => either,
  toEither: <T, E>(result: Result<T, E>): Either.Either<T, E> => result,
}

// Legacy type aliases for backward compatibility (deprecated)
/** @deprecated Use Result<T, E> instead */
export type Success<T> = { success: true; data: T }
/** @deprecated Use Result<T, E> instead */
export type Failure<E> = { success: false; error: E }

// Coordinate types
export type Point2D = { x: number; y: number }
export type Point3D = Point2D & { z: number }
export type Size2D = { width: number; height: number }
export type Size3D = Size2D & { depth: number }
export type Rect = Point2D & Size2D
export type Box3D = Point3D & Size3D

// Time-related types
export type Timestamp = number & Brand.Brand<'Timestamp'>
export type Duration = number & Brand.Brand<'Duration'>

// Entity-related types
export type EntityID = ID<'Entity'>
export type ComponentID = ID<'Component'>
export type SystemID = ID<'System'>

// Performance monitoring types
export type MetricName = string
export type MetricValue = number
export type PerformanceMetric = {
  name: MetricName
  value: MetricValue
  timestamp: Timestamp
  unit?: string
}

// Configuration types
export type ConfigValue = string | number | boolean | ConfigValue[] | { [key: string]: ConfigValue }
export type Config = Record<string, ConfigValue>

// Event types
export type EventType = string
export type EventPayload = Record<string, JsonValue>
export type GameEvent<T extends EventType = EventType, P extends EventPayload = EventPayload> = {
  type: T
  payload: P
  timestamp: Timestamp
}

// State management
export type State = Record<string, JsonValue>
export type StateUpdate<T extends State> = Partial<T> | ((prev: T) => Partial<T>)
export type StateSelector<T extends State, R> = (state: T) => R
