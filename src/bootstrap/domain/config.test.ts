import { Schema } from '@effect/schema'
import * as Arbitrary from '@effect/schema/Arbitrary'
import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'
import * as fc from 'effect/FastCheck'
import {
  BootstrapConfigDefaults,
  BootstrapConfigSchema,
  BootstrapConfigSnapshotSchema,
  bootstrapConfig,
  bootstrapConfigSnapshot,
  materializeConfigSnapshot,
} from './config'
import { EpochMillisecondsSchema, epochMilliseconds } from './value'

const configArb = Arbitrary.make(BootstrapConfigSchema)
const snapshotArb = Arbitrary.make(BootstrapConfigSnapshotSchema)
const epochMillisArb = Arbitrary.make(EpochMillisecondsSchema)

describe('bootstrap/domain/config', () => {
  it.effect('BootstrapConfigDefaultsはスキーマに適合する', () =>
    Schema.decodeUnknown(BootstrapConfigSchema)(BootstrapConfigDefaults).pipe(
      Effect.map((config) => {
        expect(config).toStrictEqual(BootstrapConfigDefaults)
      })
    )
  )

  it.prop(
    'bootstrapConfigはSchema生成値をそのまま返す',
    [configArb],
    ([input]) => {
      const config = Effect.runSync(bootstrapConfig(input))
      expect(config).toStrictEqual(input)
      return true
    }
  )

  it.effect('bootstrapConfigは不正なfpsを拒否する', () =>
    bootstrapConfig({ debug: false, fps: 0, memoryLimit: 1024 }).pipe(
      Effect.either,
      Effect.map((result) => {
        expect(result._tag).toBe('Left')
      })
    )
  )

  it.prop(
    'bootstrapConfigSnapshotは構造を保持する',
    [snapshotArb],
    ([input]) => {
      const snapshot = Effect.runSync(bootstrapConfigSnapshot(input))
      expect(snapshot).toStrictEqual(input)
      return true
    }
  )

  it.prop(
    'materializeConfigSnapshotは引数をそのまま保持する',
    [configArb, epochMillisArb],
    ([config, loadedAt]) => {
      const snapshot = materializeConfigSnapshot(config, loadedAt)
      expect(snapshot.config).toStrictEqual(config)
      expect(snapshot.loadedAt).toBe(loadedAt)
    }
  )

  it.prop(
    'bootstrapConfigSnapshot経由でもepochMillisecondsの整合性が保たれる',
    [configArb, epochMillisArb],
    ([config, loadedAt]) => {
      const brand = Effect.runSync(epochMilliseconds(loadedAt))
      const snapshot = Effect.runSync(bootstrapConfigSnapshot({ config, loadedAt: brand }))
      expect(snapshot.loadedAt).toBe(brand)
      return true
    }
  )
})
