import { Schema } from 'effect'

/**
 * BlockTypeId - 数値型のブロックタイプID
 *
 * chunk_metadata内部で使用される数値型のブロック識別子。
 * パフォーマンス最適化のため、チャンクデータ内では数値型を使用。
 *
 * 注意: 文字列型のBlockIdとは異なる概念
 */
export const BlockTypeIdSchema = Schema.Number.pipe(Schema.int(), Schema.nonNegative(), Schema.brand('BlockTypeId'))

export type BlockTypeId = Schema.Schema.Type<typeof BlockTypeIdSchema>
