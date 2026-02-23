---
title: 'トラブルシューティング・モニタリング - 本番環境問題解決ガイド'
description: 'TypeScript Minecraft本番環境でのトラブルシューティング手法とモニタリング設定。ログ分析、パフォーマンス監視、障害対応の実践的ガイド。'
category: 'how-to'
difficulty: 'intermediate'
tags: ['troubleshooting', 'monitoring', 'production', 'logging', 'performance']
prerequisites: ['performance-optimization']
estimated_reading_time: '25分'
related_patterns: ['ci-cd-deployment']
related_docs: ['./performance-optimization.md', './ci-cd-deployment.md']
---

# トラブルシューティング・モニタリング

## 概要

TypeScript Minecraft本番環境での問題発見、原因特定、解決までの体系的なアプローチと、継続的なモニタリング設定について説明します。

## ログ管理とモニタリング

### 構造化ログ設定

```typescript
// src/shared/infrastructure/logger/structured-logger.ts
import { Effect, Logger, LogLevel, pipe } from 'effect'

export interface LogContext {
  readonly userId?: string
  readonly sessionId?: string
  readonly requestId?: string
  readonly component?: string
  readonly action?: string
}

export const createStructuredLogger = (context: LogContext) =>
  Logger.make(({ level, message, spans }) => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.literal(level),
      message,
      context,
      spans: spans.map((span) => ({
        label: span.label,
        timing: span.timing,
      })),
      environment: process.env.NODE_ENV,
      service: 'ts-minecraft',
      version: process.env.npm_package_version,
    }

    // 本番環境では JSON形式、開発環境では読みやすい形式
    if (process.env.NODE_ENV === 'production') {
      console.log(JSON.stringify(logEntry))
    } else {
      console.log(`[${logEntry.level}] ${logEntry.message}`, logEntry)
    }
  })

// 使用例
export const logPlayerAction = (playerId: string, action: string, details: Record<string, unknown>) =>
  Effect.gen(function* (_) {
    const logger = yield* _(Effect.log)
    yield* _(
      Logger.logInfo(`Player action: ${action}`, {
        playerId,
        action,
        details,
        component: 'player-system',
      })
    )
  })
```

### パフォーマンスメトリクス収集

```typescript
// src/shared/infrastructure/metrics/performance-collector.ts
import { Effect, Ref } from 'effect'

export interface PerformanceMetric {
  readonly name: string
  readonly value: number
  readonly unit: string
  readonly timestamp: number
  readonly tags: Record<string, string>
}

interface PerformanceCollectorInterface {
  readonly recordTiming: (name: string, duration: number, tags?: Record<string, string>) => Effect.Effect<void>
  readonly recordCounter: (name: string, value?: number, tags?: Record<string, string>) => Effect.Effect<void>
  readonly recordGauge: (name: string, value: number, tags?: Record<string, string>) => Effect.Effect<void>
  readonly getMetrics: Effect.Effect<PerformanceMetric[]>
  readonly exportPrometheus: Effect.Effect<string>
}

export const PerformanceCollector = Context.GenericTag<PerformanceCollectorInterface>('@minecraft/PerformanceCollector')

export const makePerformanceCollector = Effect.gen(function* (_) {
  const metrics = yield* _(Ref.make<PerformanceMetric[]>([]))

  return PerformanceCollector.of({
    recordTiming: (name: string, duration: number, tags: Record<string, string> = {}) =>
      Effect.gen(function* (_) {
        const metric: PerformanceMetric = {
          name,
          value: duration,
          unit: 'ms',
          timestamp: Date.now(),
          tags: { type: 'timing', ...tags },
        }
        yield* _(Ref.update(metrics, (m) => [...m, metric]))
      }),

    recordCounter: (name: string, value: number = 1, tags: Record<string, string> = {}) =>
      Effect.gen(function* (_) {
        const metric: PerformanceMetric = {
          name,
          value,
          unit: 'count',
          timestamp: Date.now(),
          tags: { type: 'counter', ...tags },
        }
        yield* _(Ref.update(metrics, (m) => [...m, metric]))
      }),

    recordGauge: (name: string, value: number, tags: Record<string, string> = {}) =>
      Effect.gen(function* (_) {
        const metric: PerformanceMetric = {
          name,
          value,
          unit: 'gauge',
          timestamp: Date.now(),
          tags: { type: 'gauge', ...tags },
        }
        yield* _(Ref.update(metrics, (m) => [...m, metric]))
      }),

    getMetrics: Ref.get(metrics),

    exportPrometheus: Effect.gen(function* (_) {
      const metricList = yield* _(Ref.get(metrics))
      return metricList
        .map((metric) => {
          const tagString = Object.entries(metric.tags)
            .map(([key, value]) => `${key}="${value}"`)
            .join(',')
          return `${metric.name}{${tagString}} ${metric.value} ${metric.timestamp}`
        })
        .join('\n')
    }),
  })
})

export const PerformanceCollectorLive = Layer.effect(PerformanceCollector, makePerformanceCollector)
```

