---
title: 'ランタイムエラートラブルシューティング - 実行時エラー完全ガイド'
description: 'TypeScript Minecraftプロジェクトのランタイムエラー40パターン。Effect-TS Fiber、WebGL/Three.js、Promise拒否、ネットワークエラー対処法。'
category: 'troubleshooting'
difficulty: 'advanced'
tags: ['runtime-errors', 'troubleshooting', 'effect-ts', 'webgl', 'three.js', 'debugging', 'fiber-management']
prerequisites: ['typescript-advanced', 'effect-ts-intermediate', 'webgl-basics']
estimated_reading_time: '35分'
related_patterns: ['error-handling-patterns', 'service-patterns']
related_docs: ['./debugging-guide.md', './effect-ts-troubleshooting.md', './performance-issues.md']
status: 'complete'
---

# ランタイムエラーのトラブルシューティング

> **実行時エラー完全ガイド**: TypeScript Minecraft プロジェクトのための40のランタイムエラーパターンと実践的対処法

TypeScript Minecraft プロジェクトにおけるランタイムエラーの包括的な検出、詳細診断、そして確実な対処方法を網羅的に解説します。Effect-TSのFiber実行エラー、WebGL/Three.jsレンダリングエラー、Promise拒否エラー、ネットワークエラー、そして統合エラーハンドリング戦略を中心に説明します。

## Effect ランタイムエラー

### Effect 実行時の一般的なエラー

#### Fiber Interruption エラー

##### 症状

```bash
FiberFailure: Interrupted
Error: Effect was interrupted
```

##### 原因

- Fiber の不適切な中断
- タイムアウト設定の問題
- リソースの競合状態

##### 解決方法

```typescript
// ❌ 問題のあるコード - 不適切なFiber管理
const problematicProcessing = Effect.gen(function* () {
  const fiber = yield* Effect.fork(longRunningTask)
  yield* Effect.sleep('1 second')
  yield* Fiber.interrupt(fiber) // 強制中断
  return yield* Fiber.join(fiber) // エラー発生
})

// ✅ 修正後 - 適切なFiber管理
const properProcessing = Effect.gen(function* () {
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const fiber = yield* Effect.forkScoped(
        longRunningTask.pipe(
          Effect.interruptible,
          Effect.onInterrupt(() => Effect.log('Task was gracefully interrupted'))
        )
      )

      const result = yield* Effect.race(
        Fiber.join(fiber),
        Effect.gen(function* () {
          yield* Effect.sleep('10 seconds') // タイムアウト
          return yield* Effect.fail(new ProcessingTimeoutError())
        })
      )

      return result
    })
  )
})

// ✅ 中断可能な長時間処理
const interruptibleLongRunningTask = Effect.gen(function* () {
  for (let i = 0; i < 1000; i++) {
    yield* Effect.yieldNow() // 中断ポイント
    yield* heavyComputation(i)

    // 定期的な中断チェック
    if (i % 100 === 0) {
      yield* Effect.checkInterrupt
    }
  }
})
```

#### Context Missing エラー

##### 症状

```bash
MissingService: Service not found: WorldService
```

##### 原因

- Layer の提供忘れ
- Context タグの不一致
- スコープ問題

##### 解決方法

```typescript
// ❌ 問題のあるコード - Contextが提供されていない
const problematicService = Effect.gen(function* () {
  const worldService = yield* WorldService // エラー
  return yield* worldService.loadWorld('test')
})

// ✅ 修正後 - 適切なLayer提供
const properService = Effect.gen(function* () {
  const worldService = yield* WorldService
  return yield* worldService.loadWorld('test')
})

const program = pipe(
  properService,
  Effect.provide(WorldServiceLive) // Layer を適切に提供
)

// ✅ テスト用のデフォルトLayer設定
const TestLayer = Layer.mergeAll(WorldServiceLive, PlayerServiceLive, ChunkServiceLive)

export const runTest = <A, E>(effect: Effect.Effect<A, E>) => Effect.provide(effect, TestLayer)
```

#### Schedule/Timer エラー

##### 症状

```bash
Error: Schedule exceeded maximum duration
Error: Timer was cancelled
```

