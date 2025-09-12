/**
 * Common types used across the application
 */

// Basic utility types
export type Maybe<T> = T | null | undefined
export type Optional<T> = T | undefined
export type Nullable<T> = T | null

// Function types
export type Fn<T = void> = () => T
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

// Array utility types
export type NonEmptyArray<T> = [T, ...T[]]
export type Head<T extends readonly unknown[]> = T extends readonly [infer H, ...unknown[]] ? H : never
export type Tail<T extends readonly unknown[]> = T extends readonly [unknown, ...infer Rest] ? Rest : never

// String utility types
export type StringKeys<T> = Extract<keyof T, string>
export type NumberKeys<T> = Extract<keyof T, number>

// Brand types for better type safety
export type Brand<T, B> = T & { readonly __brand: B }
export type ID<T extends string = string> = Brand<string, T>

// Result type for error handling
export type Result<T, E = Error> = Success<T> | Failure<E>
export type Success<T> = { success: true; data: T }
export type Failure<E> = { success: false; error: E }

// Coordinate types
export type Point2D = { x: number; y: number }
export type Point3D = Point2D & { z: number }
export type Size2D = { width: number; height: number }
export type Size3D = Size2D & { depth: number }
export type Rect = Point2D & Size2D
export type Box3D = Point3D & Size3D

// Time-related types
export type Timestamp = Brand<number, 'Timestamp'>
export type Duration = Brand<number, 'Duration'>

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
export type EventPayload = Record<string, unknown>
export type GameEvent<T extends EventType = EventType, P extends EventPayload = EventPayload> = {
  type: T
  payload: P
  timestamp: Timestamp
}

// State management
export type State = Record<string, unknown>
export type StateUpdate<T extends State> = Partial<T> | ((prev: T) => Partial<T>)
export type StateSelector<T extends State, R> = (state: T) => R
