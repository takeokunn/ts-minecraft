/**
 * @fileoverview Three.js MeshStandardMaterial - Effect-TS Wrapper
 * MeshStandardMaterialのEffect-TSラッパー実装
 */

import { Effect, Match, Option, Schema } from 'effect'
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
const sideToThreeSide = (side?: 'front' | 'back' | 'double'): THREE.Side =>
  Match.value(side).pipe(
    Match.when((value) => value === undefined || value === 'front', () => THREE.FrontSide),
    Match.when('back', () => THREE.BackSide),
    Match.orElse(() => THREE.DoubleSide),
    Match.exhaustive
  )

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
    catch: (error) =>
      MaterialError.make({
        type: 'MeshStandardMaterial',
        cause: error,
      }),
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
    Option.match(Option.fromNullable(updates.color), {
      onSome: (color) => material.color.copy(toThreeColor(color)),
      onNone: () => undefined,
    })
    Option.match(Option.fromNullable(updates.metalness), {
      onSome: (value) => {
        material.metalness = value
      },
      onNone: () => undefined,
    })
    Option.match(Option.fromNullable(updates.roughness), {
      onSome: (value) => {
        material.roughness = value
      },
      onNone: () => undefined,
    })
    Option.match(Option.fromNullable(updates.opacity), {
      onSome: (value) => {
        material.opacity = value
      },
      onNone: () => undefined,
    })
    Option.match(Option.fromNullable(updates.wireframe), {
      onSome: (value) => {
        material.wireframe = value
      },
      onNone: () => undefined,
    })
    Option.match(Option.fromNullable(updates.emissive), {
      onSome: (color) => material.emissive.copy(toThreeColor(color)),
      onNone: () => undefined,
    })
    Option.match(Option.fromNullable(updates.emissiveIntensity), {
      onSome: (value) => {
        material.emissiveIntensity = value
      },
      onNone: () => undefined,
    })
    material.needsUpdate = true
  })