##### 原因

- 無制限リトライ設定
- Timer リソースの不適切な管理

##### 解決方法

```typescript
// ❌ 問題のあるコード - 無制限リトライ
const problematicRetry = someOperation.pipe(
  Effect.retry(Schedule.forever) // 無制限リトライ
)

// ✅ 修正後 - 適切な制限設定
const safeRetry = someOperation.pipe(
  Effect.retry(
    Schedule.exponential('100 millis').pipe(
      Schedule.compose(Schedule.recurs(5)), // 最大5回
      Schedule.compose(Schedule.upTo('30 seconds')), // 最大30秒
      Schedule.jittered // ジッター付き
    )
  ),
  Effect.timeout('60 seconds'), // 全体のタイムアウト
  Effect.onError((cause) => Effect.logError('Operation failed after retries', { cause }))
)

// ✅ 適切なスケジュール管理
const scheduledTask = Effect.repeat(
  Effect.gen(function* () {
    const result = yield* performTask
    yield* Effect.logInfo('Task completed', { result })
    return result
  }),
  Schedule.fixed('5 seconds').pipe(
    Schedule.compose(Schedule.recurs(100)) // 最大100回実行
  )
)
```

### Stream エラーの処理

#### Stream バックプレッシャーエラー

##### 症状

```bash
Error: Stream buffer overflow
Error: Downstream consumer too slow
```

##### 解決方法

```typescript
// ✅ バックプレッシャー対応のStream処理
const handleHighVolumeStream = <A, E>(source: Stream.Stream<A, E>): Stream.Stream<A, E> =>
  source.pipe(
    Stream.buffer({
      capacity: 1000,
      strategy: 'dropping', // または "sliding"
    }),
    Stream.groupedWithin(100, '1 second'), // バッチ処理
    Stream.mapEffect(
      (batch) =>
        Effect.gen(function* () {
          yield* Effect.logDebug(`Processing batch of ${batch.length} items`)
          return yield* processBatch(batch)
        }),
      { concurrency: 5 }
    ),
    Stream.flattenChunks
  )

// ✅ 適応的なバックプレッシャー制御
const adaptiveStream = <A, E>(source: Stream.Stream<A, E>, processor: (item: A) => Effect.Effect<void, E>) =>
  Effect.gen(function* () {
    const processingRate = yield* Ref.make(1)
    const errorCount = yield* Ref.make(0)

    return source.pipe(
      Stream.throttleShape(
        () =>
          Effect.gen(function* () {
            const rate = yield* Ref.get(processingRate)
            return Duration.millis(1000 / rate)
          }),
        1
      ),
      Stream.mapEffect(
        (item) =>
          processor(item).pipe(
            Effect.tapBoth({
              onFailure: () => Ref.update(errorCount, (n) => n + 1),
              onSuccess: () =>
                Effect.gen(function* () {
                  const errors = yield* Ref.get(errorCount)
                  if (errors > 10) {
                    yield* Ref.update(processingRate, (rate) => Math.max(1, rate * 0.8))
                    yield* Ref.set(errorCount, 0)
                  } else {
                    yield* Ref.update(processingRate, (rate) => Math.min(100, rate * 1.1))
                  }
                }),
            })
          ),
        { concurrency: 'unbounded' }
      )
    )
  })
```

## Promise 拒否エラー

### Unhandled Promise Rejection

#### 症状

```bash
UnhandledPromiseRejectionWarning: Error: Async operation failed
```

#### 原因と解決方法

