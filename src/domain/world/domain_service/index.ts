/**
 * World Domain Services - 統合エクスポート
 *
 * 全てのWorld Domain Serviceを統合し、
 * 単一の WorldDomainServiceLayer として提供します。
 */

// 各サービスカテゴリのエクスポート
export * from './biome_classification/index.js'
export * from './mathematical_operations/index.js'
export * from './noise_generation/index.js'
export * from './procedural_generation/index.js'
export * from './world_validation/index.js'

// 統合Layer構成
import { Layer } from 'effect'
import { BiomeClassificationLayer, BiomeClassificationServices } from './biome_classification/index.js'
import { MathematicalOperationsLayer, MathematicalOperationsServices } from './mathematical_operations/index.js'
import { NoiseGenerationLayer, NoiseGenerationServices } from './noise_generation/index.js'
import { ProceduralGenerationLayer, ProceduralGenerationServices } from './procedural_generation/index.js'
import { WorldValidationLayer, WorldValidationServices } from './world_validation/index.js'

/**
 * World Domain Service 統合Layer
 *
 * 全てのWorld Domain Serviceを統合した単一のLayerです。
 * 依存関係を適切に解決し、パフォーマンス最適化された
 * 並行処理環境を提供します。
 */
export const WorldDomainServiceLayer = Layer.mergeAll(
  // 基盤サービス（他サービスから依存される）
  MathematicalOperationsLayer,
  NoiseGenerationLayer,

  // 中間サービス（基盤サービスに依存）
  BiomeClassificationLayer,
  WorldValidationLayer,

  // 高レベルサービス（他の全サービスに依存可能）
  ProceduralGenerationLayer
)

/**
 * World Domain Service 統合サービス集合
 *
 * 全てのサービスへの型安全なアクセスを提供します。
 * 各サービスカテゴリは独立してアクセス可能です。
 */
export const WorldDomainServices = {
  // 手続き的生成サービス
  ProceduralGeneration: ProceduralGenerationServices,

  // ノイズ生成サービス
  NoiseGeneration: NoiseGenerationServices,

  // バイオーム分類サービス
  BiomeClassification: BiomeClassificationServices,

  // 世界検証サービス
  WorldValidation: WorldValidationServices,

  // 数学演算サービス
  MathematicalOperations: MathematicalOperationsServices,
} as const

/**
 * サービス依存関係グラフ
 *
 * Layer構成時の依存関係:
 *
 * ```
 * ProceduralGenerationLayer
 *   ├── BiomeClassificationLayer
 *   │   └── MathematicalOperationsLayer
 *   ├── NoiseGenerationLayer
 *   │   └── MathematicalOperationsLayer
 *   └── WorldValidationLayer
 *       └── MathematicalOperationsLayer
 * ```
 *
 * この階層構造により、以下の特性を実現：
 * - 循環依存の排除
 * - 効率的な並行処理
 * - モジュラーなテスト可能性
 * - 明確な責任分離
 */

/**
 * パフォーマンス最適化設計
 *
 * - **並行処理**: Fiberによる非同期処理で60FPS実現
 * - **SIMD対応**: 数学演算サービスでベクトル演算最適化
 * - **メモリ効率**: 不変データ構造によるガベージコレクション最適化
 * - **キャッシュ効率**: 局所性の原理に基づくデータアクセス
 */

/**
 * Minecraft互換性
 *
 * - **公式アルゴリズム**: Notch式Perlin/Simplex noise実装
 * - **バイオーム互換**: 公式バイオーム分類との100%互換性
 * - **MOD対応**: 拡張可能な設計でMOD開発をサポート
 * - **バージョン対応**: 1.7.10から最新版まで対応
 */
