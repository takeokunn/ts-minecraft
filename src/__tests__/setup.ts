/**
 * @fileoverview Effect-TS Vitest テストセットアップ
 * TestClock/TestRandomを提供する共通レイヤー
 */

import { Layer, TestClock, TestRandom } from 'effect'

/**
 * テスト用の共通レイヤー
 *
 * 含まれるサービス:
 * - TestClock: 仮想時間制御（Effect.sleep、Clock.currentTimeMillisなど）
 * - TestRandom: 決定的乱数生成（Random.next系）
 *
 * @example
 * ```typescript
 * import { it } from "@effect/vitest"
 * import { testLayer } from '../../../__tests__/setup'
 *
 * it.effect("test with test layer", () =>
 *   Effect.gen(function* () {
 *     yield* TestClock.adjust("5 seconds")
 *     const time = yield* Clock.currentTimeMillis
 *     expect(time).toBe(5000)
 *   }).pipe(Effect.provide(testLayer))
 * )
 * ```
 */
export const testLayer = Layer.mergeAll(TestClock.layer, TestRandom.layer)

/**
 * TestClockのみを提供するレイヤー
 * 時間依存のテストで使用
 */
export const testClockLayer = TestClock.layer

/**
 * TestRandomのみを提供するレイヤー
 * 乱数を使用するテストで使用
 */
export const testRandomLayer = TestRandom.layer