### エラー追跡システム

```typescript
// src/shared/infrastructure/error-tracking/error-handler.ts
import { Effect, Logger, pipe } from 'effect'

export interface ErrorContext {
  readonly userId?: string
  readonly sessionId?: string
  readonly component: string
  readonly action?: string
  readonly metadata?: Record<string, unknown>
}

interface ErrorTrackerInterface {
  readonly reportError: (
    error: unknown,
    context: ErrorContext,
    severity?: 'low' | 'medium' | 'high' | 'critical'
  ) => Effect.Effect<void>
  readonly captureException: (component: string) => <A, E>(effect: Effect.Effect<A, E>) => Effect.Effect<A, E>
}

export const ErrorTracker = Context.GenericTag<ErrorTrackerInterface>('@minecraft/ErrorTracker')

export const makeErrorTracker = Effect.succeed(
  ErrorTracker.of({
    reportError: (error: unknown, context: ErrorContext, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium') =>
      Effect.gen(function* (_) {
        const errorInfo = {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          name: error instanceof Error ? error.name : 'Unknown',
          context,
          severity,
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV,
        }

        // ローカルログ出力
        yield* _(Logger.logError('Application Error', errorInfo))

        // 外部エラートラッキングサービス送信（本番環境のみ）
        if (process.env.NODE_ENV === 'production') {
          yield* _(sendToErrorService(errorInfo))
        }

        // 重要度が高い場合はアラート送信
        if (severity === 'critical') {
          yield* _(sendCriticalAlert(errorInfo))
        }
      }),

    captureException:
      (component: string) =>
      <A, E>(effect: Effect.Effect<A, E>) =>
        pipe(
          effect,
          Effect.catchAll((error) =>
            pipe(
              ErrorTracker.reportError(error, { component }),
              Effect.andThen(() => Effect.fail(error))
            )
          )
        ),
  })
)

export const ErrorTrackerLive = Layer.succeed(ErrorTracker, makeErrorTracker)

const sendToErrorService = (errorInfo: any) =>
  Effect.tryPromise({
    try: async () => {
      // Sentry, Rollbar, Bugsnag等への送信
      await fetch(process.env.ERROR_TRACKING_ENDPOINT!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorInfo),
      })
    },
    catch: () => new Error('Failed to send error to tracking service'),
  })

const sendCriticalAlert = (errorInfo: any) =>
  Effect.tryPromise({
    try: async () => {
      // Slack, Discord, Email等への緊急通知
      await fetch(process.env.ALERT_WEBHOOK_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 CRITICAL ERROR: ${errorInfo.message}`,
          attachments: [
            {
              color: 'danger',
              fields: [
                { title: 'Component', value: errorInfo.context.component, short: true },
                { title: 'Environment', value: errorInfo.environment, short: true },
                { title: 'Timestamp', value: errorInfo.timestamp, short: true },
              ],
            },
          ],
        }),
      })
    },
    catch: () => new Error('Failed to send critical alert'),
  })
```

## ヘルスチェックとモニタリング

### アプリケーションヘルスチェック

```typescript
// src/shared/infrastructure/health/health-check.ts
import { Effect, pipe } from "effect";

