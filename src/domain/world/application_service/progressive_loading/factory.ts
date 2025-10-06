/**
 * Progressive Loading Service Factory
 *
 * 段階的読み込みサービスのファクトリー関数
 */

import { Clock, Effect } from 'effect'
import {
  AdaptiveQualityService,
  LoadingSchedulerService,
  MemoryMonitorService,
  PriorityCalculatorService,
  ProgressiveLoadingService as ProgressiveLoadingServiceTag,
} from './service'

export const makeProgressiveLoadingService = Effect.gen(function* () {
  const scheduler = yield* LoadingSchedulerService
  const priorityCalculator = yield* PriorityCalculatorService
  const memoryMonitor = yield* MemoryMonitorService
  const adaptiveQuality = yield* AdaptiveQualityService

  const initialize = () =>
    Effect.gen(function* () {
      yield* Effect.logInfo('Progressive Loading システム初期化開始')

      // 各サービスの初期化
      // スケジューラは初期化不要（状態管理はリアクティブ）
      // 優先度計算器は初期化不要
      // メモリモニタとアダプティブ品質は初期化

      yield* Effect.logInfo('Progressive Loading システム初期化完了')
    })

  const start = () =>
    Effect.gen(function* () {
      yield* Effect.logInfo('Progressive Loading システム開始')

      // 各サービスを開始
      yield* memoryMonitor.startMonitoring()
      yield* adaptiveQuality.startAdaptation()

      yield* Effect.logInfo('Progressive Loading システム開始完了')
    })

  const stop = () =>
    Effect.gen(function* () {
      yield* Effect.logInfo('Progressive Loading システム停止')

      // 各サービスを停止
      yield* memoryMonitor.stopMonitoring()
      yield* adaptiveQuality.stopAdaptation()

      yield* Effect.logInfo('Progressive Loading システム停止完了')
    })

  const updatePlayerState = (
    playerId: string,
    position: { x: number; y: number; z: number },
    velocity: { x: number; z: number },
    viewDistance: number
  ) =>
    Effect.gen(function* () {
      const movementState = {
        _tag: 'PlayerMovementState' as const,
        playerId,
        currentPosition: position,
        movementVector: {
          _tag: 'MovementVector' as const,
          velocity,
          acceleration: { x: 0, z: 0 }, // 簡略化
          direction: (Math.atan2(velocity.z, velocity.x) * 180) / Math.PI,
          confidence: velocity.x !== 0 || velocity.z !== 0 ? 0.8 : 0.5,
        },
        viewDistance,
        lastUpdate: yield* Clock.currentTimeMillis,
        history: [], // 簡略化
      }

      yield* scheduler.updatePlayerMovement(movementState)
      yield* Effect.logDebug(`プレイヤー状態更新: ${playerId}`)
    })

  const updatePerformanceMetrics = (fps: number, memoryUsage: number, cpuUsage: number) =>
    Effect.gen(function* () {
      const snapshot = {
        _tag: 'PerformanceSnapshot' as const,
        timestamp: yield* Clock.currentTimeMillis,
        fps,
        frameTime: 1000 / fps,
        cpuUsage,
        gpuUsage: 0.5, // プレースホルダー
        memoryUsage,
        networkLatency: 50, // プレースホルダー
        diskIOLoad: 0.3, // プレースホルダー
        thermalState: 'normal' as const,
      }

      yield* adaptiveQuality.recordPerformance(snapshot)
      yield* Effect.logDebug(`パフォーマンス更新: FPS=${fps}, CPU=${(cpuUsage * 100).toFixed(1)}%`)
    })

  const getSystemStatus = () =>
    Effect.gen(function* () {
      const queueState = yield* scheduler.getQueueState()
      const memoryMetrics = yield* memoryMonitor.getCurrentMetrics()
      const memoryPressure = yield* memoryMonitor.getPressureLevel()
      const currentProfile = yield* adaptiveQuality.getCurrentProfile()

      const status = {
        scheduler: {
          pendingRequests: queueState.pending.length,
          inProgressRequests: queueState.inProgress.length,
          totalProcessed: queueState.totalProcessed,
        },
        memory: {
          usagePercentage: (memoryMetrics.usedMemory / memoryMetrics.totalMemory) * 100,
          pressureLevel: memoryPressure,
          totalAllocations: 0, // 実装に応じて取得
        },
        quality: {
          currentLevel: currentProfile.overallLevel,
          lastAdjustment: 'なし', // 調整履歴から取得
          adaptationActive: true, // 実際の状態を確認
        },
        overall: {
          healthy: memoryPressure !== 'critical' && queueState.failed.length < 5,
          warnings: [],
          errors: queueState.failed.map((f) => f.error),
        },
      }

      return status
    })

  const requestChunkLoad = (
    chunkX: number,
    chunkZ: number,
    playerId: string,
    priority: 'critical' | 'high' | 'normal' | 'low' | 'background' = 'normal'
  ) =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis
      const requestId = `chunk_${chunkX}_${chunkZ}_${now}`

      const loadRequest = {
        _tag: 'LoadingRequest' as const,
        id: requestId,
        chunkPosition: { x: chunkX, z: chunkZ },
        priority,
        distance: 0, // プレイヤー位置から計算
        estimatedSize: 1024, // 1KB推定
        requester: playerId,
        timestamp: now,
        dependencies: [],
        metadata: {},
      }

      yield* scheduler.scheduleLoad(loadRequest)
      yield* Effect.logInfo(`チャンク読み込みリクエスト: (${chunkX}, ${chunkZ}) 優先度: ${priority}`)

      return requestId
    })

  const reportLoadComplete = (requestId: string, success: boolean, loadTimeMs: number) =>
    Effect.gen(function* () {
      const metrics = { loadTime: loadTimeMs }
      yield* scheduler.reportCompletion(requestId, success, metrics)
      yield* Effect.logInfo(`読み込み完了報告: ${requestId} (${success ? '成功' : '失敗'}, ${loadTimeMs}ms)`)
    })

  const updateSettings = (settings: {
    maxConcurrentLoads?: number
    adaptiveQuality?: boolean
    memoryManagement?: 'conservative' | 'balanced' | 'aggressive'
    qualityStrategy?: 'performance_first' | 'quality_first' | 'balanced'
  }) =>
    Effect.gen(function* () {
      yield* Effect.when(settings.maxConcurrentLoads !== undefined, () =>
        scheduler.updateConfiguration({
          maxConcurrentLoads: settings.maxConcurrentLoads!,
        })
      )

      yield* Effect.when(settings.memoryManagement !== undefined, () =>
        memoryMonitor.updateConfiguration({
          strategy: settings.memoryManagement!,
        })
      )

      yield* Effect.when(settings.qualityStrategy !== undefined, () =>
        adaptiveQuality.updateConfiguration({
          strategy: settings.qualityStrategy!,
        })
      )

      yield* Effect.logInfo('Progressive Loading 設定更新完了')
    })

  return ProgressiveLoadingServiceTag.of({
    initialize,
    start,
    stop,
    updatePlayerState,
    updatePerformanceMetrics,
    getSystemStatus,
    requestChunkLoad,
    reportLoadComplete,
    updateSettings,
  })
})
