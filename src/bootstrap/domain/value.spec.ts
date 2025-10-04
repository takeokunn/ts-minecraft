import { Schema } from '@effect/schema'
import * as Arbitrary from '@effect/schema/Arbitrary'
import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'
import * as fc from 'effect/FastCheck'
import {
  DebugModeSchema,
  EpochMillisecondsSchema,
  FramesPerSecondSchema,
  MemoryMegabytesSchema,
  epochMilliseconds,
  reviveEpochZero,
  unsafeEpochMilliseconds,
} from './value'

const epochMillisecondsArb = Arbitrary.make(EpochMillisecondsSchema)
const framesPerSecondArb = Arbitrary.make(FramesPerSecondSchema)
const memoryMegabytesArb = Arbitrary.make(MemoryMegabytesSchema)
const debugModeArb = Arbitrary.make(DebugModeSchema)

describe('bootstrap/domain/value', () => {
  it.prop(
    'epochMilliseconds accepts非負整数をブランド付きで復元する',
    [fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER })],
    ([value]) => {
      const result = Effect.runSync(epochMilliseconds(value))
      expect(result).toBe(value)
      return true
    }
  )

  it.prop('epochMillisecondsは負の入力を拒否する', [fc.integer({ max: -1 })], ([value]) => {
    const outcome = Effect.runSync(Effect.either(epochMilliseconds(value)))
    expect(outcome).toMatchObject({ _tag: 'Left' })
    return true
  })

  it.prop('unsafeEpochMillisecondsはSchema生成値と完全一致する', [epochMillisecondsArb], ([value]) => {
    expect(unsafeEpochMilliseconds(value)).toBe(value)
  })

  it.effect('reviveEpochZeroはブランドされたゼロを返す', () =>
    epochMilliseconds(0).pipe(
      Effect.map((zero) => {
        expect(zero).toBe(reviveEpochZero())
      })
    )
  )

  it.prop('DebugModeSchemaはbooleanのみ許可する', [debugModeArb], ([flag]) => {
    expect(() => Schema.decodeUnknownSync(DebugModeSchema)(flag)).not.toThrow()
  })

  it.prop('FramesPerSecondSchemaは1〜120を受理する', [framesPerSecondArb], ([fps]) => {
    expect(() => Schema.decodeUnknownSync(FramesPerSecondSchema)(fps)).not.toThrow()
  })

  it.prop(
    'FramesPerSecondSchemaは範囲外を拒否する',
    [fc.oneof(fc.integer({ max: 0 }), fc.integer({ min: 121, max: 4096 }))],
    ([value]) => {
      expect(() => Schema.decodeUnknownSync(FramesPerSecondSchema)(value)).toThrow()
    }
  )

  it.prop('MemoryMegabytesSchemaは1〜2048を受理する', [memoryMegabytesArb], ([memory]) => {
    expect(() => Schema.decodeUnknownSync(MemoryMegabytesSchema)(memory)).not.toThrow()
  })

  it.prop(
    'MemoryMegabytesSchemaは範囲外を拒否する',
    [fc.oneof(fc.integer({ max: 0 }), fc.integer({ min: 2049, max: 16384 }))],
    ([value]) => {
      expect(() => Schema.decodeUnknownSync(MemoryMegabytesSchema)(value)).toThrow()
    }
  )
})
