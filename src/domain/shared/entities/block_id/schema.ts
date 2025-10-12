import { Schema } from 'effect'

/**
 * BlockId - 文字列型のブロックID
 *
 * ブロック定義の識別子として使用される文字列型。
 * 小文字、数字、アンダースコアのみ許可。
 *
 * 注意: chunk_metadata内部では数値型のBlockTypeIdを使用
 */
export const BlockIdSchema = Schema.String.pipe(
  Schema.trimmed(),
  Schema.pattern(/^[a-z0-9_]+$/),
  Schema.minLength(1),
  Schema.maxLength(64),
  Schema.brand('BlockId'),
  Schema.annotations({
    title: 'BlockId',
    description: '小文字・数字・アンダースコアのみ許容されるブロックID',
  })
)

export type BlockId = Schema.Schema.Type<typeof BlockIdSchema>
