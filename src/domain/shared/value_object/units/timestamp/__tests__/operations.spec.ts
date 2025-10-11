/**
 * @fileoverview Timestamp Operations Tests
 * DateTime API移行後のTimestamp操作関数のテスト
 */

import { DateTime, Effect, unsafeCoerce } from 'effect'
import { describe, expect, it } from 'vitest'
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

    it('現在時刻のTimestampを正しく変換できる', () => {
      const now = Date.now()
      const timestamp = makeTimestamp(now)
      const dateTime = toDateTime(timestamp)

      expect(DateTime.toEpochMillis(dateTime)).toBe(now)
    })

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
    it('ISO 8601形式の文字列からTimestampを生成できる', async () => {
      const isoString = '2024-01-01T00:00:00.000Z'
      const result = await Effect.runPromise(fromISOString(isoString))

      expect(result).toBe(1704067200000)
    })

    it('ミリ秒を含むISO文字列を正しくパースできる', async () => {
      const isoString = '2024-01-01T00:00:00.123Z'
      const result = await Effect.runPromise(fromISOString(isoString))

      expect(result).toBe(1704067200123)
    })

    it('タイムゾーン付きISO文字列を正しくパースできる', async () => {
      const isoString = '2024-01-01T09:00:00.000+09:00'
      const result = await Effect.runPromise(fromISOString(isoString))

      // 9時間前のUTC時刻 (2024-01-01T00:00:00.000Z)
      expect(result).toBe(1704067200000)
    })

    it('Unix epochの文字列を正しくパースできる', async () => {
      const isoString = '1970-01-01T00:00:00.000Z'
      const result = await Effect.runPromise(fromISOString(isoString))

      expect(result).toBe(0)
    })
  })

  describe('toDateTime → toISOString → fromISOString のラウンドトリップ', () => {
    it('変換の往復で値が保持される', async () => {
      const originalTimestamp = makeTimestamp(1704067200123)

      // Timestamp → ISO String
      const isoString = toISOString(originalTimestamp)

      // ISO String → Timestamp
      const restoredTimestamp = await Effect.runPromise(fromISOString(isoString))

      expect(restoredTimestamp).toBe(originalTimestamp)
    })

    it('現在時刻でのラウンドトリップが正確', async () => {
      const now = Date.now()
      const originalTimestamp = makeTimestamp(now)

      const isoString = toISOString(originalTimestamp)
      const restoredTimestamp = await Effect.runPromise(fromISOString(isoString))

      expect(restoredTimestamp).toBe(originalTimestamp)
    })
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
      const dateTime = DateTime.unsafeFromDate(new Date(1704067200000))
      const millis = DateTime.toEpochMillis(dateTime)
      const timestamp = makeTimestamp(millis)

      expect(timestamp).toBe(1704067200000)
    })
  })
})
