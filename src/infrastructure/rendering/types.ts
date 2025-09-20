import { Schema } from 'effect'

/**
 * レンダラー初期化エラー
 * WebGLコンテキストの作成失敗
 */
export const RenderInitErrorSchema = Schema.Struct({
  _tag: Schema.Literal('RenderInitError'),
  message: Schema.String,
  canvas: Schema.optional(Schema.Unknown),
  context: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.Unknown),
})

export type RenderInitError = Schema.Schema.Type<typeof RenderInitErrorSchema>

export const RenderInitError = (params: Omit<RenderInitError, '_tag'>): RenderInitError => ({
  _tag: 'RenderInitError' as const,
  ...params,
})

/**
 * レンダリング実行エラー
 * フレーム描画時のエラー
 */
export const RenderExecutionErrorSchema = Schema.Struct({
  _tag: Schema.Literal('RenderExecutionError'),
  message: Schema.String,
  operation: Schema.String,
  sceneId: Schema.optional(Schema.String),
  cameraType: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.Unknown),
})

export type RenderExecutionError = Schema.Schema.Type<typeof RenderExecutionErrorSchema>

export const RenderExecutionError = (params: Omit<RenderExecutionError, '_tag'>): RenderExecutionError => ({
  _tag: 'RenderExecutionError' as const,
  ...params,
})

/**
 * WebGLコンテキストロストエラー
 * WebGLコンテキストが失われた場合
 */
export const ContextLostErrorSchema = Schema.Struct({
  _tag: Schema.Literal('ContextLostError'),
  message: Schema.String,
  canRestore: Schema.Boolean,
  lostTime: Schema.Number,
  cause: Schema.optional(Schema.Unknown),
})

export type ContextLostError = Schema.Schema.Type<typeof ContextLostErrorSchema>

export const ContextLostError = (params: Omit<ContextLostError, '_tag'>): ContextLostError => ({
  _tag: 'ContextLostError' as const,
  ...params,
})

/**
 * レンダーターゲットエラー
 * レンダーターゲットの操作エラー
 */
export const RenderTargetErrorSchema = Schema.Struct({
  _tag: Schema.Literal('RenderTargetError'),
  message: Schema.String,
  targetType: Schema.String,
  width: Schema.Number,
  height: Schema.Number,
  format: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.Unknown),
})

export type RenderTargetError = Schema.Schema.Type<typeof RenderTargetErrorSchema>

export const RenderTargetError = (params: Omit<RenderTargetError, '_tag'>): RenderTargetError => ({
  _tag: 'RenderTargetError' as const,
  ...params,
})

/**
 * すべてのレンダリングエラーのユニオン型
 */
export const RenderErrorUnion = Schema.Union(
  RenderInitErrorSchema,
  RenderExecutionErrorSchema,
  ContextLostErrorSchema,
  RenderTargetErrorSchema
)

export type RenderError = Schema.Schema.Type<typeof RenderErrorUnion>
