import { Schema } from 'effect'

/**
 * ItemId - 文字列型のアイテムID
 *
 * アイテム定義の識別子として使用される文字列型。
 * "namespace:name"形式（例: "minecraft:diamond_sword"）
 */
export const ItemIdSchema = Schema.String.pipe(
  Schema.nonEmptyString(),
  Schema.pattern(/^[a-z0-9._-]+:[a-z0-9/_-]+$/),
  Schema.filter(
    (value) => {
      const parts = value.split(':')
      return parts.length === 2 && parts[0].length > 0 && parts[1].length > 0
    },
    {
      message: () => 'ItemId must be in format "namespace:name"',
    }
  ),
  Schema.brand('ItemId'),
  Schema.annotations({
    title: 'ItemId',
    description: 'アイテムID（namespace:name形式）',
  })
)

export type ItemId = Schema.Schema.Type<typeof ItemIdSchema>

/**
 * 簡易版ItemId - パターン制約なし
 * 既存コードとの互換性のため
 */
export const SimpleItemIdSchema = Schema.String.pipe(Schema.pattern(/^[a-z0-9_:-]+$/i), Schema.brand('ItemId'))
