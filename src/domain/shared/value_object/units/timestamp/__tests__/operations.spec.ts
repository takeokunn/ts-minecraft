/**
 * @fileoverview Timestamp Operations Tests
 * DateTime API移行後のTimestamp操作関数のテスト
 */

import { describe, expect, it } from '@effect/vitest'
import { Clock, DateTime, Effect, TestClock, unsafeCoerce } from 'effect'
import { fromISOString, toDateTime, toISOString } from '../operations'
import { type Timestamp } from '../schema'

// テスト用のヘルパー関数
const makeTimestamp = (value: number): Timestamp => unsafeCoerce<number, Timestamp>(value)

describe('Timestamp DateTime Operations', () => {
  describe('toDateTime', () => {
    it('TimestampをDateTime.Utcに変換できる', () => {
      const timestamp = makeTimestamp(1704067200000) // 2024-01-01T00:00:00.000Z
      const dateTime = toDateTime(timestamp)

      expect(DateTime.isDateTime(dateTime)).toBe(true)
      expect(DateTime.toEpochMillis(dateTime)).toBe(1704067200000)
    })

    it.effect('現在時刻のTimestampを正しく変換できる', () =>
      Effect.gen(function* () {
        // TestClockでは時刻は0から開始、5秒進める
        yield* TestClock.adjust('5 seconds')
        const now = yield* Clock.currentTimeMillis
        const timestamp = makeTimestamp(now)
        const dateTime = toDateTime(timestamp)

        expect(DateTime.toEpochMillis(dateTime)).toBe(now)
        expect(now).toBe(5000) // 5秒 = 5000ms
      })
    )

    it('過去の日時を正しく変換できる', () => {
      const timestamp = makeTimestamp(0) // Unix epoch
      const dateTime = toDateTime(timestamp)

      expect(DateTime.toEpochMillis(dateTime)).toBe(0)
    })
  })

  describe('toISOString', () => {
    it('TimestampをISO 8601形式の文字列に変換できる', () => {
      const timestamp = makeTimestamp(1704067200000) // 2024-01-01T00:00:00.000Z
      const isoString = toISOString(timestamp)

      expect(isoString).toBe('2024-01-01T00:00:00.000Z')
    })

    it('ミリ秒を含む時刻を正しく変換できる', () => {
      const timestamp = makeTimestamp(1704067200123) // 2024-01-01T00:00:00.123Z
      const isoString = toISOString(timestamp)

      expect(isoString).toBe('2024-01-01T00:00:00.123Z')
    })

    it('Unix epochを正しく変換できる', () => {
      const timestamp = makeTimestamp(0)
      const isoString = toISOString(timestamp)

      expect(isoString).toBe('1970-01-01T00:00:00.000Z')
    })
  })

  describe('fromISOString', () => {
    it.effect('ISO 8601形式の文字列からTimestampを生成できる', () =>
      Effect.gen(function* () {
        const isoString = '2024-01-01T00:00:00.000Z'
        const result = yield* fromISOString(isoString)

        expect(result).toBe(1704067200000)
      })
    )

    it.effect('ミリ秒を含むISO文字列を正しくパースできる', () =>
      Effect.gen(function* () {
        const isoString = '2024-01-01T00:00:00.123Z'
        const result = yield* fromISOString(isoString)

        expect(result).toBe(1704067200123)
      })
    )

    it.effect('タイムゾーン付きISO文字列を正しくパースできる', () =>
      Effect.gen(function* () {
        const isoString = '2024-01-01T09:00:00.000+09:00'
        const result = yield* fromISOString(isoString)

        // 9時間前のUTC時刻 (2024-01-01T00:00:00.000Z)
        expect(result).toBe(1704067200000)
      })
    )

    it.effect('Unix epochの文字列を正しくパースできる', () =>
      Effect.gen(function* () {
        const isoString = '1970-01-01T00:00:00.000Z'
        const result = yield* fromISOString(isoString)

        expect(result).toBe(0)
      })
    )
  })

  describe('toDateTime → toISOString → fromISOString のラウンドトリップ', () => {
    it.effect('変換の往復で値が保持される', () =>
      Effect.gen(function* () {
        const originalTimestamp = makeTimestamp(1704067200123)

        // Timestamp → ISO String
        const isoString = toISOString(originalTimestamp)

        // ISO String → Timestamp
        const restoredTimestamp = yield* fromISOString(isoString)

        expect(restoredTimestamp).toBe(originalTimestamp)
      })
    )

    it.effect('現在時刻でのラウンドトリップが正確', () =>
      Effect.gen(function* () {
        // TestClockで10秒進める
        yield* TestClock.adjust('10 seconds')
        const now = yield* Clock.currentTimeMillis
        const originalTimestamp = makeTimestamp(now)

        const isoString = toISOString(originalTimestamp)
        const restoredTimestamp = yield* fromISOString(isoString)

        expect(restoredTimestamp).toBe(originalTimestamp)
        expect(now).toBe(10000) // 10秒 = 10000ms
      })
    )
  })

  describe('DateTime互換性', () => {
    it('toDateTimeで生成したDateTime.UtcがEffect DateTime APIと互換性がある', () => {
      const timestamp = makeTimestamp(1704067200000)
      const dateTime = toDateTime(timestamp)

      // DateTime APIで操作可能
      const formatted = DateTime.formatIso(dateTime)
      expect(formatted).toBe('2024-01-01T00:00:00.000Z')

      // toDateで通常のDateオブジェクトに変換可能
      const date = DateTime.toDate(dateTime)
      expect(date.getTime()).toBe(1704067200000)
    })

    it('DateTimeから生成したミリ秒値でTimestampを作成できる', () => {
      const dateTime = DateTime.unsafeMake(1704067200000)
      const millis = DateTime.toEpochMillis(dateTime)
      const timestamp = makeTimestamp(millis)

      expect(timestamp).toBe(1704067200000)
    })
  })
})
