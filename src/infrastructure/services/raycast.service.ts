import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'
import * as THREE from 'three'

export interface RaycastResult {
  readonly hit: boolean
  readonly intersection?: THREE.Intersection
  readonly distance: number
  readonly point?: THREE.Vector3
  readonly normal?: THREE.Vector3
}

export interface RaycastInterface {
  readonly raycast: (
    origin?: THREE.Vector3,
    direction?: THREE.Vector3,
    maxDistance?: number
  ) => Effect.Effect<Option.Option<THREE.Intersection>, never, never>
  readonly raycastFromCamera: () => Effect.Effect<Option.Option<THREE.Intersection>, never, never>
  readonly setCamera: (camera: THREE.Camera) => Effect.Effect<void, never, never>
  readonly setScene: (scene: THREE.Scene) => Effect.Effect<void, never, never>
}

export class Raycast extends Context.GenericTag('Raycast')<
  Raycast,
  RaycastInterface
>() {}