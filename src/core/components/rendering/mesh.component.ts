import * as S from 'effect/Schema'

/**
 * Mesh Components
 * Different types of mesh rendering components
 */

// Instanced mesh for efficient rendering of many similar objects
export const InstancedMeshComponent = S.Struct({
  meshType: S.String,
  instanceId: S.Number.pipe(S.int(), S.nonNegative()).pipe(S.optional),
  maxInstances: S.Number.pipe(S.int(), S.positive()).pipe(S.withDefault(() => 1000)),
})

export type InstancedMeshComponent = S.Schema.Type<typeof InstancedMeshComponent>

// Standard mesh component
export const MeshComponent = S.Struct({
  meshId: S.String,
  materialId: S.String,
  castShadow: S.Boolean.pipe(S.withDefault(() => true)),
  receiveShadow: S.Boolean.pipe(S.withDefault(() => true)),
})

export type MeshComponent = S.Schema.Type<typeof MeshComponent>

// LOD (Level of Detail) mesh component
export const LODMeshComponent = S.Struct({
  levels: S.Array(S.Struct({
    distance: S.Number.pipe(S.positive(), S.finite()),
    meshId: S.String,
  })),
  currentLevel: S.Number.pipe(S.int(), S.nonNegative()).pipe(S.withDefault(() => 0)),
})

export type LODMeshComponent = S.Schema.Type<typeof LODMeshComponent>