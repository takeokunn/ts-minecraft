/**
 * @fileoverview Three.js Infrastructure - Error Definitions
 * Three.jsラッパーで使用するエラークラス定義
 */

import { Schema } from 'effect'

/**
 * Geometry生成時のエラー
 */
export class GeometryError extends Schema.TaggedError<GeometryError>()('GeometryError', {
  type: Schema.String,
  cause: Schema.Unknown,
}) {}

/**
 * Material生成時のエラー
 */
export class MaterialError extends Schema.TaggedError<MaterialError>()('MaterialError', {
  type: Schema.String,
  cause: Schema.Unknown,
}) {}

/**
 * Texture操作時のエラー
 */
export class TextureError extends Schema.TaggedError<TextureError>()('TextureError', {
  operation: Schema.Literal('load', 'create'),
  path: Schema.optional(Schema.String),
  cause: Schema.Unknown,
}) {}

/**
 * Scene操作時のエラー
 */
export class SceneError extends Schema.TaggedError<SceneError>()('SceneError', {
  operation: Schema.String,
  cause: Schema.Unknown,
}) {}

/**
 * Camera操作時のエラー
 */
export class CameraError extends Schema.TaggedError<CameraError>()('CameraError', {
  type: Schema.String,
  cause: Schema.Unknown,
}) {}

/**
 * Light操作時のエラー
 */
export class LightError extends Schema.TaggedError<LightError>()('LightError', {
  type: Schema.String,
  cause: Schema.Unknown,
}) {}

/**
 * Renderer操作時のエラー
 */
export class RendererError extends Schema.TaggedError<RendererError>()('RendererError', {
  operation: Schema.String,
  cause: Schema.Unknown,
}) {}
