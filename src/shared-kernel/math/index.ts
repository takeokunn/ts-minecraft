export interface Vector3 {
  readonly x: number
  readonly y: number
  readonly z: number
}

export const add = (a: Vector3, b: Vector3): Vector3 => ({
  x: a.x + b.x,
  y: a.y + b.y,
  z: a.z + b.z,
})
