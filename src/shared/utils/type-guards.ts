/**
 * Type Guard Utilities for TypeScript type safety
 * 
 * This module provides type guards to replace unsafe type assertions (as operators)
 * with safe runtime type checking, improving type safety throughout the application.
 */

import * as Option from 'effect/Option'

/**
 * DOM Element Type Guards
 */
export const isHTMLElement = (element: Element | EventTarget | null): element is HTMLElement => {
  return element !== null && element instanceof HTMLElement
}

export const isHTMLInputElement = (element: Element | EventTarget | null): element is HTMLInputElement => {
  return element !== null && element instanceof HTMLInputElement
}

export const isHTMLSelectElement = (element: Element | EventTarget | null): element is HTMLSelectElement => {
  return element !== null && element instanceof HTMLSelectElement
}

export const isHTMLDivElement = (element: Element | EventTarget | null): element is HTMLDivElement => {
  return element !== null && element instanceof HTMLDivElement
}

export const isHTMLButtonElement = (element: Element | EventTarget | null): element is HTMLButtonElement => {
  return element !== null && element instanceof HTMLButtonElement
}

export const isHTMLTextAreaElement = (element: Element | EventTarget | null): element is HTMLTextAreaElement => {
  return element !== null && element instanceof HTMLTextAreaElement
}

/**
 * Safe DOM Element Access with Option types
 */
export const getElementByIdSafe = (id: string): Option.Option<HTMLElement> => {
  const element = document.getElementById(id)
  return element ? Option.some(element) : Option.none()
}

export const getInputElementByIdSafe = (id: string): Option.Option<HTMLInputElement> => {
  const element = document.getElementById(id)
  return element && isHTMLInputElement(element) ? Option.some(element) : Option.none()
}

export const getSelectElementByIdSafe = (id: string): Option.Option<HTMLSelectElement> => {
  const element = document.getElementById(id)
  return element && isHTMLSelectElement(element) ? Option.some(element) : Option.none()
}

export const querySelectorSafe = <T extends Element>(
  selector: string,
  parent: ParentNode = document,
  typeGuard: (element: Element | null) => element is T
): Option.Option<T> => {
  const element = parent.querySelector(selector)
  return typeGuard(element) ? Option.some(element) : Option.none()
}

/**
 * Object Type Guards
 */
export const hasProperty = <K extends string | number | symbol>(
  obj: unknown,
  key: K
): obj is Record<K, unknown> => {
  return typeof obj === 'object' && obj !== null && key in obj
}

export const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export const isStringRecord = (value: unknown): value is Record<string, string> => {
  if (!isRecord(value)) return false
  return Object.values(value).every((v) => typeof v === 'string')
}

export const isNumberRecord = (value: unknown): value is Record<string, number> => {
  if (!isRecord(value)) return false
  return Object.values(value).every((v) => typeof v === 'number')
}

/**
 * Tagged Union Type Guards
 */
export const hasTag = <T extends string>(
  obj: unknown,
  tag: T
): obj is { _tag: T } => {
  return hasProperty(obj, '_tag') && obj._tag === tag
}

export const isTaggedUnion = (obj: unknown): obj is { _tag: string } => {
  return hasProperty(obj, '_tag') && typeof obj._tag === 'string'
}

/**
 * Array Type Guards
 */
export const isArrayOf = <T>(
  value: unknown,
  itemGuard: (item: unknown) => item is T
): value is T[] => {
  return Array.isArray(value) && value.every(itemGuard)
}

export const isStringArray = (value: unknown): value is string[] => {
  return isArrayOf(value, (item): item is string => typeof item === 'string')
}

export const isNumberArray = (value: unknown): value is number[] => {
  return isArrayOf(value, (item): item is number => typeof item === 'number')
}

/**
 * Function Type Guards
 */
export const isFunction = (value: unknown): value is Function => {
  return typeof value === 'function'
}

export const isAsyncFunction = (value: unknown): value is (...args: unknown[]) => Promise<unknown> => {
  return isFunction(value) && value.constructor.name === 'AsyncFunction'
}

/**
 * Browser API Type Guards
 */
export const hasPerformanceMemory = (perf: Performance): perf is Performance & { memory: unknown } => {
  return 'memory' in perf && typeof (perf as Performance & { memory?: unknown }).memory === 'object'
}

export const hasDeviceMemory = (nav: Navigator): nav is Navigator & { deviceMemory: number } => {
  return 'deviceMemory' in nav && typeof (nav as Navigator & { deviceMemory?: number }).deviceMemory === 'number'
}

export const hasPerformanceObserver = (): boolean => {
  return typeof window !== 'undefined' && 'PerformanceObserver' in window
}

