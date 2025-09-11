import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'

export interface SpatialGridInterface {
  readonly initialize: () => Effect.Effect<void, never, never>
  readonly insert: (id: any, x: number, y: number, z: number) => Effect.Effect<void, never, never>
  readonly remove: (id: any) => Effect.Effect<void, never, never>
  readonly query: (x: number, y: number, z: number, radius: number) => Effect.Effect<any[], never, never>
  readonly update: (id: any, x: number, y: number, z: number) => Effect.Effect<void, never, never>
}

export class SpatialGrid extends Context.GenericTag('SpatialGrid')<
  SpatialGrid,
  SpatialGridInterface
>() {}