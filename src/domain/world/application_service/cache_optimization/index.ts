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
    if (hitRate < 0.5) {
      return 'aggressive_preloading'
    } else if (memoryPressure > 0.8) {
      return 'conservative_eviction'
    } else if (accessPattern === 'sequential') {
      return 'predictive_caching'
    } else {
      return 'adaptive_hybrid'
    }
  },
}

export type { PreloadingStrategy as PreloadingStrategyType } from './layer'
