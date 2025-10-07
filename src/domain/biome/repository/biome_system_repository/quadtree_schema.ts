/**
 * QuadTree Schema - 再帰的QuadTreeノード構造の型定義
 *
 * 完全不変・構造共有による効率的な空間インデックス
 * Schema.suspendによる再帰構造の型安全性を保証
 */

import { BiomeIdSchema } from '@/domain/biome/value_object/biome_id'
import { WorldXSchema, WorldZSchema } from '@/domain/biome/value_object/coordinates/world_coordinate'
import { Schema } from 'effect'

// === Spatial Types ===

/**
 * 空間座標 (2D)
 */
export const SpatialCoordinateSchema = Schema.Struct({
  x: WorldXSchema,
  z: WorldZSchema,
}).pipe(
  Schema.annotations({
    identifier: 'SpatialCoordinate',
    title: 'Spatial Coordinate (2D)',
    description: '2D spatial coordinate in world space',
  })
)

export type SpatialCoordinate = Schema.Schema.Type<typeof SpatialCoordinateSchema>

/**
 * 空間境界 (2D Bounding Box)
 */
export const SpatialBoundsSchema = Schema.Struct({
  minX: WorldXSchema,
  minZ: WorldZSchema,
  maxX: WorldXSchema,
  maxZ: WorldZSchema,
}).pipe(
  Schema.annotations({
    identifier: 'SpatialBounds',
    title: 'Spatial Bounds (2D)',
    description: '2D bounding box in world space',
  })
)

export type SpatialBounds = Schema.Schema.Type<typeof SpatialBoundsSchema>

/**
 * バイオーム配置情報
 */
export const BiomePlacementSchema = Schema.Struct({
  biomeId: BiomeIdSchema,
  coordinate: SpatialCoordinateSchema,
  radius: Schema.Number.pipe(Schema.positive()),
  priority: Schema.Number,
  placedAt: Schema.Date,
  metadata: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
}).pipe(
  Schema.annotations({
    identifier: 'BiomePlacement',
    title: 'Biome Placement',
    description: 'Biome placement data with spatial information',
  })
)

export type BiomePlacement = Schema.Schema.Type<typeof BiomePlacementSchema>

// === QuadTree Node Schema (Recursive) ===

/**
 * QuadTreeノード - 再帰的構造定義
 *
 * Schema.suspendを使用して自己参照型を実現
 * 完全不変で構造共有により効率的なメモリ使用
 */
export class QuadTreeNodeSchema extends Schema.Class<QuadTreeNodeSchema>('QuadTreeNode')({
  bounds: SpatialBoundsSchema,
  biomes: Schema.Array(BiomePlacementSchema),
  isLeaf: Schema.Boolean,
  children: Schema.optional(
    Schema.Tuple(
      Schema.suspend((): Schema.Schema<QuadTreeNode> => QuadTreeNodeSchema),
      Schema.suspend((): Schema.Schema<QuadTreeNode> => QuadTreeNodeSchema),
      Schema.suspend((): Schema.Schema<QuadTreeNode> => QuadTreeNodeSchema),
      Schema.suspend((): Schema.Schema<QuadTreeNode> => QuadTreeNodeSchema)
    )
  ),
}) {}

export type QuadTreeNode = Schema.Schema.Type<typeof QuadTreeNodeSchema>

/**
 * QuadTree状態 - Refで管理される不変状態
 */
export const QuadTreeStateSchema = Schema.Struct({
  root: QuadTreeNodeSchema,
  maxDepth: Schema.Number.pipe(Schema.int(), Schema.between(1, 20)),
  maxEntries: Schema.Number.pipe(Schema.int(), Schema.between(1, 128)),
}).pipe(
  Schema.annotations({
    identifier: 'QuadTreeState',
    title: 'QuadTree State',
    description: 'Immutable QuadTree state with configuration',
  })
)

export type QuadTreeState = Schema.Schema.Type<typeof QuadTreeStateSchema>
