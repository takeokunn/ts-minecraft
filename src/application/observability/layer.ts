import { Effect, Layer } from 'effect'
import { NodeSdk } from '@effect/opentelemetry'
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus'

/**
 * OpenTelemetry Observability Layer
 * メトリクス収集・エクスポート設定
 */

/**
 * Prometheusエクスポーター設定
 * デフォルトポート: 9464
 * エンドポイント: http://localhost:9464/metrics
 */
const createPrometheusExporter = Effect.sync(() =>
  new PrometheusExporter({
    port: 9464,
    endpoint: '/metrics'
  })
)

/**
 * OpenTelemetry Layer（Prometheus統合）
 * - サービス名: ts-minecraft
 * - メトリクスリーダー: PrometheusExporter
 */
export const ObservabilityLayer = Layer.unwrapEffect(
  Effect.gen(function* () {
    const exporter = yield* createPrometheusExporter

    const sdk = yield* NodeSdk.layer(() => ({
      resource: {
        serviceName: 'ts-minecraft',
        serviceVersion: '1.0.0'
      },
      metrics: {
        reader: exporter
      }
    }))

    // Prometheusエンドポイント起動ログ
    yield* Effect.logInfo('OpenTelemetry Prometheus exporter started').pipe(
      Effect.annotateLogs({
        port: 9464,
        endpoint: 'http://localhost:9464/metrics'
      })
    )

    return sdk
  })
)