export const hasGarbageCollection = (): boolean => {
  return typeof window !== 'undefined' && 'gc' in window && isFunction((window as Window & { gc?: () => void }).gc)
}

/**
 * Vector and Math Type Guards
 */
export interface Vector3 {
  x: number
  y: number
  z: number
}

export interface Vector2 {
  x: number
  y: number
}

export const isVector3 = (value: unknown): value is Vector3 => {
  return (
    isRecord(value) &&
    hasProperty(value, 'x') &&
    hasProperty(value, 'y') &&
    hasProperty(value, 'z') &&
    typeof value.x === 'number' &&
    typeof value.y === 'number' &&
    typeof value.z === 'number'
  )
}

export const isVector2 = (value: unknown): value is Vector2 => {
  return (
    isRecord(value) &&
    hasProperty(value, 'x') &&
    hasProperty(value, 'y') &&
    typeof value.x === 'number' &&
    typeof value.y === 'number'
  )
}

export interface Matrix4 {
  elements: number[]
}

export const isMatrix4 = (value: unknown): value is Matrix4 => {
  return (
    isRecord(value) &&
    hasProperty(value, 'elements') &&
    isNumberArray(value.elements) &&
    value.elements.length === 16
  )
}

/**
 * Entity and Component Type Guards
 */
export const hasEntityId = (obj: unknown): obj is { entityId: string } => {
  return hasProperty(obj, 'entityId') && typeof obj.entityId === 'string'
}

export const hasComponents = (obj: unknown): obj is { components: unknown } => {
  return hasProperty(obj, 'components')
}

export const hasPosition = (obj: unknown): obj is { position: Vector3 } => {
  return hasProperty(obj, 'position') && isVector3(obj.position)
}

export const hasMetadata = (obj: unknown): obj is { metadata: Record<string, unknown> } => {
  return hasProperty(obj, 'metadata') && isRecord(obj.metadata)
}

/**
 * File and Event Type Guards
 */
export const isFileList = (value: unknown): value is FileList => {
  return value instanceof FileList
}

export const hasFiles = (
  target: EventTarget | null
): target is HTMLInputElement & { files: FileList } => {
  return isHTMLInputElement(target) && target.files instanceof FileList
}

/**
 * Error Type Guards
 */
export const isError = (value: unknown): value is Error => {
  return value instanceof Error
}

export const isErrorWithMessage = (value: unknown): value is { message: string } => {
  return hasProperty(value, 'message') && typeof value.message === 'string'
}

/**
 * Safe type conversion utilities
 */
export const safeParseNumber = (value: unknown): Option.Option<number> => {
  if (typeof value === 'number' && !isNaN(value)) {
    return Option.some(value)
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value)
    return !isNaN(parsed) ? Option.some(parsed) : Option.none()
  }
  return Option.none()
}

export const safeParseInt = (value: unknown): Option.Option<number> => {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return Option.some(value)
  }
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10)
    return !isNaN(parsed) ? Option.some(parsed) : Option.none()
  }
  return Option.none()
}

export const safeString = (value: unknown): Option.Option<string> => {
  return typeof value === 'string' ? Option.some(value) : Option.none()
}

export const safeBoolean = (value: unknown): Option.Option<boolean> => {
  return typeof value === 'boolean' ? Option.some(value) : Option.none()
}

/**
 * Component-specific type guards for the Minecraft project
 */
export interface ComponentValue {
  type?: string
  [key: string]: unknown
}

export const isComponentValue = (value: unknown): value is ComponentValue => {
  return isRecord(value)
}

export const hasComponentType = (
  value: unknown,
  expectedType: string
): value is ComponentValue & { type: string } => {
  return isComponentValue(value) && hasProperty(value, 'type') && value.type === expectedType
}

/**
 * Safe property access
 */
export const getSafeProperty = <T>(
  obj: unknown,
  key: string,
  typeGuard: (value: unknown) => value is T
): Option.Option<T> => {
  if (hasProperty(obj, key) && typeGuard(obj[key])) {
    return Option.some(obj[key])
  }
  return Option.none()
}

export const getSafeStringProperty = (obj: unknown, key: string): Option.Option<string> => {
  return getSafeProperty(obj, key, (value): value is string => typeof value === 'string')
}

export const getSafeNumberProperty = (obj: unknown, key: string): Option.Option<number> => {
  return getSafeProperty(obj, key, (value): value is number => typeof value === 'number')
}

export const getSafeBooleanProperty = (obj: unknown, key: string): Option.Option<boolean> => {
  return getSafeProperty(obj, key, (value): value is boolean => typeof value === 'boolean')
}