export interface HealthStatus {
  readonly status: "healthy" | "degraded" | "unhealthy";
  readonly checks: Record<string, CheckResult>;
  readonly timestamp: string;
}

export interface CheckResult {
  readonly status: "pass" | "fail" | "warn";
  readonly duration: number;
  readonly message?: string;
  readonly details?: Record<string, unknown>;
}

interface HealthCheckerInterface {
  readonly checkDatabase: Effect.Effect<{
    readonly status: "pass" | "fail"
    readonly duration: number
    readonly message: string
  }>
  readonly checkMemoryUsage: Effect.Effect<{
    readonly status: "pass" | "warn" | "fail"
    readonly duration: number
    readonly message: string
    readonly details: NodeJS.MemoryUsage
  }>
  readonly performHealthCheck: Effect.Effect<HealthCheckResult>
}

export const HealthChecker = Context.GenericTag<HealthCheckerInterface>(
  "@minecraft/HealthChecker"
)

export const makeHealthChecker = Effect.succeed(
  HealthChecker.of({
    checkDatabase: Effect.gen(function* (_) {
      const start = Date.now();
      try {
        // データベース接続テスト
        yield* _(Effect.sleep(10)); // 模擬的な接続テスト
        const duration = Date.now() - start;

        return {
          status: "pass" as const,
          duration,
          message: "Database connection successful"
        };
      } catch (error) {
        return {
          status: "fail" as const,
          duration: Date.now() - start,
          message: `Database connection failed: ${error}`
        };
      }
    }),

    checkMemoryUsage: Effect.gen(function* (_) {
      const memUsage = process.memoryUsage();
      const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
      const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
      const usagePercentage = (heapUsedMB / heapTotalMB) * 100;

      const status = usagePercentage > 90 ? "fail" :
                    usagePercentage > 70 ? "warn" : "pass";

      return {
        status,
        duration: 0,
        message: `Memory usage: ${heapUsedMB.toFixed(2)}MB / ${heapTotalMB.toFixed(2)}MB (${usagePercentage.toFixed(1)}%)`,
        details: memUsage
      };
    }),

    performHealthCheck: Effect.gen(function* (_) {
      const dbCheck = yield* _(HealthChecker.checkDatabase);
      const memCheck = yield* _(HealthChecker.checkMemoryUsage);

      return {
        status: dbCheck.status === "fail" || memCheck.status === "fail" ? "fail" : "pass",
        checks: {
          database: dbCheck,
          memory: memCheck
        },
        timestamp: new Date().toISOString()
      };
    })
  })
);

export const HealthCheckerLive = Layer.succeed(HealthChecker, makeHealthChecker)

  static checkDiskSpace = Effect.gen(function* (_) {
    const start = Date.now();
    // ディスク使用量チェック（簡略化）
    return {
      status: "pass" as const,
      duration: Date.now() - start,
      message: "Sufficient disk space available"
    };
  });

  static performHealthCheck = Effect.gen(function* (_) {
    const [database, memory, disk] = yield* _(
      Effect.all([
        HealthChecker.checkDatabase,
        HealthChecker.checkMemoryUsage,
        HealthChecker.checkDiskSpace
      ])
    );

    const checks = { database, memory, disk };

    const overallStatus = Object.values(checks).some(check => check.status === "fail")
      ? "unhealthy"
      : Object.values(checks).some(check => check.status === "warn")
      ? "degraded"
      : "healthy";

    return {
      status: overallStatus,
      checks,
      timestamp: new Date().toISOString()
    } as HealthStatus;
  });
}
```

### Prometheus メトリクス収集

```typescript
// src/shared/infrastructure/metrics/prometheus-exporter.ts
import { Effect, Ref, Schedule } from "effect";
import { PerformanceCollector } from "./performance-collector";

interface PrometheusExporterInterface {
  readonly startServer: Effect.Effect<void>
  readonly exportMetrics: Effect.Effect<string>
}

export const PrometheusExporter = Context.GenericTag<PrometheusExporterInterface>(
  "@minecraft/PrometheusExporter"
)

