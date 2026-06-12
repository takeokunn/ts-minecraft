export type TargetBlockHit = { readonly x: number; readonly y: number; readonly z: number }

export type TargetRayHit = {
  readonly blockX: number
  readonly blockY: number
  readonly blockZ: number
  readonly distance: number
  readonly normal: { readonly x: number; readonly y: number; readonly z: number }
}
