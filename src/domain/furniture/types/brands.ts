import { Schema } from '@effect/schema'

/**
 * furnitureドメイン用のブランド型定義
 */

/**
 * プレイヤーID用のブランド型
 * 文字列だが他の文字列と区別される
 */
export const PlayerIdSchema = Schema.String.pipe(
  Schema.filter((s) => s.length > 0, {
    message: () => 'PlayerId cannot be empty',
  }),
  Schema.nonEmptyString(),
  Schema.brand('PlayerId'),
  Schema.annotations({
    title: 'PlayerId',
    description: 'Unique identifier for a player',
  })
)
export type PlayerId = Schema.Schema.Type<typeof PlayerIdSchema>

/**
 * Vector3D用のブランド型
 * 3次元ベクトルを表現
 */
export const Vector3Schema = Schema.Struct({
  x: Schema.Number.pipe(Schema.finite()),
  y: Schema.Number.pipe(Schema.finite()),
  z: Schema.Number.pipe(Schema.finite()),
}).pipe(
  Schema.brand('Vector3D'),
  Schema.annotations({
    title: 'Vector3D',
    description: '3D vector with x, y, z components',
  })
)
export type Vector3D = Schema.Schema.Type<typeof Vector3Schema>
