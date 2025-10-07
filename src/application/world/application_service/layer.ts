import { Layer } from 'effect'
import { CacheOptimizationService } from './cache_optimization/index'
import { makeWorldApplicationService, WorldApplicationService } from './index'
import { PerformanceMonitoringService } from './performance_monitoring/index'
import { ProgressiveLoadingService } from './progressive_loading/index'
import { WorldGenerationOrchestrator } from './world_generation_orchestrator/index'

// === Integrated Layer ===

export const WorldApplicationServiceLive = Layer.effect(WorldApplicationService, makeWorldApplicationService).pipe(
  Layer.provide(WorldGenerationOrchestrator),
  Layer.provide(ProgressiveLoadingService),
  Layer.provide(CacheOptimizationService),
  Layer.provide(PerformanceMonitoringService)
)

// === Complete World Domain Application Service Layer ===

export const WorldDomainApplicationServiceLayer = Layer.mergeAll(
  // World Generation Orchestrator層
  Layer
    .mergeAll
    // Generation Pipeline, Dependency Coordinator, Error Recoveryの統合
    (),
  // Progressive Loading Service層
  Layer
    .mergeAll
    // Loading Scheduler, Priority Calculator, Memory Monitor, Adaptive Qualityの統合
    (),
  // Cache Optimization Service層
  Layer
    .mergeAll
    // Cache Manager, Preloading Strategyの統合
    (),
  // Performance Monitoring Service層
  Layer
    .mergeAll
    // Metrics Collector, Bottleneck Detectorの統合
    (),
  // 統合アプリケーションサービス
  WorldApplicationServiceLive
)