```typescript
// ❌ 問題のあるコード - Promise の適切でない処理
const problematicAsync = async () => {
  const promises = chunks.map(async (chunk) => {
    return await processChunk(chunk) // エラーがキャッチされない
  })

  return Promise.all(promises) // 一つでも失敗すると全て失敗
}

// ✅ 修正後 - Effect での適切なエラーハンドリング
const safeAsync = Effect.gen(function* () {
  const results = yield* Effect.all(
    chunks.map((chunk) =>
      processChunkEffect(chunk).pipe(
        Effect.either, // Left/Right で結果を包む
        Effect.timeout('30 seconds'),
        Effect.retry(Schedule.exponential('100 millis').pipe(Schedule.compose(Schedule.recurs(3)))),
        Effect.catchAll((error) =>
          Effect.gen(function* () {
            yield* Effect.logError('Chunk processing failed', { chunk, error })
            return Either.left(error)
          })
        )
      )
    ),
    { concurrency: 10 }
  )

  const successes = results.filter(Either.isRight).map((e) => e.right)
  const failures = results.filter(Either.isLeft).map((e) => e.left)

  yield* Effect.logInfo('Batch processing completed', {
    successes: successes.length,
    failures: failures.length,
  })

  return { successes, failures }
})

// ✅ Promise から Effect への変換
const promiseToEffect = <A>(promise: Promise<A>): Effect.Effect<A, unknown> =>
  Effect.async<A, unknown>((resume) => {
    promise.then((value) => resume(Effect.succeed(value))).catch((error) => resume(Effect.fail(error)))
  })

// ✅ グローバル Promise エラーハンドラー
const setupGlobalErrorHandling = () => {
  // ブラウザ環境
  if (typeof window !== 'undefined') {
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled Promise Rejection:', event.reason)

      // Effect ログシステムに統合
      Effect.runPromise(
        Effect.logError('Unhandled Promise Rejection', {
          reason: event.reason,
          stack: event.reason?.stack,
        })
      ).catch(console.error)

      event.preventDefault()
    })
  }

  // Node.js 環境
  if (typeof process !== 'undefined') {
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason)

      Effect.runPromise(
        Effect.logError('Unhandled Promise Rejection', {
          reason: String(reason),
          stack: (reason as Error)?.stack,
        })
      ).catch(console.error)
    })
  }
}
```

## WebGL エラー

### WebGL Context Lost

#### 症状

```bash
WebGLRenderingContext: GL_CONTEXT_LOST_WEBGL
```

#### 原因と対策

```typescript
// WebGL コンテキスト復旧の Effect パターン
const WebGLContextService = Context.GenericTag<{
  readonly setupContextRecovery: (renderer: THREE.WebGLRenderer) => Effect.Effect<void, WebGLError>
  readonly checkContextHealth: () => Effect.Effect<boolean, never>
  readonly recreateContext: () => Effect.Effect<THREE.WebGLRenderer, WebGLError>
}>('@minecraft/WebGLContextService')

const makeWebGLContextService = Effect.gen(function* () {
  const contextLostRef = yield* Ref.make(false)

  return WebGLContextService.of({
    setupContextRecovery: (renderer: THREE.WebGLRenderer) =>
      Effect.gen(function* () {
        const canvas = renderer.domElement

        // コンテキストロストのハンドリング
        const handleContextLost = (event: Event) => {
          event.preventDefault()
          Effect.runPromise(
            Effect.gen(function* () {
              yield* Ref.set(contextLostRef, true)
              yield* Effect.logWarn('WebGL context lost, preparing for recovery')
            })
          )
        }

        // コンテキスト復旧のハンドリング
        const handleContextRestored = () => {
          Effect.runPromise(
            Effect.gen(function* () {
              yield* Ref.set(contextLostRef, false)
              yield* Effect.logInfo('WebGL context restored')

              // リソースの再初期化
              yield* reinitializeRenderer(renderer)
              yield* reloadAllTextures()
              yield* rebuildAllGeometries()
            })
          )
        }

        canvas.addEventListener('webglcontextlost', handleContextLost)
        canvas.addEventListener('webglcontextrestored', handleContextRestored)

        // クリーンアップのためのリソース管理
        yield* Effect.addFinalizer(() =>
          Effect.sync(() => {
            canvas.removeEventListener('webglcontextlost', handleContextLost)
            canvas.removeEventListener('webglcontextrestored', handleContextRestored)
          })
        )
      }),

    checkContextHealth: () =>
      Effect.gen(function* () {
        const isLost = yield* Ref.get(contextLostRef)
        return !isLost
      }),

    recreateContext: () =>
      Effect.gen(function* () {
        // WebGL コンテキストの強制再作成
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('webgl2') || canvas.getContext('webgl')

        if (!context) {
          return yield* Effect.fail(new WebGLNotSupportedError())
        }

        const newRenderer = new THREE.WebGLRenderer({
          canvas,
          antialias: true,
          alpha: false,
        })

        yield* Effect.logInfo('WebGL context recreated successfully')
        return newRenderer
      }),
  })
})

// WebGL エラー監視とレポート
const monitorWebGLErrors = (gl: WebGLRenderingContext) =>
  Effect.gen(function* () {
    return yield* Effect.repeat(
      Effect.gen(function* () {
        const error = gl.getError()

        if (error !== gl.NO_ERROR) {
          const errorName = pipe(
            error,
            Match.value,
            Match.when(gl.INVALID_ENUM, () => 'INVALID_ENUM'),
            Match.when(gl.INVALID_VALUE, () => 'INVALID_VALUE'),
            Match.when(gl.INVALID_OPERATION, () => 'INVALID_OPERATION'),
            Match.when(gl.INVALID_FRAMEBUFFER_OPERATION, () => 'INVALID_FRAMEBUFFER_OPERATION'),
            Match.when(gl.OUT_OF_MEMORY, () => 'OUT_OF_MEMORY'),
            Match.when(gl.CONTEXT_LOST_WEBGL, () => 'CONTEXT_LOST_WEBGL'),
            Match.orElse(() => `UNKNOWN_ERROR_${error}`)
          )

          yield* Effect.logError('WebGL Error Detected', {
            errorCode: error,
            errorName,
          })
        }
      }),
      Schedule.fixed('1 second')
    )
  })
```

