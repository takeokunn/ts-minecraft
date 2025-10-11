import { Metric } from 'effect'

/**
 * Observability Metrics
 * OpenTelemetryと統合したパフォーマンスメトリクス定義
 *
 * 既存の@application/world_generation/metrics.tsから移行
 */

// ==========================================
// チャンク生成メトリクス
// ==========================================

/**
 * チャンク生成時間のヒストグラム
 * boundaries: 0-1000ms（100ms刻み）+ 無限大
 */
export const chunkGenerationDuration = Metric.histogram('chunk_generation_duration_ms', {
  boundaries: [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000],
  description: 'チャンク生成時間（ミリ秒）の分布を計測',
})

/**
 * チャンク生成総数を計測するカウンター
 */
export const chunkGenerationCounter = Metric.counter('chunk_generation_total', {
  description: '生成されたチャンクの総数',
})

/**
 * チャンク生成エラーカウンター
 */
export const chunkGenerationErrorCounter = Metric.counter(
  'chunk_generation_errors_total',
  {
    description: 'Total number of chunk generation errors'
  }
)

// ==========================================
// FPSメトリクス
// ==========================================

/**
 * 現在のFPS（ゲージ）
 */
export const fpsGauge = Metric.gauge(
  'fps_current',
  {
    description: 'Current frames per second'
  }
)

/**
 * フレーム時間のヒストグラム
 * boundaries: 8ms（120fps）~ 100ms（10fps）
 */
export const frameTimeHistogram = Metric.histogram(
  'frame_time_ms',
  MetricBoundaries.linear({ start: 8, width: 8, count: 12 }).pipe(
    MetricBoundaries.fromChunk
  ),
  'Frame rendering time in milliseconds'
)

// ==========================================
// プログレッシブローディングメトリクス
// ==========================================

/**
 * チャンクロードスケジューリング時間
 */
export const chunkLoadScheduleDuration = Metric.histogram(
  'chunk_load_schedule_duration_ms',
  MetricBoundaries.linear({ start: 1, width: 5, count: 10 }).pipe(
    MetricBoundaries.fromChunk
  ),
  'Chunk load scheduling time in milliseconds'
)

/**
 * アクティブチャンク数（メモリ内）
 */
export const activeChunksGauge = Metric.gauge(
  'active_chunks',
  {
    description: 'Number of active chunks in memory'
  }
)

/**
 * ローディングキューサイズ（既存のloadingSchedulerQueueSizeと統合）
 */
export const loadingSchedulerQueueSize = Metric.gauge('loading_scheduler_queue_size', {
  description: 'ロードスケジューラの現在のキュー長',
})

// ==========================================
// メモリメトリクス
// ==========================================

/**
 * 推定メモリ使用量（MB）
 */
export const memoryUsageGauge = Metric.gauge(
  'memory_usage_mb',
  {
    description: 'Estimated memory usage in megabytes'
  }
)

// ==========================================
// 物理演算メトリクス
// ==========================================

/**
 * 物理演算ステップ時間（ミリ秒）を計測するヒストグラム
 * boundaries: 0-100ms（10ms刻み）+ 無限大
 */
export const physicsStepDuration = Metric.histogram('physics_step_duration_ms', {
  boundaries: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
  description: '物理演算ステップ時間（ミリ秒）の分布を計測',
})

/**
 * 衝突判定回数カウンター
 */
export const collisionCheckCounter = Metric.counter(
  'collision_checks_total',
  {
    description: 'Total number of collision checks performed'
  }
)
