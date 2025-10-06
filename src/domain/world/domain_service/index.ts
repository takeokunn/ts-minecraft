/**
 * World Domain Services - 統合エクスポート
 *
 * 全てのWorld Domain Serviceを統合し、
 * 単一の WorldDomainServiceLayer として提供します。
 */

// 各サービスカテゴリのエクスポート
export * from './biome_classification/index'
export * from './mathematical_operations/index'
export * from './noise_generation/index'
export * from './procedural_generation/index'
export * from './world_validation/index'

// 統合Layer構成
export * from './layer'

import { BiomeClassificationServices } from './biome_classification/index'
import { MathematicalOperationsServices } from './mathematical_operations/index'
import { NoiseGenerationServices } from './noise_generation/index'
import { ProceduralGenerationServices } from './procedural_generation/index'
import { WorldValidationServices } from './world_validation/index'

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
