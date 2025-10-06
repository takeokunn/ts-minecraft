/**
 * @fileoverview Three.js MeshStandardMaterial - Effect-TS Wrapper
 * MeshStandardMaterialのEffect-TSラッパー実装
 */

import { Effect, Schema } from 'effect'
import * as THREE from 'three'
import { ColorSchema, toThreeColor, type Color } from '../core/color'
import { MaterialError } from '../errors'

/**
 * MeshStandardMaterial Parameters Schema
 */
export const MeshStandardMaterialParamsSchema = Schema.Struct({
  color: Schema.optional(ColorSchema),
  metalness: Schema.optional(Schema.Number.pipe(Schema.between(0, 1))),
  roughness: Schema.optional(Schema.Number.pipe(Schema.between(0, 1))),
  opacity: Schema.optional(Schema.Number.pipe(Schema.between(0, 1))),
  transparent: Schema.optional(Schema.Boolean),
  side: Schema.optional(Schema.Literal('front', 'back', 'double')),
  wireframe: Schema.optional(Schema.Boolean),
  visible: Schema.optional(Schema.Boolean),
  emissive: Schema.optional(ColorSchema),
  emissiveIntensity: Schema.optional(Schema.Number.pipe(Schema.nonNegative())),
})

export type MeshStandardMaterialParams = Schema.Schema.Type<typeof MeshStandardMaterialParamsSchema>

/**
 * Side定数変換
 */
const sideToThreeSide = (side?: 'front' | 'back' | 'double'): THREE.Side => {
  if (!side || side === 'front') return THREE.FrontSide
  if (side === 'back') return THREE.BackSide
  return THREE.DoubleSide
}

/**
 * MeshStandardMaterial生成
 */
export const createMeshStandardMaterial = (
  params: MeshStandardMaterialParams
): Effect.Effect<THREE.MeshStandardMaterial, MaterialError> =>
  Effect.try({
    try: () =>
      new THREE.MeshStandardMaterial({
        color: params.color ? toThreeColor(params.color) : undefined,
        metalness: params.metalness,
        roughness: params.roughness,
        opacity: params.opacity,
        transparent: params.transparent,
        side: sideToThreeSide(params.side),
        wireframe: params.wireframe,
        visible: params.visible,
        emissive: params.emissive ? toThreeColor(params.emissive) : undefined,
        emissiveIntensity: params.emissiveIntensity,
      }),
    catch: (error) => new MaterialError({ type: 'MeshStandardMaterial', cause: error }),
  })

/**
 * Effect.Scopeによるリソース管理付きMaterial生成
 */
export const withMeshStandardMaterial = <A, E>(
  params: MeshStandardMaterialParams,
  f: (material: THREE.MeshStandardMaterial) => Effect.Effect<A, E>
): Effect.Effect<A, E | MaterialError> =>
  Effect.acquireUseRelease(createMeshStandardMaterial(params), f, (material) => Effect.sync(() => material.dispose()))

/**
 * Material手動dispose
 */
export const disposeMeshStandardMaterial = (material: THREE.MeshStandardMaterial): Effect.Effect<void, never> =>
  Effect.sync(() => material.dispose())

/**
 * Material更新
 */
export const updateMeshStandardMaterial = (
  material: THREE.MeshStandardMaterial,
  updates: Partial<{
    color: Color
    metalness: number
    roughness: number
    opacity: number
    wireframe: boolean
    emissive: Color
    emissiveIntensity: number
  }>
): Effect.Effect<void, never> =>
  Effect.sync(() => {
    if (updates.color !== undefined) {
      material.color.copy(toThreeColor(updates.color))
    }
    if (updates.metalness !== undefined) {
      material.metalness = updates.metalness
    }
    if (updates.roughness !== undefined) {
      material.roughness = updates.roughness
    }
    if (updates.opacity !== undefined) {
      material.opacity = updates.opacity
    }
    if (updates.wireframe !== undefined) {
      material.wireframe = updates.wireframe
    }
    if (updates.emissive !== undefined) {
      material.emissive.copy(toThreeColor(updates.emissive))
    }
    if (updates.emissiveIntensity !== undefined) {
      material.emissiveIntensity = updates.emissiveIntensity
    }
    material.needsUpdate = true
  })
