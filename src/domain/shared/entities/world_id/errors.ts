import { Effect, Schema } from 'effect'

/**
 * WorldIdエラー
 */
export const WorldIdErrorSchema = Schema.TaggedStruct('WorldIdError', {
  message: Schema.String,
  value: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}).pipe(
  Schema.annotations({
    title: 'WorldId Error',
    description: 'Error when WorldId validation or creation fails',
  })
)

export type WorldIdError = Schema.Schema.Type<typeof WorldIdErrorSchema>

/**
 * WorldIdエラーメッセージ取得
 */
export const getWorldIdErrorMessage = (error: WorldIdError): string => error.message

/**
 * WorldIdエラー生成
 */
export const createWorldIdError = (
  message: string,
  value: string,
  cause?: unknown
): Effect.Effect<WorldIdError, Schema.ParseError> =>
  Schema.decode(WorldIdErrorSchema)({
    _tag: 'WorldIdError' as const,
    message,
    value,
    cause,
  })

/**
 * WorldIdエラー型ガード
 */
export const isWorldIdError = (error: unknown): error is WorldIdError => Schema.is(WorldIdErrorSchema)(error)