export const makePrometheusExporter = (port: number = 9090) =>
  Effect.gen(function* (_) {
    const performanceCollector = yield* _(PerformanceCollector);
    const healthChecker = yield* _(HealthChecker);

    return PrometheusExporter.of({
      exportMetrics: performanceCollector.exportPrometheus,

      startServer: Effect.gen(function* (_) {
        const express = yield* _(Effect.promise(() => import('express')));
        const app = express.default();

        app.get('/metrics', async (_req, res) => {
          const metricsText = yield* _(Effect.runPromise(performanceCollector.exportPrometheus));
          res.set('Content-Type', 'text/plain');
          res.send(metricsText);
        });

        app.get('/health', async (_req, res) => {
          const health = yield* _(Effect.runPromise(healthChecker.performHealthCheck));
          res.json(health);
        });

        yield* _(
          Effect.promise(() =>
            new Promise<void>((resolve) => {
              app.listen(port, () => {
                console.log(`Prometheus metrics server started on port ${port}`);
                resolve();
              });
            })
          )
        );
      })
    });
  });

export const PrometheusExporterLive = Layer.effect(PrometheusExporter, makePrometheusExporter())

  // 定期的なメトリクス収集
  collectSystemMetrics = Effect.gen(function* (_) {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    yield* _(this.collector.recordGauge("nodejs_memory_heap_used_bytes", memUsage.heapUsed));
    yield* _(this.collector.recordGauge("nodejs_memory_heap_total_bytes", memUsage.heapTotal));
    yield* _(this.collector.recordGauge("nodejs_memory_external_bytes", memUsage.external));
    yield* _(this.collector.recordGauge("nodejs_cpu_user_microseconds", cpuUsage.user));
    yield* _(this.collector.recordGauge("nodejs_cpu_system_microseconds", cpuUsage.system));
  });

  startPeriodicCollection = Effect.gen(function* (_) {
    yield* _(
      pipe(
        this.collectSystemMetrics,
        Effect.repeat(Schedule.fixed(5000)), // 5秒間隔
        Effect.fork
      )
    );
  });
}
```

## トラブルシューティング手順

### 一般的な問題の診断フロー

```typescript
// src/shared/infrastructure/diagnostics/diagnostic-runner.ts
import { Effect, pipe } from "effect";

export interface DiagnosticResult {
  readonly category: string;
  readonly severity: "info" | "warning" | "error" | "critical";
  readonly message: string;
  readonly recommendation?: string;
  readonly details?: Record<string, unknown>;
}

interface DiagnosticRunnerInterface {
  readonly runPerformanceDiagnostics: Effect.Effect<DiagnosticResult[]>
  readonly runFullDiagnostics: Effect.Effect<DiagnosticResult[]>
}

export const DiagnosticRunner = Context.GenericTag<DiagnosticRunnerInterface>(
  "@minecraft/DiagnosticRunner"
)

export const makeDiagnosticRunner = Effect.succeed(
  DiagnosticRunner.of({
    runPerformanceDiagnostics: Effect.gen(function* (_) {
      const results: DiagnosticResult[] = [];

      // メモリ使用量チェック
      const memUsage = process.memoryUsage();
      const heapUsedMB = memUsage.heapUsed / 1024 / 1024;

      if (heapUsedMB > 500) {
        results.push({
          category: "performance",
          severity: "warning",
          message: `High memory usage: ${heapUsedMB.toFixed(2)}MB`,
          recommendation: "Consider increasing heap size or optimizing memory usage",
          details: memUsage
        });
      }

      // イベントループ遅延チェック
      const start = process.hrtime.bigint();
      yield* _(Effect.sleep(0));
      const end = process.hrtime.bigint();
      const delay = Number(end - start) / 1000000; // ms

      if (delay > 10) {
        results.push({
          category: "performance",
          severity: "error",
          message: `Event loop delay: ${delay.toFixed(2)}ms`,
          recommendation: "Check for blocking operations or high CPU usage"
        });
      }

      return results;
    }),

    runFullDiagnostics: Effect.gen(function* (_) {
      const performanceDiagnostics = yield* _(DiagnosticRunner.runPerformanceDiagnostics);
      // 他の診断項目も追加可能
      return performanceDiagnostics;
    })
  })
);

