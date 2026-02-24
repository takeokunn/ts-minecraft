import * as THREE from 'three'

export type Color = { readonly r: number; readonly g: number; readonly b: number }

export const makeColor = (r: number, g: number, b: number): Color => ({ r, g, b })

export const fromHex = (hex: string): Color => {
  const threeColor = new THREE.Color(hex)
  return ({ r: threeColor.r, g: threeColor.g, b: threeColor.b })
}

export const toThreeColor = (c: Color): THREE.Color => new THREE.Color(c.r, c.g, c.b)
