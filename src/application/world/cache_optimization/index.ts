/**
 * Cache Optimization Application Service
 *
 * 多階層キャッシュシステムの統合管理と最適化機能を提供します。
 * プリローディング戦略、削除ポリシー、メモリ断片化解消を含む
 * 包括的なキャッシュ最適化システムです。
 */

// === Cache Manager ===
export {
  CacheConfiguration,
  CacheEntry,
  CacheLayer,
  CacheManagerError,
  CacheManagerService,
  CacheManagerServiceLive,
  CacheStatistics,
  DEFAULT_CACHE_CONFIG,
} from './cache_manager'

export type {
  CacheConfigurationType,
  CacheEntryType,
  CacheLayerType,
  CacheEntryOptions,
  CacheManagerErrorType,
  CacheStatisticsType,
} from './cache_manager'

// === Cache Optimization Service ===

export {
  CacheOptimizationError,
  CacheOptimizationService,
  CacheOptimizationServiceLive,
  CacheOptimizationServicesLayer,
  DEFAULT_PRELOADING_STRATEGY,
  PreloadingStrategy,
} from './layer'

export type { CacheOptimizationErrorType } from './layer'

// === Helper Functions ===

export const CacheOptimizationUtils = {
  /**
   * チャンクの重要度を計算
   */
  calculateChunkImportance: (
    chunkX: number,
    chunkZ: number,
    playerX: number,
    playerZ: number,
    viewDistance: number
  ) => {
    const distance = Math.sqrt((chunkX - playerX) ** 2 + (chunkZ - playerZ) ** 2)
    const normalizedDistance = Math.min(distance / viewDistance, 1.0)
    return 1.0 - normalizedDistance
  },

  /**
   * メモリ使用量の推定
   */
  estimateChunkMemoryUsage: (chunkComplexity: number = 1.0) => {
    const baseSize = 64 * 1024 // 64KB基本サイズ
    return Math.floor(baseSize * chunkComplexity)
  },

  /**
   * キャッシュ戦略の推奨
   */
  recommendCacheStrategy: (
    hitRate: number,
    memoryPressure: number,
    accessPattern: 'sequential' | 'random' | 'clustered'
  ) => {
    // ルールベース設計: 優先度順に評価
    const strategyRules = [
      { check: () => hitRate < 0.5, strategy: 'aggressive_preloading' as const },
      { check: () => memoryPressure > 0.8, strategy: 'conservative_eviction' as const },
      { check: () => accessPattern === 'sequential', strategy: 'predictive_caching' as const },
      { check: () => true, strategy: 'adaptive_hybrid' as const }, // デフォルト
    ]

    const matchedRule = strategyRules.find((rule) => rule.check())
    return matchedRule?.strategy ?? 'adaptive_hybrid'
  },
}

export type { PreloadingStrategy as PreloadingStrategyType } from './layer'
