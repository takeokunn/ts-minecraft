/**
 * @fileoverview Three.js Infrastructure - Error Definitions
 * Three.jsラッパーで使用するエラークラス定義
 */

import { Schema } from 'effect'
import { makeErrorFactory } from '@shared/schema/tagged_error_factory'

import { ErrorCauseSchema } from '@/shared/schema/error'

/**
 * Geometry生成時のエラー
 */
export const GeometryErrorSchema = Schema.TaggedError('GeometryError', {
  type: Schema.String,
  cause: ErrorCauseSchema,
})
export type GeometryError = Schema.Schema.Type<typeof GeometryErrorSchema>
export const GeometryError = makeErrorFactory(GeometryErrorSchema)

/**
 * Material生成時のエラー
 */
export const MaterialErrorSchema = Schema.TaggedError('MaterialError', {
  type: Schema.String,
  cause: ErrorCauseSchema,
})
export type MaterialError = Schema.Schema.Type<typeof MaterialErrorSchema>
export const MaterialError = makeErrorFactory(MaterialErrorSchema)

/**
 * Texture操作時のエラー
 */
export const TextureErrorSchema = Schema.TaggedError('TextureError', {
  operation: Schema.Literal('load', 'create'),
  path: Schema.optional(Schema.String),
  cause: ErrorCauseSchema,
})
export type TextureError = Schema.Schema.Type<typeof TextureErrorSchema>
export const TextureError = makeErrorFactory(TextureErrorSchema)

/**
 * Scene操作時のエラー
 */
export const SceneErrorSchema = Schema.TaggedError('SceneError', {
  operation: Schema.String,
  cause: ErrorCauseSchema,
})
export type SceneError = Schema.Schema.Type<typeof SceneErrorSchema>
export const SceneError = makeErrorFactory(SceneErrorSchema)

/**
 * Camera操作時のエラー
 */
export const CameraErrorSchema = Schema.TaggedError('CameraError', {
  type: Schema.String,
  cause: ErrorCauseSchema,
})
export type CameraError = Schema.Schema.Type<typeof CameraErrorSchema>
export const CameraError = makeErrorFactory(CameraErrorSchema)

/**
 * Light操作時のエラー
 */
export const LightErrorSchema = Schema.TaggedError('LightError', {
  type: Schema.String,
  cause: ErrorCauseSchema,
})
export type LightError = Schema.Schema.Type<typeof LightErrorSchema>
export const LightError = makeErrorFactory(LightErrorSchema)

/**
 * Renderer操作時のエラー
 */
export const RendererErrorSchema = Schema.TaggedError('RendererError', {
  operation: Schema.String,
  cause: ErrorCauseSchema,
})
export type RendererError = Schema.Schema.Type<typeof RendererErrorSchema>
export const RendererError = makeErrorFactory(RendererErrorSchema)
