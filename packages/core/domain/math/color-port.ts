// Structural port schema for Three.js Color objects — no Three.js import required.
import { Schema } from 'effect'

export type ColorPort = {
  readonly r: number
  readonly g: number
  readonly b: number
  setHSL(h: number, s: number, l: number, colorSpace?: string): unknown
  lerpColors(color1: ColorPort, color2: ColorPort, alpha: number): unknown
}

const hasFunctionProperty = <K extends PropertyKey>(value: object, key: K): value is Record<K, (...args: ReadonlyArray<unknown>) => unknown> =>
  key in value && typeof Reflect.get(value, key) === 'function'

const hasNumberProperty = (value: object, key: PropertyKey): boolean =>
  key in value && typeof Reflect.get(value, key) === 'number'

export const ColorPortSchema = Schema.declare(
  (u): u is ColorPort =>
    typeof u === 'object' &&
    u !== null &&
    hasNumberProperty(u, 'r') &&
    hasNumberProperty(u, 'g') &&
    hasNumberProperty(u, 'b') &&
    hasFunctionProperty(u, 'setHSL') &&
    hasFunctionProperty(u, 'lerpColors')
)
