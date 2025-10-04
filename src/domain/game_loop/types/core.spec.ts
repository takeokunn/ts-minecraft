import { describe, expect, it } from 'vitest'
import * as Effect from 'effect/Effect'
import * as Either from 'effect/Either'
import * as FastCheck from 'effect/FastCheck'
import * as Schema from 'effect/Schema'
import { pipe } from 'effect/Function'

import {
  DefaultGameLoopConfig,
  FramesPerSecondSchema,
  NonMonotonicTimestamp,
  currentTimestamp,
  fpsToNumber,
  frameCountToNumber,
  makeConfig,
  makeFrameCount,
  makeFrameDuration,
  makeFrameId,
  makeFrameInfo,
  makeFps,
  makeTimestamp,
  reconcileFrameTiming,
  timestampToNumber,
  TimestampSchema,
} from './core'

describe('Game loop core types', () => {
  it('constructs branded values safely', () => {
    const timestamp = pipe(
      makeTimestamp(128),
      Either.getOrElse((error) => {
        throw new Error(Schema.formatError(error))
      })
    )
    expect(timestampToNumber(timestamp)).toBe(128)

    const frameId = pipe(
      makeFrameId('frame_10'),
      Either.getOrElse((error) => {
        throw new Error(Schema.formatError(error))
      })
    )
    expect(frameId).toBe('frame_10')
  })

  it('produces FrameInfo objects', () => {
    const frameInfo = pipe(
      makeFrameInfo({
        frameId: pipe(
          makeFrameId(1),
          Either.getOrElse((error) => {
            throw new Error(Schema.formatError(error))
          })
        ),
        frameCount: pipe(
          makeFrameCount(1),
          Either.getOrElse((error) => {
            throw new Error(Schema.formatError(error))
          })
        ),
        timestamp: pipe(
          makeTimestamp(16),
          Either.getOrElse((error) => {
            throw new Error(Schema.formatError(error))
          })
        ),
        delta: pipe(
          makeFrameDuration(16),
          Either.getOrElse((error) => {
            throw new Error(Schema.formatError(error))
          })
        ),
        fps: pipe(
          makeFps(60),
          Either.getOrElse((error) => {
            throw new Error(Schema.formatError(error))
          })
        ),
        skipped: false,
      }),
      Either.getOrElse((error) => { throw new Error(Schema.formatError(error)) })
    )
    expect(frameCountToNumber(frameInfo.frameCount)).toBe(1)
  })

  it('merges partial config with defaults', () => {
    const config = pipe(
      makeConfig({ maxFrameSkip: 3 }),
      Either.getOrElse((error) => { throw new Error(Schema.formatError(error)) })
    )
    expect(config.maxFrameSkip).toBe(3)
    expect(fpsToNumber(config.targetFps)).toBe(fpsToNumber(DefaultGameLoopConfig.targetFps))
  })

  it('validates fps and skip via FastCheck', async () => {
    await FastCheck.assert(
      FastCheck.property(
        FastCheck.integer({ min: 30, max: 240 }),
        FastCheck.integer({ min: 0, max: 10 }),
        (fps, skip) => {
          const config = pipe(
            makeConfig({
              targetFps: Schema.decodeSync(FramesPerSecondSchema)(fps),
              maxFrameSkip: skip,
            }),
            Either.getOrElse((error) => {
              throw new Error(Schema.formatError(error))
            })
          )
          expect(fpsToNumber(config.targetFps)).toBe(fps)
          expect(config.maxFrameSkip).toBe(skip)
        }
      )
    )
  })

  it('detects non-monotonic timestamps', () => {
    const fps = Schema.decodeSync(FramesPerSecondSchema)(60)
    const previous = pipe(
      makeTimestamp(20),
      Either.getOrElse((error) => {
        throw new Error(Schema.formatError(error))
      })
    )
    const current = pipe(
      makeTimestamp(10),
      Either.getOrElse((error) => {
        throw new Error(Schema.formatError(error))
      })
    )
    const result = reconcileFrameTiming(fps, previous, current)
    expect(result).toStrictEqual(Either.left(NonMonotonicTimestamp({ previous, current })))
  })

  it('produces Effect Clock timestamps', async () => {
    const now = await Effect.runPromise(currentTimestamp)
    expect(timestampToNumber(now)).toBeGreaterThan(0)
  })
})