### Texture Loading エラー

#### 症状

```bash
THREE.WebGLRenderer: Texture marked for update but image is incomplete
Error: Failed to load texture from URL
```

#### 解決方法

```typescript
// テクスチャの安全なロード
const createSafeTextureLoader = () =>
  Effect.gen(function* () {
    const loadingCache = yield* Ref.make(new Map<string, Effect.Effect<THREE.Texture, TextureLoadError>>())
    const loadedTextures = yield* Ref.make(new Map<string, THREE.Texture>())

    return {
      loadTexture: (url: string): Effect.Effect<THREE.Texture, TextureLoadError> =>
        Effect.gen(function* () {
          const cache = yield* Ref.get(loadingCache)
          const cached = cache.get(url)

          if (cached) {
            return yield* cached
          }

          const loadEffect = Effect.async<THREE.Texture, TextureLoadError>((resume) => {
            const loader = new THREE.TextureLoader()
            const texture = loader.load(
              url,
              // onLoad
              (loadedTexture) => {
                resume(Effect.succeed(loadedTexture))
              },
              // onProgress
              (progress) => {
                console.log(`Loading texture ${url}: ${(progress.loaded / progress.total) * 100}%`)
              },
              // onError
              (error) => {
                resume(
                  Effect.fail(
                    new TextureLoadError({
                      url,
                      message: error?.message || 'Unknown texture loading error',
                    })
                  )
                )
              }
            )
          }).pipe(
            Effect.timeout('30 seconds'),
            Effect.retry(Schedule.exponential('1 second').pipe(Schedule.compose(Schedule.recurs(3)))),
            Effect.tap((texture) => Ref.update(loadedTextures, (map) => new Map(map.set(url, texture)))),
            Effect.tapError((error) => Effect.logError('Texture loading failed', { url, error })),
            Effect.ensuring(
              Ref.update(loadingCache, (map) => {
                const newMap = new Map(map)
                newMap.delete(url)
                return newMap
              })
            )
          )

          yield* Ref.update(loadingCache, (map) => new Map(map.set(url, loadEffect)))

          return yield* loadEffect
        }),

      preloadTextures: (urls: string[]) =>
        Effect.all(
          urls.map((url) =>
            loadTexture(url).pipe(
              Effect.either,
              Effect.tap((result) =>
                Either.match(result, {
                  onLeft: (error) => Effect.logWarn(`Failed to preload texture: ${url}`, { error }),
                  onRight: () => Effect.logDebug(`Preloaded texture: ${url}`),
                })
              )
            )
          ),
          { concurrency: 5 }
        ),

      disposeTexture: (url: string) =>
        Effect.gen(function* () {
          const textures = yield* Ref.get(loadedTextures)
          const texture = textures.get(url)

          if (texture) {
            texture.dispose()
            yield* Ref.update(loadedTextures, (map) => {
              const newMap = new Map(map)
              newMap.delete(url)
              return newMap
            })
            yield* Effect.logDebug(`Disposed texture: ${url}`)
          }
        }),

      disposeAll: () =>
        Effect.gen(function* () {
          const textures = yield* Ref.get(loadedTextures)

          for (const [url, texture] of textures) {
            texture.dispose()
          }

          yield* Ref.set(loadedTextures, new Map())
          yield* Effect.logInfo(`Disposed ${textures.size} textures`)
        }),
    }
  })
```

