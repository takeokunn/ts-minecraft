import { Schema } from "effect"

/**
 * 基本的なゲームエラー
 */
export class GameError extends Schema.TaggedError<GameError>()(
  "GameError",
  {
    message: Schema.String,
    code: Schema.optional(Schema.String),
    cause: Schema.optional(Schema.Unknown)
  }
) {}

/**
 * 無効な状態エラー
 * ゲーム状態が期待と異なる場合に発生
 */
export class InvalidStateError extends Schema.TaggedError<InvalidStateError>()(
  "InvalidStateError",
  {
    message: Schema.String,
    currentState: Schema.String,
    expectedState: Schema.String,
    context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown }))
  }
) {}

/**
 * リソース未発見エラー
 * テクスチャやモデル等のリソースが見つからない場合
 */
export class ResourceNotFoundError extends Schema.TaggedError<ResourceNotFoundError>()(
  "ResourceNotFoundError",
  {
    message: Schema.String,
    resourceType: Schema.String,
    resourceId: Schema.String,
    searchPath: Schema.optional(Schema.String)
  }
) {}

/**
 * バリデーションエラー
 * 入力値や設定値が不正な場合
 */
export class ValidationError extends Schema.TaggedError<ValidationError>()(
  "ValidationError",
  {
    message: Schema.String,
    field: Schema.String,
    value: Schema.Unknown,
    constraints: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown }))
  }
) {}

/**
 * パフォーマンスエラー
 * FPS低下やメモリ不足等の性能問題
 */
export class PerformanceError extends Schema.TaggedError<PerformanceError>()(
  "PerformanceError",
  {
    message: Schema.String,
    metric: Schema.String,
    currentValue: Schema.Number,
    threshold: Schema.Number,
    severity: Schema.Union(
      Schema.Literal("warning"),
      Schema.Literal("critical")
    )
  }
) {}

/**
 * 設定エラー
 * ゲーム設定の読み込みや適用に失敗
 */
export class ConfigError extends Schema.TaggedError<ConfigError>()(
  "ConfigError",
  {
    message: Schema.String,
    configKey: Schema.String,
    configValue: Schema.optional(Schema.Unknown),
    expectedType: Schema.optional(Schema.String)
  }
) {}

/**
 * レンダリングエラー
 * WebGLやキャンバス描画のエラー
 */
export class RenderError extends Schema.TaggedError<RenderError>()(
  "RenderError",
  {
    message: Schema.String,
    component: Schema.String,
    phase: Schema.Union(
      Schema.Literal("initialization"),
      Schema.Literal("update"),
      Schema.Literal("render"),
      Schema.Literal("cleanup")
    ),
    gpuInfo: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown }))
  }
) {}

/**
 * ワールド生成エラー
 * チャンクやバイオームの生成失敗
 */
export class WorldGenerationError extends Schema.TaggedError<WorldGenerationError>()(
  "WorldGenerationError",
  {
    message: Schema.String,
    chunkX: Schema.Number,
    chunkZ: Schema.Number,
    generationType: Schema.String,
    seed: Schema.optional(Schema.Number)
  }
) {}

/**
 * エンティティエラー
 * プレイヤーやMob関連のエラー
 */
export class EntityError extends Schema.TaggedError<EntityError>()(
  "EntityError",
  {
    message: Schema.String,
    entityId: Schema.String,
    entityType: Schema.String,
    operation: Schema.String,
    position: Schema.optional(Schema.Struct({
      x: Schema.Number,
      y: Schema.Number,
      z: Schema.Number
    }))
  }
) {}

/**
 * 物理エンジンエラー
 * 衝突判定や重力計算のエラー
 */
export class PhysicsError extends Schema.TaggedError<PhysicsError>()(
  "PhysicsError",
  {
    message: Schema.String,
    calculationType: Schema.String,
    affectedEntities: Schema.optional(Schema.Array(Schema.String)),
    deltaTime: Schema.optional(Schema.Number)
  }
) {}