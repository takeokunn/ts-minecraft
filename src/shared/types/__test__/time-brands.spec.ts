import { describe, expect } from 'vitest'
import { Effect } from 'effect'
import { it } from '@effect/vitest'
import { Schema } from '@effect/schema'
import {
  TimestampSchema,
  DeltaTimeSchema,
  FrameTimeSchema,
  DurationSchema,
  TimeBrands,
  type Timestamp,
  type DeltaTime,
  type FrameTime,
  type Duration,
} from '../time-brands'

describe('Time Brand Types', () => {
  describe('TimestampSchema', () => {
    it.effect('正常な値を受け入れる', () =>
      Effect.gen(function* () {
        const validValues = [1640995200000, Date.now(), 1]

        validValues.forEach((value) => {
          expect(() => Schema.decodeSync(TimestampSchema)(value)).not.toThrow()
        })
      })
    )

    it.effect('不正な値を拒否する', () =>
      Effect.gen(function* () {
        const invalidValues = [-1, 0, 1.5, NaN, Infinity]

        invalidValues.forEach((value) => {
          expect(() => Schema.decodeSync(TimestampSchema)(value)).toThrow()
        })
      })
    )

    it.effect('型安全性を確保する', () =>
      Effect.gen(function* () {
        const timestamp: Timestamp = Schema.decodeSync(TimestampSchema)(1640995200000)
        expect(typeof timestamp).toBe('number')
      })
    )
  })

  describe('DeltaTimeSchema', () => {
    it.effect('正常な値を受け入れる', () =>
      Effect.gen(function* () {
        const validValues = [0, 16.67, 33.33, 8.33, 1000]

        validValues.forEach((value) => {
          expect(() => Schema.decodeSync(DeltaTimeSchema)(value)).not.toThrow()
        })
      })
    )

    it.effect('不正な値を拒否する', () =>
      Effect.gen(function* () {
        const invalidValues = [-1, 1001, NaN, Infinity]

        invalidValues.forEach((value) => {
          expect(() => Schema.decodeSync(DeltaTimeSchema)(value)).toThrow()
        })
      })
    )

    it.effect('60FPS相当の値を正しく処理する', () =>
      Effect.gen(function* () {
        const sixtyFpsDelta = 1000 / 60 // 16.67ms
        expect(() => Schema.decodeSync(DeltaTimeSchema)(sixtyFpsDelta)).not.toThrow()
      })
    )
  })

  describe('FrameTimeSchema', () => {
    it.effect('正常な値を受け入れる', () =>
      Effect.gen(function* () {
        const validValues = [0, 8.33, 16.67, 33.33, 100]

        validValues.forEach((value) => {
          expect(() => Schema.decodeSync(FrameTimeSchema)(value)).not.toThrow()
        })
      })
    )

    it.effect('不正な値を拒否する', () =>
      Effect.gen(function* () {
        const invalidValues = [-1, 101, NaN, Infinity]

        invalidValues.forEach((value) => {
          expect(() => Schema.decodeSync(FrameTimeSchema)(value)).toThrow()
        })
      })
    )
  })

  describe('DurationSchema', () => {
    it.effect('正常な値を受け入れる', () =>
      Effect.gen(function* () {
        const validValues = [0, 1.5, 30, 3600, 86400]

        validValues.forEach((value) => {
          expect(() => Schema.decodeSync(DurationSchema)(value)).not.toThrow()
        })
      })
    )

    it.effect('不正な値を拒否する', () =>
      Effect.gen(function* () {
        const invalidValues = [-1, NaN, Infinity, -Infinity]

        invalidValues.forEach((value) => {
          expect(() => Schema.decodeSync(DurationSchema)(value)).toThrow()
        })
      })
    )
  })

  describe('TimeBrands helpers', () => {
    describe('createTimestamp', () => {
      it.effect('値を指定して作成する', () =>
        Effect.gen(function* () {
          const timestamp = TimeBrands.createTimestamp(1640995200000)
          expect(timestamp).toBe(1640995200000)
        })
      )

      it.effect('値を指定しない場合は現在時刻を使用する', () =>
        Effect.gen(function* () {
          const before = Date.now()
          const timestamp = TimeBrands.createTimestamp()
          const after = Date.now()

          expect(timestamp).toBeGreaterThanOrEqual(before)
          expect(timestamp).toBeLessThanOrEqual(after)
        })
      )
    })

    describe('now', () => {
      it.effect('現在のタイムスタンプを取得する', () =>
        Effect.gen(function* () {
          const before = Date.now()
          const timestamp = TimeBrands.now()
          const after = Date.now()

          expect(timestamp).toBeGreaterThanOrEqual(before)
          expect(timestamp).toBeLessThanOrEqual(after)
        })
      )
    })

    describe('createDeltaTime', () => {
      it.effect('正常なDeltaTimeを作成する', () =>
        Effect.gen(function* () {
          const deltaTime = TimeBrands.createDeltaTime(16.67)
          expect(deltaTime).toBe(16.67)
        })
      )

      it.effect('境界値をテストする', () =>
        Effect.gen(function* () {
          expect(TimeBrands.createDeltaTime(0)).toBe(0)
          expect(TimeBrands.createDeltaTime(1000)).toBe(1000)
        })
      )
    })

    describe('createFrameTime', () => {
      it.effect('正常なFrameTimeを作成する', () =>
        Effect.gen(function* () {
          const frameTime = TimeBrands.createFrameTime(16.67)
          expect(frameTime).toBe(16.67)
        })
      )
    })

    describe('createDuration', () => {
      it.effect('正常なDurationを作成する', () =>
        Effect.gen(function* () {
          const duration = TimeBrands.createDuration(30)
          expect(duration).toBe(30)
        })
      )
    })

    describe('duration conversion helpers', () => {
      it.effect('durationFromMs - ミリ秒から秒に変換する', () =>
        Effect.gen(function* () {
          const duration = TimeBrands.durationFromMs(1000)
          expect(duration).toBe(1)
        })
      )

      it.effect('durationFromMinutes - 分から秒に変換する', () =>
        Effect.gen(function* () {
          const duration = TimeBrands.durationFromMinutes(1)
          expect(duration).toBe(60)
        })
      )

      it.effect('durationFromHours - 時間から秒に変換する', () =>
        Effect.gen(function* () {
          const duration = TimeBrands.durationFromHours(1)
          expect(duration).toBe(3600)
        })
      )
    })
  })

  describe('型の互換性テスト', () => {
    it.effect('異なるBrand型は互換性がない', () =>
      Effect.gen(function* () {
        const timestamp: Timestamp = TimeBrands.createTimestamp(1640995200000)
        const deltaTime: DeltaTime = TimeBrands.createDeltaTime(16.67)

        // TypeScriptレベルでの型チェック（実行時には問題ないが、型として区別される）
        expect(typeof timestamp).toBe('number')
        expect(typeof deltaTime).toBe('number')

        // 値は同じ型だが、Brand型として区別される
        expect(timestamp).not.toBe(deltaTime)
      })
    )
  })
})
