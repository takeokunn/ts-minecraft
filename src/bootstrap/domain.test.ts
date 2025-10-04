import { describe, expect, it, prop } from '@effect/vitest'
import * as FC from 'effect/FastCheck'
import { Schema } from '@effect/schema'
import { Effect } from 'effect'
import * as Option from 'effect/Option'
import {
  AppInitializationResultSchema,
  AppReadinessSchema,
  BootstrapConfigDefaults,
  BootstrapConfigSchema,
  ConfigIssueList,
  EpochMillisecondsSchema,
  appErrorStage,
  bootstrapConfig,
  epochMilliseconds,
  formatAppError,
  makeConfigError,
  makeConfigIssue,
  makeInitializationError,
  makeLifecycleError,
  toConfigIssueList,
  unsafeEpochMilliseconds,
} from './domain'

describe('bootstrap/domain', () => {
  it('provides deterministic defaults for bootstrap config', () => {
    expect(BootstrapConfigDefaults).toStrictEqual({
      debug: false,
      fps: 60,
      memoryLimit: 2048,
    })
  })

  prop(
    'accepts well-formed configuration samples',
    [
      FC.boolean(),
      FC.integer({ min: 1, max: 120 }),
      FC.integer({ min: 1, max: 2048 }),
    ],
    ([debug, fps, memoryLimit]) => {
      const decoded = Effect.runSync(
        bootstrapConfig({ debug, fps, memoryLimit })
      )
      expect(decoded).toStrictEqual({ debug, fps, memoryLimit })
    }
  )

  it('rejects negative epoch values', () => {
    const parse = epochMilliseconds(-1)
    expect(() => Effect.runSync(parse)).toThrowError()
  })

  it('brands zero epoch explicitly', () => {
    const value = unsafeEpochMilliseconds(0)
    const validated = Effect.runSync(Schema.decodeUnknown(EpochMillisecondsSchema)(value))
    expect(validated).toBe(value)
  })

  it('formats config errors with issue paths', () => {
    const issue = makeConfigIssue({ path: ['fps'], message: 'out of range' })
    const error = makeConfigError([issue] satisfies ConfigIssueList)
    expect(formatAppError(error)).toBe('config:fps => out of range')
  })

  it('formats initialization errors and exposes stage', () => {
    const error = makeInitializationError({
      stage: 'config',
      message: 'provider unreachable',
    })
    expect(formatAppError(error)).toBe('provider unreachable')
    const stage = appErrorStage(error)
    expect(Option.isSome(stage)).toBe(true)
    expect(stage.value).toBe('config')
  })

  it('formats lifecycle errors without stage information', () => {
    const error = makeLifecycleError({
      current: 'ready',
      requested: 'initialize',
      message: 'illegal transition',
    })
    expect(formatAppError(error)).toBe('illegal transition')
    expect(Option.isNone(appErrorStage(error))).toBe(true)
  })

  it('creates config issues from schema parse errors', () => {
    let caught: Error | string | undefined
    try {
      Schema.decodeUnknownSync(BootstrapConfigSchema)({})
    } catch (error) {
      caught = error instanceof Error ? error : String(error)
    }
    if (caught === undefined) {
      throw new Error('expected failure')
    }
    const issues = toConfigIssueList(caught)
    expect(issues).toHaveLength(1)
    expect(issues[0]?.message).toContain('BootstrapConfig')
  })

  it('encodes readiness and initialization ADTs consistently', () => {
    const readiness = Effect.runSync(
      Schema.decodeUnknown(AppReadinessSchema)({
        ready: true,
        state: 'ready',
        initializedAt: unsafeEpochMilliseconds(10),
        updatedAt: unsafeEpochMilliseconds(10),
        config: BootstrapConfigDefaults,
      })
    )
    expect(readiness.ready).toBe(true)

    const initialization = Effect.runSync(
      Schema.decodeUnknown(AppInitializationResultSchema)({
        ready: true,
        fresh: false,
        state: 'ready',
        initializedAt: unsafeEpochMilliseconds(20),
        updatedAt: unsafeEpochMilliseconds(20),
        config: BootstrapConfigDefaults,
      })
    )
    expect(initialization.fresh).toBe(false)
  })
})
