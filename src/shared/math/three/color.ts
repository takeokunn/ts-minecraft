import * as THREE from 'three'
import { Schema } from 'effect'

export const ColorSchema = Schema.Struct({
  r: Schema.Number,
  g: Schema.Number,
  b: Schema.Number,
})
export type Color = Schema.Schema.Type<typeof ColorSchema>

export const makeColor = (r: number, g: number, b: number): Color => ({ r, g, b })

export const fromHex = (hex: string): Color => {
  const threeColor = new THREE.Color(hex)
  return ({ r: threeColor.r, g: threeColor.g, b: threeColor.b })
}

export const toThreeColor = (c: Color): THREE.Color => new THREE.Color(c.r, c.g, c.b)
