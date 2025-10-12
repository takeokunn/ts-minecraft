import { Effect, Option, pipe, Schema } from 'effect'

/**
 * PerformanceMemory Schema
 *
 * ブラウザのperformance.memory API型定義
 * Chrome/Edge等のV8ベースブラウザでのみ利用可能
 */
export const PerformanceMemorySchema = Schema.Struct({
  jsHeapSizeLimit: Schema.Number.pipe(
    Schema.nonNegative(),
    Schema.annotations({ description: 'Maximum heap size in bytes' })
  ),
  totalJSHeapSize: Schema.Number.pipe(
    Schema.nonNegative(),
    Schema.annotations({ description: 'Total allocated heap size' })
  ),
  usedJSHeapSize: Schema.Number.pipe(
    Schema.nonNegative(),
    Schema.annotations({ description: 'Currently used heap size' })
  ),
})

export type PerformanceMemory = Schema.Schema.Type<typeof PerformanceMemorySchema>

/**
 * performance.memory APIへの型安全なアクセス
 *
 * @returns PerformanceMemoryデータ（存在しない場合はOption.none()）
 * @example
 * ```typescript
 * yield* pipe(
 *   getPerformanceMemory(),
 *   Effect.flatMap(
 *     Option.match({
 *       onNone: () => Effect.unit,
 *       onSome: (memory) => Effect.log(`Used: ${memory.usedJSHeapSize} bytes`),
 *     })
 *   )
 * )
 * ```
 */
interface ExperimentalPerformanceMemory {
  readonly jsHeapSizeLimit: number
  readonly totalJSHeapSize: number
  readonly usedJSHeapSize: number
}

export const getPerformanceMemory = (): Effect.Effect<Option.Option<PerformanceMemory>, never> =>
  Effect.sync(() => {
    // Performance.memory は非標準APIでTypeScript型定義に含まれないため、ランタイムチェック
    const perf = performance as Performance & { memory?: ExperimentalPerformanceMemory }
    return pipe(
      Option.fromNullable(perf.memory),
      Option.flatMap((memory) => Schema.decodeUnknownOption(PerformanceMemorySchema)(memory))
    )
  })

/**
 * usedJSHeapSizeのみを取得するヘルパー関数
 *
 * @returns 使用中のヒープサイズ（bytes）、取得不可時は0
 * @example
 * ```typescript
 * const beforeMemory = yield* getUsedHeapSize()
 * // ... 処理 ...
 * const afterMemory = yield* getUsedHeapSize()
 * console.log(`Memory diff: ${afterMemory - beforeMemory} bytes`)
 * ```
 */
export const getUsedHeapSize = (): Effect.Effect<number, never> =>
  pipe(
    getPerformanceMemory(),
    Effect.map(
      Option.match({
        onNone: () => 0,
        onSome: (mem) => mem.usedJSHeapSize,
      })
    )
  )

/**
 * PerformanceMemoryのデフォルト値
 *
 * performance.memory API非対応環境用のフォールバック
 */
export const defaultPerformanceMemory: PerformanceMemory = {
  usedJSHeapSize: 0,
  totalJSHeapSize: 0,
  jsHeapSizeLimit: 0,
}

/**
 * PerformanceMemoryを確実に取得（デフォルト値あり）- 同期版
 *
 * @returns PerformanceMemoryデータ（取得不可時はdefaultPerformanceMemory）
 */
export const getPerformanceMemoryOrDefaultSync = (): PerformanceMemory => {
  const perf = performance as Performance & { memory?: ExperimentalPerformanceMemory }
  const decoded = Option.fromNullable(perf.memory).pipe(
    Option.flatMap((memory) => Schema.decodeUnknownOption(PerformanceMemorySchema)(memory))
  )
  return Option.getOrElse(() => defaultPerformanceMemory)(decoded)
}

/**
 * PerformanceMemoryを確実に取得（デフォルト値あり）
 *
 * @returns PerformanceMemoryデータ（取得不可時はdefaultPerformanceMemory）
 */
export const getPerformanceMemoryOrDefault = (): Effect.Effect<PerformanceMemory, never> =>
  pipe(getPerformanceMemory(), Effect.map(Option.getOrElse(() => defaultPerformanceMemory)))