export const DiagnosticRunnerLive = Layer.succeed(DiagnosticRunner, makeDiagnosticRunner)

  static runConnectivityDiagnostics = Effect.gen(function* (_) {
    const results: DiagnosticResult[] = [];

    // データベース接続チェック
    try {
      yield* _(HealthChecker.checkDatabase);
      results.push({
        category: "connectivity",
        severity: "info",
        message: "Database connection is healthy"
      });
    } catch (error) {
      results.push({
        category: "connectivity",
        severity: "critical",
        message: "Database connection failed",
        recommendation: "Check database server status and connection configuration",
        details: { error: String(error) }
      });
    }

    return results;
  });

  static runSecurityDiagnostics = Effect.gen(function* (_) {
    const results: DiagnosticResult[] = [];

    // 環境変数チェック
    const requiredEnvVars = [
      'NODE_ENV',
      'DATABASE_URL',
      'JWT_SECRET'
    ];

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        results.push({
          category: "security",
          severity: "critical",
          message: `Missing required environment variable: ${envVar}`,
          recommendation: "Set all required environment variables before deployment"
        });
      }
    }

    // 本番環境設定チェック
    if (process.env.NODE_ENV === 'production') {
      if (process.env.DEBUG === 'true') {
        results.push({
          category: "security",
          severity: "warning",
          message: "Debug mode is enabled in production",
          recommendation: "Disable debug mode in production environment"
        });
      }
    }

    return results;
  });

  static runFullDiagnostics = Effect.gen(function* (_) {
    const [performance, connectivity, security] = yield* _(
      Effect.all([
        DiagnosticRunner.runPerformanceDiagnostics,
        DiagnosticRunner.runConnectivityDiagnostics,
        DiagnosticRunner.runSecurityDiagnostics
      ])
    );

    return [...performance, ...connectivity, ...security];
  });
}
```

### 問題別トラブルシューティングガイド

#### 1. 高負荷・パフォーマンス問題

```bash
# CPU使用率確認
docker exec ts-minecraft-app top -p 1

# メモリ使用量詳細
docker exec ts-minecraft-app cat /proc/meminfo

# ネットワーク統計
docker exec ts-minecraft-app netstat -i

# アプリケーションプロファイリング
node --prof app.js
node --prof-process isolate-*.log > profile.txt
```

**対処法**:

- メモリリーク調査: `node --inspect` でデバッガー接続
- CPU プロファイリング: Chrome DevTools または clinic.js使用
- データベースクエリ最適化確認
- キャッシュ戦略見直し

#### 2. 接続・ネットワーク問題

```bash
# ポート接続確認
docker exec ts-minecraft-app nc -zv localhost 3000

# DNS解決確認
docker exec ts-minecraft-app nslookup database-host

# ネットワーク遅延測定
docker exec ts-minecraft-app ping -c 4 external-service.com

# SSL証明書確認
docker exec ts-minecraft-app openssl s_client -connect domain.com:443
```

**対処法**:

- ファイアウォール設定確認
- LoadBalancer/Proxy設定検証
- SSL証明書の有効期限確認
- DNS設定の検証

#### 3. データベース問題

```bash
# 接続プール状況確認
docker exec ts-minecraft-db psql -U postgres -c "SELECT * FROM pg_stat_activity;"

