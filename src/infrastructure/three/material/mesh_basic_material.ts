/**
 * @fileoverview Three.js MeshBasicMaterial - Effect-TS Wrapper
 * MeshBasicMaterialのEffect-TSラッパー実装
 */

import { Effect, Schema } from 'effect'
import * as THREE from 'three'
import { ColorSchema, toThreeColor, type Color } from '../core/color'
import { MaterialError } from '../errors'

/**
 * MeshBasicMaterial Parameters Schema
 */
export const MeshBasicMaterialParamsSchema = Schema.Struct({
  color: Schema.optional(ColorSchema),
  opacity: Schema.optional(Schema.Number.pipe(Schema.between(0, 1))),
  transparent: Schema.optional(Schema.Boolean),
  side: Schema.optional(Schema.Literal('front', 'back', 'double')),
  wireframe: Schema.optional(Schema.Boolean),
  visible: Schema.optional(Schema.Boolean),
})

export type MeshBasicMaterialParams = Schema.Schema.Type<typeof MeshBasicMaterialParamsSchema>

/**
 * Side定数変換
 */
const sideToThreeSide = (side?: 'front' | 'back' | 'double'): THREE.Side => {
  if (!side || side === 'front') return THREE.FrontSide
  if (side === 'back') return THREE.BackSide
  return THREE.DoubleSide
}

/**
 * MeshBasicMaterial生成
 */
export const createMeshBasicMaterial = (
  params: MeshBasicMaterialParams
): Effect.Effect<THREE.MeshBasicMaterial, MaterialError> =>
  Effect.try({
    try: () =>
      new THREE.MeshBasicMaterial({
        color: params.color ? toThreeColor(params.color) : undefined,
        opacity: params.opacity,
        transparent: params.transparent,
        side: sideToThreeSide(params.side),
        wireframe: params.wireframe,
        visible: params.visible,
      }),
    catch: (error) =>
      MaterialError.make({
        type: 'MeshBasicMaterial',
        cause: error,
      }),
  })

/**
 * Effect.Scopeによるリソース管理付きMaterial生成
 */
export const withMeshBasicMaterial = <A, E>(
  params: MeshBasicMaterialParams,
  f: (material: THREE.MeshBasicMaterial) => Effect.Effect<A, E>
): Effect.Effect<A, E | MaterialError> =>
  Effect.acquireUseRelease(createMeshBasicMaterial(params), f, (material) => Effect.sync(() => material.dispose()))

/**
 * Material手動dispose
 */
export const disposeMeshBasicMaterial = (material: THREE.MeshBasicMaterial): Effect.Effect<void, never> =>
  Effect.sync(() => material.dispose())

/**
 * Material更新
 */
export const updateMeshBasicMaterial = (
  material: THREE.MeshBasicMaterial,
  updates: Partial<{ color: Color; opacity: number; wireframe: boolean }>
): Effect.Effect<void, never> =>
  Effect.sync(() => {
    if (updates.color !== undefined) {
      material.color.copy(toThreeColor(updates.color))
    }
    if (updates.opacity !== undefined) {
      material.opacity = updates.opacity
    }
    if (updates.wireframe !== undefined) {
      material.wireframe = updates.wireframe
    }
    material.needsUpdate = true
  })