## ネットワークエラー

### HTTP Request 失敗

#### 症状

```bash
Network Error: Failed to fetch
Error: Request timeout
```

#### 解決方法

```typescript
// HTTP クライアントの Effect ラッパー
const createHttpClient = Effect.gen(function* () {
  const requestQueue = yield* Queue.bounded<HttpRequest>(100)
  const rateLimiter = yield* Semaphore.make(10) // 最大10並列リクエスト

  const makeRequest = <A>(request: HttpRequest): Effect.Effect<A, HttpError> =>
    Effect.gen(function* () {
      yield* Semaphore.take(rateLimiter)

      const response = yield* Effect.async<Response, HttpError>((resume) => {
        const controller = new AbortController()

        const timeoutId = setTimeout(() => {
          controller.abort()
          resume(Effect.fail(new HttpTimeoutError({ url: request.url })))
        }, request.timeout || 30000)

        fetch(request.url, {
          method: request.method,
          headers: request.headers,
          body: request.body,
          signal: controller.signal,
        })
          .then((response) => {
            clearTimeout(timeoutId)
            if (response.ok) {
              resume(Effect.succeed(response))
            } else {
              resume(
                Effect.fail(
                  new HttpStatusError({
                    status: response.status,
                    statusText: response.statusText,
                    url: request.url,
                  })
                )
              )
            }
          })
          .catch((error) => {
            clearTimeout(timeoutId)
            if (error.name === 'AbortError') {
              resume(Effect.fail(new HttpTimeoutError({ url: request.url })))
            } else {
              resume(
                Effect.fail(
                  new HttpNetworkError({
                    message: error.message,
                    url: request.url,
                  })
                )
              )
            }
          })
      }).pipe(Effect.ensuring(Semaphore.release(rateLimiter)))

      return yield* parseResponse<A>(response, request.responseType)
    })

  return {
    get: <A>(url: string, options?: RequestOptions) => makeRequest<A>({ ...options, method: 'GET', url }),

    post: <A>(url: string, body: unknown, options?: RequestOptions) =>
      makeRequest<A>({
        ...options,
        method: 'POST',
        url,
        body: JSON.stringify(body),
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      }),

    // バッチリクエスト処理
    batch: <A>(requests: HttpRequest[]) =>
      Stream.fromIterable(requests).pipe(Stream.mapEffect(makeRequest, { concurrency: 5 }), Stream.runCollect),
  }
})

// 自動リトライと回路ブレーカーパターン
const createResilientHttpClient = Effect.gen(function* () {
  const circuitBreaker = yield* Ref.make({
    state: 'CLOSED' as 'CLOSED' | 'OPEN' | 'HALF_OPEN',
    failureCount: 0,
    lastFailureTime: 0,
    successCount: 0,
  })

  const httpClient = yield* createHttpClient

  const makeResilientRequest = <A>(request: HttpRequest): Effect.Effect<A, HttpError> =>
    Effect.gen(function* () {
      const breakerState = yield* Ref.get(circuitBreaker)

      // 回路ブレーカーの状態チェック
      if (breakerState.state === 'OPEN') {
        const timeSinceFailure = Date.now() - breakerState.lastFailureTime
        if (timeSinceFailure < 60000) {
          // 60秒間は OPEN を維持
          return yield* Effect.fail(new CircuitBreakerOpenError())
        } else {
          yield* Ref.update(circuitBreaker, (state) => ({
            ...state,
            state: 'HALF_OPEN',
          }))
        }
      }

      const result = yield* httpClient.get<A>(request.url, request).pipe(
        Effect.retry(
          Schedule.exponential('500 millis').pipe(
            Schedule.compose(Schedule.recurs(3)),
            Schedule.whileInput(
              (error: HttpError) =>
                error._tag === 'HttpNetworkError' || (error._tag === 'HttpStatusError' && error.status >= 500)
            )
          )
        ),
        Effect.either
      )

      return yield* Either.match(result, {
        onLeft: (error) =>
          Effect.gen(function* () {
            yield* Ref.update(circuitBreaker, (state) => ({
              state: state.failureCount >= 5 ? 'OPEN' : 'CLOSED',
              failureCount: state.failureCount + 1,
              lastFailureTime: Date.now(),
              successCount: 0,
            }))

            return yield* Effect.fail(error)
          }),
        onRight: (value) =>
          Effect.gen(function* () {
            yield* Ref.update(circuitBreaker, (state) => ({
              state: 'CLOSED',
              failureCount: 0,
              lastFailureTime: 0,
              successCount: state.successCount + 1,
            }))

            return value
          }),
      })
    })

  return { makeResilientRequest }
})
```