# スロークエリ確認
docker exec ts-minecraft-db psql -U postgres -c "SELECT query, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# データベースサイズ確認
docker exec ts-minecraft-db psql -U postgres -c "SELECT pg_size_pretty(pg_database_size('minecraft'));"
```

**対処法**:

- インデックス最適化
- クエリ実行計画の確認（EXPLAIN ANALYZE）
- 接続プール設定調整
- データベース設定チューニング

## モニタリングダッシュボード設定

### Grafana ダッシュボード設定

```json
{
  "dashboard": {
    "id": null,
    "title": "TS-Minecraft Monitoring",
    "tags": ["typescript", "minecraft", "monitoring"],
    "timezone": "browser",
    "panels": [
      {
        "id": 1,
        "title": "System Metrics",
        "type": "graph",
        "targets": [
          {
            "expr": "nodejs_memory_heap_used_bytes",
            "legendFormat": "Heap Used"
          },
          {
            "expr": "nodejs_memory_heap_total_bytes",
            "legendFormat": "Heap Total"
          }
        ]
      },
      {
        "id": 2,
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{status}}"
          }
        ]
      },
      {
        "id": 3,
        "title": "Error Rate",
        "type": "singlestat",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m]) / rate(http_requests_total[5m])",
            "legendFormat": "Error Rate"
          }
        ]
      }
    ]
  }
}
```

### アラート設定

```yaml
# alerts/minecraft-alerts.yml
groups:
  - name: minecraft-application
    rules:
      - alert: HighMemoryUsage
        expr: nodejs_memory_heap_used_bytes / nodejs_memory_heap_total_bytes > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'High memory usage detected'
          description: 'Memory usage is above 90% for more than 5 minutes'

      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.1
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: 'High error rate detected'
          description: 'Error rate is above 10% for more than 2 minutes'

      - alert: DatabaseConnectionFailed
        expr: up{job="minecraft-db"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: 'Database connection failed'
          description: 'Cannot connect to database'

      - alert: DiskSpaceHigh
        expr: (node_filesystem_size_bytes - node_filesystem_free_bytes) / node_filesystem_size_bytes > 0.85
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: 'Disk space usage high'
          description: 'Disk usage is above 85%'
```

## デバッグとログ解析

### ログ集約設定

```yaml
# docker-compose.monitoring.yml
version: '3.8'
services:
  fluentd:
    image: fluent/fluentd:v1.14
    volumes:
      - ./fluentd.conf:/fluentd/etc/fluent.conf
      - ./logs:/var/log
    ports:
      - '24224:24224'
    environment:
      - FLUENTD_CONF=fluent.conf

  elasticsearch:
    image: elasticsearch:7.17.0
    environment:
      - discovery.type=single-node
      - 'ES_JAVA_OPTS=-Xms1g -Xmx1g'
    ports:
      - '9200:9200'

  kibana:
    image: kibana:7.17.0
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
    ports:
      - '5601:5601'
    depends_on:
      - elasticsearch
```

### ログ解析クエリ例

```javascript
// Elasticsearch クエリ例
const errorAnalysisQuery = {
  query: {
    bool: {
      must: [{ match: { level: 'ERROR' } }, { range: { '@timestamp': { gte: 'now-1h' } } }],
    },
  },
  aggs: {
    error_by_component: {
      terms: { field: 'context.component.keyword' },
    },
    error_timeline: {
      date_histogram: {
        field: '@timestamp',
        interval: '5m',
      },
    },
  },
}

// パフォーマンス分析クエリ
const performanceAnalysisQuery = {
  query: {
    bool: {
      must: [{ exists: { field: 'response_time' } }, { range: { response_time: { gte: 1000 } } }],
    },
  },
  aggs: {
    slow_endpoints: {
      terms: { field: 'endpoint.keyword' },
      aggs: {
        avg_response_time: {
          avg: { field: 'response_time' },
        },
      },
    },
  },
}
```

## 運用チェックリスト

### 日次チェック項目

- [ ] システム全体のヘルスチェック実行
- [ ] エラーログの確認と対応
- [ ] パフォーマンスメトリクスの確認
- [ ] ディスク使用量の確認
- [ ] バックアップ状況の確認

### 週次チェック項目

- [ ] セキュリティログの詳細確認
- [ ] データベースパフォーマンス分析
- [ ] システムリソース使用傾向の確認
- [ ] ログローテーション実行
- [ ] モニタリングダッシュボードの更新

### 月次チェック項目

- [ ] セキュリティアップデートの適用
- [ ] パフォーマンスベースライン更新
- [ ] 容量計画の見直し
- [ ] 災害復旧手順の確認・テスト
- [ ] 運用ドキュメントの更新

## 関連ドキュメント

- [パフォーマンス最適化](./performance-optimization.md) - 性能改善手法
- [CI/CD デプロイメント](./ci-cd-deployment.md) - 自動デプロイメントパイプライン
