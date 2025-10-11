/**
 * @fileoverview CANNON.Material Schema定義
 *
 * CANNON.Materialオブジェクトの型安全なラッパー。
 */

import * as CANNON from 'cannon-es'
import { Schema } from 'effect'
import { unsafeCoerce } from 'effect/Function'

/**
 * CANNON.Material Brand型
 */
export const CannonMaterialSchema = Schema.Unknown.pipe(Schema.brand('CannonMaterial'))

export type CannonMaterial = Schema.Schema.Type<typeof CannonMaterialSchema>

/**
 * CANNON.MaterialをCannonMaterial型に安全に変換
 *
 * @param material - CANNON.Materialオブジェクト
 * @returns CannonMaterial Brand型
 */
export const makeCannonMaterialUnsafe = (material: CANNON.Material): CannonMaterial =>
  unsafeCoerce<CANNON.Material, CannonMaterial>(material)

/**
 * CannonMaterialを元のCANNON.Materialに変換
 *
 * @param material - CannonMaterial Brand型
 * @returns CANNON.Materialオブジェクト
 */
export const toCannonMaterial = (material: CannonMaterial): CANNON.Material =>
  unsafeCoerce<CannonMaterial, CANNON.Material>(material)
