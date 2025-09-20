import { Schema } from "effect"

/**
 * 基本的なゲームエラー
 */
export const GameErrorSchema = Schema.Struct({
  _tag: Schema.Literal("GameError"),
  message: Schema.String,
  code: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.Unknown)
})

export type GameError = Schema.Schema.Type<typeof GameErrorSchema>

export const GameError = (params: Omit<GameError, "_tag">): GameError => ({
  _tag: "GameError" as const,
  ...params
})

/**
 * 無効な状態エラー
 * ゲーム状態が期待と異なる場合に発生
 */
export const InvalidStateErrorSchema = Schema.Struct({
  _tag: Schema.Literal("InvalidStateError"),
  message: Schema.String,
  currentState: Schema.String,
  expectedState: Schema.String,
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown }))
})

export type InvalidStateError = Schema.Schema.Type<typeof InvalidStateErrorSchema>

export const InvalidStateError = (params: Omit<InvalidStateError, "_tag">): InvalidStateError => ({
  _tag: "InvalidStateError" as const,
  ...params
})

/**
 * リソース未発見エラー
 * テクスチャやモデル等のリソースが見つからない場合
 */
export const ResourceNotFoundErrorSchema = Schema.Struct({
  _tag: Schema.Literal("ResourceNotFoundError"),
  message: Schema.String,
  resourceType: Schema.String,
  resourceId: Schema.String,
  searchPath: Schema.optional(Schema.String)
})

export type ResourceNotFoundError = Schema.Schema.Type<typeof ResourceNotFoundErrorSchema>

export const ResourceNotFoundError = (params: Omit<ResourceNotFoundError, "_tag">): ResourceNotFoundError => ({
  _tag: "ResourceNotFoundError" as const,
  ...params
})

/**
 * バリデーションエラー
 * 入力値や設定値が不正な場合
 */
export const ValidationErrorSchema = Schema.Struct({
  _tag: Schema.Literal("ValidationError"),
  message: Schema.String,
  field: Schema.String,
  value: Schema.Unknown,
  constraints: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown }))
})

export type ValidationError = Schema.Schema.Type<typeof ValidationErrorSchema>

export const ValidationError = (params: Omit<ValidationError, "_tag">): ValidationError => ({
  _tag: "ValidationError" as const,
  ...params
})

/**
 * パフォーマンスエラー
 * FPS低下やメモリ不足等の性能問題
 */
export const PerformanceErrorSchema = Schema.Struct({
  _tag: Schema.Literal("PerformanceError"),
  message: Schema.String,
  metric: Schema.String,
  currentValue: Schema.Number,
  threshold: Schema.Number,
  severity: Schema.Union(
    Schema.Literal("warning"),
    Schema.Literal("critical")
  )
})

export type PerformanceError = Schema.Schema.Type<typeof PerformanceErrorSchema>

export const PerformanceError = (params: Omit<PerformanceError, "_tag">): PerformanceError => ({
  _tag: "PerformanceError" as const,
  ...params
})

/**
 * 設定エラー
 * ゲーム設定の読み込みや適用に失敗
 */
export const ConfigErrorSchema = Schema.Struct({
  _tag: Schema.Literal("ConfigError"),
  message: Schema.String,
  configKey: Schema.String,
  configValue: Schema.optional(Schema.Unknown),
  expectedType: Schema.optional(Schema.String)
})

export type ConfigError = Schema.Schema.Type<typeof ConfigErrorSchema>

export const ConfigError = (params: Omit<ConfigError, "_tag">): ConfigError => ({
  _tag: "ConfigError" as const,
  ...params
})

/**
 * レンダリングエラー
 * WebGLやキャンバス描画のエラー
 */
export const RenderErrorSchema = Schema.Struct({
  _tag: Schema.Literal("RenderError"),
  message: Schema.String,
  component: Schema.String,
  phase: Schema.Union(
    Schema.Literal("initialization"),
    Schema.Literal("update"),
    Schema.Literal("render"),
    Schema.Literal("cleanup")
  ),
  gpuInfo: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown }))
})

export type RenderError = Schema.Schema.Type<typeof RenderErrorSchema>

export const RenderError = (params: Omit<RenderError, "_tag">): RenderError => ({
  _tag: "RenderError" as const,
  ...params
})

/**
 * ワールド生成エラー
 * チャンクやバイオームの生成失敗
 */
export const WorldGenerationErrorSchema = Schema.Struct({
  _tag: Schema.Literal("WorldGenerationError"),
  message: Schema.String,
  chunkX: Schema.Number,
  chunkZ: Schema.Number,
  generationType: Schema.String,
  seed: Schema.optional(Schema.Number)
})

export type WorldGenerationError = Schema.Schema.Type<typeof WorldGenerationErrorSchema>

export const WorldGenerationError = (params: Omit<WorldGenerationError, "_tag">): WorldGenerationError => ({
  _tag: "WorldGenerationError" as const,
  ...params
})

/**
 * エンティティエラー
 * プレイヤーやMob関連のエラー
 */
export const EntityErrorSchema = Schema.Struct({
  _tag: Schema.Literal("EntityError"),
  message: Schema.String,
  entityId: Schema.String,
  entityType: Schema.String,
  operation: Schema.String,
  position: Schema.optional(Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number
  }))
})

export type EntityError = Schema.Schema.Type<typeof EntityErrorSchema>

export const EntityError = (params: Omit<EntityError, "_tag">): EntityError => ({
  _tag: "EntityError" as const,
  ...params
})

/**
 * 物理エンジンエラー
 * 衝突判定や重力計算のエラー
 */
export const PhysicsErrorSchema = Schema.Struct({
  _tag: Schema.Literal("PhysicsError"),
  message: Schema.String,
  calculationType: Schema.String,
  affectedEntities: Schema.optional(Schema.Array(Schema.String)),
  deltaTime: Schema.optional(Schema.Number)
})

export type PhysicsError = Schema.Schema.Type<typeof PhysicsErrorSchema>

export const PhysicsError = (params: Omit<PhysicsError, "_tag">): PhysicsError => ({
  _tag: "PhysicsError" as const,
  ...params
})

/**
 * すべてのゲームエラーのユニオン型
 */
export const GameErrorUnion = Schema.Union(
  GameErrorSchema,
  InvalidStateErrorSchema,
  ResourceNotFoundErrorSchema,
  ValidationErrorSchema,
  PerformanceErrorSchema,
  ConfigErrorSchema,
  RenderErrorSchema,
  WorldGenerationErrorSchema,
  EntityErrorSchema,
  PhysicsErrorSchema
)

export type AnyGameError = Schema.Schema.Type<typeof GameErrorUnion>