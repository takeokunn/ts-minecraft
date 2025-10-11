import { Metric } from 'effect'

/**
 * World Generation Metrics
 *
 * @effect/opentelemetryを使用したパフォーマンスメトリクス定義
 */

/**
 * チャンク生成時間（ミリ秒）を計測するヒストグラム
 *
 * バケット範囲: 0-1000ms（100ms刻み）+ 無限大
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
 * ロードスケジューラのキュー長を計測するゲージ
 */
export const loadingSchedulerQueueSize = Metric.gauge('loading_scheduler_queue_size', {
  description: 'ロードスケジューラの現在のキュー長',
})

/**
 * 物理演算ステップ時間（ミリ秒）を計測するヒストグラム
 *
 * バケット範囲: 0-100ms（10ms刻み）+ 無限大
 */
export const physicsStepDuration = Metric.histogram('physics_step_duration_ms', {
  boundaries: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
  description: '物理演算ステップ時間（ミリ秒）の分布を計測',
})
