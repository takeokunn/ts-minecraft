import { Schema } from '@effect/schema'

/**
 * infrastructure/rendering用のブランド型定義
 */

/**
 * UV座標用のブランド型
 */
export const UVCoordinateSchema = Schema.Number.pipe(
  Schema.between(0, 1),
  Schema.brand('UVCoordinate'),
  Schema.annotations({
    title: 'UVCoordinate',
    description: 'Texture coordinate value (0-1)',
  })
)
export const UVCoordinate = UVCoordinateSchema
export type UVCoordinate = Schema.Schema.Type<typeof UVCoordinateSchema>

/**
 * AmbientOcclusion値用のブランド型
 */
export const AOValueSchema = Schema.Number.pipe(
  Schema.between(0, 1),
  Schema.brand('AOValue'),
  Schema.annotations({
    title: 'AOValue',
    description: 'Ambient occlusion value (0-1)',
  })
)
export const AOValue = AOValueSchema
export type AOValue = Schema.Schema.Type<typeof AOValueSchema>

/**
 * メッシュ寸法用のブランド型
 */
export const MeshDimensionSchema = Schema.Number.pipe(
  Schema.positive(),
  Schema.brand('MeshDimension'),
  Schema.annotations({
    title: 'MeshDimension',
    description: 'Mesh dimension value (positive number)',
  })
)
export const MeshDimension = MeshDimensionSchema
export type MeshDimension = Schema.Schema.Type<typeof MeshDimensionSchema>

/**
 * ブランド型ヘルパー
 */
export const BrandedTypes = {
  UVCoordinate: UVCoordinateSchema,
  AOValue: AOValueSchema,
  MeshDimension: MeshDimensionSchema,

  // 作成ヘルパー関数
  createUVCoordinate: (coord: number): UVCoordinate => Schema.decodeSync(UVCoordinateSchema)(coord),
  createAOValue: (value: number): AOValue => Schema.decodeSync(AOValueSchema)(value),
  createMeshDimension: (dimension: number): MeshDimension => Schema.decodeSync(MeshDimensionSchema)(dimension),
}
