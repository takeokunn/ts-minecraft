/**
 * @fileoverview Container Repository LocalStorage用Schema定義
 * localStorage読み書き時の型安全性を保証
 */

import { Schema } from 'effect'

/**
 * LocalStorage保存用のContainerSlot型定義
 * Brand型は一度プリミティブ型に変換してから保存
 */
const ContainerSlotStorageSchema = Schema.Union(
  Schema.Null,
  Schema.Struct({
    itemStack: Schema.optional(
      Schema.Struct({
        itemId: Schema.String, // ItemId Brand解除
        quantity: Schema.Number.pipe(Schema.int(), Schema.positive()),
        durability: Schema.optional(Schema.Number.pipe(Schema.between(0, 1))),
        metadata: Schema.optional(Schema.Unknown),
      })
    ),
    locked: Schema.optional(Schema.Boolean),
    metadata: Schema.optional(Schema.Unknown),
  })
)

/**
 * LocalStorage保存用のContainer型定義
 * Brand型をプリミティブ型に変換した形式
 */
export const ContainerStorageDataSchema = Schema.Struct({
  id: Schema.String, // ContainerId Brand解除
  type: Schema.Literal(
    'chest',
    'double_chest',
    'furnace',
    'blast_furnace',
    'smoker',
    'brewing_stand',
    'enchanting_table',
    'anvil',
    'crafting_table',
    'shulker_box',
    'ender_chest',
    'hopper',
    'dispenser',
    'dropper'
  ),
  ownerId: Schema.optional(Schema.String), // PlayerId Brand解除
  worldId: Schema.optional(Schema.String),
  position: Schema.optional(
    Schema.Struct({
      x: Schema.Number,
      y: Schema.Number,
      z: Schema.Number,
    })
  ),
  capacity: Schema.Number.pipe(Schema.int(), Schema.positive()),
  slots: Schema.Record({
    key: Schema.String, // Map keyは文字列化されている
    value: ContainerSlotStorageSchema,
  }),
  permissions: Schema.optional(
    Schema.Struct({
      public: Schema.optional(Schema.Boolean),
      owner: Schema.optional(Schema.String), // PlayerId Brand解除
      allowedPlayers: Schema.optional(Schema.Array(Schema.String)), // PlayerId[] Brand解除
    })
  ),
  lastAccessed: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())), // timestamp
  version: Schema.Number.pipe(Schema.int(), Schema.positive()),
})

export type ContainerStorageData = Schema.Schema.Type<typeof ContainerStorageDataSchema>

/**
 * LocalStorage全体保存形式
 * containerとsnapshotの両方を含む
 */
export const ContainerRepositoryStorageSchema = Schema.Struct({
  containers: Schema.optional(
    Schema.Record({
      key: Schema.String,
      value: ContainerStorageDataSchema,
    })
  ),
  snapshots: Schema.optional(
    Schema.Record({
      key: Schema.String,
      value: Schema.Struct({
        id: Schema.String,
        name: Schema.String,
        containerId: Schema.String,
        container: ContainerStorageDataSchema,
        createdAt: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
      }),
    })
  ),
  version: Schema.Number.pipe(Schema.int(), Schema.positive()),
  lastSaved: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
})

export type ContainerRepositoryStorage = Schema.Schema.Type<typeof ContainerRepositoryStorageSchema>