## デバッグとロギング

### 構造化エラーロギング

```typescript
// 統合エラーロギングシステム
const createErrorLogger = Effect.gen(function* () {
  const errorBuffer = yield* Queue.bounded<ErrorLogEntry>(1000)

  // エラーログエントリの処理
  const processErrorLogs = Effect.fork(
    Stream.fromQueue(errorBuffer).pipe(
      Stream.grouped(10),
      Stream.mapEffect(
        (batch) =>
          Effect.gen(function* () {
            // バッチでログを外部システムに送信
            yield* sendErrorBatch(batch)
            yield* Effect.logDebug(`Sent error batch: ${batch.length} entries`)
          }),
        { concurrency: 1 }
      ),
      Stream.runDrain
    )
  )

  return {
    logError: (error: unknown, context?: Record<string, unknown>) =>
      Effect.gen(function* () {
        const errorEntry: ErrorLogEntry = {
          timestamp: Date.now(),
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          context: context || {},
          level: 'error',
          service: 'ts-minecraft',
        }

        yield* Queue.offer(errorBuffer, errorEntry)
        console.error('Runtime Error:', errorEntry)
      }),

    logWarning: (message: string, context?: Record<string, unknown>) =>
      Effect.gen(function* () {
        const warningEntry: ErrorLogEntry = {
          timestamp: Date.now(),
          message,
          context: context || {},
          level: 'warning',
          service: 'ts-minecraft',
        }

        yield* Queue.offer(errorBuffer, warningEntry)
        console.warn('Runtime Warning:', warningEntry)
      }),

    shutdown: () =>
      Effect.gen(function* () {
        yield* Fiber.interrupt(processErrorLogs)
        yield* Queue.shutdown(errorBuffer)
      }),
  }
})

// グローバルエラーハンドラーの統合
const setupGlobalErrorHandling = Effect.gen(function* () {
  const errorLogger = yield* createErrorLogger

  // Effect エラーの統合ログ
  const logEffectError = (error: unknown, context: Record<string, unknown> = {}) =>
    Effect.runPromise(
      errorLogger.logError(error, {
        ...context,
        source: 'effect-runtime',
      })
    ).catch(console.error)

  // グローバルエラーイベントの設定
  if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
      logEffectError(event.error, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        source: 'global-error',
      })
    })

    window.addEventListener('unhandledrejection', (event) => {
      logEffectError(event.reason, {
        source: 'unhandled-promise',
      })
      event.preventDefault()
    })
  }

  return errorLogger
})
```

## 関連リソース

- [よくあるエラー](./common-errors.md) - 一般的なエラー対処法
- [デバッグガイド](./debugging-guide.md) - デバッグ技術
- [パフォーマンス問題](./performance-issues.md) - パフォーマンス分析
- [ビルド問題](./build-problems.md) - ビルド設定の問題
- [Effect-TS Error Handling](https://effect.website/docs/guides/error-handling) - Effect-TS エラー処理ガイド
